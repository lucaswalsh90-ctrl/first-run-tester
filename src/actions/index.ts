/**
 * Server actions for the first-run tester.
 *
 * Actions run with record permissions switched off, so every action below
 * loads the record it was given and checks it belongs to the caller before
 * touching anything (see the trust model in src/server/action-routes.ts).
 *
 *   startTest     start a full test of one of your sites (two browser missions)
 *   startSample   replay a saved real test, free, so anyone can see the app work
 *   checkRun      called by the open run page every few seconds: collects
 *                 finished missions, then writes the fix list and emails it
 *   retestIssue   re-check one issue after you fixed it
 *
 * Who pays: apify, anthropic and email are billed to the caller
 * (src/integrations.ts), and each person gets a few real runs a day.
 */
import type { ActionHandler, ActionResult, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import {
  LIMITS,
  browserAgentRequest,
  fixPrompt,
  isFinished,
  planFullTest,
  planRetest,
  readBrowserAgentRun,
  readSummary,
  reportEmail,
  summaryRequest,
  type MissionPlan,
  type MissionResult,
} from '../server/tester'
import { SAMPLE_MISSIONS, SAMPLE_SITE, SAMPLE_SUMMARY } from '../server/sample-run'

type Row<T> = { recordId: string; data: T; createdBy?: string }

interface Site { name: string; url: string; goal: string }
interface Run {
  siteId: string
  kind: 'full' | 'retest'
  issueId?: string
  status: 'running' | 'summarizing' | 'done' | 'failed'
  summary?: string
  error?: string
  sample?: boolean
  startedAt: number
  finishedAt?: number
}
interface Mission extends Partial<Omit<MissionResult, 'status'>> {
  runId: string
  order: number
  title: string
  task: string
  externalId?: string
  status: 'running' | 'done' | 'failed'
  revealAfterSec?: number
}
interface Issue {
  runId: string
  siteId: string
  severity: number
  title: string
  detail: string
  fixPrompt: string
  check: string
  status: 'open' | 'retesting' | 'fixed' | 'still_broken'
  retestNote?: string
}

const fail = (error: string): ActionResult<never> => ({ success: false, error })

/** Load a record and confirm the caller owns it. */
async function getOwned<T>(tools: ActionTools, collection: string, id: unknown, userId: string): Promise<Row<T> | null> {
  if (typeof id !== 'string' || !id) return null
  const r = await tools.get(collection, id)
  if (!r.success) return null
  const record = (r.data as { record: Row<T> }).record
  return record?.createdBy === userId ? record : null
}

async function queryAll<T>(tools: ActionTools, collection: string, where: Record<string, string | number | boolean>) {
  const r = await tools.query(collection, { where, limit: 200 })
  return r.success ? ((r.data as { records: Row<T>[] }).records ?? []) : []
}

/** Real (paid) runs started by this user in the last 24 hours. */
async function realRunsToday(tools: ActionTools, userId: string): Promise<number> {
  const runs = await queryAll<Run>(tools, 'runs', { createdBy: userId })
  const since = Date.now() - 24 * 60 * 60 * 1000
  return runs.filter((r) => !r.data.sample && r.data.startedAt > since).length
}

function isPublicHttpUrl(value: string): boolean {
  try {
    const u = new URL(value)
    const host = u.hostname
    const local = host === 'localhost' || host.endsWith('.local') || /^(127\.|10\.|192\.168\.|0\.)/.test(host)
    return (u.protocol === 'https:' || u.protocol === 'http:') && !local
  } catch {
    return false
  }
}

/** Starts one browser session at Apify and records it as a running mission. */
async function launchMission(tools: ActionTools, runId: string, url: string, plan: MissionPlan, order: number) {
  const started = await tools.integration<{ jobId?: string }>('apify/run-actor', browserAgentRequest(url, plan))
  const base = { runId, order, title: plan.title, task: plan.task }
  if (!started.success || !started.data?.jobId) {
    const why = started.success ? 'The browser agent did not start.' : started.error
    await tools.create('missions', { ...base, status: 'failed', report: why })
    return { ok: false as const, error: why }
  }
  await tools.create('missions', { ...base, status: 'running', externalId: started.data.jobId })
  return { ok: true as const }
}

export const actions: Record<string, ActionHandler<Env>> = {
  startTest: async ({ params, tools, userId }) => {
    const site = await getOwned<Site>(tools, 'sites', params.siteId, userId)
    if (!site) return fail('Site not found.')
    if (!isPublicHttpUrl(site.data.url)) {
      return fail('The tester opens your app from the internet, so it needs a public link (not localhost).')
    }
    if ((await realRunsToday(tools, userId)) >= LIMITS.realRunsPerUserPerDay) {
      return fail(`You've used today's ${LIMITS.realRunsPerUserPerDay} tests. Try again tomorrow, or watch the sample.`)
    }

    const run = await tools.create('runs', {
      siteId: site.recordId,
      kind: 'full',
      status: 'running',
      sample: false,
      startedAt: Date.now(),
    } satisfies Run)
    if (!run.success) return run
    const runId = run.data.recordId

    // Both missions start now and run side by side, each in a fresh browser.
    const plans = planFullTest(site.data.url, site.data.goal)
    const launched = await Promise.all(plans.map((plan, i) => launchMission(tools, runId, site.data.url, plan, i)))
    if (launched.every((l) => !l.ok)) {
      const error = launched.find((l) => !l.ok)?.error ?? 'The browser agent did not start.'
      await tools.update('runs', runId, { status: 'failed', error, finishedAt: Date.now() })
      return fail(error)
    }
    return { success: true, data: { runId } }
  },

  startSample: async ({ tools, userId }) => {
    // Reuse this user's sample site if they've opened the sample before.
    const existing = (await queryAll<Site>(tools, 'sites', { createdBy: userId, url: SAMPLE_SITE.url }))[0]
    let siteId = existing?.recordId
    if (!siteId) {
      const created = await tools.create('sites', SAMPLE_SITE)
      if (!created.success) return created
      siteId = created.data.recordId
    }
    const run = await tools.create('runs', {
      siteId,
      kind: 'full',
      status: 'running',
      sample: true,
      startedAt: Date.now(),
    } satisfies Run)
    if (!run.success) return run
    const runId = run.data.recordId
    for (const [i, m] of SAMPLE_MISSIONS.entries()) {
      await tools.create('missions', {
        runId,
        order: i,
        title: m.title,
        task: planFullTest(SAMPLE_SITE.url, SAMPLE_SITE.goal)[i]?.task ?? '',
        status: 'running',
        revealAfterSec: m.revealAfterSec,
      } satisfies Mission)
    }
    return { success: true, data: { runId, siteId } }
  },

  checkRun: async ({ params, tools, userId, env }) => {
    const run = await getOwned<Run>(tools, 'runs', params.runId, userId)
    if (!run) return fail('Run not found.')
    if (run.data.status !== 'running') return { success: true, data: { status: run.data.status } }

    // 1. Collect any missions that have finished since the last check.
    const missions = await queryAll<Mission>(tools, 'missions', { runId: run.recordId })
    const elapsedSec = (Date.now() - run.data.startedAt) / 1000
    for (const m of missions.filter((x) => x.data.status === 'running')) {
      let result: MissionResult | null = null
      if (run.data.sample) {
        const saved = SAMPLE_MISSIONS[m.data.order]
        if (saved && elapsedSec >= saved.revealAfterSec) result = saved
      } else if (m.data.externalId) {
        const r = await tools.integration<{ status?: string; items?: Array<Record<string, unknown>> }>(
          'apify/get-run',
          { runId: m.data.externalId },
        )
        if (r.success && isFinished(r.data?.status)) result = readBrowserAgentRun(r.data)
      }
      if (result) {
        await tools.update('missions', m.recordId, { ...result })
        m.data = { ...m.data, ...result }
      }
    }
    if (missions.some((m) => m.data.status === 'running')) {
      return { success: true, data: { status: 'running' } }
    }

    // 2. Every mission is finished: claim the run so a second open tab doesn't repeat this.
    await tools.update('runs', run.recordId, { status: 'summarizing' })
    const site = await getOwned<Site>(tools, 'sites', run.data.siteId, userId)
    if (!site) {
      await tools.update('runs', run.recordId, { status: 'failed', error: 'Site was deleted.', finishedAt: Date.now() })
      return fail('Site was deleted.')
    }
    const finished = missions.map((m) => ({ title: m.data.title, ...(m.data as MissionResult) }))

    // 2a. A retest: the agent already judged whether the issue is fixed.
    if (run.data.kind === 'retest') {
      const result = finished[0]
      const fixed = result?.status === 'done' && result.fixed === true
      if (run.data.issueId) {
        await tools.update('issues', run.data.issueId, {
          status: fixed ? 'fixed' : 'still_broken',
          retestNote: result?.confusing || result?.report || '',
        })
      }
      await tools.update('runs', run.recordId, {
        status: 'done',
        summary: fixed ? 'Retest passed: a newcomer no longer runs into this.' : 'Retest: the problem is still there.',
        finishedAt: Date.now(),
      })
      return { success: true, data: { status: 'done' } }
    }

    // 2b. A full test: turn the missions into a ranked fix list.
    let summary: { summary: string; issues: typeof SAMPLE_SUMMARY.issues }
    if (run.data.sample) {
      summary = SAMPLE_SUMMARY
    } else if (finished.every((m) => m.status === 'failed')) {
      await tools.update('runs', run.recordId, {
        status: 'failed',
        error: 'The browser agent could not finish either mission. Check that the link opens without a login.',
        finishedAt: Date.now(),
      })
      return { success: true, data: { status: 'failed' } }
    } else {
      const ai = await tools.integration('anthropic/chat-completion', summaryRequest(site.data, finished))
      try {
        if (!ai.success) throw new Error(ai.error)
        summary = readSummary(ai.data)
      } catch (e) {
        const error = `The missions finished, but writing the fix list failed: ${e instanceof Error ? e.message : String(e)}`
        await tools.update('runs', run.recordId, { status: 'failed', error, finishedAt: Date.now() })
        return fail(error)
      }
    }

    for (const issue of summary.issues) {
      await tools.create('issues', {
        runId: run.recordId,
        siteId: site.recordId,
        severity: issue.severity,
        title: issue.title,
        detail: issue.detail,
        fixPrompt: fixPrompt(site.data, issue),
        check: issue.check,
        status: 'open',
      } satisfies Issue)
    }
    await tools.update('runs', run.recordId, { status: 'done', summary: summary.summary, finishedAt: Date.now() })

    // 3. Email the report (real runs only). A failed email never fails the run.
    if (!run.data.sample) {
      const me = await tools.get('users', userId)
      const email = me.success ? (me.data as { record?: Row<{ email?: string }> }).record?.data.email : undefined
      if (email) {
        const link = `https://${env.APP_NAME}.app.space/runs/${run.recordId}`
        const sent = await tools.integration('email/send', {
          from: `First-run tester <${env.APP_NAME}@app.space>`,
          to: email,
          subject: `First-run test: ${summary.issues.length} thing(s) a newcomer ran into on ${site.data.name}`,
          text: reportEmail(site.data, summary.summary, summary.issues, link),
        })
        if (!sent.success) console.warn(`[checkRun] report email failed: ${sent.error}`)
      }
    }
    return { success: true, data: { status: 'done' } }
  },

  retestIssue: async ({ params, tools, userId }) => {
    const issue = await getOwned<Issue>(tools, 'issues', params.issueId, userId)
    if (!issue) return fail('Issue not found.')
    if (issue.data.status === 'retesting') return fail('A retest is already running for this issue.')
    const site = await getOwned<Site>(tools, 'sites', issue.data.siteId, userId)
    if (!site) return fail('Site not found.')
    if (site.data.url === SAMPLE_SITE.url) {
      return fail("The sample app isn't yours to fix, so it can't be retested. Add your own app to try Retest.")
    }
    if ((await realRunsToday(tools, userId)) >= LIMITS.realRunsPerUserPerDay) {
      return fail(`You've used today's ${LIMITS.realRunsPerUserPerDay} tests. Try again tomorrow.`)
    }

    const run = await tools.create('runs', {
      siteId: site.recordId,
      kind: 'retest',
      issueId: issue.recordId,
      status: 'running',
      sample: false,
      startedAt: Date.now(),
    } satisfies Run)
    if (!run.success) return run
    const runId = run.data.recordId
    const plan = planRetest(site.data.url, site.data.goal, issue.data)
    const launched = await launchMission(tools, runId, site.data.url, plan, 0)
    if (!launched.ok) {
      await tools.update('runs', runId, { status: 'failed', error: launched.error, finishedAt: Date.now() })
      return fail(launched.error)
    }
    await tools.update('issues', issue.recordId, { status: 'retesting', retestNote: '' })
    return { success: true, data: { runId } }
  },
}
