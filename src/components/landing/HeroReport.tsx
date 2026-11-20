/**
 * The landing page's hero visual: a real session from the saved sample test,
 * inking in line by line like a readout, then the problem it led to.
 *
 * It is built from the same data and the same step rows as the real report
 * (see RunView.tsx), so the picture on the front door is the product, not a
 * drawing of it. Motion is CSS only (see .tick-in in styles.css) and switches
 * off for people who ask for reduced motion.
 */
import type { CSSProperties } from 'react'
import { HesitationTrace, StepRow } from '../RunView'
import { SAMPLE_MISSIONS, SAMPLE_SITE, SAMPLE_SUMMARY } from '../../server/sample-run'

const SESSION = SAMPLE_MISSIONS[1] // "Main goal"
const STEPS = SESSION.steps.filter((s) => s.action !== 'done')
const FOUND = SAMPLE_SUMMARY.issues[0]

/** Milliseconds between lines. */
const TICK = 320
const delay = (n: number) => ({ '--tick-delay': `${300 + n * TICK}ms` }) as CSSProperties

export function HeroReport() {
  return (
    <figure
      className="rounded-lg border border-border bg-card p-5 shadow-[0_2px_8px_0_var(--color-border)] sm:p-6"
      aria-label="Example: an AI newcomer's session on a to-do app"
    >
      <figcaption className="flex items-baseline justify-between gap-3 border-b border-border pb-3">
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Session · main goal</span>
        <span className="truncate font-mono text-xs text-muted-foreground">{new URL(SAMPLE_SITE.url).hostname}</span>
      </figcaption>

      <p className="mt-3 text-sm text-muted-foreground">
        Asked to: <span className="text-foreground">{SAMPLE_SITE.goal}</span>
      </p>

      <ol className="mt-4 space-y-2.5">
        {STEPS.map((step, i) => (
          <StepRow key={step.step} step={step} className="tick-in" style={delay(i)} />
        ))}
      </ol>

      <div className="tick-in mt-5 border-t border-border pt-4" style={delay(STEPS.length)}>
        <HesitationTrace steps={STEPS} />
      </div>

      <div className="tick-in mt-4 rounded-md bg-muted p-3" style={delay(STEPS.length + 1)}>
        <p className="font-mono text-xs uppercase tracking-wider text-primary">Found</p>
        <p className="mt-1 text-sm font-semibold text-foreground">{FOUND.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{FOUND.change}</p>
      </div>
    </figure>
  )
}
