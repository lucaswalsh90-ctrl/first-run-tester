/* home pattern: product-preview-first — your apps and their test reports; a signed-out visitor sees the same list filled with the sample app */
/**
 * Home: the apps you test and their reports.
 *
 * Signed in: add an app (a public link plus what a newcomer should be able to
 * do), press "Run a first-run test", and you land on the live run page.
 * Signed out: the same screen in preview form, showing the sample app and its
 * report, with sign-in inline. There is no empty sign-in gate, because the
 * app's own first-run test found that a gate gave newcomers nothing to act on.
 *
 * This page sits under (app)/ and outside (protected)/, so it renders for
 * everyone. Only the signed-in half reads or writes data.
 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthOverlay, useAuthStatus, useMutations, useQuery } from 'deepspace'
import { Inbox } from 'lucide-react'
import { TestLoginBox } from '@/components/TestLoginBox'
import { Badge, Button, ConfirmModal, EmptyState, Input, Label, Textarea, useToast } from '@/components/ui'
import { SIGN_IN_COPY } from '@/constants'
import { callAction } from '@/lib/actions'
import { fixProgress, siteHistory, type HistoryEntry } from '@/lib/history'
import { clearLink, readLink, withScheme } from '@/lib/prefill'
import { countedIssues } from '@/lib/test-limit'
import { completeTestLogin, testLoginIsHalfFilled } from '@/lib/test-login'
import type { Issue, Mission, Run, Site } from '@/lib/types'
import { isPublicHttpUrl } from '@/lib/url'
import { cn } from '@/lib/utils'
import { SAMPLE_SITE, SAMPLE_SUMMARY } from '@/server/sample-run'

const CARD = 'rounded-lg border border-border bg-card p-5 shadow-[0_1px_2px_0_rgba(28,25,23,0.04)]'
const SECTION_LABEL = 'font-mono text-sm uppercase tracking-wider text-muted-foreground'

export default function HomePage() {
  const { isSignedIn } = useAuthStatus()
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">Your apps</h1>
        <p className="mt-2 max-w-xl text-lg text-muted-foreground">
          An AI that has never seen your app clicks through it and hands you a fix list.
        </p>
      </header>
      {isSignedIn ? <SignedInHome /> : <PreviewHome />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// The three steps, with "you are here"
// ---------------------------------------------------------------------------

const GUIDE = ['Add your app', 'Run a test', 'Fix and retest']

/**
 * Always says what to do next. Added after the first click-through, where the
 * page had everything on it but no direction.
 */
function Guide({ at }: { at: 1 | 2 | 3 }) {
  return (
    <ol className="mb-10 grid gap-2 sm:grid-cols-3" aria-label="The three steps">
      {GUIDE.map((label, i) => {
        const n = i + 1
        const state = n < at ? 'done' : n === at ? 'now' : 'later'
        return (
          <li
            key={label}
            aria-current={state === 'now' ? 'step' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-lg border px-4 py-3',
              state === 'now' ? 'border-primary bg-card' : 'border-border',
            )}
          >
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-sm font-medium',
                state === 'now' && 'bg-primary text-primary-foreground',
                state === 'done' && 'bg-foreground text-background',
                state === 'later' && 'bg-muted text-muted-foreground',
              )}
            >
              {state === 'done' ? '✓' : n}
            </span>
            <span className={cn('font-medium', state === 'later' ? 'text-muted-foreground' : 'text-foreground')}>
              {label}
            </span>
            {state === 'now' && <span className="sr-only">(you are here)</span>}
          </li>
        )
      })}
    </ol>
  )
}

// ---------------------------------------------------------------------------
// Signed out: the same surface, in preview form
// ---------------------------------------------------------------------------

function PreviewHome() {
  const [showSignIn, setShowSignIn] = useState(false)
  const signIn = () => setShowSignIn(true)
  // A link typed on the landing page is waiting here, and is still here after sign-in.
  const [link] = useState(readLink)

  return (
    <>
      <Guide at={1} />
      <div className={`${CARD} flex flex-wrap items-center justify-between gap-4`}>
        <div>
          <p className="text-lg font-semibold text-foreground">This is a preview.</p>
          <p className="text-muted-foreground">
            {link ? 'Sign in and your link will be waiting in the form.' : 'Sign in to test your own app.'}{' '}
            It's free.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/create-account" className="font-medium text-foreground underline underline-offset-4">
            New here? Create your account
          </Link>
          <Button size="lg" onClick={signIn}>Sign in to start</Button>
        </div>
      </div>

      <section className="mt-10">
        <h2 className={SECTION_LABEL}>Add an app to test</h2>
        <form
          className={`${CARD} mt-3 space-y-4`}
          onSubmit={(e) => {
            e.preventDefault()
            signIn()
          }}
        >
          <SiteFields disabled values={{ url: link, name: '', goal: '' }} />
          <Button type="submit" variant="outline">Sign in to add your app</Button>
        </form>
      </section>

      <section className="mt-10">
        <h2 className={SECTION_LABEL}>Example</h2>
        <ul className="mt-3">
          <li className={CARD}>
            <SiteSummary name={SAMPLE_SITE.name} url={SAMPLE_SITE.url} goal={SAMPLE_SITE.goal} />
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
              <Link to="/sample" className="font-medium text-foreground underline underline-offset-4">
                Open its finished report
              </Link>
              <span className="font-mono text-sm text-muted-foreground">
                {SAMPLE_SUMMARY.issues.length} problems found
              </span>
            </div>
          </li>
        </ul>
      </section>

      {showSignIn && <AuthOverlay {...SIGN_IN_COPY} onClose={() => setShowSignIn(false)} />}
    </>
  )
}

// ---------------------------------------------------------------------------
// Signed in: the real thing
// ---------------------------------------------------------------------------

function SignedInHome() {
  const navigate = useNavigate()
  const { error } = useToast()
  const { records: sites, status, error: sitesError } = useQuery<Site>('sites', { orderBy: 'createdAt', orderDir: 'desc' })
  const { records: runs } = useQuery<Run>('runs', { orderBy: 'createdAt', orderDir: 'desc' })
  const { records: allIssues } = useQuery<Issue>('issues')
  // Sessions are loaded only to spot tests where the test browser hit its own
  // limit, so the counts here match what each report shows.
  const { records: sessions } = useQuery<Mission>('missions')
  const issues = countedIssues(allIssues, sessions)
  const { ready, removeConfirmed } = useMutations<Site>('sites')
  const [busy, setBusy] = useState<string | null>(null)
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null)

  async function start(name: 'startTest' | 'startSample', params: Record<string, unknown>, key: string) {
    setBusy(key)
    const r = await callAction<{ runId: string }>(name, params)
    setBusy(null)
    if (r.success) navigate(`/runs/${r.data.runId}`)
    else error('Could not start the test', r.error)
  }

  // Which of the three steps is next: no app yet, no finished test yet, or fixing.
  const tested = runs.some((r) => r.data.kind === 'full' && r.data.status === 'done' && !r.data.sample)
  const at = sites.length === 0 ? 1 : tested ? 3 : 2

  return (
    <>
      <Guide at={at} />
      <section>
        <h2 className={SECTION_LABEL}>Add an app to test</h2>
        <AddSite />
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between gap-3">
          <h2 className={SECTION_LABEL}>Your apps</h2>
          <Button
            size="sm"
            variant="ghost"
            loading={busy === 'sample'}
            disabled={busy !== null}
            onClick={() => start('startSample', {}, 'sample')}
          >
            Watch a live sample run (free)
          </Button>
        </div>

        {status === 'loading' ? (
          <div className="mt-3 space-y-3" aria-busy="true">
            <div className="h-28 animate-pulse rounded-lg bg-muted" />
            <div className="h-28 animate-pulse rounded-lg bg-muted" />
          </div>
        ) : status === 'error' ? (
          <p className="mt-3 text-foreground">
            Your apps couldn't be loaded{sitesError ? ` (${sitesError})` : ''}. Reload the page to try again.
          </p>
        ) : sites.length === 0 ? (
          <EmptyState
            className={`${CARD} mt-3`}
            icon={<Inbox aria-hidden />}
            title="No apps yet"
            description="Add your app's public link above. Or watch a free sample run first to see what you'd get."
            action={{ label: 'Watch a live sample run', onClick: () => start('startSample', {}, 'sample') }}
          />
        ) : (
          <ul className="mt-3 space-y-4">
            {sites.map((site) => {
              const history = siteHistory(runs, issues, site.recordId)
              const progress = fixProgress(runs, issues, site.recordId)
              // Removing an app mid-test would strand its browser sessions, so wait for it to finish.
              const testing = runs.some(
                (r) => r.data.siteId === site.recordId && (r.data.status === 'running' || r.data.status === 'summarizing'),
              )
              return (
                <li key={site.recordId} className={CARD}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <SiteSummary name={site.data.name} url={site.data.url} goal={site.data.goal} />
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!ready || testing}
                        onClick={() => setRemoving({ id: site.recordId, name: site.data.name })}
                      >
                        {testing ? 'Test running' : 'Remove'}
                      </Button>
                      <Button
                        loading={busy === site.recordId}
                        disabled={busy !== null}
                        onClick={() => {
                          // Don't spend credits on a signed-out test the user didn't mean to run.
                          if (testLoginIsHalfFilled(site.recordId)) {
                            error('Finish the test login', 'Fill in both fields, or clear both to test signed out.')
                            return
                          }
                          void start(
                            'startTest',
                            { siteId: site.recordId, login: completeTestLogin(site.recordId) },
                            site.recordId,
                          )
                        }}
                      >
                        Run a first-run test
                      </Button>
                    </div>
                  </div>

                  <TestLoginBox siteId={site.recordId} />

                  {progress && progress.total > 0 && <FixProgress {...progress} />}
                  <History entries={history} />
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <ConfirmModal
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) {
            removeConfirmed(removing.id).catch((e) => error('Could not remove the app', String(e?.message ?? e)))
          }
          setRemoving(null)
        }}
        title={`Remove ${removing?.name ?? 'this app'}?`}
        description="It disappears from your list, along with the links to its past tests."
        confirmText="Remove"
        variant="destructive"
      />
    </>
  )
}

/** How much of the latest test's fix list is done. The bar fills as retests pass. */
function FixProgress({ runId, fixed, total }: { runId: string; fixed: number; total: number }) {
  const all = fixed === total
  return (
    <Link to={`/runs/${runId}`} className="mt-5 block rounded-md bg-muted p-4 transition-opacity hover:opacity-90">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium text-foreground">
          {all ? 'Every problem from the latest test is fixed' : `${fixed} of ${total} problems fixed`}
        </span>
        <span className="text-sm font-medium text-foreground underline underline-offset-4">
          {all ? 'Open the report' : 'Open the fix list'}
        </span>
      </div>
      <div
        className="mt-3 h-2.5 overflow-hidden rounded-full bg-background"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={fixed}
        aria-label="Problems fixed"
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-500', all ? 'bg-success' : 'bg-primary')}
          style={{ width: `${Math.max(4, (fixed / total) * 100)}%` }}
        />
      </div>
    </Link>
  )
}

const OUTCOME = {
  running: { label: 'Running', variant: 'info' },
  failed: { label: 'Failed', variant: 'destructive' },
  done: { label: 'Done', variant: 'success' },
  fixed: { label: 'Fixed', variant: 'success' },
  still_broken: { label: 'Still broken', variant: 'warning' },
} as const

const WHEN: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
const HISTORY_SHOWN = 4

/**
 * Everything that has happened to this app, newest first: each test, and each
 * retest with the problem it checked. Every row opens the report it belongs to.
 */
function History({ entries }: { entries: HistoryEntry[] }) {
  const [all, setAll] = useState(false)
  if (entries.length === 0) return null
  const shown = all ? entries : entries.slice(0, HISTORY_SHOWN)
  return (
    <div className="mt-5 border-t border-border pt-4">
      <h3 className={SECTION_LABEL}>History</h3>
      <ul className="mt-1">
        {shown.map((entry) => (
          <li key={entry.id}>
            <Link
              to={`/runs/${entry.runId}`}
              className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-muted"
            >
              <span className="min-w-0">
                <span className="block truncate text-foreground">{entry.title}</span>
                <span className="block font-mono text-sm text-muted-foreground">
                  {new Date(entry.at).toLocaleString(undefined, WHEN)}
                  {entry.note ? ` · ${entry.note}` : ''}
                </span>
              </span>
              <Badge variant={OUTCOME[entry.outcome].variant} className="shrink-0 whitespace-nowrap">
                {OUTCOME[entry.outcome].label}
              </Badge>
            </Link>
          </li>
        ))}
      </ul>
      {entries.length > HISTORY_SHOWN && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="mt-1 text-sm font-medium text-foreground underline underline-offset-4"
        >
          {all ? 'Show less' : `Show all ${entries.length}`}
        </button>
      )}
    </div>
  )
}

function SiteSummary({ name, url, goal }: { name: string; url: string; goal: string }) {
  return (
    <div className="min-w-0">
      <p className="text-lg font-semibold text-foreground">{name}</p>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="block truncate font-mono text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        {url}
      </a>
      <p className="mt-2 text-muted-foreground">
        <span className="text-foreground">Goal:</span> {goal}
      </p>
    </div>
  )
}

/** The three inputs for an app. Disabled in the signed-out preview. */
function SiteFields({
  disabled = false,
  values,
  onChange,
}: {
  disabled?: boolean
  values?: { url: string; name: string; goal: string }
  onChange?: (patch: Partial<{ url: string; name: string; goal: string }>) => void
}) {
  const v = values ?? { url: '', name: '', goal: '' }
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="site-url">Public link</Label>
          <Input
            id="site-url"
            disabled={disabled}
            value={v.url}
            onChange={(e) => onChange?.({ url: e.target.value })}
            placeholder="my-app.app.space"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="site-name">Name (optional)</Label>
          <Input
            id="site-name"
            disabled={disabled}
            value={v.name}
            onChange={(e) => onChange?.({ name: e.target.value })}
            placeholder="My app"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="site-goal">What should a brand-new user be able to do?</Label>
        <Textarea
          id="site-goal"
          disabled={disabled}
          maxLength={300}
          value={v.goal}
          onChange={(e) => onChange?.({ goal: e.target.value })}
          rows={2}
          placeholder="Sign up and create their first project"
        />
      </div>
    </>
  )
}

function AddSite() {
  const { ready, createConfirmed } = useMutations<Site>('sites')
  const { success, error } = useToast()
  // Starts with the link typed on the landing page, if there was one.
  const [values, setValues] = useState(() => ({ url: readLink(), name: '', goal: '' }))
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    let link: URL
    try {
      link = new URL(withScheme(values.url))
    } catch {
      error('That link is not valid', 'Use the address people open your app with, like my-app.app.space')
      return
    }
    if (!isPublicHttpUrl(link.toString())) {
      error(
        'That link is not reachable from the internet',
        'The tester runs in the cloud, so it needs a public link (not localhost or a private address).',
      )
      return
    }
    if (!values.goal.trim()) {
      error('Add a goal', 'Say what a brand-new user should be able to do.')
      return
    }
    // Wait for the server to confirm the save before saying it worked.
    setSaving(true)
    try {
      await createConfirmed({
        name: values.name.trim() || link.hostname,
        url: link.toString(),
        goal: values.goal.trim(),
      })
      setValues({ url: '', name: '', goal: '' })
      clearLink()
      success('App added', 'Press "Run a first-run test" when you are ready.')
    } catch (e) {
      error('The app was not saved', e instanceof Error ? e.message : 'Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className={`${CARD} mt-3 space-y-4`}>
      <SiteFields values={values} onChange={(patch) => setValues((v) => ({ ...v, ...patch }))} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-muted-foreground">
          A test uses 60 to 90 of your DeepSpace credits. Needs sign-in? Add a test login after this.
        </p>
        <Button type="submit" size="lg" loading={saving} disabled={!ready}>Add app</Button>
      </div>
    </form>
  )
}
