/** Unit tests for handing a fix list to a coding agent. */
import { describe, expect, it } from 'vitest'
import { FOLDER_CHECK, agentCommand, agentLinks, agentPrompt, allFixPrompts, asExample, unfixed, withFolderCheck } from './handoff'

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
    expect(text).toContain('stop and ask me where the code is')
    expect(text).toContain('Do not search the rest of the computer')
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

describe('agentLinks', () => {
  const links = agentLinks('first-run-tester', 'run_123', site)

  it('makes one link per coding agent, in the format each one documents', () => {
    expect(links.map((l) => l.name)).toEqual(['Claude Code', 'Cursor', 'Codex'])
    expect(links[0].href.startsWith('claude-cli://open?q=')).toBe(true)
    expect(links[1].href.startsWith('https://cursor.com/link/prompt?text=')).toBe(true)
    expect(links[2].href.startsWith('codex://new?prompt=')).toBe(true)
  })

  it('carries the prompt intact, including the command to fetch the list', () => {
    const carried = decodeURIComponent(links[0].href.split('?q=')[1])
    expect(carried).toBe(agentPrompt('first-run-tester', 'run_123', site))
    expect(carried).toContain(agentCommand('first-run-tester', 'run_123'))
    expect(carried).toContain('treat them as bug reports')
  })

  it("stays inside each agent's length limit", () => {
    expect(agentPrompt('first-run-tester', 'run_123', site).length).toBeLessThan(5000) // Claude Code: 5,000 on the prompt
    expect(links[1].href.length).toBeLessThan(10000) // Cursor: 10,000 on the whole link
  })
})

describe('asExample', () => {
  it('says up front that the prompt is an example and tells an agent to stop', () => {
    const text = asExample('Please fix a first-run problem in TodoMVC demo.', 'TodoMVC demo')
    expect(text.startsWith('EXAMPLE ONLY')).toBe(true)
    expect(text).toContain('TodoMVC demo, a public demo app')
    expect(text).toContain('say that it is an example and stop')
    expect(text.endsWith('Please fix a first-run problem in TodoMVC demo.')).toBe(true)
  })
})

describe('agentPrompt', () => {
  it('has the agent check its folder before it fetches anything', () => {
    const text = agentPrompt('first-run-tester', 'run_123', site)
    expect(text.indexOf('stop and ask me where the code is')).toBeLessThan(text.indexOf('npx deepspace'))
  })

  it('names the tested app, so the agent knows which code to look for', () => {
    const text = agentPrompt('first-run-tester', 'run_123', site)
    expect(text.split('\n')[0]).toBe('Fix the first-run problems that First-run tester found in My app (https://my-app.app.space/).')
    expect(text).toContain('Do not commit or deploy')
  })
})

describe('withFolderCheck', () => {
  it('adds the check as the second line of a prompt saved before the check existed', () => {
    const old = 'Please fix a first-run problem in My app.\nMake the change directly in this repository.'
    expect(withFolderCheck(old).split('\n')).toEqual([
      'Please fix a first-run problem in My app.',
      FOLDER_CHECK,
      'Make the change directly in this repository.',
    ])
  })

  it('leaves a prompt that already has it alone', () => {
    const current = `Please fix.\n${FOLDER_CHECK}\nMake the change.`
    expect(withFolderCheck(current)).toBe(current)
  })
})
