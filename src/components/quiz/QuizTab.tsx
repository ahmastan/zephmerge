import { useCallback, useEffect, useMemo, useId, useRef, useState, type ReactNode } from 'react'
import { usePresenceRoom, useQuery } from 'deepspace'
import { ArrowRight, Check, Layers, Lock, Play, Timer, Trophy, Users, X, Zap } from 'lucide-react'
import { callAction } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useCountUp } from '@/lib/useCountUp'
import { MemberAvatar } from '../MemberAvatar'
import { Button, ConfirmModal, useToast } from '../ui'
import { Countdown, remainingMs } from './Countdown'
import { Leaderboard, standings } from './Leaderboard'
import { hasResults, LETTERS, normalizeSession, ordinal, plural } from './quizUtils'
import type { QuizSession } from './types'
import './quiz.css'

interface Props {
  groupId: string
  myId: string
  myName: string
  cardCount: number
  onGoToCards: () => void
}

type ServerClock = {
  offset: number
  /** Feed any `serverNow` from a response. */
  note: (serverNow: number | undefined) => void
}

const COUNT_OPTIONS = [5, 8, 12] as const
const TIME_OPTIONS = [15, 20, 30] as const
const MIN_CARDS = 4
/** Grace after the clock hits zero before the host reveals, so late answers land. */
const AUTO_ADVANCE_GRACE_MS = 750
/** Answer errors that mean "this question is closed for you": stay locked. */
const FINAL_SUBMIT_ERRORS = ['Too late', 'Already answered', 'Not accepting answers']

function useServerClock(): ServerClock {
  const [offset, setOffset] = useState(0)
  const note = useCallback((serverNow: number | undefined) => {
    if (typeof serverNow !== 'number' || !Number.isFinite(serverNow)) return
    const next = serverNow - Date.now()
    // Ignore jitter so the countdown doesn't restart on every response.
    setOffset((cur) => (Math.abs(cur - next) > 150 ? next : cur))
  }, [])
  useEffect(() => {
    let alive = true
    void callAction<{ now: number }>('serverTime', {}).then((r) => {
      if (alive && r.success) note(r.data.now)
    })
    return () => {
      alive = false
    }
  }, [note])
  return useMemo(() => ({ offset, note }), [offset, note])
}

export function QuizTab({ groupId, myId, myName, cardCount, onGoToCards }: Props) {
  const q = useQuery<QuizSession>('quiz_sessions', {
    where: { groupId },
    orderBy: 'createdAt',
    orderDir: 'desc',
    limit: 1,
  })
  const clock = useServerClock()
  const [dismissedId, setDismissedId] = useState<string | null>(null)

  const latest = q.records[0]
  const session = useMemo(() => (latest ? normalizeSession(latest.data) : null), [latest])
  const sessionId = latest?.recordId

  if (q.status === 'loading') {
    return (
      <div aria-busy="true" aria-label="Loading quiz" className="mx-auto w-full max-w-2xl space-y-4">
        <div className="h-40 animate-pulse rounded-2xl bg-muted" />
        <div className="h-24 animate-pulse rounded-2xl bg-muted" />
      </div>
    )
  }

  if (q.status === 'error') {
    return <p className="text-sm text-danger-ink">Couldn’t load the quiz. {q.error}</p>
  }

  const live = session && sessionId && session.status !== 'done'
  const finished = session && sessionId && session.status === 'done' && hasResults(session) ? session : null
  const showDone = finished && dismissedId !== sessionId

  return (
    <div className="mx-auto w-full max-w-2xl">
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announce(session, myId, showDone ? 'done' : live ? 'live' : 'setup')}
      </p>
      {live ? (
        <LiveSession key={sessionId} sessionId={sessionId} session={session} myId={myId} myName={myName} clock={clock} />
      ) : showDone ? (
        <DoneView
          session={finished}
          myId={myId}
          onNewQuiz={() => setDismissedId(sessionId!)}
        />
      ) : (
        <SetupView
          groupId={groupId}
          cardCount={cardCount}
          onGoToCards={onGoToCards}
          last={finished}
          myId={myId}
          clock={clock}
        />
      )}
    </div>
  )
}

function announce(s: QuizSession | null, myId: string, view: 'setup' | 'live' | 'done'): string {
  if (!s || view === 'setup') return ''
  if (view === 'done') {
    const me = standings(s.scores).find((r) => r.userId === myId)
    return me ? `Quiz over. You placed ${ordinal(me.rank)} with ${me.total} points.` : 'Quiz over.'
  }
  const i = s.currentIndex
  const item = s.items[i]
  if (s.status === 'lobby') return 'Waiting for players.'
  if (s.status === 'question' && item) return `Question ${i + 1} of ${s.items.length}. ${item.prompt}`
  if (s.status === 'reveal' && item) {
    const a = s.answers[i]
    const last = s.scores[myId]?.last
    const answer = typeof a === 'number' ? `Answer: ${item.choices[a]}.` : ''
    const mine = last ? (last.correct ? `Correct, plus ${last.points} points.` : 'Wrong answer.') : 'Missed.'
    return `${answer} ${mine}`
  }
  return ''
}

/* ───────────────────────────── Setup ───────────────────────────── */

function Segmented<T extends number>({
  label,
  options,
  value,
  onChange,
  format,
}: {
  label: string
  options: readonly T[]
  value: T
  onChange: (v: T) => void
  format: (v: T) => string
}) {
  const id = useId()
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground" id={id}>
        {label}
      </p>
      <div role="group" aria-labelledby={id} className="inline-flex rounded-lg border border-border bg-muted p-0.5">
        {options.map((o) => {
          const on = o === value
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(o)}
              className={cn(
                'h-8 min-w-12 rounded-md px-3 text-sm font-medium tabular-nums outline-none transition-colors duration-150 focus-visible:ring-[3px] focus-visible:ring-ring/50',
                on ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {format(o)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SetupView({
  groupId,
  cardCount,
  onGoToCards,
  last,
  myId,
  clock,
}: {
  groupId: string
  cardCount: number
  onGoToCards: () => void
  last: QuizSession | null
  myId: string
  clock: ServerClock
}) {
  const [count, setCount] = useState<(typeof COUNT_OPTIONS)[number]>(8)
  const [secs, setSecs] = useState<(typeof TIME_OPTIONS)[number]>(20)
  const [starting, setStarting] = useState(false)
  const toast = useToast()
  const enough = cardCount >= MIN_CARDS

  async function start() {
    if (starting || !enough) return
    setStarting(true)
    const r = await callAction<{ sessionId: string; serverNow: number }>('startQuiz', {
      groupId,
      count,
      questionSeconds: secs,
    })
    setStarting(false)
    if (!r.success) {
      toast.error('Couldn’t start the quiz', r.error)
      return
    }
    clock.note(r.data.serverNow)
  }

  return (
    <div className="space-y-5">
      {last && (
        <section className="rise-in rounded-2xl border border-border bg-card p-5" aria-labelledby="quiz-last">
          <div className="mb-3 flex items-center gap-2">
            <Trophy className="size-4 text-brand-ink" aria-hidden />
            <h2 id="quiz-last" className="text-sm font-semibold">
              Last quiz
            </h2>
            <span className="text-xs text-muted-foreground">
              · {plural(last.items.length, 'question')}
              {last.hostName ? ` · hosted by ${last.hostName}` : ''}
            </span>
          </div>
          <Leaderboard scores={last.scores} myId={myId} limit={5} emphasizeTop />
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-6 sm:p-8" aria-labelledby="quiz-hero">
        <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-brand-soft text-brand-soft-foreground">
          <Zap className="size-5" aria-hidden />
        </div>
        <h2 id="quiz-hero" className="text-xl font-semibold tracking-tight">
          Live quiz
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Everyone answers the same multiple-choice questions from your flashcards at once. Faster right answers score more.
        </p>

        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-4">
          <Segmented label="Questions" options={COUNT_OPTIONS} value={count} onChange={setCount} format={(v) => String(v)} />
          <Segmented label="Time per question" options={TIME_OPTIONS} value={secs} onChange={setSecs} format={(v) => `${v}s`} />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button data-testid="quiz-start" size="lg" className="px-6" onClick={() => void start()} disabled={!enough} loading={starting}>
            <Play aria-hidden /> {last ? 'Play again' : 'Start quiz'}
          </Button>
          {enough ? (
            <p className="text-xs text-muted-foreground">
              Drawn from {plural(cardCount, 'flashcard')}. You’ll host; others join from this tab.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                You need at least {MIN_CARDS} flashcards to run a quiz
                {cardCount > 0 ? ` (you have ${cardCount})` : ''}.
              </p>
              <Button variant="outline" onClick={onGoToCards}>
                <Layers aria-hidden /> Go to cards
              </Button>
            </>
          )}
        </div>
      </section>
    </div>
  )
}

/* ───────────────────────────── Live session ───────────────────────────── */

type Player = { userId: string; name: string; answered: number }

function LiveSession({
  sessionId,
  session,
  myId,
  myName,
  clock,
}: {
  sessionId: string
  session: QuizSession
  myId: string
  myName: string
  clock: ServerClock
}) {
  const { peers, connected, updateState } = usePresenceRoom(`quiz:${sessionId}`)
  const toast = useToast()
  const isHost = session.hostId === myId
  const { status, currentIndex: idx } = session

  /** My locked-in choice per question index. */
  const [picks, setPicks] = useState<Record<number, number>>({})
  /** Questions the server confirmed I answered (drives my own check badge). */
  const [answered, setAnswered] = useState<Record<number, true>>({})
  const [expiredIdx, setExpiredIdx] = useState(-1)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [ending, setEnding] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const advanceKey = useRef<string | null>(null)
  const sessionKey = `${status}:${idx}`
  const sessionKeyRef = useRef(sessionKey)
  useEffect(() => {
    sessionKeyRef.current = sessionKey
  }, [sessionKey])

  // updateState is dropped while the socket is closed, so (re)send on connect
  // and on every question change: -1 until the server accepts my answer.
  const iAnswered = !!answered[idx]
  useEffect(() => {
    if (connected) updateState({ answered: iAnswered ? idx : -1 })
  }, [connected, idx, iAnswered, updateState])

  const players = useMemo<Player[]>(() => {
    const seen = new Map<string, Player>()
    seen.set(myId, { userId: myId, name: myName, answered: answered[idx] ? idx : -1 })
    for (const p of peers) {
      if (p.userId === myId || seen.has(p.userId)) continue
      const a = (p.state as { answered?: unknown })?.answered
      seen.set(p.userId, { userId: p.userId, name: p.userName || 'Player', answered: typeof a === 'number' ? a : -1 })
    }
    return [...seen.values()]
  }, [peers, myId, myName, answered, idx])

  /**
   * advanceQuiz is not idempotent (two calls during a question skip the
   * reveal), so every caller goes through here and each status:index fires once.
   */
  const advance = useCallback(
    async (manual: boolean) => {
      const key = sessionKeyRef.current
      if (advanceKey.current === key) return
      advanceKey.current = key
      setAdvancing(true)
      const r = await callAction<{ status: string; currentIndex: number; serverNow: number }>('advanceQuiz', { sessionId })
      setAdvancing(false)
      if (r.success) {
        clock.note(r.data.serverNow)
        return
      }
      if (sessionKeyRef.current === key) advanceKey.current = null
      if (manual) toast.error('Couldn’t continue the quiz', r.error)
    },
    [sessionId, clock, toast],
  )

  // Host: reveal automatically once time is up (plus a short grace).
  const { questionStartedAt, questionSeconds } = session
  useEffect(() => {
    if (!isHost || status !== 'question') return
    const wait = remainingMs(questionStartedAt, questionSeconds, clock.offset) + AUTO_ADVANCE_GRACE_MS
    const t = window.setTimeout(() => void advance(false), wait)
    return () => window.clearTimeout(t)
  }, [isHost, status, idx, questionStartedAt, questionSeconds, clock.offset, advance])

  const pending = useRef(new Set<number>())
  const submit = useCallback(
    async (choice: number) => {
      if (status !== 'question' || picks[idx] !== undefined || pending.current.has(idx) || expiredIdx === idx) return
      pending.current.add(idx)
      setPicks((p) => ({ ...p, [idx]: choice }))
      const r = await callAction<{ accepted: boolean; serverNow: number }>('submitAnswer', {
        sessionId,
        questionIndex: idx,
        choiceIndex: choice,
      })
      pending.current.delete(idx)
      if (r.success) {
        clock.note(r.data.serverNow)
        setAnswered((a) => ({ ...a, [idx]: true }))
        updateState({ answered: idx })
        return
      }
      if (r.error === 'Already answered') {
        toast.info('Already answered', 'Your earlier answer for this question counts.')
        setAnswered((a) => ({ ...a, [idx]: true }))
        return
      }
      if (r.error === 'Too late') toast.error('Too late', 'Time ran out before your answer landed.')
      else toast.error('Answer not counted', r.error)
      if (FINAL_SUBMIT_ERRORS.includes(r.error)) return
      setPicks((p) => {
        const next = { ...p }
        delete next[idx]
        return next
      })
    },
    [status, picks, idx, expiredIdx, sessionId, clock, updateState, toast],
  )

  async function end() {
    setEnding(true)
    const r = await callAction<{ status: 'done' }>('endQuiz', { sessionId })
    setEnding(false)
    setConfirmEnd(false)
    if (!r.success) toast.error('Couldn’t end the quiz', r.error)
  }

  const hostName = session.hostName || 'the host'
  const total = session.items.length
  const item = session.items[idx]

  let body: ReactNode
  if (status === 'lobby' || !item) {
    body = (
      <LobbyView
        players={players}
        myId={myId}
        isHost={isHost}
        hostName={hostName}
        total={total}
        seconds={questionSeconds}
        advancing={advancing}
        ending={ending}
        onStart={() => void advance(true)}
        onCancel={() => void end()}
      />
    )
  } else if (status === 'question') {
    const timeUp = expiredIdx === idx
    const answeredCount = players.filter((p) => p.answered === idx).length
    body = (
      <div key={`q${idx}`} className="space-y-6">
        <QuestionHeader index={idx} total={total} />
        <Countdown
          startedAt={questionStartedAt}
          seconds={questionSeconds}
          offset={clock.offset}
          onSecond={(s) => {
            if (s === 0) setExpiredIdx(idx)
          }}
        />
        <Prompt text={item.prompt} />
        <ChoiceGrid
          choices={item.choices}
          picked={picks[idx]}
          disabled={picks[idx] !== undefined || timeUp}
          onPick={(c) => void submit(c)}
        />
        <p className="min-h-5 text-center text-sm font-medium" aria-live="polite">
          {picks[idx] !== undefined ? (
            <span className="quiz-fade inline-flex items-center gap-1.5 text-brand-ink">
              <Lock className="size-3.5" aria-hidden /> Locked in
            </span>
          ) : timeUp ? (
            <span className="text-muted-foreground">Time’s up</span>
          ) : null}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <AnsweredRow players={players} index={idx} answeredCount={answeredCount} />
          {isHost && (
            <Button data-testid="quiz-advance" variant="secondary" onClick={() => void advance(true)} disabled={advancing}>
              Reveal now <ArrowRight aria-hidden />
            </Button>
          )}
        </div>
      </div>
    )
  } else {
    const last = idx === total - 1
    body = (
      <RevealView
        key={`r${idx}`}
        session={session}
        myId={myId}
        myPick={picks[idx]}
        footer={
          isHost ? (
            <Button data-testid="quiz-advance" size="lg" onClick={() => void advance(true)} disabled={advancing}>
              {last ? (
                <>
                  <Trophy aria-hidden /> See results
                </>
              ) : (
                <>
                  Next question <ArrowRight aria-hidden />
                </>
              )}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              Waiting for {hostName} to {last ? 'show results' : 'continue'}…
            </p>
          )
        }
      />
    )
  }

  return (
    <div className="space-y-4">
      {body}
      {isHost && status !== 'lobby' && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => setConfirmEnd(true)}>
            <X aria-hidden /> End quiz
          </Button>
        </div>
      )}
      <ConfirmModal
        open={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        onConfirm={() => void end()}
        loading={ending}
        variant="destructive"
        title="End the quiz now?"
        description="Everyone goes straight to the results with the scores so far."
        confirmText="End quiz"
      />
    </div>
  )
}

function LobbyView({
  players,
  myId,
  isHost,
  hostName,
  total,
  seconds,
  advancing,
  ending,
  onStart,
  onCancel,
}: {
  players: Player[]
  myId: string
  isHost: boolean
  hostName: string
  total: number
  seconds: number
  advancing: boolean
  ending: boolean
  onStart: () => void
  onCancel: () => void
}) {
  return (
    <section className="rounded-2xl border border-border bg-card px-6 py-10 text-center sm:px-10" aria-labelledby="quiz-lobby">
      <h2 id="quiz-lobby" className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Waiting for players
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {plural(total, 'question')} · {seconds}s each
      </p>
      <ul className="mx-auto mt-8 flex max-w-md flex-wrap justify-center gap-4" aria-label="Players">
        {players.map((p, i) => (
          <li key={p.userId} className="rise-in flex w-16 flex-col items-center gap-1.5" style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}>
            <MemberAvatar userId={p.userId} name={p.name} size="md" tooltip={false} />
            <span className="w-full truncate text-xs text-muted-foreground">{p.userId === myId ? 'You' : p.name}</span>
          </li>
        ))}
      </ul>
      <p className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium tabular-nums">
        <Users className="size-4 text-muted-foreground" aria-hidden />
        {plural(players.length, 'player')} here
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {isHost ? (
          <>
            <Button variant="outline" onClick={onCancel} loading={ending} disabled={advancing}>
              Cancel
            </Button>
            <Button data-testid="quiz-advance" size="lg" className="px-8" onClick={onStart} loading={advancing} disabled={ending}>
              <Play aria-hidden /> Start
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Waiting for {hostName} to start…</p>
        )}
      </div>
    </section>
  )
}

function QuestionHeader({ index, total }: { index: number; total: number }) {
  return (
    <p className="text-sm font-medium text-muted-foreground tabular-nums">
      Question {index + 1} of {total}
    </p>
  )
}

function Prompt({ text }: { text: string }) {
  return <h2 className="rise-in text-2xl font-semibold leading-snug tracking-tight text-balance sm:text-3xl">{text}</h2>
}

function ChoiceGrid({
  choices,
  picked,
  disabled,
  onPick,
}: {
  choices: string[]
  picked: number | undefined
  disabled: boolean
  onPick: (i: number) => void
}) {
  // Keys 1–4 answer. No animation on the keyboard path beyond the state change.
  useEffect(() => {
    if (disabled) return
    function onKey(e: KeyboardEvent) {
      if (e.repeat || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement | null
      if (el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.isContentEditable) return
      const n = Number(e.key)
      if (Number.isInteger(n) && n >= 1 && n <= choices.length) {
        e.preventDefault()
        onPick(n - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [disabled, choices.length, onPick])

  return (
    <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Answers">
      {choices.map((c, i) => {
        const selected = picked === i
        return (
          <button
            key={i}
            type="button"
            data-testid={`quiz-choice-${i}`}
            aria-pressed={selected}
            aria-keyshortcuts={String(i + 1)}
            aria-label={`${LETTERS[i]}: ${c}`}
            disabled={disabled}
            onClick={() => onPick(i)}
            className={cn(
              'quiz-tile flex min-h-20 items-center gap-3 rounded-xl border border-border bg-card p-4 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              !disabled && 'cursor-pointer hover:bg-muted',
              selected && 'ring-2 ring-primary',
              disabled && !selected && 'opacity-60',
            )}
          >
            <LetterBadge i={i} tone={selected ? 'on' : 'off'} />
            <span className="min-w-0 flex-1 text-base font-medium leading-snug">{c}</span>
          </button>
        )
      })}
    </div>
  )
}

function LetterBadge({ i, tone }: { i: number; tone: 'on' | 'off' | 'right' | 'wrong' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold transition-colors duration-150',
        tone === 'on' && 'bg-primary text-primary-foreground',
        tone === 'off' && 'bg-muted text-muted-foreground',
        tone === 'right' && 'bg-primary text-primary-foreground',
        tone === 'wrong' && 'bg-danger-ink text-background',
      )}
    >
      {tone === 'right' ? <Check className="size-4" /> : tone === 'wrong' ? <X className="size-4" /> : LETTERS[i]}
    </span>
  )
}

function AnsweredRow({ players, index, answeredCount }: { players: Player[]; index: number; answeredCount: number }) {
  return (
    <div className="flex items-center gap-3">
      <ul className="flex -space-x-1.5" aria-hidden>
        {players.slice(0, 8).map((p) => (
          <li key={p.userId} className="relative">
            <MemberAvatar userId={p.userId} name={p.name} size="sm" tooltip={false} />
            <span
              data-on={p.answered === index}
              className="quiz-check absolute -bottom-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background"
            >
              <Check className="size-2.5" strokeWidth={3} />
            </span>
          </li>
        ))}
      </ul>
      <span data-testid="quiz-answered-count" className="text-sm text-muted-foreground tabular-nums">
        {answeredCount} of {players.length} answered
      </span>
    </div>
  )
}

/* ───────────────────────────── Reveal ───────────────────────────── */

function RevealView({
  session,
  myId,
  myPick,
  footer,
}: {
  session: QuizSession
  myId: string
  myPick: number | undefined
  footer: ReactNode
}) {
  const idx = session.currentIndex
  const item = session.items[idx]
  const correct = session.answers[idx]
  const tally = session.tallies[idx] ?? {}
  const last = session.scores[myId]?.last ?? null
  const pick = last ? last.choice : myPick

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <QuestionHeader index={idx} total={session.items.length} />
        <ResultChip last={last} />
      </div>
      <h2 className="text-2xl font-semibold leading-snug tracking-tight text-balance sm:text-3xl">{item.prompt}</h2>
      <div className="grid gap-3 sm:grid-cols-2" role="list" aria-label="Answers">
        {item.choices.map((c, i) => {
          const isRight = correct === i
          const isMyWrong = pick === i && !isRight
          const n = tally[String(i)] ?? 0
          return (
            <div
              key={i}
              role="listitem"
              data-testid={`quiz-choice-${i}`}
              data-correct={isRight || undefined}
              aria-label={`${LETTERS[i]}: ${c}${isRight ? ', correct answer' : ''}${pick === i ? ', your pick' : ''}, ${plural(n, 'pick')}`}
              className={cn(
                'quiz-tile flex min-h-20 items-center gap-3 rounded-xl border p-4',
                isRight && 'border-transparent bg-brand-soft text-brand-soft-foreground ring-2 ring-primary',
                isMyWrong && 'border-transparent bg-danger-soft text-danger-ink',
                !isRight && !isMyWrong && 'border-border bg-card text-muted-foreground',
              )}
            >
              <LetterBadge i={i} tone={isRight ? 'right' : isMyWrong ? 'wrong' : 'off'} />
              <span className="min-w-0 flex-1 text-base font-medium leading-snug">{c}</span>
              <span className="quiz-fade shrink-0 text-sm font-semibold tabular-nums" aria-hidden>
                {n}
              </span>
            </div>
          )
        })}
      </div>
      <section className="rounded-2xl border border-border bg-card p-4" aria-labelledby="quiz-standings">
        <h3 id="quiz-standings" className="mb-2 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Standings
        </h3>
        <Leaderboard scores={session.scores} myId={myId} limit={5} fromPrevious />
      </section>
      <div className="flex justify-end">{footer}</div>
    </div>
  )
}

function ResultChip({ last }: { last: QuizSession['scores'][string]['last'] }) {
  const points = last?.correct ? last.points : 0
  const shown = useCountUp(points, 500, 100)
  if (last?.correct) {
    return (
      <span
        data-testid="quiz-my-result"
        className="quiz-pop inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold tabular-nums text-brand-soft-foreground"
        aria-label={`Correct, plus ${points} points`}
      >
        <Check className="size-4" aria-hidden /> +{shown.toLocaleString()}
      </span>
    )
  }
  return (
    <span
      data-testid="quiz-my-result"
      className="quiz-pop inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-3 py-1 text-sm font-semibold text-danger-ink"
    >
      {last ? <X className="size-4" aria-hidden /> : <Timer className="size-4" aria-hidden />}
      {last ? 'Wrong' : 'Missed'}
    </span>
  )
}

/* ───────────────────────────── Done ───────────────────────────── */

function DoneView({ session, myId, onNewQuiz }: { session: QuizSession; myId: string; onNewQuiz: () => void }) {
  const isHost = session.hostId === myId
  const rows = standings(session.scores)
  const me = rows.find((r) => r.userId === myId)
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [])

  return (
    <section className="rise-in rounded-2xl border border-border bg-card p-6 sm:p-8" aria-labelledby="quiz-done">
      <div className="mb-1 flex items-center gap-2 text-brand-ink">
        <Trophy className="size-5" aria-hidden />
        <span className="text-xs font-semibold uppercase tracking-wide">Final results</span>
      </div>
      <h2 ref={headingRef} id="quiz-done" tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">
        Quiz complete
      </h2>
      <p data-testid="quiz-my-result" className="mt-1 text-sm text-muted-foreground">
        {me ? (
          <>
            You placed <span className="font-semibold text-foreground">{ordinal(me.rank)}</span> of {rows.length} with{' '}
            <span className="font-semibold text-foreground tabular-nums">{me.total.toLocaleString()}</span> points.
          </>
        ) : (
          'You didn’t answer in this one.'
        )}
      </p>
      <Leaderboard scores={session.scores} myId={myId} emphasizeTop className="mt-5" />
      <div className="mt-6 flex justify-end">
        {isHost ? (
          <Button onClick={onNewQuiz}>
            <Play aria-hidden /> New quiz
          </Button>
        ) : (
          <Button variant="outline" onClick={onNewQuiz}>
            Back to quiz
          </Button>
        )}
      </div>
    </section>
  )
}
