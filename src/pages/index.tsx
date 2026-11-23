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
 * Hero: a session you can play. A cursor works through the sample app, wavers
 *   at the control it was unsure of, and the problem it found lands underneath.
 *   Point at a bar of the trace to jump to that step.
 *
 * Style Tile
 * - Color: warm paper off-white dominant, ink text, one vermilion accent kept
 *   for buttons and hesitations; muted everywhere else.
 * - Type: IBM Plex Sans (headings and body) + IBM Plex Mono (numbers, labels).
 *   It is a test report, so it should read like a lab readout: plain and exact.
 * - Theme: light. It is a report you read and mark up, like a proof on paper.
 * - Art direction: modern minimalism. Whitespace, one accent, character from
 *   type and from the trace.
 * - Motion: it shows what happened. The replay plays once and then waits for
 *   you; bars and steps light up when you point at them. Nothing loops.
 * - Voice: second person; plain verbs and no hype words; says what it can't do.
 *
 * This is a STATIC page (top level of src/pages/): no auth fetch, no records
 * WebSocket, prerendered to HTML at build. The live app is behind /home.
 */

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { HeroReplay } from '../components/landing/HeroReplay'
import { Seo } from '../components/Seo'
import { TopBar } from '../components/TopBar'
import { saveLink, takeSignInStarted } from '../lib/prefill'
import { seo } from '../seo'

const HOW = [
  ['Paste your link.', 'Say what a new user should be able to do.'],
  ['Watch it try.', 'Every step shows how sure it was. Low means a newcomer would hesitate.'],
  ['Fix, then retest.', 'Each problem comes with a prompt for your coding agent.'],
]

const FACTS = [
  ['Why not your coding agent', 'It built the app, so it knows where things are. This one starts cold.'],
  ['Your account', 'Sign in to this site with Google or GitHub. Either one creates your free account.'],
  ['What a credit is', 'DeepSpace\'s currency. 100 credits is one US dollar.'],
  ['Apps with sign-in', "Give the tester a throwaway email and password. On your app it can't use Google sign-in or emailed codes."],
  ['Maps and 3D', "The test browser can't draw them, and the report says so."],
]

const BUTTON =
  'inline-flex items-center rounded-md px-5 py-3 text-base font-medium transition-opacity hover:opacity-90'

export default function Landing() {
  const navigate = useNavigate()
  // The platform returns people here after sign-in. If they came from the Create
  // account page, take them on to Your apps, which is where they were headed.
  useEffect(() => {
    if (takeSignInStarted()) navigate('/home', { replace: true })
  }, [navigate])
  const [link, setLink] = useState('')

  /** The link goes with you to the Add app form, so you never type it twice. */
  function start(e: React.FormEvent) {
    e.preventDefault()
    if (link.trim()) saveLink(link)
    navigate('/home')
  }

  return (
    <>
      <Seo {...seo} path="/" />
      <div data-testid="static-landing" className="min-h-screen bg-background">
        <TopBar />

        <main className="mx-auto max-w-6xl px-6">
          <section className="grid items-start gap-12 pb-20 pt-10 lg:grid-cols-[1fr_minmax(0,32rem)] lg:pt-14">
            <div className="lg:pt-6">
              <p className="font-mono text-sm uppercase tracking-wider text-primary">For anyone who just built an app</p>
              <h1 className="mt-4 text-5xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-6xl">
                Watch a stranger use your app.
              </h1>
              <p className="mt-6 max-w-md text-xl text-muted-foreground">
                An AI that has never seen it clicks through in a real browser and shows you where it got stuck.
              </p>

              <form onSubmit={start} className="mt-8 max-w-md">
                <label htmlFor="hero-link" className="text-base font-medium text-foreground">
                  Paste your app's link to start
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    id="hero-link"
                    type="text"
                    inputMode="url"
                    autoComplete="url"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="my-app.app.space"
                    className="min-w-0 flex-1 rounded-md border border-border bg-card px-4 py-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring"
                  />
                  <button type="submit" className={`${BUTTON} bg-primary text-primary-foreground`}>
                    Test your app
                  </button>
                </div>
              </form>
              <div className="mt-3 flex max-w-md flex-wrap items-center gap-x-4 gap-y-2">
                <Link to="/sample" className={`${BUTTON} border border-border bg-card text-foreground`}>
                  See a sample report (no sign-in)
                </Link>
              </div>
              <p className="mt-4 max-w-md text-muted-foreground">
                The sample is free. Your own app costs 60 to 90 credits a test, and a free account has 500 a month.
              </p>
            </div>
            <HeroReplay />
          </section>

          <section className="grid gap-12 border-t border-border py-16 lg:grid-cols-2" aria-labelledby="how">
            <div>
              <h2 id="how" className="font-mono text-sm uppercase tracking-wider text-muted-foreground">
                How it works
              </h2>
              <ol className="mt-6">
                {HOW.map(([title, body], i) => (
                  <li key={title} className="flex gap-5 border-b border-border py-5 first:pt-0 last:border-b-0">
                    <span className="font-mono text-3xl font-medium leading-none text-muted-foreground">{i + 1}</span>
                    <div>
                      <p className="text-xl font-semibold tracking-tight text-foreground">{title}</p>
                      <p className="mt-1 text-lg text-muted-foreground">{body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h2 className="font-mono text-sm uppercase tracking-wider text-muted-foreground">Good to know</h2>
              <dl className="mt-6 rounded-lg border border-border bg-card">
                {FACTS.map(([term, detail]) => (
                  <div key={term} className="grid grid-cols-[9rem_1fr] gap-4 border-b border-border px-5 py-4 last:border-b-0">
                    <dt className="font-mono text-sm uppercase tracking-wider text-muted-foreground">{term}</dt>
                    <dd className="text-foreground">{detail}</dd>
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
          <p className="mx-auto max-w-6xl px-6 py-6 font-mono text-sm text-muted-foreground">
            Built on DeepSpace. Browser agent by Apify. Fix list by Claude.
          </p>
        </footer>
      </div>
    </>
  )
}
