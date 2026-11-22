/**
 * Integration Billing Config
 *
 * Configure who pays for each integration's API calls.
 *
 * - 'developer': The app owner pays (default).
 * - 'user': The calling user pays.
 *
 * Every integration requires a signed-in caller. Set `anonymous: true` on a
 * 'developer' integration to let signed-out visitors call it too — the owner
 * then pays for anyone who can reach the app.
 *
 * Integrations not listed here default to 'developer' with sign-in required.
 *
 * IMPORTANT: any integration backed by per-user connected accounts (Google,
 * Composio) must be 'user' — the api-worker resolves the account from the
 * JWT subject. With 'developer' the app owner's JWT is forwarded, so every
 * signed-in user connects and acts on the app owner's account. Server code
 * that acts for a user in the background (e.g. a cron job) uses
 * `callComposio(env, ..., { asUser })` from 'deepspace/worker' instead.
 */

export const integrations: Record<
  string,
  { billing: 'developer' | 'user'; anonymous?: boolean }
> = {
  // Only the three this app calls. The starter also listed google and composio;
  // they were removed because this app's proxy refuses anything not listed here,
  // and an unused entry is an open door nobody needs.
  // First-run tester: whoever runs a test pays for it from their own
  // DeepSpace credits, so strangers can't spend the owner's balance.
  apify: { billing: 'user' }, // the AI browser agent (the expensive part)
  anthropic: { billing: 'user' }, // writes the fix list (cheap)
  email: { billing: 'user' }, // sends the report (about a cent)
}
