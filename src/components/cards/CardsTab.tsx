import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { useMutations, useQuery } from 'deepspace'
import { Check, Layers, PartyPopper, RefreshCw, RotateCcw, Sparkles, X } from 'lucide-react'
import { callAction } from '@/lib/api'
import { isDue, MAX_BOX, nextDueAt, orderForStudy, review, type LeitnerProgress } from '@/lib/leitner'
import type { Card, CardProgress } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Badge, Button, ConfirmModal, EmptyState, useToast } from '../ui'
import './cards.css'

type Row<T> = { recordId: string; data: T }
type CardRow = Row<Card>
/** Merged view of the caller's progress for one card. recordId is absent until the first create resolves. */
type ProgressEntry = { recordId?: string; data: LeitnerProgress }
type GenerateResult = { count: number }

const FEEDBACK_MS = 420
const LEAVE_MS = 200
const REDUCED_FEEDBACK_MS = 260
const REDUCED_LEAVE_MS = 140

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** Future-facing relative time: "now", "in 5 min", "in 3 h", "tomorrow", "in 4 d". */
export function timeUntil(iso: string | undefined, now: number = Date.now()): string {
  if (!iso) return ''
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const s = Math.round((t - now) / 1000)
  if (s < 45) return 'now'
  const m = Math.round(s / 60)
  if (m < 60) return `in ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `in ${h} h`
  const d = Math.round(h / 24)
  if (d === 1) return 'tomorrow'
  if (d < 7) return `in ${d} d`
  return `on ${new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}

export function CardsTab({ groupId, myId }: { groupId: string; myId: string }) {
  const cardsQ = useQuery<Card>('cards', { where: { groupId }, orderBy: 'order', orderDir: 'asc' })
  // Read permission is own-only, so these are the caller's rows.
  const progressQ = useQuery<CardProgress>('card_progress', { where: { groupId } })
  const { ready, createConfirmed: create, putConfirmed: put } = useMutations<CardProgress>('card_progress')
  const toast = useToast()

  const [now, setNow] = useState(() => new Date())
  const [local, setLocal] = useState<Map<string, ProgressEntry>>(() => new Map())
  const pendingCreates = useRef(new Map<string, Promise<string>>())
  const [session, setSession] = useState<{ key: number; queue: CardRow[] } | null>(null)
  const [generating, setGenerating] = useState(false)
  const [confirmRegen, setConfirmRegen] = useState(false)

  // Keep "due" counts honest while the tab sits open.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const cards = cardsQ.records as CardRow[]

  const progress = useMemo(() => {
    const m = new Map<string, ProgressEntry>()
    for (const r of progressQ.records as Row<CardProgress>[]) {
      if (r.data.userId && r.data.userId !== myId) continue
      m.set(r.data.cardId, { recordId: r.recordId, data: r.data })
    }
    // Local writes win until the subscription catches up.
    for (const [cardId, entry] of local) {
      const server = m.get(cardId)
      const serverNewer =
        server?.data.lastReviewedAt && entry.data.lastReviewedAt && server.data.lastReviewedAt > entry.data.lastReviewedAt
      if (!serverNewer) m.set(cardId, { recordId: entry.recordId ?? server?.recordId, data: entry.data })
    }
    return m
  }, [progressQ.records, local, myId])

  const studyable = useMemo(() => cards.map((c) => ({ id: c.recordId, order: c.data.order ?? 0, row: c })), [cards])
  const progressData = useMemo(() => {
    const m = new Map<string, LeitnerProgress>()
    for (const [k, v] of progress) m.set(k, v.data)
    return m
  }, [progress])
  const dueQueue = useMemo(() => orderForStudy(studyable, progressData, now).map((c) => c.row), [studyable, progressData, now])
  const nextReview = useMemo(() => {
    const ids = new Set(cards.map((c) => c.recordId))
    return nextDueAt([...progress].filter(([id]) => ids.has(id)).map(([, v]) => v.data))
  }, [cards, progress])

  const answer = useCallback(
    async (cardId: string, correct: boolean) => {
      const at = new Date()
      const existing = progress.get(cardId)
      const next = review(existing?.data, correct, at)
      setLocal((m) => new Map(m).set(cardId, { recordId: existing?.recordId, data: next }))
      try {
        let recordId = existing?.recordId
        const pending = pendingCreates.current.get(cardId)
        if (!recordId && pending) recordId = await pending
        if (recordId) {
          await put(recordId, next)
        } else {
          const p = create({ cardId, groupId, ...next })
          pendingCreates.current.set(cardId, p)
          const id = await p
          setLocal((m) => {
            const cur = m.get(cardId)
            return cur ? new Map(m).set(cardId, { ...cur, recordId: id }) : m
          })
        }
      } catch (e) {
        pendingCreates.current.delete(cardId)
        toast.error('Couldn’t save your progress', e instanceof Error ? e.message : undefined)
      }
    },
    [progress, create, put, groupId, toast],
  )

  function startSession(all: boolean) {
    const at = new Date()
    setNow(at)
    const queue = all ? cards : orderForStudy(studyable, progressData, at).map((c) => c.row)
    if (queue.length === 0) return
    setSession((s) => ({ key: (s?.key ?? 0) + 1, queue }))
  }

  function exitSession() {
    setSession(null)
    setNow(new Date())
  }

  async function generate() {
    setGenerating(true)
    const r = await callAction<GenerateResult>('generateCards', { groupId })
    setGenerating(false)
    if (!r.success) {
      toast.error('Couldn’t make flashcards', r.error)
      return
    }
    setConfirmRegen(false)
    setSession(null)
    setLocal(new Map())
    pendingCreates.current.clear()
    toast.success('Flashcards ready', `${plural(r.data?.count ?? 0, 'card')} from the merged notes.`)
  }

  if (cardsQ.status === 'loading' || (cards.length > 0 && progressQ.status === 'loading')) {
    return (
      <div aria-busy="true" aria-label="Loading flashcards">
        <div className="mb-5 flex items-center justify-between">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="h-10 w-40 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  if (cardsQ.status === 'error') {
    return <p className="text-sm text-danger-ink">Couldn’t load flashcards. {cardsQ.error}</p>
  }

  if (cards.length === 0) {
    return (
      <EmptyState
        className="rounded-xl border border-dashed border-border"
        icon={<Layers aria-hidden />}
        title="No flashcards yet"
        description="Flashcards are written from your group’s merged notes, one fact per card. Everyone studies the same deck at their own pace."
        action={{ label: generating ? 'Making flashcards…' : 'Make flashcards', onClick: () => void (!generating && generate()) }}
        aria-busy={generating || undefined}
      />
    )
  }

  if (session) {
    return (
      <StudySession
        key={session.key}
        queue={session.queue}
        progress={progress}
        ready={ready}
        nextReview={nextReview}
        onAnswer={answer}
        onExit={exitSession}
        onStudyAll={() => startSession(true)}
      />
    )
  }

  const due = dueQueue.length
  return (
    <div className="space-y-5">
      {progressQ.status === 'error' && (
        <p className="text-sm text-danger-ink">Couldn’t load your progress. {progressQ.error}</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" data-testid="cards-count">
          {plural(cards.length, 'card')} · {due} due
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setConfirmRegen(true)} disabled={generating}>
            <RefreshCw aria-hidden /> Regenerate
          </Button>
          {due > 0 && (
            <Button onClick={() => startSession(false)}>
              <Sparkles aria-hidden /> Study now ({due} due)
            </Button>
          )}
        </div>
      </div>

      {due === 0 && (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-brand-soft p-4 text-brand-soft-foreground sm:flex-row sm:items-center">
          <Check className="h-5 w-5 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">All caught up</p>
            {nextReview && <p className="text-sm opacity-80">Next review {timeUntil(nextReview, now.getTime())}.</p>}
          </div>
          <Button variant="outline" onClick={() => startSession(true)}>
            <RotateCcw aria-hidden /> Study anyway
          </Button>
        </div>
      )}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => {
          const p = progress.get(c.recordId)
          return (
            <li key={c.recordId}>
              <CompactCard card={c.data} box={p?.data.box} due={isDue(p?.data, now)} />
            </li>
          )
        })}
      </ul>

      <ConfirmModal
        open={confirmRegen}
        onClose={() => setConfirmRegen(false)}
        onConfirm={() => void generate()}
        loading={generating}
        variant="destructive"
        title="Regenerate flashcards?"
        description="This writes a new deck from the current merged notes. It replaces every card and resets everyone’s study progress."
        confirmText="Regenerate"
      />
    </div>
  )
}

function BoxPips({ box, fresh = false, className }: { box: number | undefined; fresh?: boolean; className?: string }) {
  const filled = box ?? 0
  return (
    <span
      className={cn('inline-flex items-center gap-1', className)}
      role="img"
      aria-label={box ? `Box ${box} of ${MAX_BOX}` : 'New card'}
    >
      {Array.from({ length: MAX_BOX }, (_, i) => {
        const on = i < filled
        return (
          <span
            key={i}
            data-on={on}
            data-fresh={fresh && i === filled - 1}
            className={cn('zc-pip h-1.5 w-1.5 rounded-full', on ? 'bg-primary' : 'bg-border')}
          />
        )
      })}
    </span>
  )
}

function CompactCard({ card, box, due }: { card: Card; box: number | undefined; due: boolean }) {
  return (
    <article className="flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        {card.topic && (
          <Badge variant="secondary" size="sm" className="max-w-[70%] truncate">
            {card.topic}
          </Badge>
        )}
        <BoxPips box={box} className="ml-auto" />
      </div>
      <p className="line-clamp-3 text-sm font-medium leading-snug text-card-foreground">{card.front}</p>
      <p className="mt-auto text-xs text-muted-foreground">{box === undefined ? 'New' : due ? 'Due' : `Box ${box}`}</p>
    </article>
  )
}

type Phase = 'idle' | 'feedback' | 'leaving'

function StudySession({
  queue,
  progress,
  ready,
  nextReview,
  onAnswer,
  onExit,
  onStudyAll,
}: {
  queue: CardRow[]
  progress: Map<string, ProgressEntry>
  ready: boolean
  nextReview: string | undefined
  onAnswer: (cardId: string, correct: boolean) => Promise<void>
  onExit: () => void
  onStudyAll: () => void
}) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [feedback, setFeedback] = useState<'got' | 'missed' | null>(null)
  const [tally, setTally] = useState({ got: 0, missed: 0 })
  const [finishedAt, setFinishedAt] = useState<number | null>(null)
  const timers = useRef<number[]>([])
  const cardRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef<HTMLHeadingElement>(null)

  const total = queue.length
  const done = index >= total
  const current = done ? undefined : queue[index]

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  // Keep keyboard focus on the card as cards change.
  useEffect(() => {
    if (done) doneRef.current?.focus({ preventScroll: true })
    else cardRef.current?.focus({ preventScroll: true })
  }, [index, done])

  const flip = useCallback(() => {
    if (phase !== 'idle') return
    setFlipped((f) => !f)
  }, [phase])

  const answer = useCallback(
    (correct: boolean) => {
      if (!current || !flipped || phase !== 'idle' || !ready) return
      const reduced = prefersReducedMotion()
      setFeedback(correct ? 'got' : 'missed')
      setPhase('feedback')
      setTally((t) => (correct ? { ...t, got: t.got + 1 } : { ...t, missed: t.missed + 1 }))
      void onAnswer(current.recordId, correct)
      timers.current.push(
        window.setTimeout(() => {
          setPhase('leaving')
          timers.current.push(
            window.setTimeout(() => {
              setFeedback(null)
              setFlipped(false)
              setPhase('idle')
              setIndex(index + 1)
              if (index + 1 >= total) setFinishedAt(Date.now())
            }, reduced ? REDUCED_LEAVE_MS : LEAVE_MS),
          )
        }, reduced ? REDUCED_FEEDBACK_MS : FEEDBACK_MS),
      )
    },
    [current, flipped, phase, ready, onAnswer, total, index],
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement | null
      const tag = el?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable) return
      if (e.key === 'Escape') {
        e.preventDefault()
        onExit()
        return
      }
      if (done) return
      if (e.key === ' ' || e.code === 'Space') {
        // Let a focused button handle its own Space press.
        if (tag === 'BUTTON' || tag === 'A') return
        e.preventDefault()
        if (!e.repeat) flip()
        return
      }
      if (e.repeat || !flipped) return
      if (e.key === '1') {
        e.preventDefault()
        answer(false)
      } else if (e.key === '2') {
        e.preventDefault()
        answer(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [done, flipped, flip, answer, onExit])

  if (done) {
    return (
      <SessionComplete
        headingRef={doneRef}
        got={tally.got}
        missed={tally.missed}
        nextReview={nextReview}
        now={finishedAt ?? 0}
        onStudyAll={onStudyAll}
        onExit={onExit}
      />
    )
  }

  const card = current!.data
  const entry = progress.get(current!.recordId)
  const shownIndex = Math.min(total, index + 1)
  const pct = ((index + (phase === 'idle' ? 0 : 1)) / total) * 100
  const faceTone =
    feedback === 'got'
      ? 'bg-brand-soft ring-2 ring-primary'
      : feedback === 'missed'
        ? 'bg-danger-soft ring-2 ring-danger-ink/40'
        : 'bg-card'

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex items-center gap-3">
        <div
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Study progress"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={index}
        >
          <div className="zc-progress h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {shownIndex} of {total}
        </span>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Exit study mode (Escape)" onClick={onExit}>
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </div>

      <div>
        <div key={index} className={cn(phase === 'leaving' ? 'zc-leave' : 'zc-enter')}>
          <div
            ref={cardRef}
            data-testid="study-card"
            role="button"
            tabIndex={0}
            aria-label={flipped ? `Answer: ${card.back}` : `Question: ${card.front}. Press Space to show the answer.`}
            aria-pressed={flipped}
            onClick={flip}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                flip()
              }
            }}
            className="zc-scene cursor-pointer rounded-2xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <div className="zc-flipper" data-flipped={flipped}>
              <section
                aria-hidden={flipped}
                className={cn(
                  'zc-face zc-front flex min-h-72 flex-col rounded-2xl border border-border p-6 shadow-sm sm:p-8',
                  flipped ? 'bg-card' : faceTone,
                )}
              >
                <CardMeta topic={card.topic} box={entry?.data.box} fresh={false} />
                <p className="my-auto py-6 text-center text-2xl font-semibold leading-snug tracking-tight text-balance sm:text-3xl">
                  {card.front}
                </p>
                <p className="text-center text-xs text-muted-foreground">
                  Click or press <Kbd>Space</Kbd> to flip
                </p>
              </section>
              <section
                aria-hidden={!flipped}
                className={cn(
                  'zc-face zc-back flex min-h-72 flex-col rounded-2xl border border-border p-6 shadow-sm sm:p-8',
                  flipped ? faceTone : 'bg-card',
                )}
              >
                <CardMeta topic={card.topic} box={entry?.data.box} fresh={feedback === 'got'} />
                <div className="my-auto py-6 text-center">
                  <p className="text-xl font-medium leading-relaxed text-balance sm:text-2xl">{card.back}</p>
                  {card.sourceQuote && (
                    <p className="mx-auto mt-5 max-w-prose text-xs leading-relaxed text-muted-foreground">
                      From the notes: “{card.sourceQuote}”
                    </p>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      <div className={cn('flex justify-center gap-3 transition-opacity duration-200', flipped ? 'opacity-100' : 'pointer-events-none opacity-0')} aria-hidden={!flipped}>
        <Button
          data-testid="missed-it"
          variant="outline"
          size="lg"
          className="min-w-36 px-5 hover:bg-danger-soft hover:text-danger-ink"
          disabled={!flipped || phase !== 'idle' || !ready}
          tabIndex={flipped ? 0 : -1}
          onClick={() => answer(false)}
          aria-keyshortcuts="1"
        >
          <X aria-hidden /> Missed it <Kbd>1</Kbd>
        </Button>
        <Button
          data-testid="got-it"
          size="lg"
          className="min-w-36 px-5"
          disabled={!flipped || phase !== 'idle' || !ready}
          tabIndex={flipped ? 0 : -1}
          onClick={() => answer(true)}
          aria-keyshortcuts="2"
        >
          <Check aria-hidden /> Got it <Kbd>2</Kbd>
        </Button>
      </div>
      <p className="sr-only" aria-live="polite">
        {feedback === 'got' ? 'Got it.' : feedback === 'missed' ? 'Missed it.' : `Card ${shownIndex} of ${total}.`}
      </p>
    </div>
  )
}

function CardMeta({ topic, box, fresh }: { topic?: string; box: number | undefined; fresh: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {topic && (
        <Badge variant="secondary" size="sm" className="max-w-[70%] truncate">
          {topic}
        </Badge>
      )}
      <BoxPips box={box} fresh={fresh} className="ml-auto" />
    </div>
  )
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="ml-1 rounded border border-current/20 px-1.5 py-px font-mono text-[10px] font-medium opacity-60">
      {children}
    </kbd>
  )
}

function SessionComplete({
  headingRef,
  got,
  missed,
  nextReview,
  now,
  onStudyAll,
  onExit,
}: {
  headingRef: RefObject<HTMLHeadingElement | null>
  got: number
  missed: number
  nextReview: string | undefined
  now: number
  onStudyAll: () => void
  onExit: () => void
}) {
  const when = timeUntil(nextReview, now)
  return (
    <div className="zc-enter mx-auto flex w-full max-w-md flex-col items-center rounded-2xl border border-border bg-card px-6 py-10 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-soft-foreground">
        <PartyPopper className="size-6" aria-hidden />
      </div>
      <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none">
        Session complete
      </h2>
      <dl className="mt-5 grid w-full grid-cols-2 gap-3">
        <div className="rounded-xl bg-brand-soft p-3 text-brand-soft-foreground">
          <dt className="text-xs font-medium">Got it</dt>
          <dd className="text-2xl font-semibold tabular-nums">{got}</dd>
        </div>
        <div className="rounded-xl bg-danger-soft p-3 text-danger-ink">
          <dt className="text-xs font-medium">Missed</dt>
          <dd className="text-2xl font-semibold tabular-nums">{missed}</dd>
        </div>
      </dl>
      {when && (
        <p className="mt-4 text-sm text-muted-foreground">
          Next review: <span className="font-medium text-foreground">{when}</span>
        </p>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button variant="secondary" onClick={onStudyAll}>
          <RotateCcw aria-hidden /> Study anyway
        </Button>
        <Button onClick={onExit}>Back to cards</Button>
      </div>
    </div>
  )
}
