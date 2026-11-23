/** Shapes of the four collections as the browser sees them (see src/schemas/tester-schemas.ts). */

export type Site = { name: string; url: string; goal: string }

export type Run = {
  siteId: string
  kind: 'full' | 'retest'
  issueId?: string
  status: 'running' | 'summarizing' | 'done' | 'failed'
  summary?: string
  error?: string
  usedLogin?: boolean
  sample?: boolean
  startedAt: number
  finishedAt?: number
}

export type Step = {
  step: number
  action: string
  description: string
  confidence: number | null
  url: string
}

export type Mission = {
  runId: string
  order: number
  title: string
  task: string
  status: 'running' | 'done' | 'failed'
  succeeded?: boolean
  steps?: Step[]
  report?: string
  confusing?: string
  screenshotUrl?: string
  durationSec?: number
  fixed?: boolean
}

export type Issue = {
  runId: string
  siteId: string
  severity: 1 | 2 | 3
  title: string
  detail: string
  fixPrompt: string
  check: string
  status: 'open' | 'retesting' | 'fixed' | 'still_broken'
  retestNote?: string
  /** How sure the report is about this fix, 5 to 95 (src/lib/confidence.ts). Missing on reports from before 23 Nov 2026. */
  confidence?: number
  /** What backs the fix, in plain words. */
  evidence?: string[]
  /** What is unclear and what a person should check by hand. */
  unsure?: Array<{ what: string; check: string }>
}

export const SEVERITY = {
  1: { label: 'Blocks newcomers', variant: 'destructive' },
  2: { label: 'Slows newcomers', variant: 'warning' },
  3: { label: 'Polish', variant: 'secondary' },
} as const
