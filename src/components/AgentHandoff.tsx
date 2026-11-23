/**
 * "Hand this to your coding agent": the box above a fix list.
 *
 * Added after the first real click-through, where the person using the report
 * had no idea a coding agent could fetch it. Copying five prompts one by one
 * was the only visible way. Now there are three one-step ways (see lib/handoff.ts):
 * open your coding agent with the prompt already in it, copy everything in one
 * go, or have the agent fetch the list itself.
 */
import { useState } from 'react'
import { Button, useToast } from '@/components/ui'
import { ManualCopy } from '@/components/ManualCopy'
import { copyText } from '@/lib/copy'
import { SKILL_ASK, SKILL_INSTALL, agentCommand, agentLinks, allFixPrompts, asExample, unfixed } from '@/lib/handoff'
import { readFolder, saveFolder } from '@/lib/prefill'
import type { Issue } from '@/lib/types'

export function AgentHandoff({
  site,
  issues,
  appName,
  runId,
  example = false,
}: {
  site: { name: string; url: string }
  issues: Array<Pick<Issue, 'title' | 'fixPrompt' | 'status'>>
  /** Set both to also show the command an agent can run. Left out on the public sample. */
  appName?: string
  runId?: string
  /** On the sample report: these prompts are for someone else's app. */
  example?: boolean
}) {
  const { success, error } = useToast()
  // The app's folder on this computer, remembered in this browser only.
  const [folder, setFolder] = useState(() => readFolder(site.url))
  // Set when the browser refused to copy: the text is then shown, selected, to copy by hand.
  const [manual, setManual] = useState<{ text: string; what: string } | null>(null)
  // The open-in-agent link last pressed, if it needs the browser to open an app. Some browsers
  // ignore such a link silently, so the same prompt is then offered as text to copy.
  const [pressed, setPressed] = useState<{ name: string; prompt: string } | null>(null)
  const todo = unfixed(issues).length
  if (todo === 0) return null
  const command = appName && runId ? agentCommand(appName, runId) : null
  const links = appName && runId ? agentLinks(appName, runId, site, folder) : []

  async function copy(text: string, what: string) {
    if (!(await copyText(text))) {
      setManual({ text, what })
      error('This browser blocked copying', 'The text is shown below, already selected.')
      return
    }
    setManual(null)
    if (example) success(`${what} copied`, "They're for the demo app, so your coding agent has nothing to fix. Test your own app to get real ones.")
    else success(`${what} copied`, "Paste it into your coding agent, opened in your app's folder.")
  }

  return (
    <div className="mb-4 rounded-lg bg-card p-5 shadow-[0_1px_6px_0_var(--color-border)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            {example ? 'What you would hand to your coding agent' : 'Hand this to your coding agent'}
          </h3>
          <p className="mt-0.5 text-muted-foreground">
            {example
              ? `An example. These ${todo} prompts are about the demo app, which is not your code.`
              : `${todo === 1 ? 'One problem' : `All ${todo} problems`} in a single prompt. Paste it into your coding agent, opened in your app's folder.`}
          </p>
        </div>
        <Button
          size="lg"
          variant={example ? 'outline' : 'default'}
          onClick={() =>
            copy(
              example ? asExample(allFixPrompts(site, issues), site.name) : allFixPrompts(site, issues),
              example ? 'Example prompts' : 'Fix prompts',
            )
          }
        >
          {example
            ? `Copy all ${todo} example prompts`
            : todo === 1
              ? 'Copy the fix prompt'
              : `Copy all ${todo} fix prompts`}
        </Button>
      </div>
      {manual && <ManualCopy text={manual.text} />}

      {/* The sample has no report of the visitor's own, so the open-in-agent links can't work here.
          Without this line nobody looking at the sample would know they exist. */}
      {example && (
        <p className="mt-4 text-muted-foreground">
          On your own report you don't have to copy: one click opens Claude Code, Cursor or Codex with the prompt
          already in it.
        </p>
      )}

      {links.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="font-medium text-foreground">Or open your coding agent with the prompt already in it</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {links.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={() => setPressed(link.opensApp ? { name: link.name, prompt: link.prompt } : null)}
                className="inline-flex items-center rounded-md border border-border bg-background px-4 py-2 font-medium text-foreground transition-colors hover:bg-muted"
              >
                Open in {link.name}
              </a>
            ))}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            It opens on this computer with the prompt waiting. Nothing is sent until you press Enter.
          </p>
          {pressed && (
            <div className="mt-3 flex flex-wrap items-center gap-3" role="status">
              <p className="text-foreground">
                Nothing opened? Some browsers, like the one inside the Claude app, can't open {pressed.name} from a
                link.
              </p>
              <Button size="sm" variant="outline" onClick={() => copy(pressed.prompt, `${pressed.name} prompt`)}>
                Copy the {pressed.name} prompt
              </Button>
            </div>
          )}
          <label htmlFor="app-folder" className="mt-4 block font-medium text-foreground">
            Your app's folder on this computer (optional)
          </label>
          <input
            id="app-folder"
            type="text"
            value={folder}
            onChange={(e) => {
              setFolder(e.target.value)
              saveFolder(site.url, e.target.value)
            }}
            placeholder="/Users/you/projects/my-app"
            spellCheck={false}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring"
          />
          <p className="mt-1 text-sm text-muted-foreground">
            {folder.trim()
              ? 'Claude Code and Codex will open in this folder. It is saved in this browser only.'
              : 'Without it the agent opens in your home folder and asks where the code is. Saved in this browser only.'}
          </p>
        </div>
      )}

      {command && (
        <details className="mt-4 border-t border-border pt-3">
          <summary className="cursor-pointer font-medium text-foreground">
            Or connect your coding agent once, and never paste again
          </summary>
          <p className="mt-2 text-muted-foreground">
            Run this once in your app's folder. It adds a skill, which is a small text file of instructions, so your
            agent knows how to fetch your fix list and work through it. After that you only have to say:{' '}
            <strong className="text-foreground">"{SKILL_ASK}"</strong>.
          </p>
          <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 font-mono text-sm text-foreground">{SKILL_INSTALL}</pre>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Button size="sm" variant="outline" onClick={() => copy(SKILL_INSTALL, 'Command')}>Copy the command</Button>
            <span className="text-sm text-muted-foreground">
              It adds that one file to your project. Works with Claude Code, Cursor and Codex.
            </span>
          </div>
        </details>
      )}

      {command && (
        <details className="mt-4 border-t border-border pt-3">
          <summary className="cursor-pointer font-medium text-foreground">
            Or let your agent fetch the list itself
          </summary>
          <p className="mt-2 text-muted-foreground">
            A website can't send a prompt into your coding agent, but your agent can fetch one. Ask it to run this
            and fix what comes back. It only reads your own reports and can't spend credits.
          </p>
          <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 font-mono text-sm text-foreground">{command}</pre>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Button size="sm" variant="outline" onClick={() => copy(command, 'Command')}>Copy the command</Button>
            <span className="text-sm text-muted-foreground">
              Needs the DeepSpace CLI signed in once: <code className="font-mono">npx deepspace auth login</code>
            </span>
          </div>
        </details>
      )}
    </div>
  )
}
