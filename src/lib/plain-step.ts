/**
 * Turns the browser agent's own wording for a step into plain English.
 *
 * The agent describes steps the way a tool would: `type text into input
 * "What needs to be done?" and press Enter (search boxes, tag/skill inputs:
 * one entry per Enter)`. A fresh-eyes test of this app called that out as raw
 * tool output. The saved record keeps the agent's exact words (the fix-list
 * writer reads those); this only changes what is shown.
 */
const RULES: Array<[RegExp, string]> = [
  [/^type text into (?:input|textarea|field) "(.*?)" and press Enter\b.*$/i, 'Typed into "$1" and pressed Enter'],
  [/^type text into (?:input|textarea|field) "(.*?)".*$/i, 'Typed into "$1"'],
  [/^(?:check|tick) checkbox "(.*?)".*$/i, 'Ticked the checkbox "$1"'],
  [/^uncheck checkbox "(.*?)".*$/i, 'Unticked the checkbox "$1"'],
  [/^click (link|button|tab|menu item) "(.*?)"(?:\s*→\s*(.*))?$/i, 'Clicked the $1 "$2"'],
  [/^select option "(.*?)".*$/i, 'Chose "$1" from a list'],
  [/^temporary error page; loaded it again$/i, 'The page showed an error, so it loaded the page again'],
  [/^go back to the previous page$/i, 'Went back to the previous page'],
  [/^scroll (up|down).*$/i, 'Scrolled $1'],
]

export function plainStep(description: string): string {
  const text = description.trim()
  for (const [pattern, plain] of RULES) {
    if (pattern.test(text)) return text.replace(pattern, plain)
  }
  // Anything else: drop the agent's bracketed hints to itself and start with a capital.
  const tidy = text.replace(/\s*\((?:search boxes|tag\/skill)[^)]*\)/gi, '')
  return tidy.charAt(0).toUpperCase() + tidy.slice(1)
}
