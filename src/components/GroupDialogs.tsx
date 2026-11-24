import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { LIMITS } from '../config'
import { useAction } from '../lib/api'
import { bumpMembership } from '../lib/membership'
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
  const { run, pending } = useAction<{ groupId: string; alreadyMember: boolean }>('joinGroup')
  const navigate = useNavigate()
  const toast = useToast()

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const r = await run({ code })
    if (!r.success) return setError(r.error)
    bumpMembership()
    toast.success(r.data.alreadyMember ? 'You’re already in this group' : 'Joined group')
    setCode('')
    onClose()
    navigate(`/groups/${r.data.groupId}`)
  }

  return (
    <Modal open={open} onClose={onClose} size="sm">
      <form onSubmit={submit}>
        <Modal.Header>
          <Modal.Title>Join with a code</Modal.Title>
          <Modal.Description>Ask a group member for their 6-character code.</Modal.Description>
        </Modal.Header>
        <Modal.Body className="space-y-2">
          <Label htmlFor="join-code">Join code</Label>
          <Input
            id="join-code"
            autoFocus
            value={code}
            maxLength={9}
            autoComplete="off"
            spellCheck={false}
            placeholder="ABC234"
            className="h-12 text-center font-mono text-xl uppercase tracking-[0.4em]"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            aria-invalid={!!error || undefined}
          />
          {error && <p role="alert" className="text-sm text-danger-ink">{error}</p>}
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={pending} disabled={code.replace(/[\s-]/g, '').length !== 6}>
            Join group
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
