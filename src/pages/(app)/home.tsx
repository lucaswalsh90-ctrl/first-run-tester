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
import { RunStatus } from '@/components/RunView'
import { TestLoginBox } from '@/components/TestLoginBox'
import { Button, ConfirmModal, EmptyState, Input, Label, Textarea, useToast } from '@/components/ui'
import { SIGN_IN_COPY } from '@/constants'
import { callAction } from '@/lib/actions'
import { completeTestLogin, testLoginIsHalfFilled } from '@/lib/test-login'
import type { Issue, Run, Site } from '@/lib/types'
import { isPublicHttpUrl } from '@/lib/url'
import { SAMPLE_SITE, SAMPLE_SUMMARY } from '@/server/sample-run'

const CARD = 'rounded-lg border border-border bg-card p-5 shadow-[0_1px_2px_0_rgba(28,25,23,0.04)]'
const SECTION_LABEL = 'font-mono text-xs uppercase tracking-wider text-muted-foreground'

export default function HomePage() {
  const { isSignedIn } = useAuthStatus()
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Your apps</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Add an app, and an AI that has never seen it clicks through in a real browser. You get a ranked fix list
          and a prompt for your coding agent.
        </p>
      </header>
      {isSignedIn ? <SignedInHome /> : <PreviewHome />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Signed out: the same surface, in preview form
// ---------------------------------------------------------------------------

function PreviewHome() {
  const [showSignIn, setShowSignIn] = useState(false)
  const signIn = () => setShowSignIn(true)

  return (
    <>
      <div className={`${CARD} flex flex-wrap items-center justify-between gap-4`}>
        <div>
          <p className="font-semibold text-foreground">This is a preview.</p>
          <p className="text-sm text-muted-foreground">
            Sign in with Google or GitHub to test your own app. Either one creates your free account.
          </p>
        </div>
        <Button onClick={signIn}>Sign in to start</Button>
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
          <SiteFields disabled />
          <Button type="submit" variant="outline">Sign in to add your app</Button>
        </form>
      </section>

      <section className="mt-10">
        <h2 className={SECTION_LABEL}>Example</h2>
        <ul className="mt-3">
          <li className={CARD}>
            <SiteSummary name={SAMPLE_SITE.name} url={SAMPLE_SITE.url} goal={SAMPLE_SITE.goal} />
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4 text-sm">
              <Link to="/sample" className="font-medium text-foreground underline underline-offset-4">
                Open its finished report
              </Link>
              <span className="font-mono text-xs text-muted-foreground">
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
  const { records: issues } = useQuery<Issue>('issues')
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

  return (
    <>
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
          <p className="mt-3 text-sm text-foreground">
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
              const siteRuns = runs.filter((r) => r.data.siteId === site.recordId && r.data.kind === 'full')
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
                        size="sm"
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

                  {siteRuns.length > 0 && (
                    <ul className="mt-4 border-t border-border pt-2">
                      {siteRuns.slice(0, 5).map((run) => (
                        <li key={run.recordId}>
                          <Link
                            to={`/runs/${run.recordId}`}
                            className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted"
                          >
                            <span className="text-foreground">
                              {new Date(run.data.startedAt).toLocaleString()}
                              {run.data.sample ? ' · sample' : ''}
                            </span>
                            <span className="flex items-center gap-3">
                              <span className="font-mono text-xs text-muted-foreground">
                                {issueCount(issues, run.recordId)}
                              </span>
                              <RunStatus status={run.data.status} />
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
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

/** "5 found · 3 fixed" for one run, from the issues already loaded. */
function issueCount(issues: Array<{ data: Issue }>, runId: string): string {
  const mine = issues.filter((i) => i.data.runId === runId)
  if (mine.length === 0) return ''
  const fixed = mine.filter((i) => i.data.status === 'fixed').length
  return `${mine.length} found${fixed ? ` · ${fixed} fixed` : ''}`
}

function SiteSummary({ name, url, goal }: { name: string; url: string; goal: string }) {
  return (
    <div className="min-w-0">
      <p className="font-semibold text-foreground">{name}</p>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="block truncate font-mono text-xs text-muted-foreground underline-offset-4 hover:underline"
      >
        {url}
      </a>
      <p className="mt-2 text-sm text-muted-foreground">
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
            placeholder="https://my-app.app.space"
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
  const [values, setValues] = useState({ url: '', name: '', goal: '' })
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    let link: URL
    try {
      link = new URL(values.url.trim())
    } catch {
      error('That link is not valid', 'Use the full address, starting with https://')
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
        <p className="max-w-md text-xs text-muted-foreground">
          A test runs two AI browser sessions and uses 60 to 90 of your own DeepSpace credits. If your app needs
          sign-in, add a test login after adding it.
        </p>
        <Button type="submit" loading={saving} disabled={!ready}>Add app</Button>
      </div>
    </form>
  )
}
