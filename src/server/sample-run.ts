/**
 * A real first-run test, saved so anyone can watch a sample report without
 * spending credits. Recorded 2026-11-20 against Playwright's public TodoMVC
 * demo: two browser-agent missions (Apify) and the fix list Claude Haiku wrote
 * from them. Nothing here is made up; screenshots are dropped because the
 * provider's links expire. The fix list was written again on 2026-11-23 from
 * the same two sessions, by the fix-list writer that cites steps and says what
 * it is unsure of, so the sample shows how sure each fix is.
 */
import type { DraftIssue, MissionResult } from './tester'

export const SAMPLE_SITE = {
  name: 'TodoMVC demo',
  url: 'https://demo.playwright.dev/todomvc/',
  goal: 'add two to-dos, mark one done, and show only completed ones',
}

export const SAMPLE_MISSIONS: Array<{ title: string; revealAfterSec: number } & MissionResult> = [
  {
    "title": "First look",
    "status": "done",
    "succeeded": true,
    "steps": [
      {
        "step": 1,
        "action": "click:e1",
        "description": "click link \"real TodoMVC app.\" \u2192 https://todomvc.com/",
        "confidence": 0.34,
        "url": "https://demo.playwright.dev/todomvc/#/"
      },
      {
        "step": 2,
        "action": "click:e8",
        "description": "click link \"React New\" \u2192 examples/react/dist/",
        "confidence": 0.53,
        "url": "https://todomvc.com/"
      },
      {
        "step": 3,
        "action": "done",
        "description": "stop: every step the goal asks for has been taken (history shows it) and, if the goal asks a question, its answer is visible in page_text of the page the goal names",
        "confidence": 0.36,
        "url": "https://todomvc.com/examples/react/dist/"
      }
    ],
    "report": "1. Clicked the \"real TodoMVC app\" link and learned the site is TodoMVC, a collection of demo apps. 2. Clicked the \"React New\" example link and learned it opens a working React to-do list demo with a \"todos\" input field.",
    "confusing": "The homepage doesn't explain in plain words what TodoMVC is for or who it's for. The demo page is mostly a to-do input with no instructions; the \"Double-click to edit a todo\" hint is the only guidance. It's unclear whether the site is for learning frameworks, comparing them, or just trying a to-do app.",
    "screenshotUrl": "",
    "durationSec": 21,
    "revealAfterSec": 6
  },
  {
    "title": "Main goal",
    "status": "done",
    "succeeded": true,
    "steps": [
      {
        "step": 1,
        "action": "typeenter:e2",
        "description": "type text into input \"What needs to be done?\" and press Enter (search boxes, tag/skill inputs: one entry per Enter)",
        "confidence": 0.65,
        "url": "https://demo.playwright.dev/todomvc/#/"
      },
      {
        "step": 2,
        "action": "typeenter:e2",
        "description": "type text into input \"What needs to be done?\" and press Enter (search boxes, tag/skill inputs: one entry per Enter)",
        "confidence": 0.85,
        "url": "https://demo.playwright.dev/todomvc/#/"
      },
      {
        "step": 3,
        "action": "click:e4",
        "description": "check checkbox \"Toggle Todo\"",
        "confidence": 0.53,
        "url": "https://demo.playwright.dev/todomvc/#/"
      },
      {
        "step": 4,
        "action": "click:e9",
        "description": "click link \"Completed\" \u2192 #/completed",
        "confidence": 0.94,
        "url": "https://demo.playwright.dev/todomvc/#/"
      },
      {
        "step": 5,
        "action": "done",
        "description": "stop: every step the goal asks for has been taken (history shows it) and, if the goal asks a question, its answer is visible in page_text of the page the goal names",
        "confidence": 0.93,
        "url": "https://demo.playwright.dev/todomvc/#/completed"
      }
    ],
    "report": "1. Add 'Buy milk' \u2013 Typed \"Buy milk\" into the input labelled \"What needs to be done?\" and pressed Enter. It worked; the item appeared in the list. 2. Add 'Call mum' \u2013 Typed \"Call mum\" into the same input and pressed Enter. It worked; the item appeared in the list. 3. Mark 'Buy milk' as done \u2013 Clicked the checkbox labelled \"Toggle Todo\" next to 'Buy milk'. It worked; the counter dropped to \"1 item left\". 4. Show only completed to-dos \u2013 Clicked the \"Completed\" link (\u2192 #/completed). It worked; the view now shows only 'Buy milk' with \"1 item left\".",
    "confusing": "The checkbox has no visible label \u2014 it's only identified as \"Toggle Todo\", so a new user has to guess it's the done/complete control. The \"Completed\" filter is a small text link at the bottom, easy to miss. The page also opens with a demo disclaimer banner, which adds noise for a first-time user.",
    "screenshotUrl": "",
    "durationSec": 12.5,
    "revealAfterSec": 14
  }
]

export const SAMPLE_SUMMARY: { summary: string; issues: DraftIssue[] } = {
  "summary": "The newcomer reached the main goal: they added two to-dos, marked one done, and filtered to show only completed items. The rough spots were finding the done control, which has no visible label, and working out what the site is for from its homepage.",
  "issues": [
    {
      "severity": 2,
      "title": "Done checkbox has no visible label",
      "detail": "The newcomer had to guess that the checkbox labelled 'Toggle Todo' next to a to-do marks it complete, because no visible text explains it.",
      "where": "To-do list, checkbox next to each item",
      "page": "https://demo.playwright.dev/todomvc/#/",
      "search": [
        "Toggle Todo"
      ],
      "seenAt": [
        {
          "mission": "Main goal",
          "step": 3
        }
      ],
      "kind": "wording",
      "change": "Give each to-do checkbox a visible hint or tooltip such as 'Mark as done'.",
      "check": "On the to-do list, check checkbox 'Toggle Todo' and confirm the purpose is clear from the screen.",
      "unsure": [
        {
          "what": "The agent read page text, so it may not know whether a visible checkbox already has nearby text or an icon.",
          "check": "Look at the to-do list by eye and confirm whether the checkbox has any visible explanation."
        }
      ]
    },
    {
      "severity": 2,
      "title": "Homepage does not explain what TodoMVC is for",
      "detail": "The newcomer followed the 'real TodoMVC app.' link and could not tell from the homepage whether the site is for learning frameworks, comparing them, or trying a to-do app.",
      "where": "Demo page link 'real TodoMVC app.' leading to the homepage",
      "page": "https://todomvc.com/",
      "search": [
        "real TodoMVC app."
      ],
      "seenAt": [
        {
          "mission": "First look",
          "step": 1
        }
      ],
      "kind": "wording",
      "change": "Add a short plain-English sentence on the homepage saying what TodoMVC is and who it is for.",
      "check": "On the demo page, click link 'real TodoMVC app.' and read the homepage's opening text to confirm it explains the site's purpose.",
      "unsure": []
    },
    {
      "severity": 3,
      "title": "Completed filter is a small, easy-to-miss link",
      "detail": "The newcomer found the 'Completed' filter only as a small text link at the bottom of the list, which could be missed by a first-time user.",
      "where": "Footer filter bar of the to-do list, link 'Completed'",
      "page": "https://demo.playwright.dev/todomvc/#/",
      "search": [
        "Completed"
      ],
      "seenAt": [
        {
          "mission": "Main goal",
          "step": 4
        }
      ],
      "kind": "wording",
      "change": "Make the filter links larger or more prominent so the 'Completed' option stands out.",
      "check": "On the to-do list, click link 'Completed' and confirm the filter is easy to spot before clicking.",
      "unsure": []
    }
  ]
}
