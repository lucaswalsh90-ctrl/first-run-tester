/**
 * A small picture for each app on "Your apps", so a list of several is easy to
 * tell apart at a glance. The first choice is the app's own icon, the one a
 * browser shows in its tab. If the app has none, a letter in a colour stands in.
 *
 * The icon is fetched by the visitor's browser straight from the app they
 * added. Nothing is stored, and no outside service is asked.
 */

/** Where an app's own icon is usually found, most likely first. */
export function iconCandidates(url: string): string[] {
  let origin: string
  try {
    origin = new URL(url).origin
  } catch {
    return []
  }
  if (!/^https?:\/\//.test(origin)) return []
  return ['/favicon.ico', '/favicon.svg', '/apple-touch-icon.png'].map((path) => origin + path)
}

const HUES = [18, 42, 150, 200, 265, 330]

/**
 * The stand-in when an app has no icon: its first letter, and a colour picked
 * from its name. The same name always gets the same colour.
 */
export function fallbackMark(name: string): { letter: string; hue: number } {
  const clean = name.trim()
  const letter = (clean.match(/[\p{L}\p{N}]/u)?.[0] ?? '?').toUpperCase()
  let sum = 0
  for (const ch of clean.toLowerCase()) sum = (sum * 31 + (ch.codePointAt(0) ?? 0)) % 9973
  return { letter, hue: HUES[sum % HUES.length] }
}
