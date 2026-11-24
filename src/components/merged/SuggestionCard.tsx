import { ArrowRight, Check, X } from 'lucide-react'
import type { Suggestion } from '@/lib/types'
import { cn } from '@/lib/utils'
import { MemberAvatar } from '../MemberAvatar'
import { Button } from '../ui'

const KIND: Record<Suggestion['kind'], { label: string; cls: string }> = {
  conflict: { label: 'Conflict', cls: 'bg-danger-soft text-danger-ink' },
  error: { label: 'Likely error', cls: 'bg-danger-soft text-danger-ink' },
  gap: { label: 'Gap', cls: 'bg-secondary text-secondary-foreground' },
}

const STATUS: Record<Exclude<Suggestion['status'], 'open'>, string> = {
  accepted: 'Accepted',
  rejected: 'Rejected',
  stale: 'Out of date',
}

interface Props {
  s: Suggestion
  pending: 'accept' | 'reject' | null
  onDecide?: (d: 'accept' | 'reject') => void
  onHover?: (text: string | null) => void
  onFocusText?: () => void
}

export function SuggestionCard({ s, pending, onDecide, onHover, onFocusText }: Props) {
  const open = s.status === 'open'
  const kind = KIND[s.kind] ?? KIND.conflict
  return (
    <article
      data-testid="suggestion-card"
      data-status={s.status}
      onMouseEnter={() => open && onHover?.(s.originalText)}
      onMouseLeave={() => onHover?.(null)}
      className={cn(
        'rounded-xl border bg-card p-4 transition-[border-color,opacity] duration-200',
        open ? 'border-border hover:border-ring' : 'border-border opacity-70',
      )}
    >
      <header className="flex items-center gap-2">
        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', kind.cls)}>{kind.label}</span>
        {!open && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
            {s.status === 'accepted' && <Check className="h-3.5 w-3.5 text-brand-ink" aria-hidden />}
            {STATUS[s.status as Exclude<Suggestion['status'], 'open'>]}
            {s.decidedByName && ` by ${s.decidedByName}`}
          </span>
        )}
      </header>

      <p className="mt-2.5 text-sm leading-relaxed">{s.explanation}</p>

      <button
        type="button"
        onClick={onFocusText}
        className="mt-3 block w-full rounded-lg bg-muted px-3 py-2 text-left font-mono text-[12px] leading-relaxed transition-colors hover:bg-accent"
        aria-label="Show this text in the merged notes"
      >
        <span className="text-danger-ink line-through decoration-1">{s.originalText}</span>
        <ArrowRight className="mx-1.5 inline h-3 w-3 text-muted-foreground" aria-hidden />
        <span className="rounded bg-brand-soft px-0.5 text-brand-soft-foreground">{s.suggestedText || '(remove)'}</span>
      </button>

      {s.sources?.length > 0 && (
        <ul className="mt-3 space-y-2">
          {s.sources.map((src, i) => (
            <li key={i} className="flex gap-2">
              <MemberAvatar userId={src.authorId + src.authorName} name={src.authorName} size="xs" tooltip={false} />
              <blockquote className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">
                <span className="mr-1.5 font-medium text-foreground">{src.authorName}</span>
                <span className="break-words font-mono text-[11.5px] before:content-['“'] after:content-['”']">{src.quote}</span>
              </blockquote>
            </li>
          ))}
        </ul>
      )}

      {open && onDecide && (
        <div className="mt-4 flex gap-2">
          <Button
            size="sm"
            className="flex-1"
            loading={pending === 'accept'}
            disabled={pending !== null}
            onClick={() => onDecide('accept')}
          >
            <Check aria-hidden /> Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 bg-card"
            loading={pending === 'reject'}
            disabled={pending !== null}
            onClick={() => onDecide('reject')}
          >
            <X aria-hidden /> Reject
          </Button>
        </div>
      )}
    </article>
  )
}
