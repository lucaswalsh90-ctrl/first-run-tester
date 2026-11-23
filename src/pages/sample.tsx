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
import { TopBar } from '../components/TopBar'
import { AgentHandoff } from '../components/AgentHandoff'
import { IssueCard, MissionCard, SeverityKey } from '../components/RunView'
import { Badge } from '../components/ui'
import type { Mission } from '../lib/types'
import { seo } from '../seo'
import { SAMPLE_MISSIONS, SAMPLE_SITE, SAMPLE_SUMMARY } from '../server/sample-run'
import { asExample } from '../lib/handoff'
import { fixPrompt, planFullTest } from '../server/tester'

const PLANS = planFullTest(SAMPLE_SITE.url, SAMPLE_SITE.goal)

/** Every prompt on this page is marked as an example, in what you read and in what you copy. */
const examplePrompt = (issue: (typeof SAMPLE_SUMMARY.issues)[number]) =>
  asExample(fixPrompt(SAMPLE_SITE, issue), SAMPLE_SITE.name)

const MISSIONS: Mission[] = SAMPLE_MISSIONS.map((saved, i) => ({
  runId: 'sample',
  order: i,
  task: PLANS[i]?.task ?? '',
  ...saved,
}))

export default function SamplePage() {
  return (
    <>
      <Seo {...seo} title="A sample report | First-run tester" path="/sample" />
      <TopBar />
      <div className="mx-auto max-w-4xl px-4 py-8">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-4xl font-semibold text-foreground">A sample report</h1>
          <Badge variant="success">Finished test</Badge>
        </header>

        <div className="mt-4 rounded-md bg-muted p-4 text-foreground">
          <p>
            A real report from testing <strong>someone else's app</strong>: Playwright's public to-do demo at{' '}
            <span className="break-all">{SAMPLE_SITE.url}</span>. It's free to look at and needs no account.
          </p>
          <p className="mt-2">
            Two AI newcomers tried it. One just looked around. The other was given a goal:{' '}
            <strong>{SAMPLE_SITE.goal}</strong>.
          </p>
        </div>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-foreground">The fix list</h2>
          <p className="mt-1 text-muted-foreground">
            What the newcomer ran into, most serious first. The fix prompts here are examples: they are about the
            demo app, so there is nothing for your own coding agent to do with them.
          </p>
          <p className="mb-4 mt-3 max-w-2xl text-lg text-foreground">{SAMPLE_SUMMARY.summary}</p>
          <AgentHandoff
            example
            site={SAMPLE_SITE}
            issues={SAMPLE_SUMMARY.issues.map((issue) => ({
              title: issue.title,
              fixPrompt: fixPrompt(SAMPLE_SITE, issue),
              status: 'open' as const,
            }))}
          />
          <SeverityKey />
          <ol className="space-y-4">
            {SAMPLE_SUMMARY.issues.map((issue, n) => (
              <IssueCard
                key={issue.title}
                n={n + 1}
                example
                issue={{ ...issue, fixPrompt: examplePrompt(issue), status: 'open' }}
                retestHint="On your own app, a Retest button here checks this one problem again."
              />
            ))}
          </ol>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-foreground">What the newcomer did</h2>
          <p className="mt-1 text-muted-foreground">
            Each bar is one step, and a short bar means the agent was unsure. Point at a bar, or press Replay
            steps.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {MISSIONS.map((m) => (
              <MissionCard key={m.title} mission={m} startedAt={0} sample />
            ))}
          </div>
        </section>

        <footer className="mt-12 rounded-lg border border-border bg-card p-5">
          <h2 className="text-xl font-semibold text-foreground">Try it on your own app</h2>
          <p className="mt-1 text-muted-foreground">
            Sign in with Google, Microsoft or GitHub. A test takes about a minute and uses 60 to 90 DeepSpace credits
            (60 to 90 US cents). A free account comes with 500 a month.
          </p>
          <Link
            to="/home"
            className="mt-4 inline-flex items-center rounded-md bg-primary px-5 py-3 text-base font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Test your app
          </Link>
        </footer>
      </div>
    </>
  )
}
