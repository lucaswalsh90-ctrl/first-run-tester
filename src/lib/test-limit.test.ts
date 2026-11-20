/** Unit tests for spotting the test browser's own limits. */
import { describe, expect, it } from 'vitest'
import { blamesGraphicsLimit, hitGraphicsLimit, setAsideTestLimits } from './test-limit'

// The wording a real session used on a map app (first real test of someone else's app).
const mapSession = {
  steps: [{ step: 1, description: 'temporary error page; loaded it again' }],
  report:
    'I opened the /create page and it showed a "Something went wrong" error with a WebGL context creation ' +
    'failure instead of a map. I clicked "Reload", but the map still failed to load with the same WebGL initialization error.',
  confusing: 'The error message is technical (WebGL, ANGLE, llvmpipe) and gives a newcomer no guidance.',
}
const fineSession = {
  steps: [{ step: 1, description: 'click link "Completed"' }],
  report: 'Added two to-dos and marked one done.',
  confusing: 'The checkbox has no visible label.',
}

describe('hitGraphicsLimit', () => {
  it('spots a WebGL failure in what a session wrote', () => {
    expect(hitGraphicsLimit([fineSession, mapSession])).toBe(true)
  })

  it('reads steps whether they arrive as a list or as saved text', () => {
    const saved = { steps: JSON.stringify([{ description: 'page said: Failed to initialize WebGL' }]) }
    expect(hitGraphicsLimit([saved])).toBe(true)
  })

  it('is false for an ordinary session', () => {
    expect(hitGraphicsLimit([fineSession])).toBe(false)
  })

  it('is false when a site merely talks about WebGL', () => {
    const tutorial = { steps: [{ description: 'click link "WebGL tutorials"' }], report: 'The site teaches WebGL and three.js.' }
    expect(hitGraphicsLimit([tutorial])).toBe(false)
  })
})

describe('setAsideTestLimits', () => {
  const issues = [
    { title: 'Map never loads, so route planning is impossible', detail: 'A WebGL context creation failure instead of a map.' },
    { title: 'No introduction for a first-time visitor', detail: 'The site opens straight onto /create with no explanation.' },
    { title: 'Reload button does not fix the problem', detail: "Clicking 'Reload' brought back the same WebGL error each time." },
  ]

  it('sets aside the findings that blame the graphics failure and keeps the rest', () => {
    const split = setAsideTestLimits(issues, [mapSession])
    expect(split.limited).toBe(true)
    expect(split.real.map((i) => i.title)).toEqual(['No introduction for a first-time visitor'])
    expect(split.setAside).toHaveLength(2)
  })

  it('leaves the list alone when the limit was not hit, even if a finding mentions WebGL', () => {
    const split = setAsideTestLimits(issues, [fineSession])
    expect(split).toEqual({ limited: false, real: issues, setAside: [] })
  })

  it('blamesGraphicsLimit looks at the title and the detail', () => {
    expect(blamesGraphicsLimit({ title: 'WebGL error shown', detail: '' })).toBe(true)
    expect(blamesGraphicsLimit({ title: 'Small text', detail: 'Hard to read' })).toBe(false)
  })
})
