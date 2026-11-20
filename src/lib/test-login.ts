/**
 * Where a test login lives while you use the app: in this browser tab's
 * memory, and nowhere else. It is not saved to the database, to cookies or to
 * browser storage, so reloading the page forgets it. It is sent to the server
 * only at the moment you start a test or a retest.
 */
import { useSyncExternalStore } from 'react'

export interface TestLogin {
  email: string
  password: string
}

const logins = new Map<string, TestLogin>()
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setTestLogin(siteId: string, login: TestLogin) {
  if (!login.email && !login.password) logins.delete(siteId)
  else logins.set(siteId, login)
  listeners.forEach((l) => l())
}

/** The login to send with a test, or undefined when it is empty or half filled. */
export function completeTestLogin(siteId: string): TestLogin | undefined {
  const login = logins.get(siteId)
  return login?.email.trim() && login.password ? login : undefined
}

/** True when only one of the two fields is filled, which is almost certainly a mistake. */
export function testLoginIsHalfFilled(siteId: string): boolean {
  const login = logins.get(siteId)
  if (!login) return false
  return !!login.email.trim() !== !!login.password
}

/** React hook: the login typed for one app (empty strings when none). */
export function useTestLogin(siteId: string): TestLogin {
  return useSyncExternalStore(
    subscribe,
    () => logins.get(siteId) ?? EMPTY,
    () => EMPTY,
  )
}

const EMPTY: TestLogin = { email: '', password: '' }
