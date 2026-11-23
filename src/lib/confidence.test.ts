import { describe, expect, it } from 'vitest'
import { SURE_ENOUGH, TOP_SCORE, describeSteps, hedgeIn, rateIssue, readStepRefs, readUnsure, realSteps } from './confidence'
import { fixPrompt, keepWhatWasSeen, readSummary, reportEmail, summaryRequest, type DraftIssue } from '../server/tester'
import { fixList } from '../server/agent-reports'

const sessions = [
  {
    title: 'First look',
    succeeded: true,
    steps: [{ step: 1, description: 'Read the page. It lists a "Packed" filter.', url: 'https://app.example/list', action: '', confidence: null }],
  },
  {
    title: 'Main goal',
    succeeded: false,
    steps: [
      { step: 1, description: 'Typed "Passport" and pressed Enter.', url: 'https://app.example/list', action: '', confidence: null },
      { step: 2, description: 'Clicked the "Packed" filter button.', url: 'https://app.example/list', action: '', confidence: null },
      { step: 3, description: 'Read the page: it still shows unpacked items.', url: 'https://app.example/list', action: '', confidence: null },
    ],
  },
]

const backed: DraftIssue = {
  severity: 2,
  title: 'Packed filter shows the wrong items',
  detail: 'After ticking Passport, the Packed filter showed the unticked items.',
  where: 'Packed filter',
  change: 'Show ticked items under Packed.',
  check: 'Tick one item, click "Packed", and see only that item.',
  search: ['Packed'],
  seenAt: [
    { mission: 'Main goal', step: 2 },
    { mission: 'Main goal', step: 3 },
  ],
}

describe('rateIssue', () => {
  it('gives the top score, and nothing to check by hand, when every check passes', () => {
    const r = rateIssue(backed, sessions)
    expect(r.confidence).toBe(TOP_SCORE)
    expect(r.confidence).toBeGreaterThanOrEqual(SURE_ENOUGH)
    expect(r.unsure).toEqual([])
    expect(r.evidence.join(' ')).toContain('Main goal steps 2 and 3 on https://app.example/list')
    expect(r.evidence.join(' ')).toContain('"Packed"')
  })

  it('without a recorded step, says so and tells the person to try it themselves', () => {
    const r = rateIssue({ ...backed, seenAt: [] }, sessions)
    expect(r.confidence).toBeLessThan(SURE_ENOUGH)
    expect(r.unsure.map((u) => u.what).join(' ')).toMatch(/does not point to a recorded step/)
    expect(r.unsure.every((u) => u.check.length > 0)).toBe(true)
  })

  it('without exact words, says the code has nothing to be searched by', () => {
    const r = rateIssue({ ...backed, search: [] }, sessions)
    expect(r.confidence).toBe(TOP_SCORE - 15)
    expect(r.unsure[0].what).toMatch(/quoted no words/)
  })

  it('counts a problem seen once as unconfirmed, unless it stopped the newcomer', () => {
    const once = { ...backed, seenAt: [{ mission: 'Main goal', step: 2 }] }
    expect(rateIssue(once, sessions).unsure[0].what).toMatch(/Seen once/)
    // Severity 1 at a step of a session that did not reach its goal is confirmed by that.
    const blocking = rateIssue({ ...once, severity: 1 }, sessions)
    expect(blocking.confidence).toBe(TOP_SCORE)
    expect(blocking.evidence).toContain('It kept the newcomer from reaching the goal')
    // A session that reached its goal confirms nothing.
    const firstLook = rateIssue({ ...once, severity: 1, seenAt: [{ mission: 'First look', step: 1 }] }, sessions)
    expect(firstLook.confidence).toBe(TOP_SCORE - 15)
  })

  it('accepts one exact sighting of what a page says, but not of something that did not work', () => {
    const once = { ...backed, seenAt: [{ mission: 'First look', step: 1 }] }
    expect(rateIssue({ ...once, kind: 'wording' as const, title: 'The "Packed" filter has no explanation' }, sessions).confidence).toBe(TOP_SCORE)
    // Labelled wording, but the words say it did not work: treated as behaviour.
    expect(rateIssue({ ...once, kind: 'wording' as const, title: 'Packed filter does nothing' }, sessions).confidence).toBe(TOP_SCORE - 15)
    // Wording with no exact words quoted proves nothing.
    expect(rateIssue({ ...once, kind: 'wording' as const, search: [] }, sessions).confidence).toBe(TOP_SCORE - 30)
  })

  it('counts a check that names the page or recorded words as redoing the step', () => {
    const noWords = { ...backed, search: [] }
    expect(rateIssue({ ...noWords, check: 'Open /list, tick one item and see it alone.' }, sessions).unsure.map((u) => u.what).join(' ')).not.toMatch(/done when/)
    expect(rateIssue({ ...noWords, check: "Type 'Passport', tick it and see it alone." }, sessions).unsure.map((u) => u.what).join(' ')).not.toMatch(/done when/)
    expect(rateIssue({ ...noWords, check: "Type 'Toothbrush' and see it." }, sessions).unsure.map((u) => u.what).join(' ')).toMatch(/done when/)
  })

  it('takes a little off when the "done when" check names nothing on that screen', () => {
    const r = rateIssue({ ...backed, check: 'Confirm it works now.' }, sessions)
    expect(r.confidence).toBe(TOP_SCORE - 5)
    expect(r.unsure[0].what).toMatch(/done when/)
  })

  it('takes off for each thing the AI was unsure of and lists it with its check', () => {
    const unsure = [
      { what: 'Two possible causes.', check: 'Tick an item by hand.' },
      { what: 'The second screen was never reached.', check: 'Open it yourself.' },
    ]
    const r = rateIssue({ ...backed, unsure }, sessions)
    expect(r.confidence).toBe(TOP_SCORE - 30)
    expect(r.unsure).toEqual(unsure)
  })

  it('counts a hedge in the tester\'s own words at a cited step as one doubt', () => {
    const hedged = [
      sessions[0],
      { ...sessions[1], steps: [...sessions[1].steps, { step: 4, description: 'Ticked it; it appeared to work.', url: '', action: '', confidence: null }] },
    ]
    const r = rateIssue({ ...backed, seenAt: [...backed.seenAt!, { mission: 'Main goal', step: 4 }] }, hedged)
    expect(r.confidence).toBe(TOP_SCORE - 15)
    expect(r.unsure[0].what).toContain('appeared to work')
  })

  it('does not treat a detail about the newcomer\'s confusion as doubt about the problem', () => {
    const r = rateIssue({ ...backed, detail: 'The newcomer could not tell whether the tick was saved.' }, sessions)
    expect(r.confidence).toBe(TOP_SCORE)
  })

  it('never goes below 5', () => {
    const doubts = Array.from({ length: 3 }, (_, n) => ({ what: `w${n}`, check: 'c' }))
    expect(rateIssue({ ...backed, seenAt: [], search: [], check: 'x', unsure: doubts }, sessions).confidence).toBe(5)
  })
})

describe('reading and checking the evidence', () => {
  it('drops step references to steps no session recorded', () => {
    expect(
      realSteps(
        [
          { mission: 'Main goal', step: 2 },
          { mission: 'main goal', step: 2 },
          { mission: 'Main goal', step: 9 },
          { mission: 'Checkout', step: 1 },
        ],
        sessions,
      ),
    ).toEqual([{ mission: 'Main goal', step: 2 }])
  })

  it('reads step references and doubts defensively', () => {
    expect(readStepRefs([{ mission: 'Main goal', step: '3' }, { step: 2 }, 'x', { mission: 'A', step: 0 }])).toEqual([
      { mission: 'Main goal', step: 3 },
    ])
    expect(readStepRefs('none')).toEqual([])
    expect(readUnsure([{ what: 'a', check: 'b' }, { what: 'only half' }, null])).toEqual([{ what: 'a', check: 'b' }])
  })

  it('finds hedges as whole phrases', () => {
    expect(hedgeIn('Clicked it. It appeared to work.')).toBe('It appeared to work.')
    expect(hedgeIn('Clicked "Unsure-o-meter" and it opened.')).toBeNull()
  })

  it('describes steps the way a person would say them', () => {
    expect(describeSteps([{ mission: 'Main goal', step: 3 }, { mission: 'Main goal', step: 2 }, { mission: 'First look', step: 1 }])).toBe(
      'Main goal steps 2 and 3; First look step 1',
    )
  })

  it('reads seenAt and unsure from the fix-list reply, and keeps only real steps', () => {
    const reply = {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            summary: 's',
            issues: [
              {
                severity: 2,
                title: 't',
                detail: 'd',
                where: 'w',
                change: 'c',
                check: 'k',
                seenAt: [{ mission: 'Main goal', step: 3 }, { mission: 'Main goal', step: 42 }],
                unsure: [{ what: 'Two causes.', check: 'Try it.' }],
              },
            ],
          }),
        },
      ],
    }
    const read = readSummary(reply)
    expect(read.issues[0].unsure).toEqual([{ what: 'Two causes.', check: 'Try it.' }])
    const [kept] = keepWhatWasSeen(read.issues, sessions)
    expect(kept.seenAt).toEqual([{ mission: 'Main goal', step: 3 }])
    // With no page of its own, it takes the page of its first real step.
    expect(kept.page).toBe('https://app.example/list')
  })

  it('asks the fix-list writer for steps and doubts', () => {
    const req = summaryRequest({ name: 'A', url: 'https://app.example', goal: 'g' }, [])
    expect(req.system).toContain('"seenAt"')
    expect(req.system).toContain('"unsure"')
    expect(req.system).toMatch(/Give each fault its own entry/)
  })
})

describe('where the percentage shows up', () => {
  const site = { name: 'Packlist', url: 'https://app.example' }

  it('puts the steps and, under 90%, the points to check into the fix prompt', () => {
    const unsure = [{ what: 'Two causes.', check: 'Tick an item by hand.' }]
    const low = { ...backed, unsure }
    const prompt = fixPrompt(site, low, rateIssue(low, sessions))
    expect(prompt).toContain('Seen at: Main goal steps 2 and 3 of the test')
    expect(prompt).toContain('How sure the test is: 80%')
    expect(prompt).toContain('- Two causes. Tick an item by hand.')
    const high = fixPrompt(site, backed, rateIssue(backed, sessions))
    expect(high).toContain('How sure the test is: 95%.')
    expect(high).not.toContain('left these points open')
    // Reports made before ratings existed keep their old wording.
    expect(fixPrompt(site, backed)).not.toContain('How sure')
  })

  it('shows the percentage in the report email', () => {
    expect(reportEmail(site, 's', [{ ...backed, confidence: 95 }], 'link')).toContain('(95% sure)')
  })

  it('gives a coding agent the percentage and a checkFirst list under 90%', () => {
    const issue = (confidence: number) => ({
      recordId: `i${confidence}`,
      data: {
        runId: 'r1',
        severity: 2,
        title: `t${confidence}`,
        detail: 'd',
        fixPrompt: 'p',
        check: 'k',
        status: 'open',
        confidence,
        unsure: [{ what: 'Seen once.', check: 'Try it.' }],
      },
    })
    const out = fixList(
      [{ recordId: 's1', data: { name: 'A', url: 'https://a.example', goal: 'g' } }],
      [{ recordId: 'r1', data: { siteId: 's1', kind: 'full', status: 'done', startedAt: 1 } }],
      [issue(80), issue(95)],
      { runId: 'r1' },
      (id) => id,
    )
    if (!out.found) throw new Error('not found')
    const [low, high] = out.issues
    expect(low).toMatchObject({ confidence: '80%', checkFirst: ['Seen once. Try it.'] })
    expect(high.confidence).toBe('95%')
    expect(high).not.toHaveProperty('checkFirst')
    expect(out.howToUseThis).toContain('checkFirst')
  })
})
