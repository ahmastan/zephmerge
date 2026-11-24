# Zephmerge demo notes

Three classmates' notes on the same lecture, written to show off Zephmerge's merge:
it should combine them into one study sheet and flag conflicts and errors with quotes.

- **Lecture:** Lecture 6: Chain rule & trig derivatives
- **Source course:** [MIT OpenCourseWare 18.01 Single Variable Calculus (Fall 2006)](https://ocw.mit.edu/courses/18-01-single-variable-calculus-fall-2006/)
- The notes are original writing based on the lecture topic; no OCW text is copied.

| File | Author | Style |
| --- | --- | --- |
| `alex.md` | Alex | Tidy headings and bullets |
| `sam.md` | Sam | Terse shorthand, abbreviations, arrows |
| `priya.md` | Priya | Full sentences with a worked example |

The same bodies are exported from `src/demo/demoNotes.ts` (`DEMO_NOTES`), byte-identical to these files.

## Planted issues

| # | Type | Author | Exact quote (wrong line) | Correct |
| --- | --- | --- | --- | --- |
| 1 | Contradiction | Alex (vs. Sam, Priya) | `- d/dx f(g(x)) = f(g(x))·g'(x)` | d/dx f(g(x)) = f'(g(x))·g'(x), as Sam and Priya wrote. Alex forgot to differentiate the outer function. |
| 2 | Contradiction | Sam (vs. Alex) | `- d/dx cos x = sin x` | d/dx cos x = -sin x, as Alex wrote. |
| 3 | Error (single source) | Priya | `d/dx (3x+1)^5 = 5(3x+1)^4` | 15(3x+1)^4. The inner derivative (3) is missing. Nobody else works this example, so only fact-checking catches it. |

## Facts only one author has (the merge must keep them)

| Author | Unique fact |
| --- | --- |
| Alex | Small-angle limit sin(h)/h -> 1 (and (cos(h) - 1)/h -> 0); radians required |
| Sam | Leibniz form dy/dx = dy/du·du/dx; worked example d/dx sin(3x^2) = 6x·cos(3x^2) |
| Priya | d/dx tan x = sec^2 x (via the quotient rule) |

All three mention the definition of the derivative and the product rule (uv)' = u'v + uv'.
Sam and Priya each include a common-mistake tip.

## How to use

1. Open a group and go to its **Notes** tab.
2. Click **Try with demo notes**. This loads the three notes as Alex, Sam and Priya.
3. Click **Merge**.
4. Check that the result flags all three planted issues with quotes and keeps every unique fact.

To upload the notes by hand instead, use `alex.md`, `sam.md` and `priya.md` from this folder.
