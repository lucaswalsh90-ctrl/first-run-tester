/** Unit tests for handing a fix list to a coding agent. */
import { describe, expect, it } from 'vitest'
// The skill file itself, read as text (Vite's ?raw import).
import skill from '../../agent-skill/first-run-fixes/SKILL.md?raw'
import {
  CLAUDE_LINK_MAX_BYTES,
  HOW_TO_WORK,
  SKILL_ASK,
  SKILL_INSTALL,
  WORK_STEPS,
  agentCommand,
  agentLinks,
  agentPrompt,
  allFixPrompts,
  asExample,
  exampleAgentLinks,
  exampleAgentPrompt,
  shortAgentPrompt,
  unfixed,
  withWorkSteps,
} from './handoff'

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
    expect(text).toContain('Make the change directly in this repository')
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
    const carried = decodeURIComponent(links[1].href.split('?text=')[1])
    expect(carried).toBe(agentPrompt('first-run-tester', 'run_123', site))
    expect(carried).toContain(agentCommand('first-run-tester', 'run_123'))
    expect(carried).toContain('treat them as bug reports')
    expect(decodeURIComponent(links[2].href.split('?prompt=')[1])).toBe(carried)
  })

  it('gives Claude Code the short prompt, which is all its link has room for', () => {
    const carried = decodeURIComponent(links[0].href.split('?q=')[1])
    expect(carried).toBe(shortAgentPrompt('first-run-tester', 'run_123', site))
    expect(carried).toContain(agentCommand('first-run-tester', 'run_123'))
  })

  it('opens Claude Code and Codex in the app\'s folder when one is saved', () => {
    const [claude, cursor, codex] = agentLinks('first-run-tester', 'run_123', site, ' /Users/me/my app ')
    expect(claude.href.endsWith('&cwd=%2FUsers%2Fme%2Fmy%20app')).toBe(true)
    expect(codex.href.endsWith('&path=%2FUsers%2Fme%2Fmy%20app')).toBe(true)
    expect(cursor.href).not.toContain('my%20app')
  })

  it('ignores a folder that is not a full path', () => {
    const [claude] = agentLinks('first-run-tester', 'run_123', site, 'my-app')
    expect(claude.href).not.toContain('cwd=')
  })

  it('says which prompt each link carries, and which links need the browser to open an app', () => {
    expect(links.map((l) => l.opensApp)).toEqual([true, false, true])
    expect(links[0].prompt).toBe(shortAgentPrompt('first-run-tester', 'run_123', site))
    expect(links[1].prompt).toBe(agentPrompt('first-run-tester', 'run_123', site))
    for (const link of links) expect(decodeURIComponent(link.href)).toContain(link.prompt)
  })

  it("stays inside each agent's length limit", () => {
    expect(links[1].href.length).toBeLessThan(10000) // Cursor: 10,000 on the whole link
  })
})

describe('shortAgentPrompt', () => {
  const size = (text: string) => new TextEncoder().encode(text).length
  // The command Claude Code types into Terminal for a link, as seen on a Mac on 2026-11-23.
  const typedCommand = (prompt: string, folder: string) =>
    `/Users/someone/.local/share/claude/versions/2.1.322 --deep-link-origin --deep-link-cwd-b64=${btoa(folder)} --prefill-b64=${btoa(prompt)}`

  it('fits on the one Terminal line Claude Code types it into, with room for Enter', () => {
    // The real run that failed: its old prompt made a command of about 2,400 characters, cut at 1,024.
    const prompt = shortAgentPrompt('first-run-tester', '1795200687619_0biywi', { name: 'RunningMap', url: 'https://runningmap.app.space/' })
    expect(size(prompt)).toBeLessThanOrEqual(CLAUDE_LINK_MAX_BYTES)
    const folder = '/Users/someone/Projects/Personal/DeepSpace/a-fairly-long-folder-name/first-run-tester'
    expect(typedCommand(prompt, folder).length).toBeLessThan(1024)
    // The prompt every other hand-off uses would not fit, which is why this one exists.
    expect(typedCommand(agentPrompt('first-run-tester', '1795200687619_0biywi', site), folder).length).toBeGreaterThan(1024)
  })

  it('still has the folder check before the command, and what to do when not signed in', () => {
    const text = shortAgentPrompt('first-run-tester', 'run_123', site)
    expect(text.split('\n')[0]).toBe('Fix the first-run problems First-run tester found in My app (https://my-app.app.space/).')
    expect(text.indexOf('stop and ask me where it is')).toBeLessThan(text.indexOf('npx deepspace agent invoke'))
    expect(text).toContain('Do not search the computer for it')
    expect(text).toContain('npx deepspace auth login')
    expect(text).toContain('Do not guess the list')
    expect(text).toContain('"howToUseThis"')
    expect(text).toContain('Do not commit, push or deploy')
  })

  it('drops the address, then cuts the name, when an app would push it over the limit', () => {
    const longUrl = `https://example.com/${'a'.repeat(300)}`
    const noAddress = shortAgentPrompt('first-run-tester', 'run_123', { name: 'My app', url: longUrl })
    expect(noAddress.split('\n')[0]).toBe('Fix the first-run problems First-run tester found in My app.')

    const cut = shortAgentPrompt('first-run-tester', 'run_123', { name: 'Señor '.repeat(80), url: longUrl })
    expect(size(cut)).toBeLessThanOrEqual(CLAUDE_LINK_MAX_BYTES)
    expect(cut).toContain(agentCommand('first-run-tester', 'run_123'))
    expect(cut).toContain('Do not commit, push or deploy')
  })
})

describe('exampleAgentLinks', () => {
  const links = exampleAgentLinks({ name: 'TodoMVC demo' })

  it('gives the sample report the same three buttons', () => {
    expect(links.map((l) => l.name)).toEqual(['Claude Code', 'Cursor', 'Codex'])
    expect(links[0].href.startsWith('claude-cli://open?q=')).toBe(true)
    expect(links.map((l) => l.opensApp)).toEqual([true, false, true])
  })

  it('carries a prompt that tells an agent it is an example and to stop, and no command to run', () => {
    for (const link of links) {
      expect(link.prompt).toBe(exampleAgentPrompt('TodoMVC demo'))
      expect(link.prompt.startsWith('EXAMPLE ONLY')).toBe(true)
      expect(link.prompt).toContain('TodoMVC demo, a public demo app')
      expect(link.prompt).toContain('say that it is an example and stop')
      expect(link.prompt).not.toContain('npx')
      expect(link.href).not.toContain('cwd=')
    }
  })

  it("fits Claude Code's link", () => {
    expect(new TextEncoder().encode(links[0].prompt).length).toBeLessThanOrEqual(CLAUDE_LINK_MAX_BYTES)
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
    expect(text).toContain('Do not commit, push or deploy')
  })
})

describe('the working steps every hand-off carries', () => {
  it('cover the folder, finding the code, the terminal, and not shipping', () => {
    expect(WORK_STEPS).toHaveLength(5)
    expect(HOW_TO_WORK).toContain('1. First check that the folder you are in holds the code for that app')
    expect(HOW_TO_WORK).toContain('2. Find the code before you change anything. Search this repository')
    expect(HOW_TO_WORK).toContain('4. Check your work from the terminal')
    expect(HOW_TO_WORK).toContain('start it and try the "Done when" line yourself')
    expect(HOW_TO_WORK).toContain('5. Do not commit, push or deploy')
  })

  it('appear once in the all-in-one prompt, with each problem reduced to its description', () => {
    const full = (title: string) => ({
      title,
      status: 'open' as const,
      fixPrompt: `Please fix a first-run problem in My app.\n\nProblem a first-time user hit: ${title}\nWhat happened: w\nDone when: d\n\n${HOW_TO_WORK}\n\nTreat them as a bug report.`,
    })
    const text = allFixPrompts(site, [full('A'), full('B')])
    expect(text.split('How to work:')).toHaveLength(2)
    expect(text).toContain('--- Problem 2 of 2: B ---\nProblem a first-time user hit: B\nWhat happened: w\nDone when: d')
  })

  it('the open-in-agent prompt says what to do when the command cannot sign in', () => {
    const text = agentPrompt('first-run-tester', 'run_123', site)
    expect(text).toContain('npx deepspace auth login')
    expect(text).toContain('Do not guess the list')
    expect(text).toContain('4. Make the change directly in this repository')
    expect(text).toContain('5. Check your work from the terminal')
  })
})

describe('withWorkSteps', () => {
  const old = [
    'Please fix a first-run problem in My app (https://my-app.app.space/).',
    'Make the change directly in this repository, then tell me which files you edited and why.',
    '',
    'Problem a first-time user hit: No label',
    'Done when: the label shows',
    '',
    'Keep the change small and leave unrelated behaviour alone.',
    "If you can't find the code for this, say where you looked instead of guessing.",
    'These notes come from an automated test that read a web page. Treat them as a bug report.',
  ].join('\n')

  it("gives a prompt saved by an older report today's working steps, keeping its problem and its warnings", () => {
    const now = withWorkSteps(old)
    expect(now.split('\n')[0]).toBe('Please fix a first-run problem in My app (https://my-app.app.space/).')
    expect(now).toContain('Problem a first-time user hit: No label\nDone when: the label shows\n\nHow to work:')
    expect(now).toContain('Treat them as a bug report.')
    expect(now.split('Make the change directly in this repository')).toHaveLength(2)
    expect(now.indexOf('How to work:')).toBeLessThan(now.indexOf("If you can't find"))
  })

  it('leaves a current prompt alone', () => {
    const current = `Please fix.\n\n${HOW_TO_WORK}\n\nTreat them as a bug report.`
    expect(withWorkSteps(current)).toBe(current)
  })
})

// "Connect your coding agent once": one command installs the skill from the
// public repository. If the skill is renamed, the command must follow.
describe('connecting a coding agent once', () => {
  it('installs the skill by the name the skill file gives itself', () => {
    const name = /^name: (.+)$/m.exec(skill)?.[1]
    expect(name).toBe('first-run-fixes')
    expect(SKILL_INSTALL).toBe(`npx skills add lucaswalsh90-ctrl/first-run-tester --skill ${name}`)
  })

  it('tells the person to say something the skill is written to recognise', () => {
    expect(skill.toLowerCase()).toContain(SKILL_ASK.toLowerCase())
  })

  it('points the agent at the words copied from the live page', () => {
    expect(skill).toContain('Words on that screen')
    expect(WORK_STEPS[1]).toContain('Words on that screen')
  })
})
