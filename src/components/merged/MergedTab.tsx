import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { usePresenceRoom, useQuery, useYjsText } from 'deepspace'
import { Check, Eye, GitMerge, Pencil, RefreshCw, Sparkles } from 'lucide-react'
import { callAction } from '@/lib/api'
import { scrollToText, setHighlight } from '@/lib/highlight'
import { timeAgo } from '@/lib/time'
import type { Group, Note, Suggestion } from '@/lib/types'
import { cn } from '@/lib/utils'
import { MemberAvatar } from '../MemberAvatar'
import { Button, ConfirmModal, EmptyState, Textarea, useToast } from '../ui'
import { SuggestionCard } from './SuggestionCard'
import './merged.css'

const MERGE_STEPS = ['Reading everyone’s notes', 'Merging by topic', 'Checking every quote against its source', 'Writing suggestions']

interface Props {
  groupId: string
  group: Group
  myName: string
  onGoToNotes: () => void
}

export function MergedTab({ groupId, group, myName, onGoToNotes }: Props) {
  const { text, setText, synced, canWrite } = useYjsText('groups', groupId, 'mergedNotes')
  const notes = useQuery<Note>('notes', { where: { groupId } })
  const suggestions = useQuery<Suggestion>('suggestions', { where: { groupId }, orderBy: 'order', orderDir: 'asc' })
  const { peers, updateState } = usePresenceRoom(`merged:${groupId}`)
  const [mode, setMode] = useState<'read' | 'edit'>('read')
  const [merging, setMerging] = useState(false)
  const [step, setStep] = useState(0)
  const [confirmRemerge, setConfirmRemerge] = useState(false)
  const [pending, setPending] = useState<Record<string, 'accept' | 'reject'>>({})
  const [filter, setFilter] = useState<'open' | 'resolved'>('open')
  const [reveal, setReveal] = useState(0)
  const docRef = useRef<HTMLDivElement>(null)
  const toast = useToast()

  const editors = peers.filter((p) => (p.state as { editing?: boolean })?.editing)
  // Keep the last non-empty list so the pill fades out with its content intact.
  const lastEditors = useRef(editors)
  if (editors.length > 0) lastEditors.current = editors
  const shownEditors = editors.length > 0 ? editors : lastEditors.current
  useEffect(() => {
    updateState({ editing: mode === 'edit' })
  }, [mode, updateState])

  useEffect(() => {
    if (!merging) return
    setStep(0)
    const t = setInterval(() => setStep((s) => Math.min(s + 1, MERGE_STEPS.length - 1)), 4500)
    return () => clearInterval(t)
  }, [merging])

  const all = suggestions.records
  const open = all.filter((s) => s.data.status === 'open')
  const resolved = all.filter((s) => s.data.status !== 'open' && s.data.status !== 'stale')
  const shown = filter === 'open' ? open : resolved
  const noteCount = notes.records.length
  const hasMerged = text.trim().length > 0

  const lectures = useMemo(() => new Set(notes.records.map((n) => n.data.lectureLabel)).size, [notes.records])

  async function merge() {
    setConfirmRemerge(false)
    setMerging(true)
    const r = await callAction<{ kept: number }>('mergeNotes', { groupId })
    setMerging(false)
    if (!r.success) return toast.error('Merge didn’t finish', r.error)
    setMode('read')
    setFilter('open')
    setReveal((n) => n + 1)
    toast.success(
      'Notes merged',
      r.data.kept === 0 ? 'No conflicts found.' : `${r.data.kept} ${r.data.kept === 1 ? 'suggestion' : 'suggestions'} to review.`,
    )
  }

  async function decide(id: string, s: Suggestion, d: 'accept' | 'reject') {
    setPending((p) => ({ ...p, [id]: d }))
    const r = await callAction<{ status: Suggestion['status'] }>('decideSuggestion', { suggestionId: id, decision: d })
    setPending(({ [id]: _drop, ...rest }) => rest)
    setHighlight('suggest-hover', null, null)
    if (!r.success) return toast.error('Couldn’t update suggestion', r.error)
    if (r.data.status === 'stale') {
      toast.warning('Text changed', 'That passage was edited since the merge, so the suggestion no longer applies.')
    } else if (r.data.status === 'accepted') {
      setMode('read')
      // Flash the corrected passage once the new text has rendered.
      setTimeout(() => {
        if (setHighlight('accept-flash', docRef.current, s.suggestedText)) {
          scrollToText(docRef.current, s.suggestedText)
          setTimeout(() => setHighlight('accept-flash', null, null), 2400)
        }
      }, 250)
    }
  }

  // --- empty / loading states -------------------------------------------
  if (!synced || notes.status === 'loading') {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]" aria-busy="true">
        <div className="h-96 animate-pulse rounded-xl bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }

  if (!hasMerged && !merging) {
    const ready = noteCount >= 2
    return (
      <EmptyState
        className="rounded-xl border border-dashed border-border"
        icon={<GitMerge className="h-8 w-8" aria-hidden />}
        title={ready ? 'Ready to merge' : 'Merging needs two sets of notes'}
        description={
          ready
            ? `${noteCount} notes across ${lectures} ${lectures === 1 ? 'lecture' : 'lectures'}. The AI merges them into one sheet and flags disagreements — it never silently changes anything.`
            : 'Each member adds their own notes for a lecture. You can also try it with sample notes from the Notes tab.'
        }
        action={ready ? { label: 'Merge notes', onClick: merge } : { label: 'Go to notes', onClick: onGoToNotes }}
      />
    )
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* Merged document */}
      <section className="min-w-0 rounded-xl border border-border bg-card" aria-label="Merged notes">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
          <div className="inline-flex rounded-lg bg-muted p-0.5" role="tablist" aria-label="View mode">
            {(['read', 'edit'] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                disabled={m === 'edit' && !canWrite}
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors disabled:opacity-50',
                  mode === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {m === 'read' ? <Eye className="h-3.5 w-3.5" aria-hidden /> : <Pencil className="h-3.5 w-3.5" aria-hidden />}
                {m === 'read' ? 'Read' : 'Edit'}
              </button>
            ))}
          </div>
          <span
            data-visible={editors.length > 0}
            aria-hidden={editors.length === 0}
            className="presence-pill inline-flex items-center gap-1.5 rounded-full bg-brand-soft py-0.5 pl-1 pr-2 text-[11px] font-medium text-brand-soft-foreground"
          >
            <span className="flex -space-x-1">
              {shownEditors.slice(0, 3).map((p) => (
                <MemberAvatar key={p.userId} userId={p.userId} name={p.userName} size="xs" tooltip={false} />
              ))}
            </span>
            {Math.max(shownEditors.length, 1)} editing
          </span>
          <span className="ml-auto text-xs text-muted-foreground">
            {group.lastMergedAt && `Merged ${timeAgo(group.lastMergedAt)}${group.lastMergedBy ? ` by ${group.lastMergedBy}` : ''}`}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="bg-card"
            loading={merging}
            onClick={() => setConfirmRemerge(true)}
            disabled={noteCount < 2}
          >
            <RefreshCw aria-hidden /> Re-merge
          </Button>
        </div>

        {merging ? (
          <MergeProgress step={step} noteCount={noteCount} />
        ) : mode === 'edit' ? (
          <div className="p-4">
            <Textarea
              data-testid="merged-editor"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={!synced || !canWrite}
              aria-label="Edit merged notes"
              className="min-h-[60vh] resize-y border-0 bg-transparent p-0 font-mono text-[13px] leading-[1.75] shadow-none focus-visible:ring-0"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Changes sync live to everyone, {myName}. Markdown is supported.
            </p>
          </div>
        ) : (
          <div
            ref={docRef}
            key={reveal}
            data-testid="merged-doc"
            className={cn('merged-prose px-6 py-5 md:px-8 md:py-7', reveal > 0 && 'merged-reveal')}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
          </div>
        )}
      </section>

      {/* Suggestions */}
      <aside className="lg:sticky lg:top-4" aria-label="Suggestions">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-brand-ink" aria-hidden /> Suggestions
          </h2>
          <div className="inline-flex rounded-lg bg-muted p-0.5 text-xs">
            {(['open', 'resolved'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={cn(
                  'rounded-md px-2.5 py-1 font-medium capitalize transition-colors',
                  filter === f ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {f} <span className="tabular-nums text-muted-foreground">{f === 'open' ? open.length : resolved.length}</span>
              </button>
            ))}
          </div>
        </div>

        {suggestions.status === 'loading' ? (
          <div className="h-40 animate-pulse rounded-xl bg-muted" />
        ) : shown.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-5 py-8 text-center">
            <span className="mx-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
              <Check className="h-4 w-4" aria-hidden />
            </span>
            <p className="mt-3 text-sm font-medium">{filter === 'open' ? 'All reviewed' : 'Nothing decided yet'}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {filter === 'open'
                ? 'No open suggestions. The merged notes are the group’s version.'
                : 'Accepted and rejected suggestions show up here.'}
            </p>
          </div>
        ) : (
          <ul className="max-h-[calc(100vh-14rem)] space-y-3 overflow-y-auto pb-2 pr-1">
            {shown.map((r) => (
              <li key={r.recordId} className="suggestion-in">
                <SuggestionCard
                  s={r.data}
                  pending={pending[r.recordId] ?? null}
                  onDecide={(d) => decide(r.recordId, r.data, d)}
                  onHover={(t) => mode === 'read' && setHighlight('suggest-hover', docRef.current, t)}
                  onFocusText={() => {
                    setMode('read')
                    setTimeout(() => {
                      setHighlight('suggest-hover', docRef.current, r.data.originalText)
                      scrollToText(docRef.current, r.data.originalText)
                    }, 50)
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </aside>

      <ConfirmModal
        open={confirmRemerge}
        onClose={() => setConfirmRemerge(false)}
        onConfirm={merge}
        title="Re-merge from the notes?"
        description="This replaces the merged notes (including manual edits) with a fresh merge, and marks open suggestions out of date."
        confirmText="Re-merge"
      />
      <span className="sr-only" aria-live="polite">
        {merging ? MERGE_STEPS[step] : ''}
      </span>
    </div>
  )
}

function MergeProgress({ step, noteCount }: { step: number; noteCount: number }) {
  return (
    <div className="px-6 py-8 md:px-8" data-testid="merge-progress">
      <ol className="space-y-3">
        {MERGE_STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-3 text-sm">
            <span
              className={cn(
                'inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] transition-colors',
                i < step && 'border-transparent bg-primary text-primary-foreground',
                i === step && 'merge-step-active border-ring',
                i > step && 'border-border text-muted-foreground',
              )}
            >
              {i < step ? <Check className="h-3 w-3" aria-hidden /> : i + 1}
            </span>
            <span className={i <= step ? 'text-foreground' : 'text-muted-foreground'}>
              {i === 0 ? `Reading ${noteCount} notes` : label}
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-8 space-y-3">
        {[92, 78, 85, 60, 88, 70].map((w, i) => (
          <div key={i} className="shimmer h-3 rounded" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  )
}
