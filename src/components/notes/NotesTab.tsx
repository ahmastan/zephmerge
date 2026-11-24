import { useMemo, useState } from 'react'
import { useQuery } from 'deepspace'
import { ChevronDown, FilePlus2, Pencil, Trash2 } from 'lucide-react'
import { callAction } from '@/lib/api'
import type { Note } from '@/lib/types'
import { timeAgo } from '@/lib/time'
import { cn } from '@/lib/utils'
import { MemberAvatar } from '../MemberAvatar'
import { Badge, Button, ConfirmModal, EmptyState, useToast } from '../ui'
import { NoteEditorModal } from './NoteEditorModal'

type Row = { recordId: string; data: Note; updatedAt: string }

export function NotesTab({ groupId, myId }: { groupId: string; myId: string }) {
  const { records, status, error } = useQuery<Note>('notes', {
    where: { groupId },
    orderBy: 'createdAt',
    orderDir: 'asc',
  })
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<{ noteId: string; lectureLabel: string; body: string } | null>(null)

  const byLecture = useMemo(() => {
    const m = new Map<string, Row[]>()
    for (const r of records as Row[]) {
      const key = r.data.lectureLabel
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(r)
    }
    return [...m.entries()]
  }, [records])
  const lectures = byLecture.map(([l]) => l)

  function openNew() {
    setEditing(null)
    setEditorOpen(true)
  }

  return (
    <div>
      {status === 'loading' ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : status === 'error' ? (
        <p className="text-sm text-danger-ink">Couldn’t load notes. {error}</p>
      ) : records.length === 0 ? (
        <EmptyState
          className="rounded-xl border border-dashed border-border"
          icon={<FilePlus2 className="h-8 w-8" aria-hidden />}
          title="No notes yet"
          description="Everyone adds their own notes for a lecture. Once there are two or more, merge them into one study sheet."
          action={{ label: 'Add your notes', onClick: openNew }}
        />
      ) : (
        <div className="space-y-10">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {records.length} {records.length === 1 ? 'note' : 'notes'} across {lectures.length}{' '}
              {lectures.length === 1 ? 'lecture' : 'lectures'}
            </p>
            <Button onClick={openNew}>
              <FilePlus2 aria-hidden /> Add notes
            </Button>
          </div>
          {byLecture.map(([lecture, notes]) => (
            <section key={lecture} aria-labelledby={`lec-${lecture}`}>
              <h2 id={`lec-${lecture}`} className="mb-3 flex items-center gap-2 text-sm font-semibold">
                {lecture}
                <span className="font-normal text-muted-foreground">· {notes.length}</span>
              </h2>
              <ul className="grid gap-3 md:grid-cols-2">
                {notes.map((n) => (
                  <li key={n.recordId}>
                    <NoteCard
                      row={n}
                      mine={n.data.authorId === myId}
                      onEdit={() => {
                        setEditing({ noteId: n.recordId, lectureLabel: n.data.lectureLabel, body: n.data.body })
                        setEditorOpen(true)
                      }}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <NoteEditorModal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        groupId={groupId}
        lectures={lectures}
        editing={editing}
      />
    </div>
  )
}

function NoteCard({ row, mine, onEdit }: { row: Row; mine: boolean; onEdit: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const toast = useToast()
  const n = row.data
  const author = n.sampleAuthor ?? n.authorName ?? 'Member'
  const long = n.body.length > 420 || n.body.split('\n').length > 9

  async function remove() {
    setDeleting(true)
    const r = await callAction('deleteNote', { noteId: row.recordId })
    setDeleting(false)
    if (!r.success) return toast.error('Couldn’t delete', r.error)
    setConfirmDelete(false)
  }

  return (
    <article
      data-testid="note-card"
      className={cn(
        'group flex h-full flex-col rounded-xl border bg-card p-4 transition-colors',
        mine ? 'border-border hover:border-ring' : 'border-border',
      )}
    >
      <header className="flex items-center gap-2">
        <MemberAvatar userId={n.sampleAuthor ? `sample:${n.sampleAuthor}` : n.authorId} name={author} size="xs" tooltip={false} />
        <span className="truncate text-sm font-medium">{author}</span>
        {mine && !n.sampleAuthor && <Badge variant="secondary" size="sm">You</Badge>}
        {n.sampleAuthor && <Badge variant="outline" size="sm">Sample</Badge>}
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">{timeAgo(row.updatedAt)}</span>
        {mine && (
          <span className="flex gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Edit note" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:text-danger-ink"
              aria-label="Delete note"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </span>
        )}
      </header>
      <pre
        className={cn(
          'mt-3 whitespace-pre-wrap break-words font-mono text-[12.5px] leading-relaxed text-muted-foreground',
          !expanded && long && 'max-h-44 overflow-hidden [mask-image:linear-gradient(to_bottom,black_70%,transparent)]',
        )}
      >
        {n.body}
      </pre>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 inline-flex items-center gap-1 self-start text-xs font-medium text-brand-ink hover:underline"
        >
          {expanded ? 'Show less' : 'Show all'}
          <ChevronDown className={cn('h-3 w-3 transition-transform', expanded && 'rotate-180')} aria-hidden />
        </button>
      )}
      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        loading={deleting}
        variant="destructive"
        title="Delete these notes?"
        description="Teammates will no longer see them. Merged notes keep whatever was already merged."
        confirmText="Delete"
      />
    </article>
  )
}
