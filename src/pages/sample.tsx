/**
 * Public sample report: no sign-in, no server calls, no credits.
 *
 * Added after the app tested itself and found that "Watch a free sample" sent
 * signed-out newcomers to a sign-in wall. It shows a real, finished test
 * (saved in src/server/sample-run.ts) of someone else's public demo app.
 *
 * The first version "replayed" the report with a delay to feel live. The app's
 * second self-test showed that a visitor who doesn't wait only sees
 * placeholder text and never reaches the fix list, so the whole report is now
 * on the page from the start. It is a static page (top level of src/pages/),
 * so it is also prerendered to HTML at build.
 */
import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { IssueCard, MissionCard } from '../components/RunView'
import { Badge } from '../components/ui'
import type { Mission } from '../lib/types'
import { seo } from '../seo'
import { SAMPLE_MISSIONS, SAMPLE_SITE, SAMPLE_SUMMARY } from '../server/sample-run'
import { fixPrompt, planFullTest } from '../server/tester'

const PLANS = planFullTest(SAMPLE_SITE.url, SAMPLE_SITE.goal)

const MISSIONS: Mission[] = SAMPLE_MISSIONS.map((saved, i) => ({
  runId: 'sample',
  order: i,
  task: PLANS[i]?.task ?? '',
  ...saved,
}))

export default function SamplePage() {
  return (
    <>
      <Seo {...seo} title="Sample first-run test | first-run-tester" path="/sample" />
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Link to="/" className="text-sm text-muted-foreground underline-offset-4 hover:underline">← Back</Link>

        <header className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold text-foreground">A sample report</h1>
          <Badge variant="success">Finished test</Badge>
        </header>

        <div className="mt-4 rounded-md border border-border bg-muted/40 p-4 text-sm text-foreground">
          <p>
            This is a real report from testing <strong>someone else's app</strong>: Playwright's public to-do
            demo at <span className="break-all">{SAMPLE_SITE.url}</span>. It is here so you can see what you
            would get for your own app. Nothing is being charged and you don't need an account.
          </p>
          <p className="mt-2">
            The AI newcomer was asked to: <strong>{SAMPLE_SITE.goal}</strong>.
          </p>
        </div>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-foreground">1. The fix list</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            What the newcomer ran into, most serious first. Open a fix prompt to see what you would paste into
            your coding agent.
          </p>
          <p className="mb-4 mt-3 text-sm text-foreground">{SAMPLE_SUMMARY.summary}</p>
          <ol className="space-y-4">
            {SAMPLE_SUMMARY.issues.map((issue, n) => (
              <IssueCard
                key={issue.title}
                n={n + 1}
                issue={{ ...issue, fixPrompt: fixPrompt(SAMPLE_SITE, issue), status: 'open' }}
                retestHint="Retest works on your own app."
              />
            ))}
          </ol>
        </section>

        <section className="mt-12">
          <h2 className="text-lg font-semibold text-foreground">2. What the newcomer did, step by step</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Two browser sessions ran at the same time. The bar under each step shows how sure the agent was.
            Low numbers mark the places a real newcomer would hesitate.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {MISSIONS.map((m) => (
              <MissionCard key={m.title} mission={m} startedAt={0} sample />
            ))}
          </div>
        </section>

        <footer className="mt-12 rounded-lg border border-border p-5">
          <h2 className="font-medium text-foreground">Try it on your own app</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in with Google or GitHub (either one creates your free DeepSpace account if you're new). A test
            takes about a minute and uses 60 to 90 of your own DeepSpace credits, roughly 60 to 90 US cents. A
            free account comes with 500 credits a month.
          </p>
          <Link
            to="/home"
            className="mt-4 inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Test your app
          </Link>
        </footer>
      </div>
    </>
  )
}
