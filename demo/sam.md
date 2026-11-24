L6 -- chain rule + trig derivs

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
