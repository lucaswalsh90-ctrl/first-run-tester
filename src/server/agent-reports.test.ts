/** Unit tests for what a coding agent is told about test reports. No network, no credits. */
import { describe, expect, it } from 'vitest'
import { fixList, listReports } from './agent-reports'

const url = (runId: string) => `https://first-run-tester.app.space/runs/${runId}`

const sites = [
  { recordId: 's1', data: { name: 'My app', url: 'https://my-app.app.space/', goal: 'sign up' } },
  { recordId: 's2', data: { name: 'Other', url: 'https://other.example.com/', goal: 'buy' } },
]
const runs = [
  { recordId: 'old', data: { siteId: 's1', kind: 'full', status: 'done', summary: 'Older.', sample: 0, startedAt: 1000 } },
  { recordId: 'new', data: { siteId: 's1', kind: 'full', status: 'done', summary: 'Newer.', sample: 0, startedAt: 2000 } },
  { recordId: 'retest', data: { siteId: 's1', kind: 'retest', status: 'done', sample: 0, startedAt: 3000 } },
  { recordId: 'running', data: { siteId: 's1', kind: 'full', status: 'running', sample: 0, startedAt: 4000 } },
  { recordId: 'sample', data: { siteId: 's2', kind: 'full', status: 'done', sample: 1, startedAt: 5000 } },
]
const issue = (runId: string, n: number, severity: number, status: string) => ({
  recordId: `${runId}-issue-${n}`,
  data: { runId, severity, status, title: `Problem ${n}`, detail: 'What happened', fixPrompt: `Prompt ${n}`, check: 'Check it' },
})
const issues = [issue('new', 1, 3, 'open'), issue('new', 2, 1, 'still_broken'), issue('new', 3, 2, 'fixed'), issue('old', 1, 2, 'open')]

describe('listReports', () => {
  it('gives each app its latest finished real test, ignoring retests, running tests and samples', () => {
    const [mine, other] = listReports(sites, runs, issues, url)
    expect(mine.latestTest?.runId).toBe('new')
    expect(mine.latestTest?.problems).toEqual({ total: 3, open: 1, fixed: 1, stillBroken: 1 })
    expect(mine.latestTest?.report).toBe('https://first-run-tester.app.space/runs/new')
    expect(other.latestTest).toBeNull()
  })
})

describe('fixList', () => {
  it('finds the latest test by address, however the address is written', () => {
    for (const address of ['https://my-app.app.space', 'my-app.app.space', 'https://my-app.app.space/some/page']) {
      const result = fixList(sites, runs, issues, { url: address }, url)
      expect(result.found && result.runId, address).toBe('new')
    }
  })

  it('lists unfixed problems, most serious first, each with its prompt and check', () => {
    const result = fixList(sites, runs, issues, { url: 'my-app.app.space' }, url)
    if (!result.found) throw new Error('expected a fix list')
    expect(result.issues.map((i) => i.title)).toEqual(['Problem 2', 'Problem 1'])
    expect(result.issues[0]).toMatchObject({ number: 1, severity: 'blocks newcomers', status: 'still_broken', fixPrompt: 'Prompt 2', doneWhen: 'Check it' })
    expect(result.problems.fixed).toBe(1)
  })

  it('can include fixed problems, and can fetch an older test by id', () => {
    const all = fixList(sites, runs, issues, { url: 'my-app.app.space', includeFixed: true }, url)
    expect(all.found && all.issues).toHaveLength(3)
    const older = fixList(sites, runs, issues, { runId: 'old' }, url)
    expect(older.found && older.summary).toBe('Older.')
  })

  it('with no arguments, uses the most recent finished real test of any app', () => {
    const result = fixList(sites, runs, issues, {}, url)
    expect(result.found && result.runId).toBe('new')
  })

  it('says plainly when there is nothing to return', () => {
    expect(fixList(sites, runs, issues, { url: 'unknown.example.org' }, url)).toMatchObject({ found: false, yourApps: expect.any(Array) })
    expect(fixList(sites, runs, issues, { runId: 'nope' }, url)).toMatchObject({ found: false })
    expect(fixList(sites, runs, issues, { url: 'other.example.com' }, url)).toMatchObject({ found: false })
    expect(fixList([], [], [], {}, url)).toMatchObject({ found: false })
  })

  it('tells the agent the notes are a bug report and that it cannot start a retest', () => {
    const result = fixList(sites, runs, issues, {}, url)
    if (!result.found) throw new Error('expected a fix list')
    expect(result.howToUseThis).toContain('bug report')
    expect(result.howToUseThis).toContain('cannot start a retest')
  })
})
