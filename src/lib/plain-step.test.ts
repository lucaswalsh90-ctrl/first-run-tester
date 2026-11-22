/** Unit tests for showing the browser agent's steps in plain English. */
import { describe, expect, it } from 'vitest'
import { plainStep } from './plain-step'
import { SAMPLE_MISSIONS } from '../server/sample-run'

describe('plainStep', () => {
  it('rewrites the steps from the saved sample test', () => {
    const shown = SAMPLE_MISSIONS.flatMap((m) => m.steps.filter((s) => s.action !== 'done').map((s) => plainStep(s.description)))
    expect(shown).toEqual([
      'Clicked the link "real TodoMVC app."',
      'Clicked the link "React New"',
      'Typed into "What needs to be done?" and pressed Enter',
      'Typed into "What needs to be done?" and pressed Enter',
      'Ticked the checkbox "Toggle Todo"',
      'Clicked the link "Completed"',
    ])
  })

  it('rewrites a reload and a back', () => {
    expect(plainStep('temporary error page; loaded it again')).toBe('The page showed an error, so it loaded the page again')
    expect(plainStep('go back to the previous page')).toBe('Went back to the previous page')
  })

  it('leaves wording it does not know alone, apart from a capital letter and the agent\'s hints to itself', () => {
    expect(plainStep('drag the slider to 5 (search boxes, tag/skill inputs: one entry per Enter)')).toBe('Drag the slider to 5')
    expect(plainStep('Opened the pricing page')).toBe('Opened the pricing page')
  })
})
