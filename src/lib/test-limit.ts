/**
 * What the test browser cannot do, and how to tell when that got in the way.
 *
 * The browser agent runs in the cloud on a machine with no graphics card.
 * Anything drawn with WebGL (interactive maps, 3D scenes, some charts) fails
 * to start there, even though it works in a real visitor's browser.
 *
 * This file exists because of the first real test of someone else's app, a
 * route planner whose whole first screen is a map. The agent saw "Failed to
 * initialize WebGL", and the report ranked "Map never loads" as the app's most
 * serious problem. That was the tester's blind spot, reported as the app's
 * bug. A tester that blames you for its own limits can't be trusted, so:
 *
 *   1. the agent is told about the limit up front (GRAPHICS_NOTE in tester.ts),
 *   2. the fix-list writer is told not to list it as a problem,
 *   3. as a backstop that does not depend on either AI doing as it was told,
 *      the checks below spot the failure in what the sessions wrote, and any
 *      finding that blames it is set aside and shown as a limit of the test.
 *
 * Pure functions, used by the server, the report page and the agent door.
 */

type Session = { steps?: unknown; report?: string; confusing?: string }

/**
 * A graphics failure, in the words a session uses for it. "WebGL" alone is not
 * enough (a site can be about WebGL), so it has to sit next to a failure word,
 * or the text has to name the software renderer a cloud browser falls back to.
 */
const FAILED = "fail|error|unable|could not|couldn't|cannot|can't|not supported|unsupported|context creation"
const GRAPHICS_FAILURE = new RegExp(
  `(web\\s?gl|webgpu)[^.]{0,120}(${FAILED})|(${FAILED})[^.]{0,120}(web\\s?gl|webgpu)|llvmpipe|swiftshader`,
  'i',
)
const GRAPHICS_WORD = /web\s?gl|webgpu|llvmpipe|swiftshader/i

/** Did any session run into the graphics limit? */
export function hitGraphicsLimit(sessions: Session[]): boolean {
  return sessions.some((s) => GRAPHICS_FAILURE.test(JSON.stringify([s.steps ?? '', s.report ?? '', s.confusing ?? ''])))
}

/** Is this finding about the graphics failure itself? Only meaningful once hitGraphicsLimit is true. */
export function blamesGraphicsLimit(issue: { title: string; detail: string }): boolean {
  return GRAPHICS_WORD.test(`${issue.title} ${issue.detail}`)
}

/** Splits a fix list into what to act on and what the test browser caused. */
export function setAsideTestLimits<T extends { title: string; detail: string }>(
  issues: T[],
  sessions: Session[],
): { limited: boolean; real: T[]; setAside: T[] } {
  if (!hitGraphicsLimit(sessions)) return { limited: false, real: issues, setAside: [] }
  return {
    limited: true,
    real: issues.filter((i) => !blamesGraphicsLimit(i)),
    setAside: issues.filter(blamesGraphicsLimit),
  }
}

/** The words shown on a report (and sent to a coding agent) when the limit was hit. */
export const GRAPHICS_LIMIT = {
  title: "The test browser couldn't draw part of this app",
  body:
    'It runs in the cloud with no graphics card, so anything drawn with WebGL (maps, 3D, some charts) fails ' +
    'there even when it works for real visitors. That is a limit of this test, not a problem with your app. ' +
    'The fix list only covers what the test browser could load.',
  next: 'For the part it could not see, watch one person who has never used the app try it.',
}
