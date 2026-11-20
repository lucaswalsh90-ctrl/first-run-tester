# First-run tester

Fresh eyes for your app. An AI agent uses your app like a brand-new user, in a real browser, and shows you where it got stuck.

**Live:** https://first-run-tester.app.space
**Free sample, no sign-in:** https://first-run-tester.app.space/sample

## The problem

When you build with a coding agent, the agent that checks your app is the one that wrote it. It knows what every button does, so it can't be confused the way a stranger is. A real newcomer who gets stuck leaves without telling you.

## What it does

1. You add your app's public link and say what a newcomer should be able to do ("sign up and create a project").
2. Two AI browser sessions run at the same time. One takes a first look. The other tries to reach your goal with no instructions.
3. A live board shows every step and how sure the agent was. Low confidence marks the places a newcomer would hesitate.
4. Claude turns both sessions into a ranked fix list.
5. Each problem comes with a prompt for your own coding agent, worded so it edits your repository and says when the fix is done.
6. After you fix something, **Retest** reruns one session and marks the problem Fixed or Still broken.
7. If your app sits behind sign-in, you can give the newcomer a throwaway **test login**.
8. The report is emailed to you and kept in your history.

## Two front doors: one for people, one for coding agents

The person who reads the fix list usually isn't the one who fixes it. Their coding agent is. So the app has a second door, built with DeepSpace's agent tools, that lets Claude Code, Cursor or Codex read a report directly:

```bash
npx deepspace agent invoke first-run-tester first_run_fix_list --input '{"url":"https://my-app.app.space"}' --json
```

It returns the ranked problems, each with its fix prompt and a "done when" check. A second tool, `first_run_reports`, lists your apps and their latest tests. [agent-skill/first-run-fixes/SKILL.md](agent-skill/first-run-fixes/SKILL.md) is a small skill that walks a coding agent through the loop. To use it, copy that folder into your project's `.claude/skills/`.

This door is read-only on purpose. An agent sees only the signed-in person's own reports, can't change anything, and can't start a test or a retest, so it can never spend your credits. The retest stays a person's click, and it is the only thing that marks a problem fixed.

## How it works

```
Browser (React)                 Worker (Hono on Cloudflare)            Outside services
---------------                 ---------------------------            ----------------
Home: add app, press Run  --->  action startTest
                                  writes a `runs` record
                                  starts 2 sessions  ----------------> Apify: AI browser agent
Run page: shows records,
  asks every 4 s  ----------->  action checkRun
                                  collects finished sessions <-------- Apify
                                  writes `missions` records
                                  asks for the fix list  ------------> Claude Haiku
                                  writes `issues` records
                                  sends the report  -----------------> Email
  (records update the page
   by themselves)
Retest button  -------------->  action retestIssue (one session)
```

The four collections are in [src/schemas/tester-schemas.ts](src/schemas/tester-schemas.ts): `sites`, `runs`, `missions` and `issues`.

| File | What is in it |
|---|---|
| [src/actions/index.ts](src/actions/index.ts) | The four server actions: `startTest`, `startSample`, `checkRun`, `retestIssue` |
| [src/server/tester.ts](src/server/tester.ts) | The instructions given to the browser agent, reading its results, the fix-list request, the fix-prompt wording, spend caps |
| [src/server/sample-run.ts](src/server/sample-run.ts) | A real test saved on 2026-11-20, shown by the sample report |
| [src/ai/tools.ts](src/ai/tools.ts), [src/server/agent-reports.ts](src/server/agent-reports.ts) | The two tools a coding agent can call, and what they return |
| [src/components/RunView.tsx](src/components/RunView.tsx) | The report pieces: session card, hesitation trace, step row, issue card |
| [src/lib/test-login.ts](src/lib/test-login.ts), [src/components/TestLoginBox.tsx](src/components/TestLoginBox.tsx) | The optional test login, held in the tab's memory only |
| [src/pages/(app)/home.tsx](<src/pages/(app)/home.tsx>) | Your apps, with a preview for signed-out visitors |
| [src/pages/index.tsx](src/pages/index.tsx), [src/themes.css](src/themes.css) | The landing page (its design direction is written at the top) and the theme |
| [src/pages/(app)/(protected)/runs/[id].tsx](<src/pages/(app)/(protected)/runs/[id].tsx>) | The live run board |
| [src/pages/sample.tsx](src/pages/sample.tsx) | The public sample page |

## DeepSpace features used

| Feature | Why |
|---|---|
| Sign-in | Tests cost credits, so the app has to know who is running one |
| Records with live sync | The run board updates when the server writes a record. There is no hand-written socket code |
| Permissions | Everyone sees only their own apps and reports, and that includes the app's owner. Reports can only be written or deleted by the server, so nobody can fake a result or erase a run from the browser console |
| Server actions | Starting and collecting tests needs server-side rules (ownership checks, daily limit, spend caps) |
| Integration proxy | Three outside services with no API keys in this repository |
| Agent tools | A coding agent can read a report through the DeepSpace CLI, with the person's own permissions |
| Per-user billing | Whoever runs a test pays for it. The starter's proxy would bill any unlisted integration to the owner, so this app refuses integrations it doesn't list |
| Unique records | A one-per-run "claim" record means two open tabs can't both write the fix list or send the email |

## The three integrations

| Integration | Job | Cost seen in testing |
|---|---|---|
| `apify/run-actor`, `apify/get-run` | The AI browser agent that clicks through the app | Almost all of the cost |
| `anthropic/chat-completion` (Claude Haiku) | Groups what went wrong into a ranked fix list | Well under 1 credit |
| `email/send` | Sends the finished report | About 1 credit |

A full test cost roughly 85 to 90 DeepSpace credits in testing, and a retest about 16. The sample report costs nothing because it is saved data shown in the browser.

## Decisions and tradeoffs

**The main tradeoff: Apify's browser agent over a browser inside the app.** Cloudflare's own headless browser worked on my laptop, but deploying it needs an admin DeepSpace account. Apify is available to every app through the integration proxy. The price is that Apify reports when a session ends, so the board updates session by session and can't show each click as it happens. Running two short sessions side by side keeps it feeling live.

**The page asks the server for progress.** A background job would be tidier, but jobs run as the app owner and would bill the owner. The app needs each user to pay for their own tests, so the open page calls `checkRun`, which runs as the signed-in user. The cost: a test only moves forward while its page is open.

**The cheapest model that does the job.** The fix list is a summarising task, so it uses Claude Haiku.

**Fix prompts use fixed wording.** The AI supplies the facts (what happened, where, what to change, how to check). The sentences around them are a template in `fixPrompt`, so every prompt reads the same way.

**It never touches your code.** The app hands the fix list to your coding agent, as a prompt you paste or through the agent tools. Connecting to GitHub and editing a repository directly would need write access to someone's code, which is a trust question this version doesn't take on.

**Why an app when a skill could do this.** A skill such as the open-source [naive-user](https://github.com/TechGardenCode/naive-user) runs the same kind of test inside your own coding agent, for free. That is a good fit for one developer. An app adds what a skill can't: nothing to install, a tester that has no access to your code at all, a saved history, a report you can open on any device, and a retest that someone other than the fixer runs. The small skill in this repo joins the two: the app tests, your agent fixes.

**Spend limits are built in.** Each session has a step limit and a dollar cap sized to that limit. Each person gets 12 real runs in 24 hours, where a test and a retest each count as one.

**Failures don't waste a paid test.** If writing the fix list fails, it's tried again up to three times before the run is marked failed. A retest that crashes or times out reopens the issue and says nothing was checked. It never reports that as "still broken".

**A test login is passed through and never stored.** The agent can't sign in with Google or GitHub: Google blocks automated browsers, and it would mean handing over a real account. So the app accepts an email and password for a throwaway test account. On a DeepSpace app you make one with `npx deepspace test accounts create`. The login lives in your browser tab's memory, travels once to the worker and on to Apify in the agent's encrypted credentials field, and is typed only on your app's own address. It is never written to the database, to a log, or into the instructions the AI reads. A run only records that a login was used. The tradeoff is that you type it again after a reload.

**Text from the tested site is treated as data.** The browser agent, the model that writes the fix list and the fix prompt are each told that words found on a page are something to evaluate and never instructions to follow.

## What it found when it tested itself

I pointed the live app at its own address.

- It found that "Watch a free sample" sent signed-out visitors to a sign-in wall. I added the public sample page, and Retest came back Fixed.
- Using it exposed a timing bug of mine: the page could ask about a new retest a moment before its browser session was recorded, and the server closed the retest as finished. A run with no sessions now counts as still starting.
- It showed that an uncollected session leaves credits on hold, so the spend caps were lowered to fit each session's step limit.

After those fixes I ran it on itself again. Both sessions reached the goal this time, and nothing was rated as blocking. It found that my sample page "replayed" the report with a delay, so a visitor who didn't wait saw placeholder text and never reached the fix list. The sample now shows the whole report at once, and the landing page puts cost, sign-in and the main limit next to the buttons.

I then had a second AI agent review the code with one job: assume it's broken and prove where. It reported 15 problems, including a test that could stay on "Writing the fix list" forever, duplicate work when a run is open in two tabs, and the proxy issue above. Fourteen are fixed and one is partly fixed (the last item under Limits). Each one that can be checked without a live run has a unit test in [src/server/tester.test.ts](src/server/tester.test.ts).

## Design

The look follows DeepSpace's design guide, and the direction is written as a comment at the top of [src/pages/index.tsx](src/pages/index.tsx).

- **Idea:** a test report that reads like a proof sheet handed back by a careful reader, with a mark wherever they stumbled.
- **Signature:** the hesitation trace. One bar per step, as tall as the agent was sure, with the unsure steps in the accent colour. It appears in the landing page's hero, on every session card and in the icon.
- **Colour:** warm paper off-white, ink text and one vermilion accent, used only for buttons and hesitations. Status colours are darkened so white text on them passes the WCAG 4.5:1 contrast floor.
- **Type:** IBM Plex Sans for text and IBM Plex Mono for numbers and labels, so the report reads like a lab readout. The fonts ship with the app, so no outside font service is called.
- **Motion:** the hero's lines ink in one after another, once. They start faintly visible, so a screenshot or a visitor who looks early still sees the whole report. It switches off for people who ask for reduced motion.
- **Signed-out home:** a visitor sees the real screen in preview form with an example, in place of an empty sign-in gate. The app's own self-test flagged the gate twice.

## Limits

- The agent can't use Google or GitHub sign-in or emailed codes. Apps behind sign-in need a test login with an email and password.
- A test login passes through DeepSpace's proxy and Apify on its way to your app. Use a throwaway test account, never a real one.
- It needs a public link. It can't reach an app running only on your laptop.
- The live board updates when a session ends, about every 15 to 40 seconds.
- A test only progresses while its page is open.
- Screenshots come from Apify links that expire.
- The daily limit and the retest guard are checked just before a run starts. Many requests sent at the same instant could slip past them. The credits at risk are the sender's own.
- An AI newcomer is a good first pass. It doesn't replace watching real people use the app.

## Run it locally

```bash
npm install
npx deepspace auth login
npx deepspace dev start
```

Then open http://localhost:5173. Real tests call paid integrations. The sample doesn't.

## Tests

```bash
npm run test:unit
npm test
npx deepspace test run all --grep "Public sample"
```

- Unit tests cover what the agent tools return, reading the browser agent's results, reading the fix list, the fix-prompt wording, the spend caps, the public-link check, the test login and the review findings.
- Browser tests cover the landing page, the sign-in boundary, the signed-out home preview, and the sample report showing its fix list with no server calls.
- Tests that need two signed-in test accounts are skipped until those accounts exist.

## What I'd build next

- Letting a coding agent start a retest itself, once there is a safe way to cap what it can spend.
- Human testers on the same board, with an "I'm stuck" button.
- A scheduled retest after every deploy.
- Comparing two runs to see what a release changed.
