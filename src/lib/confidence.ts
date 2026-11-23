/**
 * How sure the report is about each fix, and what a person should check by
 * hand when it is not sure.
 *
 * The number is not the AI's opinion of itself. The AI that writes the fix
 * list is asked to point at its evidence (the recorded step where the
 * newcomer got stuck, the exact words on that screen) and to say what it is
 * unsure of. Plain code then checks each piece against what the browser
 * sessions really recorded, and the percentage is simply which checks passed:
 *
 *   start at 95                                     (an AI tester is not a person;
 *                                                    the last 5 stays with you)
 *   no recorded step or screen behind it      -30
 *   no exact words from that screen, written
 *     at a cited step                         -15   (nothing to search the code for)
 *   not seen at two steps that mention those
 *     words, and the newcomer still got
 *     through (a wording problem quoted
 *     exactly needs only one look)            -15
 *   the "done when" check does not name
 *     anything on that screen                  -5
 *   each thing the AI or the tester was
 *     unsure of                               -15
 *
 * So 90% or more means: tied to a real step and screen, the code can be found
 * by its words, seen twice or it stopped the newcomer, and nobody hedged.
 * Every missing check becomes a plain sentence on what is unclear and a short
 * thing to check by hand, so a low number always says why.
 */

export const TOP_SCORE = 95
export const SURE_ENOUGH = 90

const COST = {
  step: 30,
  words: 15,
  confirmed: 15,
  check: 5,
  doubt: 15,
} as const

/** A recorded step the fix list points at: the session's title and the step's number. */
export interface StepRef {
  mission: string
  step: number
}

/** Something unclear about a fix, with what a person should check by hand. */
export interface Unsure {
  what: string
  check: string
}

/** What gets saved on each issue. */
export interface Rating {
  /** 5 to 95. */
  confidence: number
  /** What backs the fix, in plain words. */
  evidence: string[]
  /** What is unclear and what to check by hand. Empty when the fix is backed on every count. */
  unsure: Unsure[]
}

/** The parts of a fix-list problem that the rating looks at. */
export interface RatedIssue {
  severity: number
  detail: string
  check: string
  page?: string
  search?: string[]
  seenAt?: StepRef[]
  unsure?: Unsure[]
  /** 'wording' for what a page says or shows, 'behaviour' for something that did not work. */
  kind?: 'behaviour' | 'wording'
  title?: string
}

/** The parts of a browser session that the rating looks at. */
export interface RatedSession {
  title: string
  /** true/false fresh from the browser agent, 1/0 once read back from the database. */
  succeeded?: unknown
  steps?: Array<{ step: number; description: string; url?: string; action?: string }>
  /** The tester's own account, usually one numbered sentence per step. */
  report?: string
  confusing?: string
}

/** Whether a session failed its goal. Saved records hold 1/0, fresh ones true/false. */
function failedGoal(s: RatedSession | undefined): boolean {
  return s?.succeeded === false || s?.succeeded === 0
}

/**
 * Words a tester uses at a step when it did not really see what happened.
 * Only the tester's own words at the cited steps are scanned: a fix-list
 * detail like "the newcomer could not tell whether it saved" describes the
 * newcomer's confusion, which is the problem itself, not doubt about it.
 */
const HEDGES = [
  'could not tell',
  "couldn't tell",
  'could not confirm',
  "couldn't confirm",
  'not sure',
  'unsure',
  'appeared to',
  'seemed to',
]

/** The sentence in a piece of text that hedges, if any. */
export function hedgeIn(text: string): string | null {
  const sentences = text.split(/(?<=[.!?])\s+/)
  for (const s of sentences) {
    const lower = ` ${s.toLowerCase()} `
    if (HEDGES.some((h) => lower.includes(` ${h} `) || lower.includes(` ${h},`) || lower.includes(` ${h}.`))) {
      return s.trim()
    }
  }
  return null
}

/** "Main goal step 7" or "Main goal steps 6 and 7". */
export function describeSteps(refs: StepRef[]): string {
  const byMission = new Map<string, number[]>()
  for (const r of refs) byMission.set(r.mission, [...(byMission.get(r.mission) ?? []), r.step])
  return [...byMission.entries()]
    .map(([mission, steps]) => {
      const sorted = [...new Set(steps)].sort((a, b) => a - b)
      if (sorted.length === 1) return `${mission} step ${sorted[0]}`
      return `${mission} steps ${sorted.slice(0, -1).join(', ')} and ${sorted[sorted.length - 1]}`
    })
    .join('; ')
}

/** Keeps only step references that point at a step a session really recorded. */
export function realSteps(refs: StepRef[] | undefined, sessions: RatedSession[]): StepRef[] {
  const seen = new Set<string>()
  const out: StepRef[] = []
  for (const r of refs ?? []) {
    const session = sessions.find((s) => s.title.toLowerCase() === r.mission.toLowerCase())
    const step = session?.steps?.find((s) => s.step === r.step)
    if (!session || !step) continue
    const key = `${session.title}#${step.step}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ mission: session.title, step: step.step })
  }
  return out
}

/** The page address of the first cited step, when the step recorded one. */
export function pageOfSteps(refs: StepRef[], sessions: RatedSession[]): string | undefined {
  for (const r of refs) {
    const url = sessions.find((s) => s.title === r.mission)?.steps?.find((s) => s.step === r.step)?.url
    if (url && /^https?:\/\//.test(url)) return url
  }
  return undefined
}

/**
 * The tester's own sentence for one step, from its numbered account
 * ("1. Clicked ... 2. Typed ..."). The recorded step itself is usually a
 * machine action line such as: click button "Packed".
 */
export function proseAt(report: string | undefined, step: number): string {
  if (!report) return ''
  const start = report.search(new RegExp(`(^|\\s)${step}\\.\\s`))
  if (start < 0) return ''
  const rest = report.slice(start).replace(/^\s+/, '')
  // It ends where the next numbered sentence starts (a higher number, so "Add 2. more" inside it does not end it).
  for (const m of rest.matchAll(/\s(\d{1,2})\.\s/g)) {
    if (Number(m[1]) > step && m.index > 0) return rest.slice(0, m.index).trim()
  }
  return rest.trim()
}

/** Everything known about one cited step: its action line and the tester's sentence for it. */
function textAt(r: StepRef, sessions: RatedSession[]): string {
  const session = sessions.find((s) => s.title === r.mission)
  const step = session?.steps?.find((s) => s.step === r.step)
  return `${step?.description ?? ''} ${proseAt(session?.report, r.step)}`
}

/** The closing "stop" or "done" step, which shows nothing about any problem. */
function isClosingStep(r: StepRef, sessions: RatedSession[]): boolean {
  const step = sessions.find((s) => s.title === r.mission)?.steps?.find((s) => s.step === r.step)
  return step?.action === 'done' || /^stop\b/i.test(step?.description ?? '')
}

const flat = (text: string) => text.toLowerCase().replace(/\s+/g, ' ')

/**
 * Phrases that mean something did not work. A problem described with one of
 * these is about behaviour, whatever the fix-list writer labelled it, and
 * behaviour has to be seen twice (or stop the newcomer) to count as confirmed.
 */
const BEHAVIOUR = /\b(does nothing|did nothing|do nothing|doesn't work|does not work|did not work|not working|broken|fails?|failed|error|stuck|no response|did not respond|nothing happen|wrong items?|does not update|doesn't update|did not update|not saved|lost|disappear|missing after|crash)/i

/** A problem about what the page says or shows, which one careful look can confirm. */
function isWording(issue: RatedIssue): boolean {
  return issue.kind === 'wording' && !BEHAVIOUR.test(`${issue.title ?? ''} ${issue.detail}`)
}

/** Short quoted labels in the cited steps, like the "Packed" in: click button "Packed". */
function quotedInSteps(refs: StepRef[], sessions: RatedSession[]): string[] {
  const out: string[] = []
  for (const r of refs) {
    const d = sessions.find((s) => s.title === r.mission)?.steps?.find((s) => s.step === r.step)?.description ?? ''
    for (const m of d.matchAll(/["“']([^"”']{2,60})["”']/g)) out.push(m[1])
  }
  return out
}

/**
 * Rates one fix. `issue.seenAt` and `issue.search` must already be checked
 * against the sessions (see keepWhatWasSeen in src/server/tester.ts), so
 * everything counted here is something a session really recorded.
 */
export function rateIssue(issue: RatedIssue, sessions: RatedSession[]): Rating {
  const evidence: string[] = []
  const unsure: Unsure[] = []
  let score = TOP_SCORE

  const steps = issue.seenAt ?? []
  const page = issue.page ?? pageOfSteps(steps, sessions)
  const where = page ? `the page ${page}` : 'the app'

  // 1. A recorded step and screen.
  if (steps.length) {
    evidence.push(`Seen at ${describeSteps(steps)}${page ? ` on ${page}` : ''}`)
  } else {
    score -= COST.step
    unsure.push({
      what: 'The report does not point to a recorded step where this happened, so it may be a general impression.',
      check: `Open ${where} and try the goal yourself. Only fix it if you run into the same thing.`,
    })
  }

  // 2. Exact words, so the code that draws that screen can be found. They
  //    count only when the tester wrote them at a cited step, or in the
  //    "confusing" notes of a session it cites, so they belong to that screen.
  const citedText = flat(
    [
      ...steps.map((r) => textAt(r, sessions)),
      ...[...new Set(steps.map((r) => r.mission))].map((m) => sessions.find((s) => s.title === m)?.confusing ?? ''),
    ].join('\n'),
  )
  const words = (issue.search ?? []).filter((w) => citedText.includes(flat(w)))
  if (words.length) {
    evidence.push(`Exact words on that screen: ${words.map((w) => `"${w}"`).join(', ')}`)
  } else {
    score -= COST.words
    unsure.push({
      what: issue.search?.length
        ? `The words it quotes (${issue.search.map((w) => `"${w}"`).join(', ')}) were not written at a step it points to, so they may come from another screen.`
        : 'The tester quoted no words from that screen, so a coding agent has nothing exact to search the code for.',
      check: `Find the screen yourself and note the button, heading or message beside the problem, so you can point your coding agent at the right file.`,
    })
  }

  // 3. Seen more than once, or it stopped the newcomer. A step counts as a
  //    sighting only if it is not the closing step and the tester's words at
  //    that step mention the problem's on-screen words, so citing any old
  //    step cannot make a problem look confirmed.
  const missions = new Set(steps.map((s) => s.mission))
  const stoppedGoal = issue.severity === 1 && [...missions].some((m) => failedGoal(sessions.find((s) => s.title === m)))
  const sightings = steps.filter(
    (r) => !isClosingStep(r, sessions) && words.some((w) => flat(textAt(r, sessions)).includes(flat(w))),
  )
  const sightedIn = new Set(sightings.map((r) => r.mission))
  if (sightings.length >= 2) {
    evidence.push(sightedIn.size > 1 ? 'Both sessions ran into it' : 'Seen at more than one step')
  } else if (stoppedGoal) {
    evidence.push('It kept the newcomer from reaching the goal')
  } else if (steps.length === 1 && words.length && isWording(issue)) {
    // Words on a page do not flicker: quoted exactly at a recorded step, they are there.
    evidence.push('It is about what the page says, and the words were quoted exactly')
  } else {
    score -= COST.confirmed
    unsure.push({
      what: 'Seen once, and the newcomer still got through, so it could be a one-off.',
      check: `Open ${where}, do the same thing, and check that it happens for you too.`,
    })
  }

  // 4. The "done when" check redoes that step on that screen: it names the
  //    screen's words, the page itself, or words in quotes that the sessions recorded.
  const check = issue.check.toLowerCase()
  const recorded = sessions.flatMap((s) => (s.steps ?? []).map((st) => st.description)).join('\n').toLowerCase()
  const quotedInCheck = [...issue.check.matchAll(/["“']([^"”']{2,60})["”']/g)].map((m) => m[1].toLowerCase())
  const pagePath = lastPathPart(page)
  const anchors = [...(issue.search ?? []), ...quotedInSteps(steps, sessions)].map((w) => w.toLowerCase())
  if (
    anchors.some((w) => check.includes(w)) ||
    quotedInCheck.some((q) => recorded.includes(q)) ||
    (pagePath && pagePath.length >= 3 && check.includes(pagePath))
  ) {
    evidence.push('The "done when" check redoes that step on that screen')
  } else {
    score -= COST.check
    unsure.push({
      what: 'The "done when" check does not name anything on that screen, so a pass may not prove this exact problem is gone.',
      check: `Before you retest, read the check and make sure it repeats what the newcomer did${steps.length ? ` at ${describeSteps(steps)}` : ''}.`,
    })
  }

  // 5. Anything the AI said it was unsure of. If it listed nothing but the
  //    tester hedged at a cited step, that counts as one doubt.
  const doubts = [...(issue.unsure ?? [])]
  const hedge = doubts.length
    ? null
    : hedgeIn(steps.map((r) => proseAt(sessions.find((s) => s.title === r.mission)?.report, r.step)).join(' '))
  if (hedge) {
    doubts.push({
      what: `At that step the tester wrote: "${hedge.slice(0, 160)}"`,
      check: `Try it yourself on ${where} and see whether it really happens.`,
    })
  }
  if (doubts.length) {
    score -= COST.doubt * doubts.length
    unsure.push(...doubts)
  } else {
    evidence.push('Nothing about it was left unclear')
  }

  return { confidence: Math.max(5, score), evidence, unsure }
}

/** "packlist-b" for https://app/practice/packlist-b, or undefined. Never throws. */
function lastPathPart(page: string | undefined): string | undefined {
  if (!page) return undefined
  try {
    return new URL(page).pathname.replace(/\/+$/, '').split('/').pop()?.toLowerCase()
  } catch {
    return undefined
  }
}

/** Reads `unsure` from an AI reply or a saved record: a list of { what, check } with text in both. */
export function readUnsure(value: unknown): Unsure[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((u): u is Record<string, unknown> => !!u && typeof u === 'object')
    .map((u) => ({ what: String(u.what ?? '').trim().slice(0, 300), check: String(u.check ?? '').trim().slice(0, 300) }))
    .filter((u) => u.what && u.check)
    .slice(0, 3)
}

/** Reads `seenAt` from an AI reply: a list of { mission, step }. */
export function readStepRefs(value: unknown): StepRef[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .map((r) => ({ mission: String(r.mission ?? '').trim(), step: Number(r.step) }))
    .filter((r) => r.mission && Number.isInteger(r.step) && r.step > 0)
    .slice(0, 6)
}

/** Reads `kind` from an AI reply. */
export function readKind(value: unknown): 'behaviour' | 'wording' | undefined {
  return value === 'wording' || value === 'behaviour' ? value : undefined
}
