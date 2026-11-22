/**
 * "Hand this to your coding agent": the box above a fix list.
 *
 * Added after the first real click-through, where the person using the report
 * had no idea a coding agent could fetch it. Copying five prompts one by one
 * was the only visible way. Now there are three one-step ways (see lib/handoff.ts):
 * open your coding agent with the prompt already in it, copy everything in one
 * go, or have the agent fetch the list itself.
 */
import { Button, useToast } from '@/components/ui'
import { agentCommand, agentLinks, allFixPrompts, asExample, unfixed } from '@/lib/handoff'
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
  const todo = unfixed(issues).length
  if (todo === 0) return null
  const command = appName && runId ? agentCommand(appName, runId) : null
  const links = appName && runId ? agentLinks(appName, runId, site) : []

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text)
      if (example) success(`${what} copied`, "They're for the demo app, so your coding agent has nothing to fix. Test your own app to get real ones.")
      else success(`${what} copied`, "Paste it into your coding agent, opened in your app's folder.")
    } catch {
      error('Could not copy', 'Select the text and copy it by hand.')
    }
  }

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-5 shadow-[0_1px_2px_0_rgba(28,25,23,0.04)]">
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

      {links.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="font-medium text-foreground">Or open your coding agent with the prompt already in it</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {links.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="inline-flex items-center rounded-md border border-border bg-background px-4 py-2 font-medium text-foreground transition-colors hover:bg-muted"
              >
                Open in {link.name}
              </a>
            ))}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            It opens on this computer with the prompt waiting. Nothing is sent until you press Enter. Check it is
            in your app's folder first.
          </p>
        </div>
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
