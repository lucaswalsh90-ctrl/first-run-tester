/**
 * First-run tester data.
 *
 *   sites     an app someone wants tested (public link + what a newcomer should achieve)
 *   runs      one test of a site (a full test, or a retest of one issue)
 *   missions  one AI browser session inside a run (the agent clicking through the site)
 *   issues    problems found in a run, each with a ready-to-paste fix prompt
 *
 *   run_claims  one row per run whose fix list is being written (see below)
 *
 * Everyone sees only their own rows ('own' = record.createdBy), and that
 * includes the app's owner: being admin does not show you other people's apps
 * or reports. Runs, missions and issues are written and deleted only by server
 * actions, so a user can't fake a test result or erase a run to dodge the
 * daily limit from the browser console.
 */
import type { CollectionSchema } from 'deepspace/schema'

/** Read your own; only the server writes. */
const ownReadOnly = {
  member: { read: 'own', create: false, update: false, delete: false },
  admin: { read: 'own', create: false, update: false, delete: false },
} as const

export const sitesSchema: CollectionSchema = {
  name: 'sites',
  columns: [
    { name: 'name', storage: 'text', interpretation: 'plain' },
    { name: 'url', storage: 'text', interpretation: 'plain' },
    /** What a brand-new user should be able to do, in plain English. */
    { name: 'goal', storage: 'text', interpretation: 'plain' },
  ],
  permissions: {
    member: { read: 'own', create: true, update: 'own', delete: 'own' },
    admin: { read: 'own', create: true, update: 'own', delete: 'own' },
  },
}

export const runsSchema: CollectionSchema = {
  name: 'runs',
  columns: [
    { name: 'siteId', storage: 'text', interpretation: 'plain' },
    /** 'full' tests the whole first run; 'retest' re-checks one issue. */
    { name: 'kind', storage: 'text', interpretation: 'plain' },
    { name: 'issueId', storage: 'text', interpretation: 'plain' },
    /** running → summarizing → done, or failed */
    { name: 'status', storage: 'text', interpretation: 'plain' },
    { name: 'summary', storage: 'text', interpretation: 'plain' },
    { name: 'error', storage: 'text', interpretation: 'plain' },
    /** How many times writing the fix list has failed (it is retried a few times). */
    { name: 'summaryTries', storage: 'number', interpretation: 'plain' },
    /** Sample runs replay a saved real result and cost nothing. */
    { name: 'sample', storage: 'number', interpretation: { kind: 'boolean' } },
    { name: 'startedAt', storage: 'number', interpretation: 'plain' },
    { name: 'finishedAt', storage: 'number', interpretation: 'plain' },
  ],
  permissions: ownReadOnly,
}

export const missionsSchema: CollectionSchema = {
  name: 'missions',
  columns: [
    { name: 'runId', storage: 'text', interpretation: 'plain' },
    { name: 'order', storage: 'number', interpretation: 'plain' },
    { name: 'title', storage: 'text', interpretation: 'plain' },
    { name: 'task', storage: 'text', interpretation: 'plain' },
    /** The Apify run id, used to check on the browser session. */
    { name: 'externalId', storage: 'text', interpretation: 'plain' },
    /** running → done, or failed */
    { name: 'status', storage: 'text', interpretation: 'plain' },
    { name: 'succeeded', storage: 'number', interpretation: { kind: 'boolean' } },
    /** [{ step, action, description, confidence, url }] */
    { name: 'steps', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'report', storage: 'text', interpretation: 'plain' },
    { name: 'confusing', storage: 'text', interpretation: 'plain' },
    { name: 'screenshotUrl', storage: 'text', interpretation: 'plain' },
    { name: 'durationSec', storage: 'number', interpretation: 'plain' },
    /** Retests only: did the agent judge the issue fixed? */
    { name: 'fixed', storage: 'number', interpretation: { kind: 'boolean' } },
    /** Sample runs reveal their saved result this many seconds after start. */
    { name: 'revealAfterSec', storage: 'number', interpretation: 'plain' },
  ],
  permissions: ownReadOnly,
}

export const issuesSchema: CollectionSchema = {
  name: 'issues',
  columns: [
    { name: 'runId', storage: 'text', interpretation: 'plain' },
    { name: 'siteId', storage: 'text', interpretation: 'plain' },
    /** 1 = blocks a newcomer, 2 = slows them down, 3 = polish */
    { name: 'severity', storage: 'number', interpretation: 'plain' },
    { name: 'title', storage: 'text', interpretation: 'plain' },
    /** What the newcomer ran into, in plain English. */
    { name: 'detail', storage: 'text', interpretation: 'plain' },
    /** Ready to paste into the builder's coding agent, which edits their repo. */
    { name: 'fixPrompt', storage: 'text', interpretation: 'plain' },
    /** How a retest can tell the issue is fixed. */
    { name: 'check', storage: 'text', interpretation: 'plain' },
    /** open → retesting → fixed | still_broken */
    { name: 'status', storage: 'text', interpretation: 'plain' },
    { name: 'retestNote', storage: 'text', interpretation: 'plain' },
  ],
  permissions: ownReadOnly,
}

/**
 * A claim ticket for the last step of a run (writing the fix list and sending
 * the email). If the same run is open in two tabs, both ask the server to
 * finish it at the same moment. `uniqueOn` makes the database refuse the second
 * ticket, so that work happens once. Nobody can read or write these from the
 * browser; only server actions use them.
 */
export const runClaimsSchema: CollectionSchema = {
  name: 'run_claims',
  columns: [
    { name: 'runId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'claimedAt', storage: 'number', interpretation: 'plain' },
  ],
  uniqueOn: ['runId'],
  permissions: {
    member: { read: false, create: false, update: false, delete: false },
    admin: { read: false, create: false, update: false, delete: false },
  },
}
