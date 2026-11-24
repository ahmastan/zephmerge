## Lecture 6 notes (Priya)

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
