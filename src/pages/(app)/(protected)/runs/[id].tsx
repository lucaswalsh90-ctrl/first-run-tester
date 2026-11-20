/**
 * The live run board.
 *
 * Missions, issues and runs are DeepSpace records, so this page re-renders by
 * itself whenever the server writes to them. While anything is still running,
 * the page asks the server to check on it every few seconds (checkRun); the
 * server pulls finished browser sessions from Apify and writes them as records,
 * which then appear here (and in any other tab showing this run).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from 'deepspace'
import { Badge, Button, useToast } from '@/components/ui'
import { callAction } from '@/lib/actions'
import { SEVERITY, type Issue, type Mission, type Run, type Site, type Step } from '@/lib/types'
import { RunStatus } from '../home'

const POLL_MS = 4000

export default function RunPage() {
  const { id = '' } = useParams()
  const { records: runs, status } = useQuery<Run>('runs', { orderBy: 'createdAt', orderDir: 'desc' })
  const { records: sites } = useQuery<Site>('sites')
  const { records: missions } = useQuery<Mission>('missions', { where: { runId: id }, orderBy: 'order', orderDir: 'asc' })
  const { records: issues } = useQuery<Issue>('issues', { where: { runId: id }, orderBy: 'severity', orderDir: 'asc' })

  const run = runs.find((r) => r.recordId === id)
  const site = sites.find((s) => s.recordId === run?.data.siteId)

  // Retests started from this page's issues.
  const issueIds = useMemo(() => new Set(issues.map((i) => i.recordId)), [issues])
  const retests = runs.filter((r) => r.data.kind === 'retest' && r.data.issueId && issueIds.has(r.data.issueId))

  // Everything still in flight gets checked every few seconds.
  const active = [run, ...retests]
    .filter((r): r is NonNullable<typeof r> => !!r && (r.data.status === 'running' || r.data.status === 'summarizing'))
    .map((r) => r.recordId)
  usePolling(active)

  if (status === 'loading') return <p className="p-10 text-sm text-muted-foreground">Loading…</p>
  if (!run) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-muted-foreground">This test doesn't exist, or it isn't yours.</p>
        <Link to="/home" className="mt-3 inline-block text-sm underline">Back to your apps</Link>
      </div>
    )
  }

  const inFlight = run.data.status === 'running' || run.data.status === 'summarizing'

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/home" className="text-sm text-muted-foreground underline-offset-4 hover:underline">← Your apps</Link>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-foreground">
            {site?.data.name ?? 'Test'} {run.data.sample && <span className="text-muted-foreground">(sample)</span>}
          </h1>
          {site && <p className="truncate text-sm text-muted-foreground">{site.data.url}</p>}
          {site && <p className="mt-1 text-sm text-muted-foreground">Newcomer's goal: {site.data.goal}</p>}
        </div>
        <div className="flex items-center gap-3">
          <Elapsed from={run.data.startedAt} to={run.data.finishedAt} />
          <RunStatus status={run.data.status} />
        </div>
      </header>

      {run.data.sample && (
        <p className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          This replays a real test recorded on Playwright's public to-do demo, so it costs nothing. Results arrive
          as each browser session finishes, just like a live test.
        </p>
      )}
      {run.data.status === 'failed' && (
        <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground">
          {run.data.error ?? 'The test failed.'}
        </p>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Browser sessions
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {missions.map((m) => <MissionCard key={m.recordId} mission={m.data} startedAt={run.data.startedAt} />)}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-muted-foreground">Fix list</h2>
        {run.data.summary && <p className="mb-4 text-sm text-foreground">{run.data.summary}</p>}
        {inFlight ? (
          <p className="text-sm text-muted-foreground">
            {run.data.status === 'summarizing'
              ? 'Writing the fix list…'
              : 'The fix list appears once both browser sessions finish.'}
          </p>
        ) : issues.length === 0 && run.data.status === 'done' ? (
          <p className="text-sm text-muted-foreground">No problems found. A newcomer got through without getting stuck.</p>
        ) : (
          <ol className="space-y-4">
            {issues.map((issue, n) => (
              <IssueCard key={issue.recordId} n={n + 1} id={issue.recordId} issue={issue.data} sample={!!run.data.sample} />
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}

/** Calls checkRun for each in-flight run, one request at a time per run. */
function usePolling(runIds: string[]) {
  const inFlight = useRef(new Set<string>())
  const key = runIds.join(',')
  useEffect(() => {
    if (!key) return
    const ids = key.split(',')
    const tick = () => {
      for (const runId of ids) {
        if (inFlight.current.has(runId)) continue
        inFlight.current.add(runId)
        void callAction('checkRun', { runId }).finally(() => inFlight.current.delete(runId))
      }
    }
    tick()
    const timer = setInterval(tick, POLL_MS)
    return () => clearInterval(timer)
  }, [key])
}

function Elapsed({ from, to }: { from: number; to?: number }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (to) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [to])
  const sec = Math.max(0, Math.round(((to ?? now) - from) / 1000))
  return <span className="font-mono text-sm tabular-nums text-muted-foreground">{Math.floor(sec / 60)}:{String(sec % 60).padStart(2, '0')}</span>
}

function MissionCard({ mission, startedAt }: { mission: Mission; startedAt: number }) {
  const steps = mission.steps ?? []
  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium text-foreground">{mission.title}</h3>
        {mission.status === 'running' ? (
          <Badge variant="info">Clicking through…</Badge>
        ) : mission.status === 'failed' ? (
          <Badge variant="destructive">Failed</Badge>
        ) : mission.title === 'Retest' ? (
          <Badge variant={mission.fixed ? 'success' : 'warning'}>{mission.fixed ? 'Fixed' : 'Still broken'}</Badge>
        ) : (
          <Badge variant={mission.succeeded ? 'success' : 'warning'}>{mission.succeeded ? 'Reached goal' : 'Got stuck'}</Badge>
        )}
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-muted-foreground">What the agent was told</summary>
        <p className="mt-1 text-xs text-muted-foreground">{mission.task}</p>
      </details>

      {mission.status === 'running' ? (
        <div className="mt-4 space-y-2" aria-live="polite">
          <div className="h-2 w-full overflow-hidden rounded bg-muted">
            <div className="h-full w-1/3 animate-pulse rounded bg-primary/60" />
          </div>
          <p className="text-xs text-muted-foreground">
            A real browser is open on your app. Steps appear here when this session finishes (usually under a minute).{' '}
            <Elapsed from={startedAt} />
          </p>
        </div>
      ) : (
        <>
          {steps.length > 0 && (
            <ol className="mt-4 space-y-2">
              {steps.map((s) => <StepRow key={s.step} step={s} />)}
            </ol>
          )}
          {mission.confusing && (
            <div className="mt-4 rounded-md bg-muted/50 p-3">
              <p className="text-xs font-medium text-foreground">What confused the agent</p>
              <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{mission.confusing}</p>
            </div>
          )}
          {mission.status === 'failed' && mission.report && (
            <p className="mt-3 text-sm text-muted-foreground">{mission.report}</p>
          )}
          {mission.screenshotUrl && (
            <img
              src={mission.screenshotUrl}
              alt={`Last screen the agent saw in ${mission.title}`}
              className="mt-4 w-full rounded border border-border"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          )}
          {mission.durationSec ? (
            <p className="mt-3 text-xs text-muted-foreground">{steps.length} steps in {mission.durationSec} s</p>
          ) : null}
        </>
      )}
    </article>
  )
}

/** One step, with a bar for how sure the agent was. Low confidence = where a newcomer hesitates. */
function StepRow({ step }: { step: Step }) {
  const c = step.confidence
  const pct = c == null ? null : Math.round(c * 100)
  const hesitant = c != null && c < 0.6
  return (
    <li className="text-sm">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 w-5 shrink-0 text-right font-mono text-xs text-muted-foreground">{step.step}</span>
        <div className="min-w-0 flex-1">
          <p className="text-foreground">{step.description}</p>
          {pct != null && (
            <div className="mt-1 flex items-center gap-2">
              <div className="h-1.5 w-24 overflow-hidden rounded bg-muted">
                <div className={hesitant ? 'h-full bg-warning' : 'h-full bg-success'} style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs text-muted-foreground">
                {pct}% sure{hesitant ? ' (hesitated here)' : ''}
              </span>
            </div>
          )}
        </div>
      </div>
    </li>
  )
}

function IssueCard({ n, id, issue, sample }: { n: number; id: string; issue: Issue; sample: boolean }) {
  const { success, error } = useToast()
  const [starting, setStarting] = useState(false)
  const sev = SEVERITY[issue.severity] ?? SEVERITY[2]

  async function copy() {
    try {
      await navigator.clipboard.writeText(issue.fixPrompt)
      success('Fix prompt copied', 'Paste it into Claude Code, Cursor or your coding agent.')
    } catch {
      error('Could not copy', 'Select the prompt text and copy it by hand.')
    }
  }

  async function retest() {
    setStarting(true)
    const r = await callAction('retestIssue', { issueId: id })
    setStarting(false)
    if (!r.success) error('Could not start the retest', r.error)
  }

  const statusBadge = {
    open: null,
    retesting: <Badge variant="info">Retesting…</Badge>,
    fixed: <Badge variant="success">Fixed</Badge>,
    still_broken: <Badge variant="warning">Still broken</Badge>,
  }[issue.status]

  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm text-muted-foreground">{n}.</span>
        <h3 className="font-medium text-foreground">{issue.title}</h3>
        <Badge variant={sev.variant}>{sev.label}</Badge>
        {statusBadge}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{issue.detail}</p>

      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-medium text-foreground">Fix prompt for your coding agent</summary>
        <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-xs text-foreground">{issue.fixPrompt}</pre>
      </details>

      {issue.retestNote && (issue.status === 'fixed' || issue.status === 'still_broken') && (
        <p className="mt-3 text-sm text-muted-foreground">Retest: {issue.retestNote}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={copy}>Copy fix prompt</Button>
        <Button
          size="sm"
          variant="outline"
          disabled={sample || starting || issue.status === 'retesting'}
          title={sample ? 'Add your own app to use Retest' : 'Re-check this issue after you fixed it (one browser session)'}
          onClick={retest}
        >
          {starting ? 'Starting…' : issue.status === 'retesting' ? 'Retesting…' : 'I fixed it: retest'}
        </Button>
      </div>
    </li>
  )
}
