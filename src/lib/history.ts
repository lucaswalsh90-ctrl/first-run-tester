/**
 * The history of one app: every test and retest, newest first, and how many of
 * the latest test's problems are fixed.
 *
 * Nothing new is stored for this. A full test is already a `runs` record, and
 * so is every retest (with the id of the issue it checked), so the history is
 * just those records read in order. Pure functions: records in, plain rows out.
 */
import type { Issue, Run } from './types'

type Row<T> = { recordId: string; data: T }

/** What a finished retest writes as its run summary (see finishRetest in src/actions). */
export const RETEST_PASSED = 'Retest passed: a newcomer no longer runs into this.'
export const RETEST_STILL_BROKEN = 'Retest: the problem is still there.'

export type HistoryEntry = {
  id: string
  at: number
  kind: 'test' | 'retest'
  /** "Full test", "Sample replay" or "Retest: <problem>". */
  title: string
  /** "5 found, 2 fixed" for a test; empty for a retest. */
  note: string
  outcome: 'running' | 'failed' | 'done' | 'fixed' | 'still_broken'
  /** The report to open: a retest opens the report its problem belongs to. */
  runId: string
}

export function siteHistory(runs: Row<Run>[], issues: Row<Issue>[], siteId: string): HistoryEntry[] {
  return runs
    .filter((r) => r.data.siteId === siteId)
    .sort((a, b) => b.data.startedAt - a.data.startedAt)
    .map((run) => {
      const inFlight = run.data.status === 'running' || run.data.status === 'summarizing'
      const base = { id: run.recordId, at: run.data.startedAt }
      if (run.data.kind === 'retest') {
        const issue = issues.find((i) => i.recordId === run.data.issueId)
        return {
          ...base,
          kind: 'retest' as const,
          title: `Retest: ${issue?.data.title ?? 'a problem from an earlier test'}`,
          note: '',
          outcome: inFlight
            ? ('running' as const)
            : run.data.status === 'failed'
              ? ('failed' as const)
              : run.data.summary === RETEST_PASSED
                ? ('fixed' as const)
                : ('still_broken' as const),
          runId: issue?.data.runId ?? run.recordId,
        }
      }
      const found = issues.filter((i) => i.data.runId === run.recordId)
      const fixed = found.filter((i) => i.data.status === 'fixed').length
      return {
        ...base,
        kind: 'test' as const,
        title: run.data.sample ? 'Sample replay' : 'Full test',
        note: found.length === 0 ? '' : `${found.length} found${fixed ? `, ${fixed} fixed` : ''}`,
        outcome: inFlight ? ('running' as const) : run.data.status === 'failed' ? ('failed' as const) : ('done' as const),
        runId: run.recordId,
      }
    })
}

/** Fixed-out-of-found for the app's latest finished full test, or null before there is one. */
export function fixProgress(runs: Row<Run>[], issues: Row<Issue>[], siteId: string) {
  const latest = runs
    .filter((r) => r.data.siteId === siteId && r.data.kind === 'full' && r.data.status === 'done')
    .sort((a, b) => b.data.startedAt - a.data.startedAt)[0]
  if (!latest) return null
  const found = issues.filter((i) => i.data.runId === latest.recordId)
  return {
    runId: latest.recordId,
    total: found.length,
    fixed: found.filter((i) => i.data.status === 'fixed').length,
  }
}
