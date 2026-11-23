import { describe, expect, it } from 'vitest'
import { fallbackMark, iconCandidates } from './site-mark'

describe('iconCandidates', () => {
  it("looks for the app's own icon at the top of its address, wherever the tested page is", () => {
    expect(iconCandidates('https://my-app.app.space/pricing?x=1')).toEqual([
      'https://my-app.app.space/favicon.ico',
      'https://my-app.app.space/favicon.svg',
      'https://my-app.app.space/apple-touch-icon.png',
    ])
  })

  it('offers nothing for an address it cannot read', () => {
    expect(iconCandidates('not a link')).toEqual([])
    expect(iconCandidates('javascript:alert(1)')).toEqual([])
  })
})

describe('fallbackMark', () => {
  it('uses the first letter or number of the name, in capitals', () => {
    expect(fallbackMark('  runningMap').letter).toBe('R')
    expect(fallbackMark('"quoted" app').letter).toBe('Q')
    expect(fallbackMark('3D viewer').letter).toBe('3')
    expect(fallbackMark('').letter).toBe('?')
  })

  it('gives the same name the same colour every time, whatever its capitals', () => {
    expect(fallbackMark('TodoMVC demo')).toEqual(fallbackMark('todomvc DEMO'))
    expect(new Set(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf'].map((n) => fallbackMark(n).hue)).size).toBeGreaterThan(1)
  })
})
