// Demo lecture notes for Zephmerge. Kept byte-identical to demo/alex.md, demo/sam.md, demo/priya.md.
// Original notes on MIT OCW 18.01 (Fall 2006): https://ocw.mit.edu/courses/18-01-single-variable-calculus-fall-2006/
// These contain deliberately planted mistakes; see demo/README.md.

export const DEMO_LECTURE = 'Lecture 6: Chain rule & trig derivatives'

export interface DemoNote {
  author: string
  body: string
}

export const DEMO_NOTES: DemoNote[] = [
  {
    author: 'Alex',
    body: `# Lecture 6: Chain rule & trig derivatives

## Recap: definition of the derivative
- f'(x) = lim (h -> 0) of [f(x+h) - f(x)] / h
- Geometric meaning: slope of the tangent line at x
- Physical meaning: instantaneous rate of change

## Two key limits
- Small-angle limit: sin(h)/h -> 1 as h -> 0
- Companion limit: (cos(h) - 1)/h -> 0 as h -> 0
- Both come from the unit-circle picture (arc length vs. chord)

## Trig derivatives
- d/dx sin x = cos x
  - Expand sin(x+h) = sin x cos h + cos x sin h, then apply the two limits
- d/dx cos x = -sin x
  - Same trick with cos(x+h) = cos x cos h - sin x sin h

## Chain rule
- Applies to a composition f(g(x)): an outer function f wrapped around an inner function g
- d/dx f(g(x)) = f(g(x))·g'(x)
- Intuition: the inner function changes, and the outer function responds to that change

## Product rule (mentioned briefly)
- (uv)' = u'v + uv'
- We will combine it with the chain rule next lecture

## Reminders
- Always work in radians: the limit sin(h)/h -> 1 is false in degrees
`,
  },
  {
    author: 'Sam',
    body: `L6 -- chain rule + trig derivs

**deriv recap:** f'(x) = lim h->0 (f(x+h) - f(x))/h => slope of tangent line

**trig:**
- d/dx sin x = cos x
- d/dx cos x = sin x
- pf idea: angle addition formula + 2 std limits -> done
- RADIANS ONLY!!

**chain rule (CR):**
- y = f(u), u = g(x)
- d/dx f(g(x)) = f'(g(x))·g'(x)
- Leibniz notation: dy/dx = dy/du·du/dx (looks like du "cancels" -> not literally, but good mnemonic)
- "deriv of outside, keep inside, times deriv of inside"
- why it works: (change in y)/(change in x) = (chg y / chg u)·(chg u / chg x) -> let chg x -> 0, then chg u -> 0 too (g is continuous) => CR

**ex:** d/dx sin(3x^2)
- outer: sin(u) -> cos(u)
- inner: u = 3x^2 -> du/dx = 6x
- => 6x·cos(3x^2)

**prod rule:** (uv)' = u'v + uv' -> combine w/ CR for stuff like x^2·sin(5x)

**common mistake:** dropping the inner deriv. d/dx sin(3x^2) is NOT just cos(3x^2) -> always mult by g'(x)!!

**TODO:** redo pset Qs w/ nested CR (e.g. sin(cos(x^2))) -> peel layers outside -> in, one g' per layer
`,
  },
  {
    author: 'Priya',
    body: `## Lecture 6 notes (Priya)

We started by reviewing what a derivative actually is. The derivative f'(x) is the limit of the difference quotient (f(x+h) - f(x))/h as h goes to 0, and it gives the slope of the tangent line to the graph at the point x.

Next, the professor derived the derivatives of the basic trig functions. The derivative of sin x is cos x. Building on that, we can find the derivative of tan x by writing tan x = sin x / cos x and applying the quotient rule, which gives d/dx tan x = sec^2 x.

The main topic was the chain rule. If we have a composite function f(g(x)), its derivative is f'(g(x))·g'(x). In words, you differentiate the outer function while leaving the inner function alone, and then multiply by the derivative of the inner function. The professor also pointed out that the chain rule often shows up together with the product rule, (uv)' = u'v + uv', when an expression contains both a product and a composition.

### Worked example

Find the derivative of (3x+1)^5.

The outer function is u^5 and the inner function is u = 3x+1. Using the power rule on the outer function, we bring down the 5 and lower the exponent by one:

d/dx (3x+1)^5 = 5(3x+1)^4

So the final answer is 5(3x+1)^4.

### Tip

A common mistake is to skip writing out the inner and outer functions because the expression looks simple. Naming them explicitly every time makes it much harder to lose a step.
`,
  },
]
