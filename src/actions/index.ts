/**
 * Server actions for the first-run tester.
 *
 * Actions run with record permissions switched off, so every action below
 * loads the record it was given and checks it belongs to the caller before
 * touching anything (see the trust model in src/server/action-routes.ts).
 *
 *   startTest     start a full test of one of your sites (two browser sessions)
 *   startSample   replay a saved real test, free, so anyone can see the app work
 *   checkRun      called by the open run page every few seconds: collects
 *                 finished sessions, then writes the fix list and emails it
 *   retestIssue   re-check one issue after you fixed it
 *
 * Who pays: apify, anthropic and email are billed to the caller
 * (src/integrations.ts), and each person gets a limited number of real runs a day.
 *
 * A run moves through: running -> summarizing -> done, or failed.
 */
import type { ActionHandler, ActionResult, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { RETEST_PASSED, RETEST_STILL_BROKEN } from '../lib/history'
import { GRAPHICS_LIMIT, SIGN_IN_WALL_NOTE, hitSignInWall, setAsideTestLimits } from '../lib/test-limit'
import { isPublicHttpUrl } from '../lib/url'
import { rateIssue } from '../lib/confidence'
import {
  LIMITS,
  browserAgentRequest,
  fixPrompt,
  isFinished,
  planFullTest,
  planRetest,
  readBrowserAgentRun,
  readTestLogin,
  keepWhatWasSeen,
  readSummary,
  reportEmail,
  summaryRequest,
  type DraftIssue,
  type MissionPlan,
  type MissionResult,
  type TestLogin,
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
  summaryTries?: number
  usedLogin?: boolean
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
  confidence?: number
  evidence?: string[]
  unsure?: Array<{ what: string; check: string }>
}

const fail = (error: string): ActionResult<never> => ({ success: false, error })
const status = (value: Run['status']) => ({ success: true as const, data: { status: value } })

/** How long a new run may have no browser sessions recorded before it counts as failed. */
const STARTUP_GRACE_SEC = 90
/** Extra time, past the agent's own time limit, before a silent session is given up on. */
const SESSION_OVERDUE_SEC = LIMITS.missionTimeoutSec + 120
/** A claim older than this was abandoned (the request died), so another request may take over. */
const CLAIM_STALE_SEC = 90

const NEEDS_PUBLIC_LINK =
  'The tester opens your app from the internet, so it needs a public link (not localhost or a private address).'

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

/**
 * Real (paid) runs started by this user in the last 24 hours. Sample runs are
 * left out in the query itself (true/false is stored as 1/0), so watching the
 * free sample many times can't push real runs out of the result.
 */
async function realRunsToday(tools: ActionTools, userId: string): Promise<number> {
  const runs = await queryAll<Run>(tools, 'runs', { createdBy: userId, sample: 0 })
  const since = Date.now() - 24 * 60 * 60 * 1000
  return runs.filter((r) => r.data.startedAt > since).length
}

const overLimit = () =>
  fail(
    `You've reached ${LIMITS.realRunsPerUserPerDay} runs in 24 hours (each test and each retest counts as one). ` +
      'Try again later, or watch the sample.',
  )

/**
 * Starts one browser session at Apify and records it as a running mission.
 * A test login, if given, goes to Apify inside the request and nowhere else:
 * the mission record below holds the instructions, which never contain it.
 */
async function launchMission(
  tools: ActionTools,
  runId: string,
  url: string,
  plan: MissionPlan,
  order: number,
  login?: TestLogin,
) {
  const started = await tools.integration<{ jobId?: string }>('apify/run-actor', browserAgentRequest(url, plan, login))
  const base = { runId, order, title: plan.title, task: plan.task }
  if (!started.success || !started.data?.jobId) {
    const why = started.success ? 'The browser agent did not start.' : started.error
    await tools.create('missions', { ...base, status: 'failed', succeeded: false, steps: [], report: why })
    return { ok: false as const, error: why }
  }
  await tools.create('missions', { ...base, status: 'running', externalId: started.data.jobId })
  return { ok: true as const }
}

/**
 * Step 1 of checkRun: ask about each session that is still running and save
 * any that have finished. Returns the missions with fresh data.
 */
async function collectSessions(tools: ActionTools, run: Row<Run>, missions: Row<Mission>[]) {
  const elapsedSec = (Date.now() - run.data.startedAt) / 1000
  for (const m of missions.filter((x) => x.data.status === 'running')) {
    let result: MissionResult | null = null
    if (run.data.sample) {
      const saved = SAMPLE_MISSIONS[m.data.order]
      if (saved && elapsedSec >= saved.revealAfterSec) result = saved
    } else {
      const r = m.data.externalId
        ? await tools.integration<{ status?: string; items?: Array<Record<string, unknown>> }>('apify/get-run', {
            runId: m.data.externalId,
          })
        : null
      if (r?.success && isFinished(r.data?.status)) {
        result = readBrowserAgentRun(r.data)
      } else if (elapsedSec > SESSION_OVERDUE_SEC) {
        // No answer long after the agent's own time limit: stop waiting so the run can finish.
        result = {
          status: 'failed',
          succeeded: false,
          steps: [],
          report: 'This browser session never reported back, so it was given up on.',
          confusing: '',
          screenshotUrl: '',
          durationSec: 0,
        }
      }
    }
    if (result) {
      await tools.update('missions', m.recordId, { ...result })
      m.data = { ...m.data, ...result }
    }
  }
  return missions
}

/**
 * Step 2 of checkRun: take the claim ticket for finishing this run. The
 * `run_claims` collection allows one row per run, so if two tabs ask at the
 * same moment the database refuses the second and only one writes the fix
 * list and sends the email. A ticket left behind by a request that died is
 * replaced once it is stale.
 */
async function claimRun(tools: ActionTools, runId: string): Promise<boolean> {
  const first = await tools.create('run_claims', { runId, claimedAt: Date.now() })
  if (first.success) return true
  const existing = (await queryAll<{ runId: string; claimedAt: number }>(tools, 'run_claims', { runId }))[0]
  if (!existing) throw new Error(`Could not claim run ${runId}: ${first.error}`)
  if (Date.now() - existing.data.claimedAt < CLAIM_STALE_SEC * 1000) return false
  await tools.remove('run_claims', existing.recordId)
  return (await tools.create('run_claims', { runId, claimedAt: Date.now() })).success
}

async function releaseClaim(tools: ActionTools, runId: string) {
  for (const claim of await queryAll(tools, 'run_claims', { runId })) await tools.remove('run_claims', claim.recordId)
}

/** Finishing a retest: record the agent's verdict on the one issue it checked. */
async function finishRetest(tools: ActionTools, run: Row<Run>, missions: Row<Mission>[]) {
  const result = missions[0]?.data
  // A session that crashed, timed out or gave no verdict checked nothing.
  // Say so and reopen the issue; never report that as "still broken".
  if (!result || result.status !== 'done' || result.fixed == null) {
    const error = "The retest couldn't finish, so nothing was checked. Please retest again."
    if (run.data.issueId) await tools.update('issues', run.data.issueId, { status: 'open', retestNote: error })
    await tools.update('runs', run.recordId, { status: 'failed', error, finishedAt: Date.now() })
    return status('failed')
  }
  const fixed = !!result.fixed // stored as 1/0 once it has been saved
  if (run.data.issueId) {
    await tools.update('issues', run.data.issueId, {
      status: fixed ? 'fixed' : 'still_broken',
      retestNote: result.confusing || result.report || '',
    })
  }
  await tools.update('runs', run.recordId, {
    status: 'done',
    summary: fixed ? RETEST_PASSED : RETEST_STILL_BROKEN,
    finishedAt: Date.now(),
  })
  return status('done')
}

/** Finishing a full test: write the ranked fix list, mark the run done, email the report. */
async function finishFullTest(
  tools: ActionTools,
  run: Row<Run>,
  missions: Row<Mission>[],
  site: Row<Site>,
  userId: string,
  appName: string,
) {
  const sessions = missions.map((m) => ({ ...m.data }))

  let summary: { summary: string; issues: DraftIssue[] }
  if (run.data.sample) {
    summary = SAMPLE_SUMMARY
  } else if (sessions.every((m) => m.status === 'failed')) {
    const error = 'The browser agent could not finish either session. Check that the link opens without a login.'
    await tools.update('runs', run.recordId, { status: 'failed', error, finishedAt: Date.now() })
    return status('failed')
  } else {
    try {
      const ai = await tools.integration('anthropic/chat-completion', summaryRequest(site.data, sessions))
      if (!ai.success) throw new Error(ai.error)
      const read = readSummary(ai.data)
      // Drop any page address or on-screen words the sessions did not record.
      summary = { summary: read.summary, issues: keepWhatWasSeen(read.issues, sessions) }
    } catch (e) {
      // The sessions are already paid for, so try the fix list again on the
      // next check instead of throwing the whole test away.
      const tries = (run.data.summaryTries ?? 0) + 1
      if (tries < LIMITS.summaryTries) {
        await tools.update('runs', run.recordId, { status: 'running', summaryTries: tries })
        await releaseClaim(tools, run.recordId)
        return status('running')
      }
      const error = `The sessions finished, but writing the fix list failed: ${e instanceof Error ? e.message : String(e)}`
      await tools.update('runs', run.recordId, { status: 'failed', error, summaryTries: tries, finishedAt: Date.now() })
      return fail(error)
    }
  }

  // If the test browser could not draw part of the app, findings that blame
  // that are the tester's limit, not the app's bug. They never reach the fix list.
  const checked = setAsideTestLimits(summary.issues, sessions)
  // A run stopped at a sign-in page with no test login has no real fix list,
  // only the sign-in-wall notice. Drop its issues so the report does not list
  // the login screen as the app's own problems.
  const walled = !run.data.usedLogin && hitSignInWall(sessions)
  summary = { summary: summary.summary, issues: walled ? [] : checked.real }

  // Fixed record ids: if this step is ever repeated, it overwrites the same
  // issues instead of adding a second copy of each.
  // How sure the report is about each fix, checked against what the sessions recorded (src/lib/confidence.ts).
  const ratings = summary.issues.map((issue) => rateIssue(issue, sessions))
  for (const [n, issue] of summary.issues.entries()) {
    const rating = ratings[n]
    await tools.create(
      'issues',
      {
        runId: run.recordId,
        siteId: site.recordId,
        severity: issue.severity,
        title: issue.title,
        detail: issue.detail,
        fixPrompt: fixPrompt(site.data, issue, rating),
        check: issue.check,
        status: 'open',
        confidence: rating.confidence,
        evidence: rating.evidence,
        unsure: rating.unsure,
      } satisfies Issue,
      `${run.recordId}-issue-${n + 1}`,
    )
  }
  await tools.update('runs', run.recordId, { status: 'done', summary: summary.summary, finishedAt: Date.now() })

  // Email the report (real runs only). A failed email never fails the run.
  if (!run.data.sample) {
    const me = await tools.get('users', userId)
    const email = me.success ? (me.data as { record?: Row<{ email?: string }> }).record?.data.email : undefined
    if (email) {
      const link = `https://${appName}.app.space/runs/${run.recordId}`
      const sent = await tools.integration('email/send', {
        from: `First-run tester <${appName}@app.space>`,
        to: email,
        subject: `First-run test: ${summary.issues.length} thing(s) a newcomer ran into on ${site.data.name}`,
        text: reportEmail(
          site.data,
          summary.summary,
          summary.issues.map((issue, n) => ({ ...issue, confidence: ratings[n].confidence })),
          link,
          walled
            ? `${SIGN_IN_WALL_NOTE.title}. ${SIGN_IN_WALL_NOTE.body}`
            : checked.limited
              ? `${GRAPHICS_LIMIT.title}. ${GRAPHICS_LIMIT.body}`
              : undefined,
        ),
      })
      if (!sent.success) console.warn(`[checkRun] report email failed: ${sent.error}`)
    }
  }
  return status('done')
}

export const actions: Record<string, ActionHandler<Env>> = {
  startTest: async ({ params, tools, userId }) => {
    const site = await getOwned<Site>(tools, 'sites', params.siteId, userId)
    if (!site) return fail('Site not found.')
    if (!isPublicHttpUrl(site.data.url)) return fail(NEEDS_PUBLIC_LINK)
    const login = readTestLogin(params.login)
    if (login && 'error' in login) return fail(login.error)
    if ((await realRunsToday(tools, userId)) >= LIMITS.realRunsPerUserPerDay) return overLimit()

    const run = await tools.create('runs', {
      siteId: site.recordId,
      kind: 'full',
      status: 'running',
      sample: false,
      usedLogin: !!login,
      startedAt: Date.now(),
    } satisfies Run)
    if (!run.success) return run
    const runId = run.data.recordId

    // Both sessions start now and run side by side, each in a fresh browser.
    // Only the session that pursues the goal gets the login. The first look stays signed out.
    const plans = planFullTest(site.data.url, site.data.goal, !!login)
    const launched = await Promise.all(
      plans.map((plan, i) => launchMission(tools, runId, site.data.url, plan, i, plan.title === 'Main goal' ? login : undefined)),
    )
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
    if (run.data.status === 'done' || run.data.status === 'failed') return status(run.data.status)

    let missions = await queryAll<Mission>(tools, 'missions', { runId: run.recordId })

    // A run is created a moment before its browser sessions are recorded, and an
    // open page can ask about it in that gap. No sessions yet means "still
    // starting", not "all finished" (give up only if none ever show up).
    if (missions.length === 0) {
      const elapsedSec = (Date.now() - run.data.startedAt) / 1000
      if (elapsedSec < STARTUP_GRACE_SEC) return status('running')
      const error = 'The browser sessions never started. Please run the test again.'
      await tools.update('runs', run.recordId, { status: 'failed', error, finishedAt: Date.now() })
      if (run.data.issueId) await tools.update('issues', run.data.issueId, { status: 'open' })
      return status('failed')
    }

    // 1. Save any sessions that have finished since the last check.
    missions = await collectSessions(tools, run, missions)
    if (missions.some((m) => m.data.status === 'running')) return status('running')

    // 2. Every session is in. Only one request gets to finish the run.
    if (!(await claimRun(tools, run.recordId))) return status('summarizing')
    await tools.update('runs', run.recordId, { status: 'summarizing' })

    // 3. Finish it.
    missions.sort((a, b) => a.data.order - b.data.order)
    if (run.data.kind === 'retest') return finishRetest(tools, run, missions)

    const site = await getOwned<Site>(tools, 'sites', run.data.siteId, userId)
    if (!site) {
      const error = 'The app was removed before the test finished.'
      await tools.update('runs', run.recordId, { status: 'failed', error, finishedAt: Date.now() })
      return status('failed')
    }
    return finishFullTest(tools, run, missions, site, userId, env.APP_NAME)
  },

  retestIssue: async ({ params, tools, userId }) => {
    const issue = await getOwned<Issue>(tools, 'issues', params.issueId, userId)
    if (!issue) return fail('Issue not found.')
    // Issues from the free sample belong to someone else's demo app, so there is nothing to fix.
    const foundIn = await getOwned<Run>(tools, 'runs', issue.data.runId, userId)
    if (foundIn?.data.sample) {
      return fail("This issue comes from the sample, which isn't your app to fix. Add your own app to try Retest.")
    }
    const site = await getOwned<Site>(tools, 'sites', issue.data.siteId, userId)
    if (!site) return fail('Site not found.')
    if (!isPublicHttpUrl(site.data.url)) return fail(NEEDS_PUBLIC_LINK)
    const login = readTestLogin(params.login)
    if (login && 'error' in login) return fail(login.error)

    // Refuse only while a retest of this issue is really in flight. Checking the
    // runs themselves (not the issue's label) means a label left on "retesting"
    // by an interrupted retest can't lock the button forever.
    const earlier = await queryAll<Run>(tools, 'runs', { issueId: issue.recordId })
    if (earlier.some((r) => r.data.status === 'running' || r.data.status === 'summarizing')) {
      return fail('A retest is already running for this issue.')
    }
    if ((await realRunsToday(tools, userId)) >= LIMITS.realRunsPerUserPerDay) return overLimit()

    const run = await tools.create('runs', {
      siteId: site.recordId,
      kind: 'retest',
      issueId: issue.recordId,
      status: 'running',
      sample: false,
      usedLogin: !!login,
      startedAt: Date.now(),
    } satisfies Run)
    if (!run.success) return run
    const runId = run.data.recordId
    const plan = planRetest(site.data.url, site.data.goal, issue.data, !!login)
    const launched = await launchMission(tools, runId, site.data.url, plan, 0, login)
    if (!launched.ok) {
      await tools.update('runs', runId, { status: 'failed', error: launched.error, finishedAt: Date.now() })
      return fail(launched.error)
    }
    await tools.update('issues', issue.recordId, { status: 'retesting', retestNote: '' })
    return { success: true, data: { runId } }
  },
}
