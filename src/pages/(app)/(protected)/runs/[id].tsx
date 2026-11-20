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
import { APP_NAME } from '@/constants'
import { callAction } from '@/lib/actions'
import { AgentHandoff } from '@/components/AgentHandoff'
import { Button } from '@/components/ui'
import { Elapsed, IssueCard, MissionCard, RunStatus } from '@/components/RunView'
import { TestLoginBox } from '@/components/TestLoginBox'
import { GRAPHICS_LIMIT, setAsideTestLimits } from '@/lib/test-limit'
import { completeTestLogin, useTestLogin } from '@/lib/test-login'
import type { Issue, Mission, Run, Site } from '@/lib/types'

const POLL_MS = 4000
const SECTION_LABEL = 'text-2xl font-semibold tracking-tight text-foreground'

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
  // Is a complete test login in this tab's memory for this app? (Never loaded from the server.)
  const typedLogin = useTestLogin(run?.data.siteId ?? '')
  const loginReady = !!typedLogin.email.trim() && !!typedLogin.password

  // Retests started from this page's issues.
  const issueIds = useMemo(() => new Set(issues.map((i) => i.recordId)), [issues])
  const retests = runs.filter((r) => r.data.kind === 'retest' && r.data.issueId && issueIds.has(r.data.issueId))

  // Everything still in flight gets checked every few seconds.
  const active = [run, ...retests]
    .filter((r): r is NonNullable<typeof r> => !!r && (r.data.status === 'running' || r.data.status === 'summarizing'))
    .map((r) => r.recordId)
  usePolling(active)
  useFinishedNotification(run?.data.status, site?.data.name)

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-10" aria-busy="true">
        <div className="h-8 w-64 animate-pulse rounded-md bg-muted" />
        <div className="h-40 animate-pulse rounded-lg bg-muted" />
      </div>
    )
  }
  // A failed load is not the same as "this test doesn't exist".
  if (status === 'error') {
    return (
      <p className="mx-auto max-w-4xl px-4 py-10 text-sm text-foreground">
        This test couldn't be loaded{runsError ? ` (${runsError})` : ''}. Reload the page to try again.
      </p>
    )
  }
  if (!run) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <p className="text-foreground">This test doesn't exist, or it isn't yours.</p>
        <Link to="/home" className="mt-3 inline-block text-sm underline underline-offset-4">Back to your apps</Link>
      </div>
    )
  }

  const inFlight = run.data.status === 'running' || run.data.status === 'summarizing'
  // Booleans are stored as 0/1, and React prints a bare 0, so convert before using in JSX.
  const isSample = !!run.data.sample
  const usedLogin = !!run.data.usedLogin

  // Did the test browser hit its own limit (no graphics card)? Findings that
  // blame that are set aside, so they are never ranked as this app's problems.
  const live = issues.map((i) => ({ ...withLiveRetestStatus(i.data, i.recordId, retests), recordId: i.recordId }))
  const checked = setAsideTestLimits(live, missions.map((m) => m.data))

  const sessions = (
    <section className="mt-12">
      <h2 className={SECTION_LABEL}>{inFlight ? 'Browser sessions' : 'What the newcomer did'}</h2>
      {!inFlight && (
        <p className="mt-1 text-muted-foreground">
          Each bar is one step, and a short bar means the agent was unsure. Point at a bar, or press Replay steps.
        </p>
      )}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {missions.map((m) => (
          <MissionCard key={m.recordId} mission={m.data} startedAt={run.data.startedAt} sample={isSample} />
        ))}
      </div>
    </section>
  )

  const fixList = (
    <section className="mt-12">
      <h2 className={SECTION_LABEL}>Fix list</h2>
      {run.data.summary && <p className="mt-3 max-w-2xl text-lg text-foreground">{run.data.summary}</p>}
      {usedLogin && !isSample && run.data.status === 'done' && issues.length > 0 && (
        <div className="mt-4">
          <p className="text-muted-foreground">
            This test signed in with a test login.{' '}
            {loginReady
              ? 'Retests will sign in with it too.'
              : 'Enter it again here if a retest needs to sign in (it was never saved).'}
          </p>
          {!loginReady && <TestLoginBox siteId={run.data.siteId} open />}
        </div>
      )}
      <div className="mt-4">
        {inFlight ? (
          <p className="text-muted-foreground">
            {run.data.status === 'summarizing'
              ? 'Writing the fix list…'
              : 'The fix list appears once both browser sessions finish.'}
          </p>
        ) : issuesStatus === 'loading' ? (
          <div className="h-24 animate-pulse rounded-lg bg-muted" aria-busy="true" />
        ) : issuesStatus === 'error' ? (
          <p className="text-foreground">The fix list couldn't be loaded. Reload the page to try again.</p>
        ) : (
          <>
            {checked.limited && (
              <div className="mb-4 rounded-lg border border-primary bg-card p-5">
                <h3 className="text-lg font-semibold text-foreground">{GRAPHICS_LIMIT.title}</h3>
                <p className="mt-1 text-foreground">{GRAPHICS_LIMIT.body}</p>
                <p className="mt-2 text-muted-foreground">{GRAPHICS_LIMIT.next}</p>
              </div>
            )}
            {checked.real.length === 0 ? (
              <p className="text-lg text-foreground">
                {checked.limited
                  ? 'Nothing to fix in the parts the test browser could load.'
                  : 'No problems found. A newcomer got through without getting stuck.'}
              </p>
            ) : (
              <>
                <FixMeter issues={checked.real} />
                {site && !isSample && (
                  <AgentHandoff site={site.data} issues={checked.real} appName={APP_NAME} runId={run.recordId} />
                )}
                <ol className="space-y-4">
                  {checked.real.map((issue, n) => (
                    <IssueCard
                      key={issue.recordId}
                      n={n + 1}
                      issue={issue}
                      onRetest={isSample ? undefined : () => startRetest(issue.recordId, run.data.siteId)}
                      retestHint={isSample ? 'Add your own app to use Retest.' : undefined}
                    />
                  ))}
                </ol>
              </>
            )}
            {checked.setAside.length > 0 && (
              <details className="mt-6 rounded-lg border border-border p-4">
                <summary className="cursor-pointer font-medium text-foreground">
                  Set aside: {checked.setAside.length} {checked.setAside.length === 1 ? 'finding' : 'findings'} caused by
                  the test browser, not your app
                </summary>
                <ul className="mt-3 space-y-3">
                  {checked.setAside.map((issue) => (
                    <li key={issue.recordId}>
                      <p className="font-medium text-muted-foreground line-through">{issue.title}</p>
                      <p className="text-muted-foreground">{issue.detail}</p>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </div>
    </section>
  )

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/home" className="font-medium text-foreground underline underline-offset-4">← Back to your apps</Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
        <div className="min-w-0">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">
            {site?.data.name ?? 'Test'} {isSample && <span className="text-muted-foreground">(sample)</span>}
          </h1>
          {site && <p className="mt-1 truncate font-mono text-sm text-muted-foreground">{site.data.url}</p>}
          {site && (
            <p className="mt-3 text-muted-foreground">
              <span className="text-foreground">Newcomer's goal:</span> {site.data.goal}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {usedLogin && <span className="font-mono text-sm text-muted-foreground">test login used</span>}
          <Elapsed from={run.data.startedAt} to={run.data.finishedAt} />
          <RunStatus status={run.data.status} />
        </div>
      </header>

      {inFlight && (
        <div className="mt-6">
          <NotifyWhenDone />
        </div>
      )}
      {isSample && (
        <p className="mt-6 rounded-md bg-muted p-3 text-muted-foreground">
          This replays a real test recorded on Playwright's public to-do demo, so it costs nothing. Results arrive
          as each browser session finishes, just like a live test.
        </p>
      )}
      {run.data.status === 'failed' && (
        <p className="mt-6 rounded-md border border-destructive bg-card p-3 text-foreground">
          {run.data.error ?? 'The test failed.'}
        </p>
      )}

      {/* While it runs, the sessions are the news. Once it's done, the fix list is. */}
      {inFlight ? (
        <>
          {sessions}
          {fixList}
        </>
      ) : (
        <>
          {fixList}
          {sessions}
        </>
      )}
    </div>
  )
}

/**
 * How much of this fix list is done, as a bar that fills when a retest passes.
 * It also says what to do next, which the first click-through found was missing.
 */
function FixMeter({ issues }: { issues: Issue[] }) {
  const total = issues.length
  if (total === 0) return null
  const fixed = issues.filter((i) => i.status === 'fixed').length
  const all = fixed === total
  return (
    <div className="mb-4 rounded-lg bg-muted p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-lg font-semibold text-foreground">
          {all ? `All ${total} fixed` : `${fixed} of ${total} fixed`}
        </p>
        <p className="text-muted-foreground">
          {all
            ? 'A newcomer no longer runs into any of these.'
            : 'Next: hand the list to your coding agent, deploy, then press "I fixed it: retest".'}
        </p>
      </div>
      <div
        className="mt-3 h-2.5 overflow-hidden rounded-full bg-background"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={fixed}
        aria-label="Problems fixed"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${all ? 'bg-success' : 'bg-primary'}`}
          style={{ width: `${Math.max(4, (fixed / total) * 100)}%` }}
        />
      </div>
    </div>
  )
}

/**
 * A test takes about a minute, so people switch tabs. If they have allowed
 * notifications, tell them when it finishes. The email is still sent: that is
 * the lasting record, and this is the tap on the shoulder.
 *
 * It only fires when the status changes while this page is open and the tab is
 * in the background. Opening an old, finished report never notifies.
 */
function useFinishedNotification(status: Run['status'] | undefined, appName: string | undefined) {
  const previous = useRef<Run['status'] | undefined>(undefined)
  useEffect(() => {
    const before = previous.current
    previous.current = status
    const wasRunning = before === 'running' || before === 'summarizing'
    const finished = status === 'done' || status === 'failed'
    if (!wasRunning || !finished) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || !document.hidden) return
    new Notification(status === 'done' ? 'Your first-run test is finished' : 'Your first-run test failed', {
      body:
        status === 'done'
          ? `${appName ?? 'Your app'}: the fix list is ready.`
          : `${appName ?? 'Your app'}: open the tab to see what went wrong.`,
    })
  }, [status, appName])
}

/** Asks for permission only when the person presses the button, never on page load. */
function NotifyWhenDone() {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  )
  if (permission === 'unsupported' || permission === 'denied') return null
  if (permission === 'granted') {
    return <p className="text-muted-foreground">You can switch tabs. You'll get a notification when it's done.</p>
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="outline" onClick={async () => setPermission(await Notification.requestPermission())}>
        Notify me when it's done
      </Button>
      <span className="text-muted-foreground">Tests take about a minute. Keep this tab open.</span>
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
async function startRetest(issueId: string, siteId: string): Promise<string | null> {
  const r = await callAction('retestIssue', { issueId, login: completeTestLogin(siteId) })
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
