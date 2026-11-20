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
    await page.getByRole('link', { name: /see a sample report/i }).click()
    await expect(page).toHaveURL(/\/sample$/)

    // It says plainly that this is someone else's app and what the agent was asked to do.
    await expect(page.getByText("someone else's app")).toBeVisible()

    // The fix list is on the page straight away: ranked issues, each with a prompt for a coding agent.
    const issues = page.locator('ol > li').filter({ hasText: 'Fix prompt for your coding agent' })
    await expect(issues).toHaveCount(5, { timeout: 2_000 })
    await issues.first().getByText('Fix prompt for your coding agent').click()
    await expect(issues.first().locator('pre')).toContainText('Make the change directly in this repository')

    // Both sessions show their steps with no placeholder, and a hesitation is flagged.
    await expect(page.getByRole('heading', { name: 'First look' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Main goal' })).toBeVisible()
    await expect(page.getByText('hesitated here').first()).toBeVisible()
    await expect(page.getByText('Clicking through…')).toHaveCount(0)

    // Retest is for your own app, so it is off here and says why.
    await expect(issues.first().getByRole('button', { name: /retest/i })).toBeDisabled()
    await expect(issues.first().getByText('Retest works on your own app.')).toBeVisible()

    expect(serverCalls).toEqual([])
    expect(errors).toEqual([])
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
