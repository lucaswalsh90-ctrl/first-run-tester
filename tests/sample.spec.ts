import { test, expect } from '@playwright/test'
import { captureConsoleErrors } from './helpers/errors'

/**
 * The public sample is the one part of the product a signed-out visitor can
 * use, so it gets its own end-to-end check: it must play through to the fix
 * list with no sign-in, no server calls and no console errors.
 */
test.describe('Public sample', () => {
  test('landing links to the sample, and the sample plays through to the fix list', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    const serverCalls: string[] = []
    page.on('request', (req) => {
      const path = new URL(req.url()).pathname
      if (path.startsWith('/api/')) serverCalls.push(path)
    })

    await page.goto('/')
    await page.getByRole('link', { name: /watch a free sample/i }).click()
    await expect(page).toHaveURL(/\/sample$/)

    // Sessions start as "running", then land a few seconds apart.
    await expect(page.getByText('Clicking through…').first()).toBeVisible()
    await expect(page.getByText('The fix list appears once both browser sessions finish.')).toBeVisible()
    await expect(page.getByText('Done', { exact: true })).toBeVisible({ timeout: 20_000 })

    // Both sessions show their steps, and a hesitation is flagged.
    await expect(page.getByRole('heading', { name: 'First look' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Main goal' })).toBeVisible()
    await expect(page.getByText('hesitated here').first()).toBeVisible()

    // The fix list has ranked issues, each with a prompt for a coding agent.
    const issues = page.locator('ol > li').filter({ hasText: 'Fix prompt for your coding agent' })
    await expect(issues).toHaveCount(5)
    await issues.first().getByText('Fix prompt for your coding agent').click()
    await expect(issues.first().locator('pre')).toContainText('Make the change directly in this repository')

    // Retest is for your own app, so it is off here and says why.
    await expect(issues.first().getByRole('button', { name: /retest/i })).toBeDisabled()
    await expect(issues.first().getByText('Retest works on your own app.')).toBeVisible()

    expect(serverCalls).toEqual([])
    expect(errors).toEqual([])
  })

  test('a private report is not shown to a signed-out visitor', async ({ page }) => {
    await page.goto('/runs/anything')
    await expect(page.getByRole('heading', { name: 'Sign in to test your own app' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Fix list')).toHaveCount(0)
  })
})
