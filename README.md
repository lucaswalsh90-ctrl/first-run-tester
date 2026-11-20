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
7. The report is emailed to you and kept in your history.

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
| [src/server/sample-run.ts](src/server/sample-run.ts) | A real test saved on 2026-11-20, replayed by the free sample |
| [src/components/RunView.tsx](src/components/RunView.tsx) | The report pieces: session card, step row with confidence bar, issue card |
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
| Per-user billing | Whoever runs a test pays for it. The starter's proxy would bill any unlisted integration to the owner, so this app refuses integrations it doesn't list |
| Unique records | A one-per-run "claim" record means two open tabs can't both write the fix list or send the email |

## The three integrations

| Integration | Job | Cost seen in testing |
|---|---|---|
| `apify/run-actor`, `apify/get-run` | The AI browser agent that clicks through the app | Almost all of the cost |
| `anthropic/chat-completion` (Claude Haiku) | Groups what went wrong into a ranked fix list | Well under 1 credit |
| `email/send` | Sends the finished report | About 1 credit |

A full test cost roughly 85 to 90 DeepSpace credits in testing, and a retest about 16. The free sample costs nothing because it replays saved data in the browser.

## Decisions and tradeoffs

**The main tradeoff: Apify's browser agent over a browser inside the app.** Cloudflare's own headless browser worked on my laptop, but deploying it needs an admin DeepSpace account. Apify is available to every app through the integration proxy. The price is that Apify reports when a session ends, so the board updates session by session and can't show each click as it happens. Running two short sessions side by side keeps it feeling live.

**The page asks the server for progress.** A background job would be tidier, but jobs run as the app owner and would bill the owner. The app needs each user to pay for their own tests, so the open page calls `checkRun`, which runs as the signed-in user. The cost: a test only moves forward while its page is open.

**The cheapest model that does the job.** The fix list is a summarising task, so it uses Claude Haiku.

**Fix prompts use fixed wording.** The AI supplies the facts (what happened, where, what to change, how to check). The sentences around them are a template in `fixPrompt`, so every prompt reads the same way.

**It never touches your code.** The app hands a prompt to your coding agent. Connecting to GitHub and editing a repository directly would need write access to someone's code, which is a trust question this version doesn't take on.

**Spend limits are built in.** Each session has a step limit and a dollar cap sized to that limit. Each person gets 12 real runs in 24 hours, where a test and a retest each count as one.

**Failures don't waste a paid test.** If writing the fix list fails, it's tried again up to three times before the run is marked failed. A retest that crashes or times out reopens the issue and says nothing was checked. It never reports that as "still broken".

**Text from the tested site is treated as data.** The browser agent, the model that writes the fix list and the fix prompt are each told that words found on a page are something to evaluate and never instructions to follow.

## What it found when it tested itself

I pointed the live app at its own address.

- It found that "Watch a free sample" sent signed-out visitors to a sign-in wall. I added the public sample page, and Retest came back Fixed.
- Using it exposed a timing bug of mine: the page could ask about a new retest a moment before its browser session was recorded, and the server closed the retest as finished. A run with no sessions now counts as still starting.
- It showed that an uncollected session leaves credits on hold, so the spend caps were lowered to fit each session's step limit.

I then had a second AI agent review the code with one job: assume it's broken and prove where. It reported 15 problems, including a test that could stay on "Writing the fix list" forever, duplicate work when a run is open in two tabs, and the proxy issue above. Fourteen are fixed and one is partly fixed (the last item under Limits). Each one that can be checked without a live run has a unit test in [src/server/tester.test.ts](src/server/tester.test.ts).

## Limits

- The agent can't get past Google sign-in or emailed codes, so it tests an app up to that point.
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

- Unit tests cover reading the browser agent's results, reading the fix list, the fix-prompt wording, the spend caps, the public-link check and the review findings.
- Browser tests cover the landing page, the sign-in boundary, and the sample playing through to the fix list with no server calls.
- Tests that need two signed-in test accounts are skipped until those accounts exist.

## What I'd build next

- A test login field, so the agent can get past email sign-in on apps that have one.
- Human testers on the same board, with an "I'm stuck" button.
- A scheduled retest after every deploy.
- Comparing two runs to see what a release changed.
