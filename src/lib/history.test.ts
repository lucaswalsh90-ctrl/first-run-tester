/** Unit tests for an app's history and fix progress. */
import { describe, expect, it } from 'vitest'
import { RETEST_PASSED, RETEST_STILL_BROKEN, fixProgress, siteHistory } from './history'
import type { Issue, Run } from './types'

const run = (recordId: string, data: Partial<Run>) => ({
  recordId,
  data: { siteId: 'site', kind: 'full', status: 'done', startedAt: 0, ...data } as Run,
})
const issue = (recordId: string, runId: string, title: string, status: Issue['status']) => ({
  recordId,
  data: { runId, siteId: 'site', severity: 2, title, detail: '', fixPrompt: '', check: '', status } as Issue,
})

const runs = [
  run('test-1', { startedAt: 100 }),
  run('retest-a', { kind: 'retest', issueId: 'i1', startedAt: 200, summary: RETEST_PASSED }),
  run('retest-b', { kind: 'retest', issueId: 'i2', startedAt: 300, summary: RETEST_STILL_BROKEN }),
  run('retest-c', { kind: 'retest', issueId: 'i2', startedAt: 400, status: 'running' }),
  run('other', { siteId: 'someone-else', startedAt: 500 }),
]
const issues = [
  issue('i1', 'test-1', 'No label on the button', 'fixed'),
  issue('i2', 'test-1', 'Cost not explained', 'retesting'),
  issue('i3', 'test-1', 'Empty page', 'open'),
]

describe('siteHistory', () => {
  const history = siteHistory(runs, issues, 'site')

  it('lists only this app, newest first', () => {
    expect(history.map((h) => h.id)).toEqual(['retest-c', 'retest-b', 'retest-a', 'test-1'])
  })

  it('names each retest after the problem it checked and says how it went', () => {
    expect(history[0]).toMatchObject({ title: 'Retest: Cost not explained', outcome: 'running' })
    expect(history[1]).toMatchObject({ title: 'Retest: Cost not explained', outcome: 'still_broken' })
    expect(history[2]).toMatchObject({ title: 'Retest: No label on the button', outcome: 'fixed' })
  })

  it('opens the report a retest belongs to', () => {
    expect(history[2].runId).toBe('test-1')
  })

  it('counts what a full test found and how much is fixed', () => {
    expect(history[3]).toMatchObject({ kind: 'test', title: 'Full test', note: '3 found, 1 fixed', outcome: 'done' })
  })

  it('still lists a retest whose problem can no longer be found', () => {
    const orphan = siteHistory([run('r', { kind: 'retest', issueId: 'gone', summary: RETEST_PASSED })], [], 'site')
    expect(orphan[0]).toMatchObject({ title: 'Retest: a problem from an earlier test', outcome: 'fixed', runId: 'r' })
  })
})

describe('fixProgress', () => {
  it('counts fixed problems in the latest finished full test', () => {
    expect(fixProgress(runs, issues, 'site')).toEqual({ runId: 'test-1', total: 3, fixed: 1 })
  })

  it('is null before any test has finished', () => {
    expect(fixProgress([run('t', { status: 'running' })], [], 'site')).toBeNull()
  })
})
