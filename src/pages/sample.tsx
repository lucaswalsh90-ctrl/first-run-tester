/**
 * Public sample report: no sign-in, no server calls, no credits.
 *
 * Added after the app tested itself and found that "Watch a free sample" sent
 * signed-out newcomers to a sign-in wall. This page replays the same saved
 * real test (src/server/sample-run.ts) entirely in the browser: the two
 * browser sessions land a few seconds apart, then the fix list appears.
 *
 * It is a static page (top level of src/pages/), so it renders without the
 * DeepSpace providers and is prerendered to HTML at build.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { Elapsed, IssueCard, MissionCard } from '../components/RunView'
import { Badge } from '../components/ui'
import type { Mission } from '../lib/types'
import { seo } from '../seo'
import { SAMPLE_MISSIONS, SAMPLE_SITE, SAMPLE_SUMMARY } from '../server/sample-run'
import { fixPrompt, planFullTest } from '../server/tester'

/** Seconds after page load at which each part appears. */
const REVEAL = { missions: [3, 7], fixList: 9 }

const PLANS = planFullTest(SAMPLE_SITE.url, SAMPLE_SITE.goal)

export default function SamplePage() {
  const [startedAt, setStartedAt] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const start = Date.now()
    setStartedAt(start)
    const t = setInterval(() => {
      const sec = (Date.now() - start) / 1000
      setElapsed(sec)
      if (sec > REVEAL.fixList + 1) clearInterval(t)
    }, 500)
    return () => clearInterval(t)
  }, [])

  const done = elapsed >= REVEAL.fixList
  const missions: Mission[] = SAMPLE_MISSIONS.map((saved, i) => {
    const base = { runId: 'sample', order: i, title: saved.title, task: PLANS[i]?.task ?? '' }
    return elapsed >= REVEAL.missions[i] ? { ...base, ...saved } : { ...base, status: 'running' }
  })

  return (
    <>
      <Seo {...seo} title="Sample first-run test | first-run-tester" path="/sample" />
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Link to="/" className="text-sm text-muted-foreground underline-offset-4 hover:underline">← Back</Link>

        <header className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-foreground">
              Sample test: {SAMPLE_SITE.name}
            </h1>
            <p className="truncate text-sm text-muted-foreground">{SAMPLE_SITE.url}</p>
            <p className="mt-1 text-sm text-muted-foreground">Newcomer's goal: {SAMPLE_SITE.goal}</p>
          </div>
          <div className="flex items-center gap-3">
            {startedAt > 0 && <Elapsed from={startedAt} to={done ? startedAt + REVEAL.fixList * 1000 : undefined} />}
            <Badge variant={done ? 'success' : 'info'}>{done ? 'Done' : 'Testing'}</Badge>
          </div>
        </header>

        <p className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          This replays a real test recorded on Playwright's public to-do demo. Nothing is being charged and you
          don't need an account. A live test of your own app looks the same and usually takes about a minute.
        </p>

        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">Browser sessions</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {missions.map((m) => (
              <MissionCard key={m.title} mission={m} startedAt={startedAt || Date.now()} sample />
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-muted-foreground">Fix list</h2>
          {!done ? (
            <p className="text-sm text-muted-foreground">The fix list appears once both browser sessions finish.</p>
          ) : (
            <>
              <p className="mb-4 text-sm text-foreground">{SAMPLE_SUMMARY.summary}</p>
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
            </>
          )}
        </section>

        <footer className="mt-12 rounded-lg border border-border p-5">
          <h2 className="font-medium text-foreground">Try it on your own app</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in with Google or GitHub (either one creates your account if you're new). A test uses about 60
            to 90 of your own DeepSpace credits; a free DeepSpace account comes with 500 a month.
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
