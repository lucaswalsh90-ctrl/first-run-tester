/** Unit tests for handing a fix list to a coding agent. */
import { describe, expect, it } from 'vitest'
import { agentCommand, allFixPrompts, unfixed } from './handoff'

const site = { name: 'My app', url: 'https://my-app.app.space/' }
const issue = (title: string, status: 'open' | 'fixed' | 'still_broken' | 'retesting') => ({
  title,
  status,
  fixPrompt: `Prompt for ${title}`,
})

describe('allFixPrompts', () => {
  it('puts every unfixed problem in one prompt, in order, and leaves out fixed ones', () => {
    const text = allFixPrompts(site, [issue('A', 'open'), issue('B', 'fixed'), issue('C', 'still_broken')])
    expect(text).toContain('Please fix 2 first-run problems in My app')
    expect(text).toContain('--- Problem 1 of 2: A ---')
    expect(text).toContain('--- Problem 2 of 2: C ---')
    expect(text).not.toContain('Prompt for B')
    expect(text.indexOf('Prompt for A')).toBeLessThan(text.indexOf('Prompt for C'))
  })

  it('tells the agent to edit the repository and to treat the notes as bug reports', () => {
    const text = allFixPrompts(site, [issue('A', 'open')])
    expect(text).toContain('Please fix 1 first-run problem in My app')
    expect(text).toContain('Make the changes directly in this repository')
    expect(text).toContain('Treat them as bug reports')
  })

  it('is empty when everything is fixed', () => {
    expect(allFixPrompts(site, [issue('A', 'fixed')])).toBe('')
    expect(unfixed([issue('A', 'fixed'), issue('B', 'retesting')])).toHaveLength(1)
  })
})

describe('agentCommand', () => {
  it('builds the command an agent can run for one report', () => {
    expect(agentCommand('first-run-tester', 'run123')).toBe(
      `npx deepspace agent invoke first-run-tester first_run_fix_list --input '{"runId":"run123"}' --json`,
    )
  })
})
