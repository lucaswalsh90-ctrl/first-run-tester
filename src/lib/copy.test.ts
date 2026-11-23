import { describe, expect, it } from 'vitest'
import { copyText, copyWithSelection } from './copy'

/** A stand-in page that records what was selected and whether the browser agreed to copy. */
function fakeDoc(agree: boolean | 'throws') {
  const log = { appended: 0, removed: 0, selected: '', asked: 0 }
  const doc = {
    createElement: () => {
      const box = {
        value: '',
        style: {} as Record<string, string>,
        setAttribute: () => {},
        select: () => {
          log.selected = box.value
        },
        setSelectionRange: () => {},
        remove: () => {
          log.removed++
        },
      }
      return box
    },
    execCommand: () => {
      log.asked++
      if (agree === 'throws') throw new Error('blocked')
      return agree
    },
    body: {
      appendChild: <T>(el: T) => {
        log.appended++
        return el
      },
    },
  }
  return { doc: doc as never, log }
}

describe('copying a prompt', () => {
  it('uses the modern clipboard when the browser allows it', async () => {
    let got = ''
    const { doc, log } = fakeDoc(true)
    const nav = { clipboard: { writeText: async (t: string) => void (got = t) } }
    expect(await copyText('fix this', nav, doc)).toBe(true)
    expect(got).toBe('fix this')
    expect(log.asked).toBe(0)
  })

  // The browser inside the Claude desktop app refuses the modern clipboard.
  // Before this, both copy buttons on a report just said "Could not copy".
  it('falls back to selecting the text when the modern clipboard is refused', async () => {
    const { doc, log } = fakeDoc(true)
    const nav = { clipboard: { writeText: async () => Promise.reject(new Error('NotAllowedError')) } }
    expect(await copyText('fix this', nav, doc)).toBe(true)
    expect(log.selected).toBe('fix this')
    expect(log.removed).toBe(1)
  })

  it('falls back when the browser has no modern clipboard at all', async () => {
    const { doc, log } = fakeDoc(true)
    expect(await copyText('fix this', {}, doc)).toBe(true)
    expect(log.asked).toBe(1)
  })

  it('says so when both ways fail, so the page can show the text', async () => {
    const refused = { clipboard: { writeText: async () => Promise.reject(new Error('no')) } }
    expect(await copyText('fix this', refused, fakeDoc(false).doc)).toBe(false)
    expect(await copyText('fix this', refused, fakeDoc('throws').doc)).toBe(false)
  })

  it('always takes its off-screen box away again', () => {
    const { doc, log } = fakeDoc('throws')
    expect(copyWithSelection('x', doc)).toBe(false)
    expect(log.appended).toBe(1)
    expect(log.removed).toBe(1)
  })
})
