/** Calls a server action from src/actions/index.ts with the signed-in user's token. */
import { getAuthToken } from 'deepspace'

export async function callAction<T = unknown>(
  name: 'startTest' | 'startSample' | 'checkRun' | 'retestIssue',
  params: Record<string, unknown> = {},
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  const token = await getAuthToken()
  if (!token) return { success: false, error: 'Please sign in first.' }
  try {
    const res = await fetch(`/api/actions/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(params),
    })
    const body = (await res.json()) as { success?: boolean; data?: T; error?: string }
    if (!res.ok || !body.success) return { success: false, error: body.error ?? `Request failed (${res.status})` }
    return { success: true, data: body.data as T }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Network error' }
  }
}
