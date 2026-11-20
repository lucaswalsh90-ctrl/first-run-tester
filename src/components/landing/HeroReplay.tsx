/**
 * The landing page's hero: a session you can play.
 *
 * A cursor works through a small picture of the sample to-do app: it types two
 * to-dos, stops and wavers at the checkbox, ticks it, then finds the filter.
 * The bars underneath are the real hesitation trace from that session. Point
 * at a bar (or tap it) to jump to that step; "Replay" runs it again.
 *
 * What is real and what is drawn: the steps, the confidence numbers and the
 * problem found all come from the saved test in src/server/sample-run.ts. The
 * to-do app in the frame is a drawing of the app that was tested, and SCENES
 * below says which part of the drawing each real step touches.
 *
 * Rules it keeps (each one came from the app testing itself):
 * - Nothing is hidden behind time. The page is prerendered in its finished
 *   state, and every step and the problem found stay on screen while it plays.
 * - It plays once, when it scrolls into view. Nothing loops.
 * - People who ask for reduced motion get the finished state and can still
 *   step through it by hand.
 */
import { useEffect, useRef, useState } from 'react'
import { HESITATION_BELOW, HesitationTrace } from '../RunView'
import { cn } from '../../lib/utils'
import { SAMPLE_MISSIONS, SAMPLE_SITE, SAMPLE_SUMMARY } from '../../server/sample-run'

const SESSION = SAMPLE_MISSIONS[1] // "Main goal"
const STEPS = SESSION.steps.filter((s) => s.action !== 'done')
const FOUND = SAMPLE_SUMMARY.issues[0]
const LAST = STEPS.length

type Target = 'input' | 'checkbox' | 'filter'

/** What each real step does to the drawing: where the cursor goes, and what it types. */
const SCENES: Record<number, { target: Target; types?: string }> = {
  1: { target: 'input', types: 'Buy milk' },
  2: { target: 'input', types: 'Call mum' },
  3: { target: 'checkbox' },
  4: { target: 'filter' },
}

/** Timings, in milliseconds. */
const MOVE = 650
const KEY = 60
const WAVER = 1600
const SETTLE = 550

type View = {
  /** How many steps have finished: 0 is the empty app, LAST is the end. */
  done: number
  /** The step the cursor is on right now, if any. */
  on: number | null
  typed: string
  wavering: boolean
}

const FINISHED: View = { done: LAST, on: null, typed: '', wavering: false }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function HeroReplay() {
  const [view, setView] = useState<View>(FINISHED)
  const [playing, setPlaying] = useState(false)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  const run = useRef(0)
  const stage = useRef<HTMLDivElement>(null)
  const figure = useRef<HTMLElement>(null)
  const targets = useRef<Record<Target, HTMLElement | null>>({ input: null, checkbox: null, filter: null })

  async function play() {
    const id = ++run.current
    const live = () => run.current === id
    setPlaying(true)
    setView({ done: 0, on: null, typed: '', wavering: false })
    await sleep(500)
    for (const step of STEPS) {
      const n = step.step
      const scene = SCENES[n]
      if (!live()) return
      setView((v) => ({ ...v, on: n, typed: '', wavering: false }))
      await sleep(MOVE)
      if (scene?.types) {
        for (let i = 1; i <= scene.types.length; i++) {
          if (!live()) return
          setView((v) => ({ ...v, typed: scene.types!.slice(0, i) }))
          await sleep(KEY)
        }
        await sleep(250)
      } else if ((step.confidence ?? 1) < HESITATION_BELOW) {
        // The agent was unsure here, so the cursor stops and wavers before it acts.
        setView((v) => ({ ...v, wavering: true }))
        await sleep(WAVER)
      } else {
        await sleep(200)
      }
      if (!live()) return
      setView({ done: n, on: n, typed: '', wavering: false })
      await sleep(SETTLE)
    }
    if (!live()) return
    setView(FINISHED)
    setPlaying(false)
  }

  /** Jump straight to one step. Takes over from a replay in progress. */
  function jump(n: number | null) {
    if (n == null) return
    run.current++
    setPlaying(false)
    const step = STEPS.find((s) => s.step === n)
    setView({ done: n, on: n, typed: '', wavering: (step?.confidence ?? 1) < HESITATION_BELOW })
  }

  // Play once, the first time the picture is on screen.
  useEffect(() => {
    const el = figure.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const seen = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          seen.disconnect()
          void play()
        }
      },
      { threshold: 0.5 },
    )
    seen.observe(el)
    return () => {
      seen.disconnect()
      run.current++
    }
  }, [])

  // Keep the cursor on whatever the current step touches.
  const target = view.on ? SCENES[view.on]?.target : undefined
  useEffect(() => {
    const place = () => {
      const box = stage.current?.getBoundingClientRect()
      const el = target ? targets.current[target] : null
      if (!box || !el) return setCursor(null)
      const r = el.getBoundingClientRect()
      // Aim a little inside the element, the way a hand would.
      const dx = target === 'input' ? Math.min(r.width * 0.3, 90) : r.width / 2
      setCursor({ x: r.left - box.left + dx, y: r.top - box.top + r.height / 2 })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [target, view.done])

  const todos = [view.done >= 1 && 'Buy milk', view.done >= 2 && 'Call mum'].filter(Boolean) as string[]
  const checked = view.done >= 3
  const filtered = view.done >= 4
  const shown = filtered ? todos.filter((t) => t === 'Buy milk') : todos
  const typing = view.typed !== ''
  const current = STEPS.find((s) => s.step === view.on)
  const pct = current?.confidence == null ? null : Math.round(current.confidence * 100)
  const hesitant = current != null && (current.confidence ?? 1) < HESITATION_BELOW
  const finished = view.done === LAST

  return (
    <figure
      ref={figure}
      className="rounded-lg border border-border bg-card p-5 shadow-[0_2px_8px_0_var(--color-border)] sm:p-6"
      aria-label="Replay of an AI newcomer's session on a to-do app"
    >
      <figcaption className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-muted-foreground">
          Asked to: <span className="text-foreground">{SAMPLE_SITE.goal}</span>
        </p>
        <button
          type="button"
          onClick={() => void play()}
          className="shrink-0 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          {playing ? 'Restart' : 'Replay'}
        </button>
      </figcaption>

      {/* The drawing of the app under test. Decorative: the caption below says the same thing in words. */}
      <div
        ref={stage}
        aria-hidden
        className="relative mt-4 select-none overflow-hidden rounded-md border border-border bg-background"
      >
        <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-border" />
          <span className="h-2.5 w-2.5 rounded-full bg-border" />
          <span className="h-2.5 w-2.5 rounded-full bg-border" />
          <span className="ml-2 truncate rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
            {new URL(SAMPLE_SITE.url).hostname}/todomvc
          </span>
        </div>

        <div className="px-5 pb-4 pt-3">
          <p className="text-center text-3xl font-light tracking-tight text-muted-foreground">todos</p>
          <div
            ref={(el) => void (targets.current.input = el)}
            className={cn(
              'mt-2 flex h-10 items-center rounded-md border bg-card px-3 transition-colors',
              typing ? 'border-foreground' : 'border-border',
            )}
          >
            {typing ? (
              <span className="text-foreground">
                {view.typed}
                <span className="ml-px inline-block h-4 w-px translate-y-0.5 bg-foreground" />
              </span>
            ) : (
              <span className="text-muted-foreground">What needs to be done?</span>
            )}
          </div>

          {/* Two rows are always reserved, so the frame never changes height while it plays. */}
          <ul className="mt-1 h-20">
            {shown.map((todo) => {
              const first = todo === 'Buy milk'
              const done = first && checked
              return (
                <li key={todo} className="flex h-10 items-center gap-3 border-b border-border px-1">
                  <span
                    ref={first ? (el) => void (targets.current.checkbox = el) : undefined}
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs transition-colors',
                      done ? 'border-foreground bg-foreground text-background' : 'border-muted-foreground',
                      first && view.wavering && 'border-primary ring-2 ring-primary',
                    )}
                  >
                    {done ? '✓' : ''}
                  </span>
                  <span className={done ? 'text-muted-foreground line-through' : 'text-foreground'}>{todo}</span>
                </li>
              )
            })}
          </ul>

          <div className="flex items-center justify-between pt-2 font-mono text-xs text-muted-foreground">
            <span>
              {todos.length - (checked ? 1 : 0)} {todos.length - (checked ? 1 : 0) === 1 ? 'item' : 'items'} left
            </span>
            <span className="flex items-center gap-1">
              <span className={cn('rounded px-1.5 py-0.5', !filtered && 'border border-border')}>All</span>
              <span className="px-1.5 py-0.5">Active</span>
              <span
                ref={(el) => void (targets.current.filter = el)}
                className={cn('rounded px-1.5 py-0.5', filtered && 'border border-foreground text-foreground')}
              >
                Completed
              </span>
            </span>
          </div>
        </div>

        {cursor && (
          <div
            className="pointer-events-none absolute left-0 top-0 transition-transform ease-out motion-reduce:transition-none"
            style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)`, transitionDuration: `${MOVE - 100}ms` }}
          >
            <div className={view.wavering ? 'cursor-waver' : undefined}>
              <svg width="20" height="22" viewBox="0 0 20 22" className="fill-foreground stroke-background" strokeWidth="1.5">
                <path d="M2 1.5v16.2l4.4-3.9 2.9 6.6 2.9-1.3-2.9-6.5h6.1z" />
              </svg>
              {view.wavering && (
                <span className="absolute -top-9 left-4 whitespace-nowrap rounded-md bg-primary px-2 py-1 font-mono text-xs font-medium text-primary-foreground">
                  {pct}% sure. Is this it?
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* The real trace from this session. Point at a bar to jump to that step. */}
      <div className="mt-5 flex items-end justify-between gap-4">
        <HesitationTrace steps={STEPS} active={view.on} onActive={jump} tall />
        <p className="max-w-[11rem] text-right text-sm text-muted-foreground">
          One bar per step. Shorter means less sure. Point at one.
        </p>
      </div>

      <div className="mt-3 min-h-[4.5rem] rounded-md bg-muted p-3" aria-live="polite">
        {current ? (
          <>
            <p className={cn('font-mono text-sm', hesitant ? 'font-medium text-primary' : 'text-muted-foreground')}>
              Step {current.step} of {LAST} · {pct}% sure{hesitant ? ' · hesitated here' : ''}
            </p>
            <p className="mt-1 line-clamp-2 text-foreground">{current.description}</p>
          </>
        ) : (
          <>
            <p className="font-mono text-sm font-medium uppercase tracking-wider text-primary">
              {finished ? 'Found' : 'Starting'}
            </p>
            <p className="mt-1 font-semibold text-foreground">{finished ? FOUND.title : 'A newcomer opens the app…'}</p>
          </>
        )}
      </div>

      <p className={cn('mt-3 text-muted-foreground transition-opacity', !finished && 'opacity-60')}>
        <span className="font-medium text-foreground">The fix it suggests:</span> {FOUND.change}
      </p>
    </figure>
  )
}
