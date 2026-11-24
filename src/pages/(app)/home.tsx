// home pattern: data-forward — the signed-in home is the list of your study groups.
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthOverlay, useAuthProfileReady, useQuery } from 'deepspace'
import { ArrowRight, FileText, Plus, Users } from 'lucide-react'
import { CreateGroupModal, JoinGroupModal } from '../../components/GroupDialogs'
import { LogoMark } from '../../components/Logo'
import { MemberAvatar } from '../../components/MemberAvatar'
import { Button } from '../../components/ui'
import type { Group, Member, Note } from '../../lib/types'
import { timeAgo } from '../../lib/time'

export default function HomePage() {
  const { isLoaded, isSignedIn } = useAuthProfileReady({ requireUser: true })
  if (!isLoaded) return <div aria-busy="true" className="h-full" />
  return isSignedIn ? <GroupsDashboard /> : <SignedOutHome />
}

function SignedOutHome() {
  const [showAuth, setShowAuth] = useState(false)
  return (
    <div className="flex min-h-full items-center justify-center px-6 py-20">
      <div className="w-full max-w-sm text-center">
        <LogoMark className="mx-auto h-10 w-10" />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Sign in to your notebook</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your groups, merged notes, and flashcards live here.
        </p>
        <Button className="mt-6 w-full" onClick={() => setShowAuth(true)}>
          Sign in
        </Button>
        <Link to="/" className="mt-4 inline-block text-sm text-muted-foreground hover:text-foreground">
          What is Zephmerge?
        </Link>
      </div>
      {showAuth && <AuthOverlay onClose={() => setShowAuth(false)} />}
    </div>
  )
}

function GroupsDashboard() {
  const groups = useQuery<Group>('groups', { orderBy: 'createdAt', orderDir: 'desc' })
  const members = useQuery<Member>('team_members', { where: { status: 'active' } })
  const notes = useQuery<Note>('notes')
  const [createOpen, setCreateOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)

  const byGroup = useMemo(() => {
    const m = new Map<string, { members: Member[]; notes: number }>()
    for (const g of groups.records) m.set(g.recordId, { members: [], notes: 0 })
    for (const r of members.records) m.get(r.data.teamId)?.members.push(r.data)
    for (const n of notes.records) {
      const entry = m.get(n.data.groupId)
      if (entry) entry.notes += 1
    }
    return m
  }, [groups.records, members.records, notes.records])

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 md:px-10 md:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Study groups</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pool your lecture notes, merge them, and study the result together.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="bg-card" onClick={() => setJoinOpen(true)}>
            Join with code
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden /> New group
          </Button>
        </div>
      </div>

      <div className="mt-8">
        {groups.status === 'loading' ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-36 animate-pulse rounded-xl border border-border bg-card" />
            ))}
          </div>
        ) : groups.status === 'error' ? (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-danger-ink">
            Couldn’t load your groups. {groups.error}
          </div>
        ) : groups.records.length === 0 ? (
          <FirstRun onCreate={() => setCreateOpen(true)} onJoin={() => setJoinOpen(true)} />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groups.records.map((g) => {
              const info = byGroup.get(g.recordId)
              const people = info?.members ?? []
              return (
                <li key={g.recordId}>
                  <Link
                    to={`/groups/${g.recordId}`}
                    className="group flex h-full flex-col rounded-xl border border-border bg-card p-5 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-ring hover:shadow-lg"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="line-clamp-2 font-semibold leading-snug">{g.data.name}</h2>
                      <ArrowRight
                        className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand-ink"
                        aria-hidden
                      />
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-6">
                      <div className="flex -space-x-1.5">
                        {people.slice(0, 5).map((p) => (
                          <MemberAvatar key={p.userId} userId={p.userId} name={p.displayName} imageUrl={p.imageUrl} size="xs" tooltip={false} />
                        ))}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" aria-hidden /> {people.length}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <FileText className="h-3.5 w-3.5" aria-hidden /> {info?.notes ?? 0}
                        </span>
                      </div>
                    </div>
                    <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                      {g.data.lastMergedAt ? `Merged ${timeAgo(g.data.lastMergedAt)}` : 'Not merged yet'}
                    </p>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <CreateGroupModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <JoinGroupModal open={joinOpen} onClose={() => setJoinOpen(false)} />
    </div>
  )
}

function FirstRun({ onCreate, onJoin }: { onCreate: () => void; onJoin: () => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-[1.4fr_1fr]">
      <button
        onClick={onCreate}
        className="group flex flex-col items-start rounded-xl border border-border bg-card p-6 text-left transition-colors hover:border-ring"
      >
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Plus className="h-5 w-5" aria-hidden />
        </span>
        <span className="mt-4 text-lg font-semibold">Start a group</span>
        <span className="mt-1 text-sm text-muted-foreground">
          Name it after your class. You’ll get a code to send to classmates.
        </span>
      </button>
      <button
        onClick={onJoin}
        className="flex flex-col items-start rounded-xl border border-dashed border-border p-6 text-left transition-colors hover:border-ring hover:bg-card"
      >
        <span className="font-mono text-lg tracking-[0.3em] text-muted-foreground">A7K-Q2M</span>
        <span className="mt-4 text-lg font-semibold">Have a code?</span>
        <span className="mt-1 text-sm text-muted-foreground">Join a classmate’s group in one step.</span>
      </button>
    </div>
  )
}
