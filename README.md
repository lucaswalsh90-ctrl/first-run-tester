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
8. A test takes about a minute, so you can ask for a browser notification when it finishes.
9. The report is emailed to you and kept in your history.

## Two front doors: one for people, one for coding agents

The person who reads the fix list usually isn't the one who fixes it. Their coding agent is. So the app has a second door, built with DeepSpace's agent tools, that lets Claude Code, Cursor or Codex read a report directly:

```bash
npx deepspace agent invoke first-run-tester first_run_fix_list --input '{"url":"https://my-app.app.space"}' --json
```

Every report shows this command for its own test. A website can't open your terminal or type into a coding agent, because browsers forbid it. So the report offers the three things that do work, and each is one step:

- **Open in Claude Code, Cursor or Codex.** A link in the format each maker documents (`claude-cli://open?q=`, `https://cursor.com/link/prompt?text=`, `codex://new?prompt=`) opens the agent on your computer with a short prompt already in the box. The prompt tells the agent to run the command above. Nothing is sent until you press Enter.
- **Copy all fix prompts.** The whole list in one paste.
- **Let the agent fetch it.** Give your agent the command.

The links carry a short prompt and leave the fix list to the command, because Claude Code caps a link's prompt at 5,000 characters and Cursor caps the whole link at 10,000. The prompt names the tested app, so the agent can tell whether it is in the right folder before it runs anything. A link can't know where your code is, so the box has an optional field for your app's folder. It is kept in your browser only, and with it Claude Code and Codex open in that folder. See [src/lib/handoff.ts](src/lib/handoff.ts).

Every hand-off carries the same five working steps: check the folder, find the code by searching the repository for the words in the problem, make a small change, prove it from the terminal with the project's own checks and in the running app, and do not commit, push or deploy.

This was tested as a real hand-off. A fresh agent in this repository was given exactly the prompt the link carries, for a saved test of this app. It confirmed the folder, ran the command, left two problems alone because the code already fixed them, made two small edits, and did not commit or deploy. The same prompt for a different app, given to an agent in this folder, stopped before running anything and asked where that app's code is. A second hand-off used a single fix prompt for a problem a newcomer session had raised here (the labels "Blocks newcomers", "Slows newcomers" and "Polish" were never explained). The agent found the three files by searching, added one line above the fix list, ran the type check, the tests and a full build, checked the built page, and left the commit to me.

The command returns the ranked problems, each with its fix prompt and a "done when" check. A second tool, `first_run_reports`, lists your apps and their latest tests. [agent-skill/first-run-fixes/SKILL.md](agent-skill/first-run-fixes/SKILL.md) is a small skill that walks a coding agent through the loop. To use it, copy that folder into your project's `.claude/skills/`.

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

### The first test of someone else's app

The first person to click through the product pointed it at a route planner whose whole first screen is a map. The report came back with "Map never loads" as the most serious problem. The map was fine. The browser agent runs in the cloud on a machine with no graphics card, so WebGL could not start there, and the agent spent its steps pressing Reload.

That was the tester's own blind spot written up as the app's bug, which is the one mistake a tool like this can't make. Three changes followed, in [src/lib/test-limit.ts](src/lib/test-limit.ts):

- The agent is told about the limit before it starts, so it stops reloading and looks at what it can reach.
- The fix-list writer is told not to list the limit, or anything that only happened because of it, as a problem.
- A plain check that depends on neither AI spots the failure in what the sessions wrote. Findings that blame it never reach the fix list, the coding-agent door or the progress count. The report shows a notice instead, and lists what was set aside.

The same person copied a fix prompt from the sample report into a coding agent that was open in their home folder. The prompt was about the demo app, whose code they don't have, and its last line told the agent to say where it had looked, so it searched the whole computer before giving up. Two changes, in [src/lib/handoff.ts](src/lib/handoff.ts):

- Every fix prompt now starts by having the agent check that it is in the app's folder. If it isn't, it stops and asks where the code is.
- The sample report's prompts are marked as examples on the page, on the buttons and inside the copied text, so an agent that receives one says so and stops.

Both were checked the way the problem was found: each prompt was pasted, unchanged, into a fresh agent sitting in the wrong folder.

### Testing without the paid browser

When credits ran out, the app was tested another way. Two fresh agents, each in a clean browser with no memory of the app, were given the exact instructions the app gives its paid browser agent. What they reported went through the app's own fix-list code.

That found a bug a paid test would have hit: the fix-list reply was capped at 2,000 tokens, the model's thinking counts against that cap, and a list of six problems was cut off mid-sentence. The reader then found no complete JSON and failed, and the retry sent the same request. The cap is now 4,000, each field is kept short, and a cut-off reply keeps every problem that was written out in full ([src/server/tester.ts](src/server/tester.ts), `salvageSummary`).

It also gave a fresh-eyes fix list for the new design. From it: the sample report became a button, cost moved next to the buttons, steps are shown in plain English ([src/lib/plain-step.ts](src/lib/plain-step.ts)), the bars got a key, and the greyed-out Retest button on the sample became a sentence. This stand-in is not the product: it used the app's instructions and code, but a local browser in place of the cloud one.

### Four more apps

The same credit-free method was then pointed at four live apps that are known to work: three built on DeepSpace (GitHub Wrapped, ClaimCheck, Taskspace) and Hacker News. All four went through the fix-list code cleanly, with five or six problems each.

- Two of the DeepSpace apps stop a newcomer at sign-in, so the test never reached the product. The report listed the wall as a problem but did not say what to do next. It now shows a notice that points to the test login ([src/lib/test-limit.ts](src/lib/test-limit.ts), `hitSignInWall`). The check was run against every session saved in the account, real and stand-in, with no false alarms.
- On one app the browser read counters at 0 before their count-up animation finished. The tester is now told to look once more before calling a loading page broken.
- One finding repeated on three DeepSpace apps, this one included: the shared sign-in box is titled "Sign in to DeepSpace" on another product's page, and its email form has no visible way to create an account. That is feedback for the platform, found by pointing the tool at its own ecosystem.

The same click-through produced the top bar on every page, the three steps on the home screen, larger text, the replay you can step through, and History.

### An independent review

I then had a second AI agent review the code with one job: assume it's broken and prove where. It reported 15 problems, including a test that could stay on "Writing the fix list" forever, duplicate work when a run is open in two tabs, and the proxy issue above. Fourteen are fixed and one is partly fixed (the last item under Limits). Each one that can be checked without a live run has a unit test in [src/server/tester.test.ts](src/server/tester.test.ts).

## Design

The look follows DeepSpace's design guide, and the direction is written as a comment at the top of [src/pages/index.tsx](src/pages/index.tsx).

- **Idea:** a test report that reads like a proof sheet handed back by a careful reader, with a mark wherever they stumbled.
- **Signature:** the hesitation trace. One bar per step, as tall as the agent was sure, with the unsure steps in the accent colour. It appears in the landing page's hero, on every session card and in the icon.
- **Colour:** warm paper off-white, ink text and one vermilion accent, used only for buttons and hesitations. Status colours are darkened so white text on them passes the WCAG 4.5:1 contrast floor.
- **Type:** IBM Plex Sans for text and IBM Plex Mono for numbers and labels, so the report reads like a lab readout. The fonts ship with the app, so no outside font service is called.
- **Motion and interaction:** the hero is a session you can play. A cursor works through a drawing of the sample app, wavers at the control the agent was unsure of, and the problem it found lands underneath. It plays once and then waits. Point at a bar of the trace, on the hero or on any report, and that step lights up; "Replay steps" walks through a session. Every animation shows something that happened, nothing loops, the finished state is what gets prerendered, and people who ask for reduced motion get that finished state and can still step through by hand.
- **Direction:** a top bar names the same two places on every page. The home screen shows three steps with the current one marked, and each app has a bar for how much of its fix list is done.
- **Signed-out home:** a visitor sees the real screen in preview form with an example, in place of an empty sign-in gate. The app's own self-test flagged the gate twice.

## Limits

- The test browser has no graphics card, so it can't draw WebGL: maps, 3D and some charts. The report says so when that happens and sets aside the findings it caused, but that part of the app goes untested. An app that is mostly a map gets little from a test.
- The agent reads a page as soon as it loads, so it can catch an animation halfway. It is told to look twice, and the fix-list writer is told not to list that, but neither is a guarantee.
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

- Unit tests cover what the agent tools return, reading the browser agent's results, reading the fix list, the fix-prompt wording, the open-in-agent links, the spend caps, the public-link check, the test login, an app's history, spotting the test browser's own limits, and the review findings.
- Browser tests cover the landing page, the sign-in boundary, the signed-out home preview, the sample report showing its fix list with no server calls, the top bar, a link carried from the landing page into the form, and stepping through a replay.
- Tests that need two signed-in test accounts are skipped until those accounts exist.

## What I'd build next

- Letting a coding agent start a retest itself, once there is a safe way to cap what it can spend.
- Human testers on the same board, with an "I'm stuck" button.
- A scheduled retest after every deploy.
- Comparing two runs to see what a release changed.
- A test browser with graphics, so maps and 3D can be tested too.
- An automatic mode: the agent fixes, deploys and retests by itself, inside limits you set. It needs write access to your repository and a spending cap, and both have to be right before it is safe.
