/**
 * The app's door for coding agents.
 *
 * A coding agent on the builder's machine (Claude Code, Cursor, Codex) reaches
 * these tools through the DeepSpace CLI:
 *
 *   npx deepspace agent tools first-run-tester --json
 *   npx deepspace agent invoke first-run-tester first_run_fix_list --input '{"url":"https://my-app.app.space"}' --json
 *
 * Two tools are this app's own: `first_run_reports` and `first_run_fix_list`.
 * They let the agent that will fix the problems read them directly, instead
 * of a person copying each fix prompt across by hand. The rest are DeepSpace's
 * generic read tools.
 *
 * The door is read-only on purpose. The write tools the scaffold allowed
 * (create, update, delete) are removed, and nothing here can start a test, so
 * an agent can never spend the person's credits. Every call runs as the
 * signed-in person, so an agent sees only that person's own apps and reports.
 */

import { jsonSchema, tool } from 'ai'
import type { ToolSet } from 'ai'
import { z } from 'zod/v4'
import { BUILT_IN_TOOLS, applyAiToolDefaults } from 'deepspace/worker'
import type { AgentToolContext, ToolSchema, CollectionSchema } from 'deepspace/worker'
import type { Env } from '../../worker'
import { fixList, listReports, type Issue, type Run, type Site } from '../server/agent-reports'

type ToolExecutor = (toolName: string, params: Record<string, unknown>) => Promise<unknown>

/** Read-only: no create, update or delete. */
const ALLOWED_TOOL_NAMES = ['schema.list', 'schema.describe', 'records.query', 'records.get', 'user.current']

/** This app's own tools, described for the agent that will call them. */
const FIRST_RUN_TOOLS: ToolSchema[] = [
  {
    name: 'first_run_reports',
    description:
      "List the person's apps in First-run tester, each with its latest finished test: a summary, how many " +
      'problems are open, fixed or still broken, and a link to the report. Start here to see what there is.',
    params: {},
  },
  {
    name: 'first_run_fix_list',
    description:
      'Get the ranked fix list from a first-run test: what a first-time user ran into, with a ready-made fix ' +
      'prompt and a "done when" check for each problem. Use this when asked to fix what First-run tester found. ' +
      "Pass the app's url, or a runId from first_run_reports, or neither for the most recent test. Read-only: it " +
      'cannot start a test or a retest.',
    params: {
      url: { type: 'string', description: "The tested app's address, for example https://my-app.app.space" },
      runId: { type: 'string', description: 'A specific test, from first_run_reports' },
      includeFixed: { type: 'boolean', description: 'Also return problems already confirmed fixed. Default false.' },
    },
  },
]

/** Reads every row the caller may see in one collection (their own, by the collection's permissions). */
async function readAll<T>(executor: ToolExecutor, collection: string): Promise<Array<{ recordId: string; data: T }>> {
  const result = (await executor('records.query', { collection, limit: 500 })) as {
    success?: boolean
    data?: { records?: Array<{ recordId: string; data: T }> }
  }
  return result?.success ? (result.data?.records ?? []) : []
}

// ============================================================================
// System prompt
// ============================================================================

type Interpretation = CollectionSchema['columns'][number]['interpretation']

/**
 * Interpretation is `string | Record<string, unknown>`. When it's an object
 * the convention across the SDK's schemas is `{ kind: string, ... }`.
 * Narrow safely to a human-readable name.
 */
function interpretationLabel(interpretation: Interpretation): string {
  if (typeof interpretation === 'string') return interpretation
  const kind = interpretation.kind
  return typeof kind === 'string' ? kind : 'object'
}

export function buildSystemPrompt(appName: string, schemas: CollectionSchema[]): string {
  const schemaSummary = schemas
    .map((s) => {
      const cols = (s.columns ?? [])
        .map((c) => `${c.name}:${interpretationLabel(c.interpretation)}${c.required ? '!' : ''}`)
        .join(', ')
      return `- ${s.name}${cols ? ` (${cols})` : ''}`
    })
    .join('\n')

  return [
    `You are the assistant for the "${appName}" app on DeepSpace.`,
    "You can read and modify the user's data via the available tools. The",
    "user's own role and permissions still apply at the data layer — your",
    'tool calls run as the calling user, so you can only do what they could.',
    '',
    'Be careful with mutations:',
    '- Confirm intent before destructive actions (delete, bulk update).',
    '- Operate only on collections the user explicitly mentioned.',
    '- After a successful write, briefly confirm what changed.',
    '- If a write is denied (RBAC), tell the user plainly — do not retry blindly.',
    '',
    'Use tools to look up facts before answering. Do not invent data.',
    'If data is missing, say so plainly. Keep answers concise.',
    '',
    'Available collections:',
    schemaSummary || '(none)',
  ].join('\n')
}

// ============================================================================
// Tool definitions
// ============================================================================

export function buildTools(executor: ToolExecutor, context?: AgentToolContext<Env>): ToolSet {
  const tools: ToolSet = {}

  // Where a report lives on the web, so the agent can point the person at it.
  const reportUrl = (runId: string) => `https://${context?.env.APP_NAME ?? 'first-run-tester'}.app.space/runs/${runId}`
  const load = async () => ({
    sites: await readAll<Site>(executor, 'sites'),
    runs: await readAll<Run>(executor, 'runs'),
    issues: await readAll<Issue>(executor, 'issues'),
  })

  for (const def of FIRST_RUN_TOOLS) {
    tools[def.name] = tool({
      description: def.description,
      inputSchema: buildInputSchema(def),
      execute: async (params: Record<string, unknown>) => {
        const { sites, runs, issues } = await load()
        if (def.name === 'first_run_reports') return { apps: listReports(sites, runs, issues, reportUrl) }
        return fixList(
          sites,
          runs,
          issues,
          {
            url: typeof params.url === 'string' ? params.url : undefined,
            runId: typeof params.runId === 'string' ? params.runId : undefined,
            includeFixed: params.includeFixed === true,
          },
          reportUrl,
        )
      },
    })
  }

  for (const def of BUILT_IN_TOOLS) {
    if (!ALLOWED_TOOL_NAMES.includes(def.name)) continue
    const safeName = def.name.replace('.', '_')
    tools[safeName] = tool({
      description: def.description,
      inputSchema: buildInputSchema(def),
      // Apply assistant-only param defaults (e.g. records.query page size) here
      // in the AI tool layer, so internal record readers that hit the tools
      // dispatch directly stay unbounded.
      execute: async (params: Record<string, unknown>) =>
        executor(def.name, applyAiToolDefaults(def.name, params)),
    })
  }

  return tools
}

// ============================================================================
// Convert ToolSchema params → Zod validator + derived provider JSON Schema
// ============================================================================

/**
 * The Zod validator is the single source; the provider-facing JSON Schema is
 * derived from it with Zod's native conversion, which keeps z.record()
 * objects open (`additionalProperties: {}`). The AI SDK's own Zod conversion
 * closes every object, which would incorrectly advertise the free-form
 * `data` and `where` objects as empty — so the conversion happens here.
 */
function buildInputSchema(def: ToolSchema) {
  const shape: Record<string, z.ZodTypeAny> = {}

  for (const [name, param] of Object.entries(def.params)) {
    let s: z.ZodTypeAny
    switch (param.type) {
      case 'string':
        s = z.string()
        break
      case 'number':
        s = z.number()
        break
      case 'boolean':
        s = z.boolean()
        break
      case 'object':
        s = z.record(z.string(), z.unknown())
        break
      case 'array':
        s = z.array(z.unknown())
        break
    }
    if (param.description) s = s.describe(param.description)
    if (!param.required) s = s.optional()
    shape[name] = s
  }

  const validator = z.object(shape)
  return jsonSchema<Record<string, unknown>>(
    z.toJSONSchema(validator) as Parameters<typeof jsonSchema>[0],
    {
      validate: async (value) => {
        const result = await validator.safeParseAsync(value)
        return result.success
          ? { success: true, value: result.data }
          : { success: false, error: result.error }
      },
    },
  )
}
