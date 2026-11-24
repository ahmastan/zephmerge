import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { LIMITS } from '../config'
import { useAction } from '../lib/api'
import { bumpMembership } from '../lib/membership'
import { CodeInput } from './CodeInput'
import { Button, Input, Label, Modal, useToast } from './ui'

export function CreateGroupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { run, pending } = useAction<{ groupId: string; joinCode: string }>('createGroup')
  const navigate = useNavigate()
  const toast = useToast()

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const r = await run({ name })
    if (!r.success) return setError(r.error)
    bumpMembership()
    toast.success('Group created', `Share code ${r.data.joinCode} with your classmates.`)
    setName('')
    onClose()
    navigate(`/groups/${r.data.groupId}`)
  }

  return (
    <Modal open={open} onClose={onClose} size="sm">
      <form onSubmit={submit}>
        <Modal.Header>
          <Modal.Title>New study group</Modal.Title>
          <Modal.Description>You’ll get a 6-character code to invite classmates.</Modal.Description>
        </Modal.Header>
        <Modal.Body className="space-y-2">
          <Label htmlFor="group-name">Group name</Label>
          <Input
            id="group-name"
            autoFocus
            value={name}
            maxLength={LIMITS.groupNameMax}
            placeholder="e.g. MATH 18.01 — Section B"
            onChange={(e) => setName(e.target.value)}
            aria-invalid={!!error || undefined}
          />
          {error && <p role="alert" className="text-sm text-danger-ink">{error}</p>}
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={pending} disabled={!name.trim()}>
            Create group
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}

export function JoinGroupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [errorKey, setErrorKey] = useState(0)
  const joinBtnRef = useRef<HTMLButtonElement>(null)
  const { run, pending } = useAction<{ groupId: string; alreadyMember: boolean }>('joinGroup')
  const navigate = useNavigate()
  const toast = useToast()

  function close() {
    setCode('')
    setError(null)
    onClose()
  }

  async function join(value: string) {
    if (pending || value.length !== 6) return
    setError(null)
    const r = await run({ code: value })
    if (!r.success) {
      setError(r.error)
      setErrorKey((k) => k + 1)
      setCode('') // shake, then start fresh from the first box
      return
    }
    bumpMembership()
    toast.success(r.data.alreadyMember ? 'You’re already in this group' : 'Joined group')
    close()
    navigate(`/groups/${r.data.groupId}`)
  }

  return (
    <Modal open={open} onClose={close} size="sm">
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
          void join(code)
        }}
      >
        <Modal.Header>
          <Modal.Title>Join with a code</Modal.Title>
          <Modal.Description>Ask a group member for their 6-character code.</Modal.Description>
        </Modal.Header>
        <Modal.Body className="space-y-3 py-2">
          <CodeInput
            id="join-code"
            autoFocus
            value={code}
            onChange={(v) => {
              setCode(v)
              if (error) setError(null)
            }}
            onComplete={() => requestAnimationFrame(() => joinBtnRef.current?.focus())}
            errorKey={errorKey}
            invalid={!!error}
            disabled={pending}
          />
          <p
            role={error ? 'alert' : undefined}
            className={error ? 'text-center text-sm text-danger-ink' : 'text-center text-xs text-muted-foreground'}
          >
            {error ?? 'Letters and digits only. Paste works too. Press Enter to join.'}
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button ref={joinBtnRef} type="submit" loading={pending} disabled={code.length !== 6}>
            Join group
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
