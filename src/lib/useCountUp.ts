import { useEffect, useState } from 'react'

/** Counts from 0 to `target` once on mount (ease-out). Instant under reduced motion. */
export function useCountUp(target: number, durationMs = 700, delayMs = 150): number {
  const [value, setValue] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? target : 0,
  )
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || target === 0) {
      setValue(target)
      return
    }
    let raf = 0
    let start = 0
    const tick = (t: number) => {
      if (!start) start = t + delayMs
      const p = Math.min(1, Math.max(0, (t - start) / durationMs))
      setValue(Math.round(target * (1 - Math.pow(1 - p, 4)))) // quartic ease-out
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs, delayMs])
  return value
}
