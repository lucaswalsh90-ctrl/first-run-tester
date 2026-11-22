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

Run on 22 November 2026, one test per control. All 15 checks passed.

| Control | Goal reached? | "Blocks newcomers" problems | Checks |
| --- | --- | --- | --- |
| A, works | Yes | None | 3 of 3 |
| B, two small bugs | No | Packed filter shows the unpacked items | 3 of 3 |
| C, broken | No | Adding an item does nothing | 2 of 2 |
| D, missing | No | Address returns a 404 error | 3 of 3 |
| TodoMVC, works | Yes | None | 2 of 2 |
| Toolshop, works | Yes | None | 2 of 2 |

On B the fix list named both planted bugs: the filter as "Blocks newcomers" and the counter as "Slows newcomers".

### How these were run

The account had too few credits for the paid cloud browser, so a stand-in did the clicking. A fresh AI agent with no knowledge of the app got the exact instructions the app writes for its paid browser agent, and used a clean local browser. Its notes then went through the app's own code: the request to Claude Haiku that writes the fix list, the reading of that reply, and the checks that set findings aside.

So these results cover the instructions the app writes and everything it does with what comes back. They do not cover the paid cloud browser itself. Repeat them through the live app when credits allow.

### What the controls turned up

- **A false sentence, now fixed.** The first report on B said the test browser "could not draw any graphics-dependent parts". That page has no graphics. The rule for map and 3D apps was being applied to every app. The rule now says it applies only when the tester's notes mention such an error. After the change, none of the six reports mention graphics, and a saved report from a map app still gets the note.
- **Working apps still get a list.** A, TodoMVC and Toolshop each came back with three to six smaller items, such as "no confirmation after adding an item". None was marked "Blocks newcomers". Read the top label first: a list with no blocking problem means the app works.
- **Three findings came from the stand-in method.** The stand-in ran both sessions in one browser, one after the other, so "the list is lost on reload" (B), "leftover items from an earlier visit" (TodoMVC) and "the Testing Guide panel stays open" (Toolshop) describe that setup. The paid browser starts each session fresh.
- **One finding is unchecked.** On Toolshop the tester said the Categories menu gave no visible result. Nobody has confirmed that by hand.

### Limits of this score

One test per control is a pass or fail on each, not a rate. Running each control several times would show how often the tester gets it right.
