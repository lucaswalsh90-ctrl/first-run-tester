import { test, expect } from '@playwright/test'
import { captureConsoleErrors } from './helpers/errors'

/**
 * The public sample is the one part of the product a signed-out visitor can
 * use, so it gets its own end-to-end check: it must play through to the fix
 * list with no sign-in, no server calls and no console errors.
 */
test.describe('Public sample', () => {
  test('landing links to the sample, and the whole report is there without waiting', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    const serverCalls: string[] = []
    page.on('request', (req) => {
      const path = new URL(req.url()).pathname
      if (path.startsWith('/api/')) serverCalls.push(path)
    })

    await page.goto('/')
    // Cost is stated next to the buttons, where the decision is made.
    await expect(page.getByText('The sample is free.')).toBeVisible()
    await page.getByRole('link', { name: /see a sample report/i }).click()
    await expect(page).toHaveURL(/\/sample$/)

    // It says plainly that this is someone else's app and what the agent was asked to do.
    await expect(page.getByText("someone else's app")).toBeVisible()

    // The fix list is on the page straight away: ranked issues, each with a prompt for a coding agent.
    const issues = page.locator('ol > li').filter({ hasText: 'Example fix prompt for a coding agent' })
    await expect(issues).toHaveCount(5, { timeout: 2_000 })
    await issues.first().getByText('Example fix prompt for a coding agent').click()
    await expect(issues.first().locator('pre')).toContainText('Make the change directly in this repository')

    // These prompts are about someone else's app. The first person to try the
    // product pasted one into their coding agent, which then hunted for code
    // that was never there. So the page and the prompt both say "example".
    await expect(issues.first().locator('pre')).toContainText('EXAMPLE ONLY')
    await expect(issues.first().locator('pre')).toContainText('say that it is an example and stop')
    await expect(issues.first().getByRole('button', { name: 'Copy example prompt' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Copy fix prompt', exact: true })).toHaveCount(0)

    // One button shows what handing the whole list to a coding agent looks like.
    await expect(page.getByRole('heading', { name: 'What you would hand to your coding agent' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Copy all 5 example prompts' })).toBeVisible()

    // Both sessions show their steps with no placeholder, and a hesitation is flagged.
    await expect(page.getByRole('heading', { name: 'First look' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Main goal' })).toBeVisible()
    await expect(page.getByText('hesitated here').first()).toBeVisible()
    await expect(page.getByText('Clicking through…')).toHaveCount(0)

    // Retest is for your own app. A greyed-out button looked broken to a newcomer,
    // so there is no button here, only a line saying where it works.
    await expect(issues.first().getByRole('button', { name: /retest/i })).toHaveCount(0)
    await expect(page.getByText('On your own app, each problem also gets a Retest button.')).toBeVisible()

    // The three labels are explained above the list. This line was written by a coding agent
    // that was handed the problem with the app's own fix prompt.
    await expect(page.getByText('could not get through.')).toBeVisible()

    // Steps are shown in plain English, not in the browser agent's own shorthand.
    await expect(page.getByText('Ticked the checkbox "Toggle Todo"')).toBeVisible()
    await expect(page.getByText('one entry per Enter')).toHaveCount(0)

    expect(serverCalls).toEqual([])
    expect(errors).toEqual([])
  })

  // The browser built into the Claude desktop app refuses the modern clipboard.
  // The first person to press these buttons there got "Could not copy" twice.
  test('copying still works when the browser refuses the modern clipboard', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __copied: string }
      w.__copied = ''
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: () => Promise.reject(new Error('NotAllowedError')) },
      })
      document.execCommand = () => {
        w.__copied = (document.activeElement as HTMLTextAreaElement | null)?.value ?? ''
        return true
      }
    })
    await page.goto('/sample')
    await page.getByRole('button', { name: 'Copy all 5 example prompts' }).click()
    await expect(page.getByText('Example prompts copied')).toBeVisible()
    expect(await page.evaluate(() => (window as unknown as { __copied: string }).__copied)).toContain('EXAMPLE ONLY')
  })

  test('when a browser blocks copying outright, the text is shown already selected', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: () => Promise.reject(new Error('NotAllowedError')) },
      })
      document.execCommand = () => false
    })
    await page.goto('/sample')
    await page.getByRole('button', { name: 'Copy all 5 example prompts' }).click()
    const box = page.getByLabel(/This browser blocked copying/)
    await expect(box).toBeVisible()
    await expect(box).toHaveValue(/EXAMPLE ONLY/)
    expect(await box.evaluate((el: HTMLTextAreaElement) => el.selectionEnd - el.selectionStart)).toBeGreaterThan(100)

    const issue = page.locator('ol > li').filter({ hasText: 'Example fix prompt for a coding agent' }).first()
    await issue.getByRole('button', { name: 'Copy example prompt' }).click()
    await expect(issue.getByLabel(/This browser blocked copying/)).toHaveValue(/Please fix a first-run problem/)
  })

  test('a private report is not shown to a signed-out visitor', async ({ page }) => {
    await page.goto('/runs/anything')
    await expect(page.getByRole('heading', { name: 'Sign in to test your own app' })).toBeVisible({ timeout: 15_000 })
    // The report's own sections must be absent (the sign-in panel mentions a
    // "fix list" in a sentence, so match the headings, not the words).
    await expect(page.getByRole('heading', { name: 'Fix list', exact: true })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Browser sessions' })).toHaveCount(0)
  })
})

/**
 * A signed-out visitor to /home sees the product in preview form, not an empty
 * sign-in gate. (The app's own first-run test flagged the gate twice.)
 */
test.describe('Signed-out home preview', () => {
  test('shows the real screen with an example and a way to sign in', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/home')

    await expect(page.getByRole('heading', { name: 'Your apps', level: 1 })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('This is a preview')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in to start' })).toBeVisible()

    // The form is there to look at, but can't be used until you sign in.
    await expect(page.getByLabel('Public link')).toBeDisabled()

    // The example app links to its finished report, which needs no sign-in.
    await expect(page.getByText('TodoMVC demo')).toBeVisible()
    await page.getByRole('link', { name: 'Open its finished report' }).click()
    await expect(page).toHaveURL(/\/sample$/)
    await expect(page.getByRole('heading', { name: 'A sample report' })).toBeVisible()

    expect(errors).toEqual([])
  })

  test('asking to sign in opens the sign-in box with our wording', async ({ page }) => {
    await page.goto('/home')
    await page.getByRole('button', { name: 'Sign in to start' }).click()
    await expect(page.getByText('Sign in to First-run tester')).toBeVisible()
    // Wording from a real hand-off: a coding agent fetched this app's own report and made this change.
    await expect(page.getByText('Continue with Google or GitHub to create your free account.')).toBeVisible()
    await expect(page.getByText('The email form is only for accounts that already exist.')).toBeVisible()
  })
})

/**
 * Getting around, and the parts you can poke. Each of these came from the
 * first click-through by a person: no way back from the sample except the
 * logo, a link you had to type twice, and reports that only sat there.
 */
test.describe('Creating an account', () => {
  // The only door used to be a box titled "Sign in". Newcomers, and the app's
  // own tests, kept saying there was no way to create an account.
  test('the page offers Google, Microsoft and GitHub, and is honest about email sign-up', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/sample')
    await page.getByRole('link', { name: 'Create account' }).click()
    await expect(page).toHaveURL(/\/create-account$/)
    await expect(page.getByRole('heading', { name: 'Create your free account' })).toBeVisible()

    // Each button is a plain link to the platform's own sign-in route.
    for (const [name, id] of [['Google', 'google'], ['Microsoft', 'microsoft'], ['GitHub', 'github']]) {
      await expect(page.getByRole('link', { name: `Continue with ${name}` })).toHaveAttribute(
        'href',
        `/api/auth/social-redirect?provider=${id}`,
      )
    }
    await expect(page.getByText('Outlook, Hotmail, work or school')).toBeVisible()
    await expect(page.getByText('has no email-and-password sign-up')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('the signed-out home screen points newcomers to it', async ({ page }) => {
    await page.goto('/home')
    await page.getByRole('link', { name: 'New here? Create your account' }).click()
    await expect(page).toHaveURL(/\/create-account$/)
  })

  test('someone who started a sign-in there lands on Your apps, once', async ({ page }) => {
    await page.goto('/create-account')
    await page.evaluate(() => sessionStorage.setItem('first-run-tester:sign-in-started', String(Date.now())))
    await page.goto('/')
    await expect(page).toHaveURL(/\/home$/)
    await page.goto('/')
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('link', { name: /see a sample report/i })).toBeVisible()
  })
})

test.describe('Getting around and interacting', () => {
  test('the top bar switches between the sample report and your apps', async ({ page }) => {
    await page.goto('/sample')
    await page.getByRole('link', { name: 'Your apps' }).click()
    await expect(page).toHaveURL(/\/home$/)
    await expect(page.getByRole('heading', { name: 'Your apps', level: 1 })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('link', { name: 'Sample report' }).first().click()
    await expect(page).toHaveURL(/\/sample$/)
    await expect(page.getByRole('heading', { name: 'A sample report' })).toBeVisible()
  })

  test('a link typed on the landing page is waiting in the form', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel("Paste your app's link to start").fill('my-app.example.com')
    await page.getByRole('button', { name: 'Test your app' }).click()
    await expect(page).toHaveURL(/\/home$/)
    await expect(page.getByLabel('Public link')).toHaveValue('https://my-app.example.com', { timeout: 15_000 })
    await expect(page.getByText('your link will be waiting in the form')).toBeVisible()
  })

  test('the hero replay can be stepped through by hand', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }) // no autoplay: start from the finished state
    await page.goto('/')
    const hero = page.getByRole('figure')
    await expect(hero.getByText('Done checkbox has no visible label')).toBeVisible()
    await hero.getByRole('button', { name: /Step 3: 53% sure, hesitated here/ }).click()
    await expect(hero.getByText('Step 3 of 4 · 53% sure · hesitated here')).toBeVisible()
    await hero.getByRole('button', { name: 'Replay' }).click()
    await expect(hero.getByText('Done checkbox has no visible label')).toBeVisible({ timeout: 15_000 })
  })

  test('a session can be replayed step by step on a report', async ({ page }) => {
    await page.goto('/sample')
    const session = page.getByRole('article').filter({ hasText: 'Main goal' })
    await session.getByRole('button', { name: 'Replay steps' }).click()
    await expect(session.getByRole('button', { name: 'Stop' })).toBeVisible()
    await expect(session.getByRole('button', { name: /Step 1:/ })).toHaveAttribute('aria-pressed', 'true')
    // Pointing at a bar takes over from the replay and lights that step.
    await session.getByRole('button', { name: /Step 3:/ }).hover()
    await expect(session.getByRole('button', { name: /Step 3:/ })).toHaveAttribute('aria-pressed', 'true')
    await expect(session.getByRole('button', { name: 'Replay steps' })).toBeVisible()
  })
})
