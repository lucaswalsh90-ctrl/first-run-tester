/**
 * The pieces of a test report, shared by the live run page (signed in, real
 * data) and the public sample page (no sign-in, saved data).
 *
 * Nothing here talks to the server: the page passes data in and, for Retest,
 * passes a function in.
 */
import { useEffect, useState } from 'react'
import { Badge, Button, useToast } from '@/components/ui'
import { SEVERITY, type Issue, type Mission, type Step } from '@/lib/types'

/** A m:ss clock that ticks until `to` is set. */
export function Elapsed({ from, to }: { from: number; to?: number }) {
  const [now, setNow] = useState(from)
  useEffect(() => {
    if (to) return
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [to])
  const sec = Math.max(0, Math.round(((to ?? now) - from) / 1000))
  return (
    <span className="font-mono text-sm tabular-nums text-muted-foreground">
      {Math.floor(sec / 60)}:{String(sec % 60).padStart(2, '0')}
    </span>
  )
}

/** One line under each session's title, so it is clear the sessions have different jobs. */
const SESSION_JOB: Record<string, string> = {
  'First look': 'Arrives cold with no goal and works out what the site is for.',
  'Main goal': 'Tries to reach the goal with no instructions.',
  Retest: 'Checks one problem again after a fix.',
}

export function MissionCard({ mission, startedAt, sample }: { mission: Mission; startedAt: number; sample: boolean }) {
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
      {SESSION_JOB[mission.title] && (
        <p className="mt-1 text-sm text-muted-foreground">{SESSION_JOB[mission.title]}</p>
      )}
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-muted-foreground">The exact instructions it was given</summary>
        <p className="mt-1 text-xs text-muted-foreground">{mission.task}</p>
      </details>

      {mission.status === 'running' ? (
        <div className="mt-4 space-y-2" aria-live="polite">
          <div className="h-2 w-full overflow-hidden rounded bg-muted">
            <div className="h-full w-1/3 animate-pulse rounded bg-primary/60" />
          </div>
          <p className="text-xs text-muted-foreground">
            {sample
              ? 'Replaying a saved browser session. Its steps appear here in a few seconds.'
              : 'A real browser is open on your app. Steps appear here when this session finishes (usually under a minute).'}{' '}
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
  // The agent's last "step" is it deciding to stop; show that plainly, without a confidence bar.
  const finished = step.action === 'done'
  const c = finished ? null : step.confidence
  const pct = c == null ? null : Math.round(c * 100)
  const hesitant = c != null && c < 0.6
  return (
    <li className="text-sm">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 w-5 shrink-0 text-right font-mono text-xs text-muted-foreground">{step.step}</span>
        <div className="min-w-0 flex-1">
          <p className={finished ? 'text-muted-foreground' : 'text-foreground'}>
            {finished ? 'Stopped and wrote its report.' : step.description}
          </p>
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

/**
 * One problem from the fix list. `onRetest` starts a retest and resolves with
 * an error message if it could not start; leave it out (with `retestHint`) on
 * pages where Retest is not available.
 */
export function IssueCard({
  n,
  issue,
  onRetest,
  retestHint,
}: {
  n: number
  issue: Pick<Issue, 'severity' | 'title' | 'detail' | 'fixPrompt' | 'status' | 'retestNote'>
  onRetest?: () => Promise<string | null>
  retestHint?: string
}) {
  const { success, error } = useToast()
  const [starting, setStarting] = useState(false)
  const sev = SEVERITY[issue.severity] ?? SEVERITY[2]

  async function copy() {
    try {
      await navigator.clipboard.writeText(issue.fixPrompt)
      success('Fix prompt copied', 'Paste it into Claude Code, Cursor or your coding agent.')
    } catch {
      error('Could not copy', 'Open the prompt below, select the text and copy it by hand.')
    }
  }

  async function retest() {
    if (!onRetest) return
    setStarting(true)
    const problem = await onRetest()
    setStarting(false)
    if (problem) error('Could not start the retest', problem)
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

      {issue.retestNote && issue.status !== 'retesting' && (
        <p className="mt-3 text-sm text-muted-foreground">Retest: {issue.retestNote}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={copy}>Copy fix prompt</Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!onRetest || starting || issue.status === 'retesting'}
          title={retestHint ?? 'Re-check this issue after you fixed it (one browser session)'}
          onClick={retest}
        >
          {starting ? 'Starting…' : issue.status === 'retesting' ? 'Retesting…' : 'I fixed it: retest'}
        </Button>
        {!onRetest && retestHint && <span className="text-xs text-muted-foreground">{retestHint}</span>}
      </div>
    </li>
  )
}
