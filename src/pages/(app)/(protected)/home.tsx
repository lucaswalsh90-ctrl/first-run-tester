/**
 * Home: your apps and their test runs.
 *
 * Add an app (a public link plus what a newcomer should be able to do), press
 * "Run a first-run test", and you land on the live run page. "Watch a sample
 * test" replays a saved real test for free.
 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutations, useQuery } from 'deepspace'
import { Badge, Button, ConfirmModal, Input, Label, Textarea, useToast } from '@/components/ui'
import { callAction } from '@/lib/actions'
import type { Run, Site } from '@/lib/types'

export default function HomePage() {
  const navigate = useNavigate()
  const { error } = useToast()
  const { records: sites, status } = useQuery<Site>('sites', { orderBy: 'createdAt', orderDir: 'desc' })
  const { records: runs } = useQuery<Run>('runs', { orderBy: 'createdAt', orderDir: 'desc' })
  const { remove } = useMutations<Site>('sites')
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
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Fresh eyes for your app</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          An AI agent uses your app like a brand-new user, clicking through it in a real browser. You watch
          where it hesitates, get a ranked fix list with a prompt for your coding agent, and retest once you've
          fixed it.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy !== null} onClick={() => start('startSample', {}, 'sample')}>
            {busy === 'sample' ? 'Starting…' : 'Watch a sample test (free)'}
          </Button>
        </div>
      </header>

      <AddSite />

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">Your apps</h2>
        {status === 'loading' ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : sites.length === 0 ? (
          <p className="text-sm text-muted-foreground">No apps yet. Add one above, or watch the sample first.</p>
        ) : (
          <ul className="space-y-3">
            {sites.map((site) => {
              const siteRuns = runs.filter((r) => r.data.siteId === site.recordId && r.data.kind === 'full')
              return (
                <li key={site.recordId} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{site.data.name}</p>
                      <a
                        href={site.data.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-xs text-muted-foreground underline-offset-4 hover:underline"
                      >
                        {site.data.url}
                      </a>
                      <p className="mt-1 text-sm text-muted-foreground">Goal: {site.data.goal}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setRemoving({ id: site.recordId, name: site.data.name })}
                      >
                        Remove
                      </Button>
                      <Button
                        size="sm"
                        disabled={busy !== null}
                        onClick={() => start('startTest', { siteId: site.recordId }, site.recordId)}
                      >
                        {busy === site.recordId ? 'Starting…' : 'Run a first-run test'}
                      </Button>
                    </div>
                  </div>
                  {siteRuns.length > 0 && (
                    <ul className="mt-3 space-y-1 border-t border-border pt-3">
                      {siteRuns.slice(0, 5).map((run) => (
                        <li key={run.recordId} className="flex items-center justify-between text-sm">
                          <Link to={`/runs/${run.recordId}`} className="text-foreground underline-offset-4 hover:underline">
                            {new Date(run.data.startedAt).toLocaleString()}
                            {run.data.sample ? ' (sample)' : ''}
                          </Link>
                          <RunStatus status={run.data.status} />
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
          if (removing) remove(removing.id)
          setRemoving(null)
        }}
        title={`Remove ${removing?.name ?? 'this app'}?`}
        description="It disappears from your list, along with the links to its past tests."
        confirmText="Remove"
        variant="destructive"
      />
    </div>
  )
}

export function RunStatus({ status }: { status: Run['status'] }) {
  const map = {
    running: { label: 'Testing', variant: 'info' },
    summarizing: { label: 'Writing fix list', variant: 'info' },
    done: { label: 'Done', variant: 'success' },
    failed: { label: 'Failed', variant: 'destructive' },
  } as const
  const s = map[status] ?? map.running
  return <Badge variant={s.variant}>{s.label}</Badge>
}

function AddSite() {
  const { create } = useMutations<Site>('sites')
  const { success, error } = useToast()
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [goal, setGoal] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    let link: URL
    try {
      link = new URL(url.trim())
    } catch {
      error('That link is not valid', 'Use the full address, starting with https://')
      return
    }
    if (!goal.trim()) {
      error('Add a goal', 'Say what a brand-new user should be able to do.')
      return
    }
    create({ name: name.trim() || link.hostname, url: link.toString(), goal: goal.trim() })
    setName('')
    setUrl('')
    setGoal('')
    success('App added', 'Press "Run a first-run test" when you are ready.')
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-medium text-foreground">Add an app to test</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="site-url">Public link</Label>
          <Input id="site-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://my-app.app.space" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="site-name">Name (optional)</Label>
          <Input id="site-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My app" />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="site-goal">What should a brand-new user be able to do?</Label>
        <Textarea
          id="site-goal"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={2}
          placeholder="Sign up and create their first project"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Each real test runs two AI browser sessions and costs about 60 to 90 DeepSpace credits from your own account.
        The agent can't get past Google sign-in or verification codes.
      </p>
      <Button type="submit">Add app</Button>
    </form>
  )
}
