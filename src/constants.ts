/** App name — replaced by the CLI during scaffolding */
export const APP_NAME = 'first-run-tester'

/** The name people see (the slug above is the address). */
export const APP_TITLE = 'First-run tester'

/** Immutable app identity — data scope keys to this, so renames never
 *  strand your records.
 *
 *  Injected by the build from `DEEPSPACE_APP_ID` in the wrangler config this
 *  build is running against — `deepspaceBuild()` in vite.config.ts supplies the
 *  define (see `deepspace/build`). wrangler.toml is the only source of truth,
 *  so `deepspace dev start`, `vite build`, and `deepspace deploy --env <name>`
 *  each get their own environment's id — not a copy frozen at scaffold time.
 *  Do not replace this with a literal: that is how a staging browser ends up
 *  reading production's rooms. */
declare const __DEEPSPACE_APP_ID__: string
export const APP_ID: string = __DEEPSPACE_APP_ID__

/** Primary scope ID for the app's RecordRoom DO */
export const SCOPE_ID = `app:${APP_ID}`

/** Roles and display config — imported from SDK (single source of truth) */
export { ROLES, ROLE_CONFIG, type Role } from 'deepspace'

/** Wording for DeepSpace's sign-in box. The box itself is the platform's; these two lines are ours.
 *  Added after the app's own first-run test found that newcomers saw no way to create an account. */
export const SIGN_IN_COPY = {
  title: 'Sign in to First-run tester',
  description: 'New here? Continuing with Google or GitHub creates your free account.',
}
