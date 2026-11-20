/**
 * "Hand this to your coding agent": the box above a fix list.
 *
 * Added after the first real click-through, where the person using the report
 * had no idea a coding agent could fetch it. Copying five prompts one by one
 * was the only visible way. Now there are two one-step ways (see lib/handoff.ts).
 */
import { Button, useToast } from '@/components/ui'
import { agentCommand, allFixPrompts, unfixed } from '@/lib/handoff'
import type { Issue } from '@/lib/types'

export function AgentHandoff({
  site,
  issues,
  appName,
  runId,
}: {
  site: { name: string; url: string }
  issues: Array<Pick<Issue, 'title' | 'fixPrompt' | 'status'>>
  /** Set both to also show the command an agent can run. Left out on the public sample. */
  appName?: string
  runId?: string
}) {
  const { success, error } = useToast()
  const todo = unfixed(issues).length
  if (todo === 0) return null
  const command = appName && runId ? agentCommand(appName, runId) : null

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text)
      success(`${what} copied`, 'Paste it into Claude Code, Cursor or your coding agent.')
    } catch {
      error('Could not copy', 'Select the text and copy it by hand.')
    }
  }

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-5 shadow-[0_1px_2px_0_rgba(28,25,23,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground">Hand this to your coding agent</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {todo === 1 ? 'One problem' : `All ${todo} problems`} in a single prompt, ready to paste.
          </p>
        </div>
        <Button onClick={() => copy(allFixPrompts(site, issues), 'Fix prompts')}>
          {todo === 1 ? 'Copy the fix prompt' : `Copy all ${todo} fix prompts`}
        </Button>
      </div>

      {command && (
        <details className="mt-4 border-t border-border pt-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground">
            Or let your agent fetch the list itself
          </summary>
          <p className="mt-2 text-sm text-muted-foreground">
            A website can't send a prompt into your coding agent, but your agent can fetch one. Ask it to run this
            and fix what comes back. It only reads your own reports and can't spend credits.
          </p>
          <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs text-foreground">{command}</pre>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Button size="sm" variant="outline" onClick={() => copy(command, 'Command')}>Copy the command</Button>
            <span className="text-xs text-muted-foreground">
              Needs the DeepSpace CLI signed in once: <code className="font-mono">npx deepspace auth login</code>
            </span>
          </div>
        </details>
      )}
    </div>
  )
}
