/**
 * The pieces of a test report, shared by the live run page (signed in, real
 * data), the public sample page and the landing page's hero.
 *
 * Nothing here talks to the server or imports the DeepSpace SDK: pages pass
 * data in and, for Retest, pass a function in. That keeps the static pages
 * light.
 */
import { useEffect, useState } from 'react'
import { Badge, Button, useToast } from '@/components/ui'
import { cn } from '@/lib/utils'
import { SEVERITY, type Issue, type Mission, type Run, type Step } from '@/lib/types'

/** Below this the agent was unsure, which is where a real newcomer would hesitate. */
const HESITATION_BELOW = 0.6

/** The agent's last "step" is it deciding to stop, so it is left out of traces and bars. */
const realSteps = (steps: Step[]) => steps.filter((s) => s.action !== 'done')

/** The card surface used across the report. */
const CARD = 'rounded-lg border border-border bg-card p-5 shadow-[0_1px_2px_0_rgba(28,25,23,0.04)]'

export function RunStatus({ status }: { status: Run['status'] }) {
  const map = {
    running: { label: 'Testing', variant: 'info' },
    summarizing: { label: 'Writing fix list', variant: 'info' },
    done: { label: 'Done', variant: 'success' },
    failed: { label: 'Failed', variant: 'destructive' },
  } as const
  const s = map[status] ?? map.running
  return <Badge variant={s.variant}>{s.label}</Badge>
}

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

/**
 * The hesitation trace: one bar per step, as tall as the agent was sure.
 * Unsure steps are drawn in the accent colour. It is the whole session at a
 * glance, and the product's signature.
 */
export function HesitationTrace({ steps, className }: { steps: Step[]; className?: string }) {
  const bars = realSteps(steps)
  if (bars.length === 0) return null
  const unsure = bars.filter((s) => s.confidence != null && s.confidence < HESITATION_BELOW).length
  return (
    <div className={className}>
      <div
        className="flex h-10 items-end gap-1"
        role="img"
        aria-label={`${bars.length} steps, ${unsure} where the agent hesitated`}
      >
        {bars.map((s) => {
          const c = s.confidence ?? 1
          return (
            <div
              key={s.step}
              className={cn('w-2.5 rounded-sm', c < HESITATION_BELOW ? 'bg-primary' : 'bg-muted-foreground')}
              style={{ height: `${Math.max(12, Math.round(c * 100))}%` }}
            />
          )
        })}
      </div>
      <p className="mt-1 font-mono text-xs text-muted-foreground">
        {bars.length} {bars.length === 1 ? 'step' : 'steps'} ·{' '}
        {unsure === 0 ? 'no hesitation' : `hesitated at ${unsure}`}
      </p>
    </div>
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
    <article className={CARD}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground">{mission.title}</h3>
          {SESSION_JOB[mission.title] && (
            <p className="mt-0.5 text-sm text-muted-foreground">{SESSION_JOB[mission.title]}</p>
          )}
        </div>
        <span className="shrink-0 whitespace-nowrap">
          {mission.status === 'running' ? (
            <Badge variant="info">Clicking through…</Badge>
          ) : mission.status === 'failed' ? (
            <Badge variant="destructive">Failed</Badge>
          ) : mission.title === 'Retest' ? (
            <Badge variant={mission.fixed ? 'success' : 'warning'}>{mission.fixed ? 'Fixed' : 'Still broken'}</Badge>
          ) : (
            <Badge variant={mission.succeeded ? 'success' : 'warning'}>
              {mission.succeeded ? 'Reached goal' : 'Got stuck'}
            </Badge>
          )}
        </span>
      </div>

      {mission.status === 'running' ? (
        <div className="mt-5 space-y-3" aria-live="polite">
          {/* A greyed-out trace stands in for the one that is on its way. */}
          <div className="flex h-10 items-end gap-1" aria-hidden>
            {[55, 80, 40, 70, 60, 85].map((h, i) => (
              <div key={i} className="w-2.5 animate-pulse rounded-sm bg-muted" style={{ height: `${h}%` }} />
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {sample
              ? 'Replaying a saved browser session. Its steps appear here in a few seconds.'
              : 'A real browser is open on your app. Steps appear here when this session finishes (usually under a minute).'}{' '}
            <Elapsed from={startedAt} />
          </p>
        </div>
      ) : (
        <>
          <HesitationTrace steps={steps} className="mt-5" />
          {steps.length > 0 && (
            <ol className="mt-4 space-y-2.5 border-t border-border pt-4">
              {steps.map((s) => <StepRow key={s.step} step={s} />)}
            </ol>
          )}
          {mission.confusing && (
            <div className="mt-4 rounded-md bg-muted p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">In its own words</p>
              <p className="mt-1 whitespace-pre-line text-sm text-foreground">{mission.confusing}</p>
            </div>
          )}
          {mission.status === 'failed' && mission.report && (
            <p className="mt-3 text-sm text-muted-foreground">{mission.report}</p>
          )}
          {mission.screenshotUrl && (
            <img
              src={mission.screenshotUrl}
              alt={`Last screen the agent saw in ${mission.title}`}
              className="mt-4 w-full rounded-md border border-border"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          )}
          {mission.durationSec ? (
            <p className="mt-3 font-mono text-xs text-muted-foreground">{mission.durationSec} s in the browser</p>
          ) : null}
        </>
      )}

      <details className="mt-4">
        <summary className="cursor-pointer text-xs text-muted-foreground">The exact instructions it was given</summary>
        <p className="mt-1 text-xs text-muted-foreground">{mission.task}</p>
      </details>
    </article>
  )
}

/** One step, with how sure the agent was. Low confidence is marked in the accent colour. */
export function StepRow({ step, className, style }: { step: Step; className?: string; style?: React.CSSProperties }) {
  const finished = step.action === 'done'
  const c = finished ? null : step.confidence
  const pct = c == null ? null : Math.round(c * 100)
  const hesitant = c != null && c < HESITATION_BELOW
  return (
    <li className={cn('flex items-start gap-3 text-sm', className)} style={style}>
      <span className="mt-0.5 w-5 shrink-0 text-right font-mono text-xs text-muted-foreground">{step.step}</span>
      <div className="min-w-0 flex-1">
        <p className={finished ? 'text-muted-foreground' : 'text-foreground'}>
          {finished ? 'Stopped and wrote its report.' : step.description}
        </p>
        {pct != null && (
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
              <div
                className={cn('h-full rounded-full', hesitant ? 'bg-primary' : 'bg-muted-foreground')}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className={cn('font-mono text-xs', hesitant ? 'font-medium text-primary' : 'text-muted-foreground')}>
              {pct}% sure{hesitant ? ' · hesitated here' : ''}
            </span>
          </div>
        )}
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
    <li className={CARD}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 font-mono text-sm text-muted-foreground">{String(n).padStart(2, '0')}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={cn(
                'font-semibold text-foreground',
                issue.status === 'fixed' && 'text-muted-foreground line-through',
              )}
            >
              {issue.title}
            </h3>
            <Badge variant={sev.variant} className="whitespace-nowrap">{sev.label}</Badge>
            {statusBadge}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{issue.detail}</p>

          {issue.retestNote && issue.status !== 'retesting' && (
            <p className="mt-3 border-l-2 border-border pl-3 text-sm text-foreground">
              <span className="font-medium">Retest:</span> {issue.retestNote}
            </p>
          )}

          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-foreground">
              Fix prompt for your coding agent
            </summary>
            <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs text-foreground">
              {issue.fixPrompt}
            </pre>
          </details>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={copy}>Copy fix prompt</Button>
            <Button
              size="sm"
              variant="outline"
              loading={starting}
              disabled={!onRetest || issue.status === 'retesting'}
              onClick={retest}
            >
              {issue.status === 'retesting' ? 'Retesting…' : 'I fixed it: retest'}
            </Button>
            {!onRetest && retestHint && <span className="text-xs text-muted-foreground">{retestHint}</span>}
          </div>
        </div>
      </div>
    </li>
  )
}
