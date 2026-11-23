/**
 * Carries the link someone typed on the landing page over to the Add app form.
 *
 * It lives in sessionStorage: this tab only, gone when the tab closes, never
 * sent anywhere. Storage can be switched off (private windows), so every call
 * is wrapped and the app works the same without it.
 */
const KEY = 'first-run-tester:link'

/** "my-app.com" becomes "https://my-app.com", so people don't have to type the https part. */
export function withScheme(value: string): string {
  const v = value.trim()
  if (!v) return ''
  return /^https?:\/\//i.test(v) ? v : `https://${v}`
}

export function saveLink(value: string) {
  try {
    sessionStorage.setItem(KEY, withScheme(value))
  } catch {
    /* no storage: the form just starts empty */
  }
}

export function readLink(): string {
  try {
    return sessionStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

export function clearLink() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* nothing to clear */
  }
}

/**
 * The platform brings a person back to the landing page after they sign in.
 * Someone who just made an account should land on "Your apps", so the Create
 * account page leaves a note here and the landing page acts on it once. The
 * note is ignored after ten minutes, so an abandoned sign-in can't surprise
 * anyone later.
 */
const SIGN_IN_KEY = 'first-run-tester:sign-in-started'
const SIGN_IN_FRESH_MS = 10 * 60 * 1000

export function rememberSignInStarted() {
  try {
    sessionStorage.setItem(SIGN_IN_KEY, String(Date.now()))
  } catch {
    /* no storage: the person lands on the landing page, as before */
  }
}

/** True once, if a sign-in was started from the Create account page in the last ten minutes. */
export function takeSignInStarted(now = Date.now()): boolean {
  try {
    const at = Number(sessionStorage.getItem(SIGN_IN_KEY))
    sessionStorage.removeItem(SIGN_IN_KEY)
    return at > 0 && now - at < SIGN_IN_FRESH_MS
  } catch {
    return false
  }
}

/**
 * Where an app's code lives on this computer, so "Open in Claude Code" can
 * start in the right folder. Kept in this browser only (localStorage), one
 * entry per tested app, and never sent to the server.
 */
const folderKey = (siteUrl: string) => `first-run-tester:folder:${siteUrl}`

export function readFolder(siteUrl: string): string {
  try {
    return localStorage.getItem(folderKey(siteUrl)) ?? ''
  } catch {
    return ''
  }
}

export function saveFolder(siteUrl: string, folder: string) {
  try {
    if (folder.trim()) localStorage.setItem(folderKey(siteUrl), folder.trim())
    else localStorage.removeItem(folderKey(siteUrl))
  } catch {
    /* no storage: the links simply open without a folder */
  }
}
