/**
 * Copying text to the clipboard, in every browser a person might open a report in.
 *
 * The modern way (`navigator.clipboard.writeText`) is refused by some browsers:
 * the one built into the Claude desktop app, in-app browsers, and pages opened
 * inside another site. Found when the person who built this app pressed "Copy
 * example prompt" there and nothing useful happened.
 *
 * Why that browser matters: copying worked in regular Chrome all along, but the
 * builder had the report open in the Claude app's own browser on purpose, so
 * the report and the coding agent that would fix it sat in one window. That is
 * the one spot where a fix prompt gets copied, so it has to work there.
 *
 * So this tries the modern way, then the older way that works from a click
 * almost everywhere, and tells the caller if both failed so the page can show
 * the text to copy by hand.
 */

type Doc = Pick<Document, 'createElement' | 'execCommand'> & { body: Pick<HTMLElement, 'appendChild'> }
type Nav = { clipboard?: { writeText?: (text: string) => Promise<void> } }

/** The older way: put the text in an off-screen box, select it, and ask the browser to copy the selection. */
export function copyWithSelection(text: string, doc: Doc): boolean {
  const box = doc.createElement('textarea')
  box.value = text
  box.setAttribute('readonly', '')
  box.setAttribute('aria-hidden', 'true')
  // Off screen, but still on the page: a hidden element can't be selected.
  box.style.position = 'fixed'
  box.style.top = '0'
  box.style.left = '-9999px'
  doc.body.appendChild(box)
  box.select()
  box.setSelectionRange(0, text.length)
  let copied = false
  try {
    copied = doc.execCommand('copy')
  } catch {
    copied = false
  }
  box.remove()
  return copied
}

/** True if the text reached the clipboard. False means the page should show it for copying by hand. */
export async function copyText(
  text: string,
  nav: Nav = navigator,
  doc: Doc = document,
): Promise<boolean> {
  try {
    if (nav.clipboard?.writeText) {
      await nav.clipboard.writeText(text)
      return true
    }
  } catch {
    // Refused. Fall through to the older way.
  }
  return copyWithSelection(text, doc)
}
