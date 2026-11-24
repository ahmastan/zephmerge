import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { MemberAvatar } from '../MemberAvatar'
import type { QuizScore } from '@/lib/types'
import { prefersReducedMotion } from './quizUtils'

export interface Standing {
  userId: string
  name: string
  total: number
  rank: number
  gained: number
}

/** Sorted standings. Ties share a rank ("1, 1, 3"). */
export function standings(scores: Record<string, QuizScore>, previous = false): Standing[] {
  const rows = Object.entries(scores).map(([userId, s]) => {
    const gained = s.last?.points ?? 0
    return { userId, name: s.name || 'Player', total: previous ? s.total - gained : s.total, gained, rank: 0 }
  })
  rows.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name) || a.userId.localeCompare(b.userId))
  rows.forEach((r, i) => {
    r.rank = i > 0 && rows[i - 1].total === r.total ? rows[i - 1].rank : i + 1
  })
  return rows
}

const ROW_H = 48

/**
 * Leaderboard whose rows are absolutely placed by rank, so reordering is a
 * transform transition. With `fromPrevious`, it first shows the order before
 * the latest question, then settles into the new order.
 */
export function Leaderboard({
  scores,
  myId,
  limit,
  fromPrevious = false,
  emphasizeTop = false,
  className,
}: {
  scores: Record<string, QuizScore>
  myId: string
  limit?: number
  fromPrevious?: boolean
  emphasizeTop?: boolean
  className?: string
}) {
  const [settled, setSettled] = useState(() => !fromPrevious || prefersReducedMotion())
  useEffect(() => {
    if (settled) return
    const t = window.setTimeout(() => setSettled(true), 450)
    return () => window.clearTimeout(t)
  }, [settled])

  const now = useMemo(() => standings(scores), [scores])
  const before = useMemo(() => standings(scores, true), [scores])
  const order = settled ? now : before

  const cap = limit ?? order.length
  // Everyone who is (or was) in the visible window keeps a node, so a row
  // leaving the top N fades out instead of vanishing.
  const visibleIds = new Set(order.slice(0, cap).map((r) => r.userId))
  const nodeIds = new Set([...now.slice(0, cap), ...before.slice(0, cap)].map((r) => r.userId))
  const index = new Map(order.map((r, i) => [r.userId, i]))
  const byId = new Map(now.map((r) => [r.userId, r]))
  const rowsShown = Math.min(cap, order.length)

  if (order.length === 0) {
    return (
      <p data-testid="quiz-leaderboard" className={cn('text-sm text-muted-foreground', className)}>
        No one answered yet.
      </p>
    )
  }

  return (
    <ol
      data-testid="quiz-leaderboard"
      aria-label="Leaderboard"
      className={cn('relative overflow-hidden', className)}
      style={{ height: rowsShown * ROW_H }}
    >
      {[...nodeIds].map((id) => {
        const r = byId.get(id)!
        const shown = order[index.get(id)!]
        const i = index.get(id)!
        const visible = visibleIds.has(id)
        const mine = id === myId
        const top = emphasizeTop && r.rank <= 3
        return (
          <li
            key={id}
            aria-hidden={!visible || undefined}
            className="quiz-row absolute inset-x-0 top-0"
            style={{
              height: ROW_H,
              transform: `translateY(${Math.min(i, cap) * ROW_H}px)`,
              opacity: visible ? 1 : 0,
            }}
          >
            <div
              className={cn(
                'flex h-full items-center gap-3 rounded-lg px-3',
                mine && 'bg-muted',
              )}
            >
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums',
                  top ? 'bg-brand-soft text-brand-soft-foreground' : 'text-muted-foreground',
                )}
              >
                {shown.rank}
              </span>
              <MemberAvatar userId={id} name={r.name} size="sm" tooltip={false} />
              <span className={cn('min-w-0 flex-1 truncate text-sm', (top || mine) && 'font-semibold')}>
                {r.name}
                {mine && <span className="font-normal text-muted-foreground"> (you)</span>}
              </span>
              {fromPrevious && settled && r.gained > 0 && (
                <span className="quiz-fade text-xs font-medium tabular-nums text-brand-ink">+{r.gained.toLocaleString()}</span>
              )}
              <span className="w-16 text-right text-sm font-semibold tabular-nums">{shown.total.toLocaleString()}</span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
