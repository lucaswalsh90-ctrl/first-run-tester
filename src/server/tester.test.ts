/**
 * Unit tests for the pure logic in tester.ts: no network, no credits.
 * The "real run" fixtures are trimmed copies of what Apify and Claude returned
 * on 2026-11-20.
 */
import { describe, expect, it } from 'vitest'
import {
  browserAgentRequest,
  fixPrompt,
  isFinished,
  planFullTest,
  planRetest,
  readBrowserAgentRun,
  readSummary,
  spendCapUsd,
  summaryRequest,
} from './tester'
import { SAMPLE_MISSIONS, SAMPLE_SITE, SAMPLE_SUMMARY } from './sample-run'

const REAL_RUN = {
  status: 'SUCCEEDED',
  items: [
    {
      succeeded: true,
      answer: 'Steps: added two to-dos.',
      data: { steps: 'Added Buy milk. Added Call mum.', confusing: 'The checkbox has no label.', succeeded: true },
      durationSec: 12.5,
      screenshotUrl: 'https://api.apify.com/v2/key-value-stores/x/records/final-screenshot',
      steps: [
        { step: 1, url: 'https://example.com/', action: 'typeenter:e2', description: 'type text', confidence: 0.65 },
        { step: 2, url: 'https://example.com/', action: 'done', description: 'stop', confidence: 0.93 },
      ],
    },
  ],
}

describe('readBrowserAgentRun', () => {
  it('reads a finished run', () => {
    const r = readBrowserAgentRun(REAL_RUN)
    expect(r.status).toBe('done')
    expect(r.succeeded).toBe(true)
    expect(r.steps).toHaveLength(2)
    expect(r.steps[0]).toMatchObject({ step: 1, confidence: 0.65 })
    expect(r.confusing).toBe('The checkbox has no label.')
    expect(r.durationSec).toBe(12.5)
  })

  it('marks a run that did not succeed as failed, without crashing on missing data', () => {
    for (const run of [{ status: 'FAILED' }, { status: 'TIMED-OUT', items: [] }, { status: 'ABORTED', items: [{}] }]) {
      const r = readBrowserAgentRun(run)
      expect(r.status).toBe('failed')
      expect(r.succeeded).toBe(false)
      expect(r.steps).toEqual([])
    }
  })

  it('reads the fixed verdict of a retest', () => {
    const r = readBrowserAgentRun({ status: 'SUCCEEDED', items: [{ data: { fixed: true, why: 'The label is there now.' } }] })
    expect(r.fixed).toBe(true)
    expect(r.confusing).toBe('The label is there now.')
  })

  it('joins list answers into text', () => {
    const r = readBrowserAgentRun({ status: 'SUCCEEDED', items: [{ data: { steps: ['one', 'two'], confusing: ['a', 'b'] } }] })
    expect(r.report).toBe('one\ntwo')
    expect(r.confusing).toBe('a\nb')
  })
})

describe('isFinished', () => {
  it('knows which Apify statuses are final', () => {
    expect(['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].every(isFinished)).toBe(true)
    expect(['READY', 'RUNNING', undefined, null, 42].some(isFinished)).toBe(false)
  })
})

describe('readSummary', () => {
  const reply = (text: string) => ({ content: [{ type: 'thinking', thinking: '' }, { type: 'text', text }] })

  it('reads the JSON reply, skipping thinking blocks', () => {
    const out = readSummary(reply('{"summary":"Went fine.","issues":[{"severity":1,"title":"Stuck","detail":"d","where":"w","change":"c","check":"k"}]}'))
    expect(out.summary).toBe('Went fine.')
    expect(out.issues).toEqual([{ severity: 1, title: 'Stuck', detail: 'd', where: 'w', change: 'c', check: 'k' }])
  })

  it('tolerates prose or code fences around the JSON', () => {
    const out = readSummary(reply('Here you go:\n```json\n{"summary":"ok","issues":[]}\n```'))
    expect(out).toEqual({ summary: 'ok', issues: [] })
  })

  it('caps the list at 6 and repairs odd severities and missing fields', () => {
    const issues = Array.from({ length: 9 }, (_, i) => ({ severity: i === 0 ? 'high' : 3, title: `t${i}` }))
    const out = readSummary(reply(JSON.stringify({ summary: 's', issues })))
    expect(out.issues).toHaveLength(6)
    expect(out.issues[0].severity).toBe(2)
    expect(out.issues[1]).toMatchObject({ severity: 3, title: 't1', detail: '', check: '' })
  })

  it('throws a clear error when there is no JSON', () => {
    expect(() => readSummary(reply('Sorry, I cannot help with that.'))).toThrow(/without JSON/)
    expect(() => readSummary({})).toThrow(/without JSON/)
  })
})

describe('mission plans and requests', () => {
  it('plans two missions for a full test and keeps the agent on the site', () => {
    const plans = planFullTest('https://example.com', 'sign up')
    expect(plans.map((p) => p.title)).toEqual(['First look', 'Main goal'])
    for (const p of plans) {
      expect(p.task).toContain('Do not enter payment details')
      expect(p.maxSteps).toBeLessThanOrEqual(15)
    }
    expect(plans[1].task).toContain('sign up')
  })

  it('asks a retest for a fixed verdict', () => {
    const plan = planRetest('https://example.com', 'sign up', { title: 'No label', check: 'the label shows' })
    expect(plan.outputSchema).toHaveProperty('fixed', 'boolean')
    expect(plan.task).toContain('No label')
  })

  it('sizes the spend cap to the step limit', () => {
    expect(spendCapUsd(6)).toBe(0.11)
    expect(spendCapUsd(15)).toBe(0.2)
    const req = browserAgentRequest('https://example.com', planFullTest('https://example.com', 'x')[0])
    expect(req.maxTotalChargeUsd).toBe(0.11)
    expect(req.input.startUrl).toBe('https://example.com')
  })

  it('builds a fix-list request from the saved sample without throwing', () => {
    const req = summaryRequest(SAMPLE_SITE, SAMPLE_MISSIONS)
    expect(req.model).toBe('claude-haiku-5-5')
    expect(req.messages[0].content).toContain('Mission: First look')
    expect(req.messages[0].content).toContain('Mission: Main goal')
  })
})

describe('fixPrompt', () => {
  it('tells the coding agent to edit the repository and how to know it is done', () => {
    const prompt = fixPrompt(SAMPLE_SITE, SAMPLE_SUMMARY.issues[0])
    expect(prompt).toContain('Make the change directly in this repository')
    expect(prompt).toContain(SAMPLE_SUMMARY.issues[0].title)
    expect(prompt).toContain('Done when:')
  })
})
