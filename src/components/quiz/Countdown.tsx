import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { prefersReducedMotion } from './quizUtils'

export function remainingMs(startedAt: number, seconds: number, offset: number): number {
  return Math.max(0, seconds * 1000 - (Date.now() + offset - startedAt))
}

/**
 * Shrinking bar driven by server time. The bar's transform is written per
 * frame from a ref (no 60fps re-render); React only re-renders when the
 * whole-second label changes. Reduced motion steps once per second.
 */
export function Countdown({
  startedAt,
  seconds,
  offset,
  onSecond,
}: {
  startedAt: number
  seconds: number
  offset: number
  onSecond?: (secondsLeft: number) => void
}) {
  const barRef = useRef<HTMLDivElement>(null)
  const [left, setLeft] = useState(() => Math.ceil(remainingMs(startedAt, seconds, offset) / 1000))
  const onSecondRef = useRef(onSecond)
  useEffect(() => {
    onSecondRef.current = onSecond
  })

  useEffect(() => {
    const reduced = prefersReducedMotion()
    const total = Math.max(1, seconds * 1000)
    let raf = 0
    let lastSec = -1
    const tick = () => {
      const ms = remainingMs(startedAt, seconds, offset)
      const sec = Math.ceil(ms / 1000)
      const p = reduced ? Math.min(1, (sec * 1000) / total) : ms / total
      if (barRef.current) barRef.current.style.transform = `scaleX(${p})`
      if (sec !== lastSec) {
        lastSec = sec
        setLeft(sec)
        onSecondRef.current?.(sec)
      }
      if (ms > 0) raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [startedAt, seconds, offset])

  const danger = left <= 5
  return (
    <div className="flex items-center gap-3">
      <div
        data-testid="quiz-countdown"
        role="timer"
        aria-label={`${left} seconds left`}
        data-danger={danger}
        className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
      >
        <div ref={barRef} className={cn('quiz-bar h-full w-full rounded-full', danger ? 'bg-danger-ink' : 'bg-primary')} />
      </div>
      <span
        aria-hidden
        className={cn('w-8 shrink-0 text-right text-sm font-semibold tabular-nums', danger ? 'text-danger-ink' : 'text-muted-foreground')}
      >
        {left}s
      </span>
    </div>
  )
}
