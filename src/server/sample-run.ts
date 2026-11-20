/**
 * A real first-run test, saved so anyone can watch a sample report without
 * spending credits. Recorded 2026-11-20 against Playwright's public TodoMVC
 * demo: two browser-agent missions (Apify) and the fix list Claude Haiku wrote
 * from them. Nothing here is made up; screenshots are dropped because the
 * provider's links expire.
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
  "summary": "The newcomer reached both goals: they learned what the site was and added two to-dos, marked one done, and filtered to completed items. Each step worked, but finding the done checkbox and the filter took guessing, and the homepage didn't explain what the site is for.",
  "issues": [
    {
      "severity": 2,
      "title": "Done checkbox has no visible label",
      "detail": "To mark a to-do done, the newcomer had to identify the checkbox only by its hidden name 'Toggle Todo'. Nothing on screen said it marks an item complete, so they had to guess.",
      "where": "The to-do list, the checkbox beside each item",
      "change": "Show a visible cue next to each checkbox, or add a tooltip, that says 'Mark as done'.",
      "check": "Add a to-do, hover over or look at its checkbox, and confirm the on-screen text says what it does without guessing."
    },
    {
      "severity": 2,
      "title": "Homepage doesn't explain what TodoMVC is for",
      "detail": "On the first visit, the newcomer couldn't tell from the homepage whether the site was for learning frameworks, comparing them, or trying a to-do app. They had to click through two pages to work it out.",
      "where": "The TodoMVC homepage (todomvc.com), its opening text",
      "change": "Add one plain sentence near the top saying what the site is and who it's for, such as 'Compare the same to-do app built in different JavaScript frameworks.'",
      "check": "Open the homepage cold and confirm that within a few seconds you can say what the site is for."
    },
    {
      "severity": 2,
      "title": "'Completed' filter is easy to miss",
      "detail": "To show only finished items, the newcomer had to find a small text link at the bottom of the list. It is easy to overlook, and the newcomer noted that it was not prominent.",
      "where": "The footer filter bar below the to-do list, the 'Completed' link",
      "change": "Make the filter links larger or give them more spacing and a clearer look, so the Completed option stands out.",
      "check": "Add two to-dos, mark one done, and confirm you can find and click the Completed filter on the first look without searching."
    },
    {
      "severity": 3,
      "title": "Demo banner adds noise on arrival",
      "detail": "The page opens with a demo disclaimer banner. For a first-time user it competes with the actual task and makes the page feel less clear.",
      "where": "The top of the to-do demo page, the disclaimer banner",
      "change": "Move the disclaimer to the footer or a smaller note, or let people dismiss it.",
      "check": "Open the demo page fresh and confirm the to-do input is the first thing you see, with the banner out of the way."
    },
    {
      "severity": 3,
      "title": "No guidance on the to-do page",
      "detail": "The demo page is mostly an empty input field. The only hint is 'Double-click to edit a todo', and nothing explains how to add or complete items.",
      "where": "The empty to-do page, below the input field",
      "change": "Add a one-line instruction under the input, such as 'Type a task and press Enter to add it.'",
      "check": "Open the demo page with no prior knowledge and confirm you can tell how to add a to-do from the page alone."
    }
  ]
}
