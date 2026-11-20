/**
 * Design Direction
 *
 * Product: A developer who just shipped pastes their link; an AI that has never
 *   seen the app clicks through it in a real browser and marks where it hesitated.
 * Emotion: The small sting, then relief, of watching a stranger use your thing
 *   for the first time. "Oh. That's where they get lost."
 * Metaphor: A proof sheet handed back by a careful reader, with a mark in the
 *   margin wherever they stumbled.
 * References: an editor's proof marks; a seismograph trace; a lab notebook page.
 * Signature: the hesitation trace. One bar per step, as tall as the agent was
 *   sure, with the unsure steps in vermilion.
 * Hero: a real session ticks in line by line, its bars fill, the trace draws,
 *   and the problem it found lands underneath.
 *
 * Style Tile
 * - Color: warm paper off-white dominant, ink text, one vermilion accent kept
 *   for buttons and hesitations; muted everywhere else.
 * - Type: IBM Plex Sans (headings and body) + IBM Plex Mono (numbers, labels).
 *   It is a test report, so it should read like a lab readout: plain and exact.
 * - Theme: light. It is a report you read and mark up, like a proof on paper.
 * - Art direction: modern minimalism. Whitespace, one accent, character from
 *   type and from the trace.
 * - Motion: mechanical. Lines tick in with linear timing, once. Nothing loops.
 * - Voice: second person; plain verbs and no hype words; says what it can't do.
 *
 * This is a STATIC page (top level of src/pages/): no auth fetch, no records
 * WebSocket, prerendered to HTML at build. The live app is behind /home.
 */

import { Link } from 'react-router-dom'
import { HeroReport } from '../components/landing/HeroReport'
import { Seo } from '../components/Seo'
import { Wordmark } from '../components/Wordmark'
import { seo } from '../seo'

const HOW = [
  ['Paste your link.', 'Say what a new user should be able to do.'],
  ['Watch it try.', 'Every step shows how sure it was. Low means a newcomer would hesitate.'],
  ['Fix, then retest.', 'Each problem comes with a prompt for your coding agent.'],
]

const FACTS = [
  ['The sample', 'Free. No account.'],
  ['Your own app', 'A free DeepSpace account. Sign in with Google or GitHub.'],
  ['Cost', '60 to 90 credits a test, about 60 to 90 cents. 500 a month are free.'],
  ['Sign-in walls', "Give it a throwaway test login. It can't use Google sign-in."],
]

const BUTTON =
  'inline-flex items-center rounded-md px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-90'

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      <div data-testid="static-landing" className="min-h-screen bg-background">
        <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
            <Wordmark />
            First-run tester
          </Link>
          <Link to="/home" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Open the app
          </Link>
        </header>

        <main className="mx-auto max-w-6xl px-6">
          <section className="grid items-start gap-12 pb-20 pt-10 lg:grid-cols-[1fr_minmax(0,30rem)] lg:pt-16">
            <div className="lg:pt-6">
              <p className="font-mono text-xs uppercase tracking-wider text-primary">Fresh eyes for your app</p>
              <h1 className="mt-4 text-5xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-6xl">
                Watch a stranger use your app.
              </h1>
              <p className="mt-6 max-w-md text-lg text-muted-foreground">
                An AI that has never seen it clicks through in a real browser and shows you where it got stuck.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/home" className={`${BUTTON} bg-primary text-primary-foreground`}>
                  Test your app
                </Link>
                <Link to="/sample" className={`${BUTTON} border border-border bg-card text-foreground`}>
                  See a sample report (no sign-in)
                </Link>
              </div>
            </div>
            <HeroReport />
          </section>

          <section className="grid gap-12 border-t border-border py-16 lg:grid-cols-2" aria-labelledby="how">
            <div>
              <h2 id="how" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                How it works
              </h2>
              <ol className="mt-6">
                {HOW.map(([title, body], i) => (
                  <li key={title} className="flex gap-5 border-b border-border py-5 first:pt-0 last:border-b-0">
                    <span className="font-mono text-3xl font-medium leading-none text-muted-foreground">{i + 1}</span>
                    <div>
                      <p className="text-xl font-semibold tracking-tight text-foreground">{title}</p>
                      <p className="mt-1 text-muted-foreground">{body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Good to know</h2>
              <dl className="mt-6 rounded-lg border border-border bg-card">
                {FACTS.map(([term, detail]) => (
                  <div key={term} className="grid grid-cols-[8rem_1fr] gap-4 border-b border-border px-5 py-4 last:border-b-0">
                    <dt className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{term}</dt>
                    <dd className="text-sm text-foreground">{detail}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          <section className="border-t border-border py-16 text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">See where a newcomer gets stuck.</h2>
            <Link to="/home" className={`${BUTTON} mt-6 bg-primary text-primary-foreground`}>
              Test your app
            </Link>
          </section>
        </main>

        <footer className="border-t border-border">
          <p className="mx-auto max-w-6xl px-6 py-6 font-mono text-xs text-muted-foreground">
            Built on DeepSpace. Browser agent by Apify. Fix list by Claude.
          </p>
        </footer>
      </div>
    </>
  )
}
