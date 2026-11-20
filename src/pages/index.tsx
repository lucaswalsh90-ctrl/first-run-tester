/**
 * Landing page: a STATIC page (no auth fetch, no records WebSocket), prerendered
 * to HTML at build so crawlers and link previews read real content. The live
 * app is behind /home.
 */

import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { seo } from '../seo'

const STEPS = [
  {
    title: 'Point it at your app',
    body: 'Paste a public link and say what a brand-new user should be able to do, like "sign up and create a project".',
  },
  {
    title: 'Watch a newcomer try it',
    body: 'An AI agent opens your app in a real browser and clicks through it with no instructions. Every step shows how sure it was, so you can see where it hesitated.',
  },
  {
    title: 'Fix it, then retest',
    body: 'You get a ranked fix list. Each problem comes with a prompt your coding agent can use to edit your repo, and a Retest button to confirm the fix.',
  },
]

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      <div data-testid="static-landing" className="min-h-screen bg-background px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-sm uppercase tracking-widest text-muted-foreground">First-run tester</p>
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Your coding agent knows your app too well to get confused by it.
          </h1>
          <p className="mb-8 max-w-xl text-lg text-muted-foreground">
            This gives you fresh eyes on every release: an AI that uses your app like someone seeing it for the
            first time, and tells you exactly where it got stuck.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/home"
              className="inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Test your app
            </Link>
            <Link
              to="/sample"
              className="inline-flex items-center rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
            >
              See a sample report (no sign-in)
            </Link>
          </div>

          <ul className="mt-6 max-w-xl list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>The sample is free and needs no account.</li>
            <li>
              Testing your own app needs a free DeepSpace account. Sign in with Google or GitHub, and either
              one creates the account if you're new.
            </li>
            <li>
              A test uses 60 to 90 of your own DeepSpace credits, roughly 60 to 90 US cents. A free account
              comes with 500 credits a month.
            </li>
            <li>
              One limit: if your app sits behind Google sign-in or emailed codes, the agent can only test up
              to that point.
            </li>
          </ul>

          <ol className="mt-16 grid gap-6 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-lg border border-border p-5">
                <p className="font-mono text-xs text-muted-foreground">0{i + 1}</p>
                <h2 className="mt-2 font-medium text-foreground">{s.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>

          <p className="mt-16 text-sm text-muted-foreground">
            Built on DeepSpace. The browser agent runs through Apify and the fix list is written by Claude.
          </p>
        </div>
      </div>
    </>
  )
}
