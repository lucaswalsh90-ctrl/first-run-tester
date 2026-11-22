# Control tests

A tester is only worth trusting if it gives the right answer on apps where the right answer is already known. This file lists those apps, what the tester should say about each, and what it said.

The expected answers below were written before any test ran.

## The control apps

Packlist is a small packing-list page made for this purpose. It comes in three versions that look the same. A fourth address has no page behind it.

| Control | Address | What is true about it |
| --- | --- | --- |
| A, works | https://first-run-tester.app.space/practice/packlist-a | Everything works. |
| B, two small bugs | https://first-run-tester.app.space/practice/packlist-b | The counter stays at "0 of N packed" after you tick items. The "Packed" filter shows the items that are not packed. Adding and ticking work. |
| C, broken | https://first-run-tester.app.space/practice/packlist-c | The Add button does nothing, so the list can never be filled. |
| D, missing | https://first-run-tester.app.space/practice/packlist-d | There is no page here. The address returns "not found". |
| TodoMVC, works | https://demo.playwright.dev/todomvc/ | A well-known public demo to-do app that works. |
| Toolshop, works | https://practicesoftwaretesting.com/ | A public practice shop, kept working by its maintainers. |

Goal to paste for every Packlist version:

> add three things to pack, tick one off as packed, and show only the packed ones

Goal for TodoMVC:

> add two to-dos, mark one done, and show only completed ones

Goal for Toolshop:

> find a hammer, add it to the cart, and get to the checkout

## What the tester should say

Each line is one check. A check passes or fails.

**A, works**

1. The main session reports the goal as reached.
2. The fix list has no "Blocks newcomers" problem.
3. No problem claims that a working feature is broken.

**B, two small bugs**

4. The fix list names the counter that does not update.
5. The fix list names the "Packed" filter showing the wrong items.
6. No problem claims that adding or ticking is broken.

**C, broken**

7. The main session reports the goal as not reached.
8. The top problem is that Add does nothing, marked "Blocks newcomers".

**D, missing**

9. The main session reports the goal as not reached.
10. The summary says the page was not found.
11. The fix list invents no problems with screens the tester never saw.

**TodoMVC, works**

12. The main session reports the goal as reached.
13. The fix list has no "Blocks newcomers" problem.

**Toolshop, works**

14. The main session reports the goal as reached.
15. The fix list has no "Blocks newcomers" problem.

## How to run these yourself

1. Open https://first-run-tester.app.space and sign in.
2. Paste a control's address and its goal, then start a full test. A full test holds 108 credits and gives back what it does not use.
3. When the report is ready, tick off that control's checks from the list above.

The practice pages keep their list only for the tab you are in, so every test starts with an empty list.

## Results

Run on 22 November 2026: four tests of each control, 24 tests in all. 59 of the 60 checks passed.

| Control | Tests | Goal reported correctly | "Blocks newcomers" problems | Checks |
| --- | --- | --- | --- | --- |
| A, works | 4 | 4 of 4 reached | None in any test | 12 of 12 |
| B, two small bugs | 4 | 4 of 4 not reached | The Packed filter, every time | 11 of 12 |
| C, broken | 4 | 4 of 4 not reached | "Adding an item does nothing", every time | 8 of 8 |
| D, missing | 4 | 4 of 4 not reached | The 404 error, every time | 12 of 12 |
| TodoMVC, works | 4 | 4 of 4 reached | None in any test | 8 of 8 |
| Toolshop, works | 4 | 4 of 4 reached | None in any test | 8 of 8 |

What that adds up to:

- **Planted bugs found: 8 of 8.** Both bugs on B were in the fix list in all four tests.
- **Broken apps caught: 8 of 8.** C and D were reported as failing every time, with the real cause as the top problem.
- **False alarms that block: 0 of 12.** No test of a working app produced a "Blocks newcomers" problem.

### The one failed check

In the third test of B, the counter bug was listed under the title "Ticking an item does not register as packed" and marked "Blocks newcomers". Ticking does work on that page. The detail and the suggested fix both pointed at the counter, so the bug was found, but the title blamed the wrong thing and the label was one step too severe. That fails check 6.

### How these were run

The account had too few credits for the paid cloud browser, so a stand-in did the clicking. A fresh AI agent with no knowledge of the app got the exact instructions the app writes for its paid browser agent, and used a clean local browser. Its notes then went through the app's own code: the request to Claude Haiku that writes the fix list, the reading of that reply, and the checks that set findings aside.

So these results cover the instructions the app writes and everything it does with what comes back. They do not cover the paid cloud browser itself. Repeat them through the live app when credits allow.

### What the controls turned up

- **A false sentence, now fixed.** The first report on B said the test browser "could not draw any graphics-dependent parts". That page has no graphics. The rule for map and 3D apps was being applied to every app. The rule now says it applies only when the tester's notes mention such an error. In the 24 reports written since the change, none mentions graphics, and a saved report from a map app still gets the note.
- **One smaller finding was wrong three times, now fixed.** Three of the first four Toolshop tests said the Categories menu does nothing when clicked. Checked by hand, it opens a list of five categories. The testers had clicked once, not seen the menu in their reading of the page, and written that they "could not tell" whether it opened. The fix list then reported that as a fault. Two rules were added: the tester is told to read the page again before saying a click did nothing, and the fix list no longer treats "could not tell" as a problem with the site. Three fresh Toolshop tests after the change: none lists the Categories menu. In two of them the tester still could not read what the menu held, and said so, which is the honest answer. One fresh test each of B and C confirmed the planted bugs and the dead button are still caught.
- **Working apps still get a list.** A, TodoMVC and Toolshop came back with two to six smaller items each time. On A the same two came up in all four tests: no confirmation after adding an item, and a "Clear packed items" button with no explanation. Those are fair comments on the page. Read the top label first: a list with no blocking problem means the app works.
- **Some findings came from the stand-in method.** The stand-in ran both sessions in one browser, one after the other, so "the list is lost on reload" (B) and "a leftover to-do from an earlier visit" (TodoMVC) describe that setup. The paid browser starts each session fresh.

### Limits of this score

- Four tests per control is enough to see that the result repeats. It is too few to give a percentage anyone should quote.
- The six controls are small or simple apps. A long sign-up flow, a dashboard or an app behind a login would be a harder test.
- The answer key covers blocking problems and planted bugs. It does not judge whether each smaller item is worth fixing.
