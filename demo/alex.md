# Lecture 6: Chain rule & trig derivatives

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
