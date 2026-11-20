/**
 * First-run tester: the pieces the server actions use.
 *
 * 1. Missions   plain-English instructions for the AI browser agent
 * 2. Results    turning the agent's answer into a mission record
 * 3. Fix list   asking Claude to group what went wrong into ranked issues
 * 4. Prompts    wording each issue as a prompt for the builder's coding agent
 *
 * The browser agent is Apify's "AI Browser Agent" actor, reached through the
 * DeepSpace integration proxy (apify/run-actor and apify/get-run). It opens a
 * real browser, clicks and types like a person, and reports each step with how
 * confident it was. DeepSpace's own browser binding needs an admin account, so
 * this is the browser available to every app.
 */

export const BROWSER_AGENT = 'newpo/ai-browser-agent'

/** Hard limits on every browser session, so one test can't run up a bill. */
export const LIMITS = {
  maxStepsPerMission: 15,
  maxUsdPerMission: 0.4,
  missionTimeoutSec: 300,
  realRunsPerUserPerDay: 5,
}

/** The model that writes the fix list: the cheapest one that does the job. */
export const SUMMARY_MODEL = 'claude-haiku-5-5'

export interface MissionPlan {
  title: string
  task: string
  maxSteps: number
  outputSchema: Record<string, string>
}

const STAY_ON_SITE =
  'Stay on this website: do not follow links to other websites. ' +
  'Do not enter payment details and do not use real personal data.'

/** A full test is two missions that run at the same time, each in a fresh browser. */
export function planFullTest(url: string, goal: string): MissionPlan[] {
  return [
    {
      title: 'First look',
      task:
        `You are a first-time visitor who has never seen ${url}. Use at most 6 actions. ` +
        'Work out what this site is for, who it is for, and what a new visitor should do first. ' +
        'Do not create an account. ' +
        STAY_ON_SITE +
        ' After each action, say in one plain sentence what you did and what you learned. ' +
        'Then list anything that was unclear, hidden, slow to find or confusing for a newcomer.',
      maxSteps: 6,
      outputSchema: { steps: 'string[]', confusing: 'string[]', succeeded: 'boolean' },
    },
    {
      title: 'Main goal',
      task:
        `You are a brand-new user of ${url} with no instructions. Your goal: ${goal}. ` +
        'Figure it out by looking at the screen, the way a real newcomer would. ' +
        'If you need an account, sign up with the made-up name "Test Newcomer" and the email ' +
        '"newcomer@example.com". Stop if the site asks for a verification code. ' +
        STAY_ON_SITE +
        ' After each action, say in one plain sentence what you did and whether it worked. ' +
        'Then list anything that was unclear, hidden, slow to find or confusing, and say whether you reached the goal.',
      maxSteps: LIMITS.maxStepsPerMission,
      outputSchema: { steps: 'string[]', confusing: 'string[]', succeeded: 'boolean' },
    },
  ]
}

/** A retest is one mission that checks a single issue after the builder fixed it. */
export function planRetest(url: string, goal: string, issue: { title: string; check: string }): MissionPlan {
  return {
    title: 'Retest',
    task:
      `You are a brand-new user of ${url}. The overall goal is: ${goal}. ` +
      `A previous newcomer ran into this problem: "${issue.title}". ` +
      `Go to the relevant part of the site and check: ${issue.check}. ` +
      STAY_ON_SITE +
      ' Describe each action in one plain sentence. ' +
      'Finally, answer fixed = true only if a newcomer would no longer run into the problem.',
    maxSteps: 10,
    outputSchema: { steps: 'string[]', fixed: 'boolean', why: 'string' },
  }
}

/** The request body for apify/run-actor. */
export function browserAgentRequest(url: string, plan: MissionPlan) {
  return {
    actorId: BROWSER_AGENT,
    maxTotalChargeUsd: LIMITS.maxUsdPerMission,
    timeout: LIMITS.missionTimeoutSec,
    input: {
      startUrl: url,
      task: plan.task,
      mode: 'fast',
      maxSteps: plan.maxSteps,
      screenshot: true,
      outputSchema: plan.outputSchema,
    },
  }
}

// ---------------------------------------------------------------------------
// 2. Results
// ---------------------------------------------------------------------------

export interface MissionStep {
  step: number
  action: string
  description: string
  confidence: number | null
  url: string
}

/** What a finished browser session becomes in the `missions` collection. */
export interface MissionResult {
  status: 'done' | 'failed'
  succeeded: boolean
  steps: MissionStep[]
  report: string
  confusing: string
  screenshotUrl: string
  durationSec: number
  fixed?: boolean
}

const TERMINAL = new Set(['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT', 'TIMED_OUT'])

export function isFinished(status: unknown): boolean {
  return typeof status === 'string' && TERMINAL.has(status)
}

function text(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join('\n')
  return typeof value === 'string' ? value : ''
}

/** Reads one apify/get-run response for the browser agent. */
export function readBrowserAgentRun(run: {
  status?: string
  items?: Array<Record<string, unknown>>
}): MissionResult {
  const item = run.items?.[0] ?? {}
  const data = (item.data ?? {}) as Record<string, unknown>
  const rawSteps = Array.isArray(item.steps) ? (item.steps as Array<Record<string, unknown>>) : []
  const steps: MissionStep[] = rawSteps.map((s, i) => ({
    step: typeof s.step === 'number' ? s.step : i + 1,
    action: String(s.action ?? ''),
    description: String(s.description ?? ''),
    confidence: typeof s.confidence === 'number' ? s.confidence : null,
    url: String(s.url ?? ''),
  }))
  const finishedOk = run.status === 'SUCCEEDED'
  return {
    status: finishedOk ? 'done' : 'failed',
    succeeded: finishedOk && (data.succeeded === true || item.succeeded === true),
    steps,
    report: text(data.steps) || text(item.answer),
    confusing: text(data.confusing) || text(data.why),
    screenshotUrl: typeof item.screenshotUrl === 'string' ? item.screenshotUrl : '',
    durationSec: typeof item.durationSec === 'number' ? item.durationSec : 0,
    ...(typeof data.fixed === 'boolean' ? { fixed: data.fixed } : {}),
  }
}

// ---------------------------------------------------------------------------
// 3. Fix list
// ---------------------------------------------------------------------------

export interface DraftIssue {
  severity: 1 | 2 | 3
  title: string
  detail: string
  where: string
  change: string
  check: string
}

const SUMMARY_SYSTEM = `You review reports from an AI agent that used a website as a first-time user.
Group what it ran into into a short list of distinct problems, most serious first.
Severity: 1 = stopped the newcomer, 2 = slowed them down or confused them, 3 = small polish.
Only list problems the reports actually show. If nothing went wrong, return an empty list.
Write for the website's builder in plain English. No jargon about the agent itself.

Reply with JSON only, no prose, in exactly this shape:
{"summary": "two sentences on how the first run went",
 "issues": [{"severity": 1, "title": "short name of the problem",
   "detail": "what the newcomer ran into, citing the step",
   "where": "the page or screen and the element involved",
   "change": "the smallest change that would fix it",
   "check": "how someone would confirm the fix by using the site"}]}
Return at most 6 issues.`

export function summaryRequest(site: { name: string; url: string; goal: string }, missions: Array<{ title: string } & MissionResult>) {
  const reports = missions
    .map((m) => {
      const steps = m.steps
        .map((s) => `  ${s.step}. ${s.description} (confidence ${s.confidence ?? 'n/a'}, ${s.url})`)
        .join('\n')
      return `## Mission: ${m.title} (${m.succeeded ? 'reached its goal' : 'did not reach its goal'})
Steps:
${steps || '  (none recorded)'}
Agent's own account:
${m.report || '(none)'}
What the agent found confusing:
${m.confusing || '(nothing listed)'}`
    })
    .join('\n\n')

  return {
    model: SUMMARY_MODEL,
    max_tokens: 2000,
    temperature: 0,
    system: SUMMARY_SYSTEM,
    messages: [
      {
        role: 'user' as const,
        content: `Website: ${site.name} (${site.url})\nWhat a newcomer should be able to do: ${site.goal}\n\n${reports}`,
      },
    ],
  }
}

/** Pulls the JSON reply out of an anthropic/chat-completion response. */
export function readSummary(response: unknown): { summary: string; issues: DraftIssue[] } {
  const r = response as { content?: Array<{ type?: string; text?: string }>; text?: string }
  const raw = r?.content?.find((c) => c.type === 'text')?.text ?? r?.text ?? ''
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('The fix list came back without JSON')
  const parsed = JSON.parse(raw.slice(start, end + 1)) as { summary?: string; issues?: unknown[] }
  const issues = (parsed.issues ?? []).slice(0, 6).map((value) => {
    const i = value as Record<string, unknown>
    const severity = i.severity === 1 || i.severity === 3 ? i.severity : 2
    return {
      severity,
      title: String(i.title ?? 'Untitled problem'),
      detail: String(i.detail ?? ''),
      where: String(i.where ?? ''),
      change: String(i.change ?? ''),
      check: String(i.check ?? ''),
    } as DraftIssue
  })
  return { summary: String(parsed.summary ?? ''), issues }
}

// ---------------------------------------------------------------------------
// 4. Prompts
// ---------------------------------------------------------------------------

/**
 * The prompt a builder pastes into their coding agent (Claude Code, Cursor,
 * Codex...). The AI fills in the facts; this fixed wording makes every prompt
 * read the same way and tells the agent to edit the repository itself.
 */
export function fixPrompt(site: { name: string; url: string }, issue: DraftIssue): string {
  return [
    `Please fix a first-run problem in ${site.name} (${site.url}).`,
    `Make the change directly in this repository, then tell me which files you edited and why.`,
    '',
    `Problem a first-time user hit: ${issue.title}`,
    `What happened: ${issue.detail}`,
    `Where: ${issue.where}`,
    `Change to make: ${issue.change}`,
    `Done when: ${issue.check}`,
    '',
    `Keep the change small and leave unrelated behaviour alone.`,
    `If you can't find the code for this, say where you looked instead of guessing.`,
  ].join('\n')
}

/** The plain-text report emailed when a full test finishes. */
export function reportEmail(
  site: { name: string; url: string },
  summary: string,
  issues: Array<Pick<DraftIssue, 'severity' | 'title' | 'detail'>>,
  runLink: string,
): string {
  const label = { 1: 'Blocks newcomers', 2: 'Slows newcomers', 3: 'Polish' } as const
  const lines = issues.map((i, n) => `${n + 1}. [${label[i.severity]}] ${i.title}\n   ${i.detail}`)
  return [
    `First-run test of ${site.name} (${site.url})`,
    '',
    summary,
    '',
    issues.length ? 'What a newcomer ran into:' : 'No problems found this time.',
    ...lines,
    '',
    `Fix prompts for your coding agent and a Retest button: ${runLink}`,
  ].join('\n')
}
