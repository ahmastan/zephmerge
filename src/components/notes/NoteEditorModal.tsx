import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Upload } from 'lucide-react'
import { LIMITS } from '@/config'
import { callAction } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button, Input, Label, Modal, Textarea, useToast } from '../ui'

interface Props {
  open: boolean
  onClose: () => void
  groupId: string
  lectures: string[]
  /** When set, edits this note instead of creating one. */
  editing?: { noteId: string; lectureLabel: string; body: string } | null
}

const ACCEPT = '.md,.markdown,.txt,text/plain,text/markdown'

export function NoteEditorModal({ open, onClose, groupId, lectures, editing }: Props) {
  const [lecture, setLecture] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  useEffect(() => {
    if (!open) return
    setLecture(editing?.lectureLabel ?? lectures[0] ?? '')
    setBody(editing?.body ?? '')
    setError(null)
  }, [open, editing, lectures])

  async function readFile(file: File) {
    if (!/\.(md|markdown|txt)$/i.test(file.name) && !file.type.startsWith('text/')) {
      return setError('Upload a .md or .txt file')
    }
    if (file.size > LIMITS.noteBodyMax * 4) return setError('That file is too large')
    const text = await file.text()
    if (text.length > LIMITS.noteBodyMax) {
      return setError(`Notes are limited to ${LIMITS.noteBodyMax.toLocaleString()} characters`)
    }
    setError(null)
    setBody(text)
    if (!lecture.trim()) setLecture(file.name.replace(/\.(md|markdown|txt)$/i, '').slice(0, LIMITS.lectureLabelMax))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const r = editing
      ? await callAction('updateNote', { noteId: editing.noteId, lectureLabel: lecture, body })
      : await callAction('addNote', { groupId, lectureLabel: lecture, body })
    setPending(false)
    if (!r.success) return setError(r.error)
    toast.success(editing ? 'Notes updated' : 'Notes added')
    onClose()
  }

  const over = body.length > LIMITS.noteBodyMax

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <Modal.Header>
          <Modal.Title>{editing ? 'Edit your notes' : 'Add your notes'}</Modal.Title>
          <Modal.Description>Paste text or drop a .md / .txt file. Markdown is supported.</Modal.Description>
        </Modal.Header>
        <Modal.Body className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lecture">Lecture</Label>
            <Input
              id="lecture"
              value={lecture}
              maxLength={LIMITS.lectureLabelMax}
              placeholder="Lecture 7: The chain rule"
              onChange={(e) => setLecture(e.target.value)}
            />
            {lectures.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {lectures.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLecture(l)}
                    className={cn(
                      'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                      l === lecture
                        ? 'border-transparent bg-brand-soft text-brand-soft-foreground'
                        : 'border-border text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div
            className={cn('space-y-2 rounded-lg', dragging && 'ring-2 ring-ring ring-offset-2 ring-offset-background')}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              const f = e.dataTransfer.files?.[0]
              if (f) void readFile(f)
            }}
          >
            <div className="flex items-center justify-between">
              <Label htmlFor="body">Notes</Label>
              <Button type="button" variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload aria-hidden /> Upload file
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void readFile(f)
                  e.target.value = ''
                }}
              />
            </div>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={'# Derivatives\n- The derivative measures instantaneous rate of change…'}
              className="min-h-[280px] font-mono text-[13px] leading-relaxed"
            />
            <p className={cn('text-right text-xs tabular-nums', over ? 'text-danger-ink' : 'text-muted-foreground')}>
              {body.length.toLocaleString()} / {LIMITS.noteBodyMax.toLocaleString()}
            </p>
          </div>
          {error && <p role="alert" className="text-sm text-danger-ink">{error}</p>}
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={pending} disabled={!lecture.trim() || !body.trim() || over}>
            {editing ? 'Save changes' : 'Add notes'}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
