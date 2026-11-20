/**
 * The live run board.
 *
 * Missions, issues and runs are DeepSpace records, so this page re-renders by
 * itself whenever the server writes to them. While anything is still running,
 * the page asks the server to check on it every few seconds (checkRun); the
 * server pulls finished browser sessions from Apify and writes them as records,
 * which then appear here (and in any other tab showing this run).
 */
import { useEffect, useMemo, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from 'deepspace'
import { callAction } from '@/lib/actions'
import { Elapsed, IssueCard, MissionCard } from '@/components/RunView'
import type { Issue, Mission, Run, Site } from '@/lib/types'
import { RunStatus } from '../home'

const POLL_MS = 4000

export default function RunPage() {
  const { id = '' } = useParams()
  const { records: runs, status, error: runsError } = useQuery<Run>('runs', { orderBy: 'createdAt', orderDir: 'desc' })
  const { records: sites } = useQuery<Site>('sites')
  const { records: missions } = useQuery<Mission>('missions', { where: { runId: id }, orderBy: 'order', orderDir: 'asc' })
  const { records: issues, status: issuesStatus } = useQuery<Issue>('issues', {
    where: { runId: id },
    orderBy: 'severity',
    orderDir: 'asc',
  })

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
  // A failed load is not the same as "this test doesn't exist".
  if (status === 'error') {
    return (
      <p className="p-10 text-sm text-foreground">
        This test couldn't be loaded{runsError ? ` (${runsError})` : ''}. Reload the page to try again.
      </p>
    )
  }
  if (!run) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-muted-foreground">This test doesn't exist, or it isn't yours.</p>
        <Link to="/home" className="mt-3 inline-block text-sm underline">Back to your apps</Link>
      </div>
    )
  }

  const inFlight = run.data.status === 'running' || run.data.status === 'summarizing'
  // Booleans are stored as 0/1, and React prints a bare 0, so convert before using in JSX.
  const isSample = !!run.data.sample

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/home" className="text-sm text-muted-foreground underline-offset-4 hover:underline">← Your apps</Link>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-foreground">
            {site?.data.name ?? 'Test'} {isSample && <span className="text-muted-foreground">(sample)</span>}
          </h1>
          {site && <p className="truncate text-sm text-muted-foreground">{site.data.url}</p>}
          {site && <p className="mt-1 text-sm text-muted-foreground">Newcomer's goal: {site.data.goal}</p>}
        </div>
        <div className="flex items-center gap-3">
          <Elapsed from={run.data.startedAt} to={run.data.finishedAt} />
          <RunStatus status={run.data.status} />
        </div>
      </header>

      {isSample && (
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
          {missions.map((m) => (
            <MissionCard key={m.recordId} mission={m.data} startedAt={run.data.startedAt} sample={!!run.data.sample} />
          ))}
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
        ) : issuesStatus === 'loading' ? (
          <p className="text-sm text-muted-foreground">Loading the fix list…</p>
        ) : issuesStatus === 'error' ? (
          <p className="text-sm text-foreground">The fix list couldn't be loaded. Reload the page to try again.</p>
        ) : issues.length === 0 && run.data.status === 'done' ? (
          <p className="text-sm text-muted-foreground">No problems found. A newcomer got through without getting stuck.</p>
        ) : (
          <ol className="space-y-4">
            {issues.map((issue, n) => (
              <IssueCard
                key={issue.recordId}
                n={n + 1}
                issue={withLiveRetestStatus(issue.data, issue.recordId, retests)}
                onRetest={isSample ? undefined : () => startRetest(issue.recordId)}
                retestHint={isSample ? 'Add your own app to use Retest.' : undefined}
              />
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
    // Browsers slow timers in background tabs, so also check the moment the tab is looked at again.
    const onVisible = () => document.visibilityState === 'visible' && tick()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [key])
}

/** Starts a retest of one issue; resolves with an error message if it could not start. */
async function startRetest(issueId: string): Promise<string | null> {
  const r = await callAction('retestIssue', { issueId })
  return r.success ? null : r.error
}

/**
 * An issue only shows "Retesting" while one of its retest runs is really in
 * flight. If a retest was interrupted and left the label behind, show the
 * issue as open so the button works again.
 */
function withLiveRetestStatus(issue: Issue, issueId: string, retests: Array<{ data: Run }>): Issue {
  if (issue.status !== 'retesting') return issue
  const inFlight = retests.some(
    (r) => r.data.issueId === issueId && (r.data.status === 'running' || r.data.status === 'summarizing'),
  )
  return inFlight ? issue : { ...issue, status: 'open' }
}
