import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuthProfileReady, usePresenceRoom, useQuery } from 'deepspace'
import { Check, Copy, LogOut, MoreHorizontal, NotebookPen, SearchX } from 'lucide-react'
import { MemberAvatar } from '@/components/MemberAvatar'
import { NotesTab } from '@/components/notes/NotesTab'
import {
  Button,
  ConfirmModal,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useToast,
} from '@/components/ui'
import { callAction } from '@/lib/api'
import type { Group, Member } from '@/lib/types'
import { cn } from '@/lib/utils'

const TABS = [{ id: 'notes', label: 'Notes', icon: NotebookPen }] as const
type TabId = (typeof TABS)[number]['id']

export default function GroupPage() {
  const { groupId = '' } = useParams()
  const { user } = useAuthProfileReady({ requireUser: true })
  const group = useQuery<Group>('groups', { where: { groupId } })
  const members = useQuery<Member>('team_members', { where: { teamId: groupId, status: 'active' } })
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'notes') as TabId

  if (group.status === 'loading') return <GroupSkeleton />
  const g = group.records[0]
  if (group.status === 'error' || !g) {
    return (
      <EmptyState
        className="min-h-full"
        icon={<SearchX className="h-8 w-8" aria-hidden />}
        title="Group not found"
        description="This group doesn’t exist, or you’re not a member. Ask a member for the join code."
      />
    )
  }

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col px-6 pt-8 md:px-10">
      <GroupHeader group={g.data} members={members.records.map((m) => m.data)} myId={user?.id ?? ''} />
      <Tabs
        value={tab}
        onValueChange={(v) => setParams((p) => ({ ...Object.fromEntries(p), tab: String(v) }), { replace: true })}
        className="mt-6 flex-1 gap-0"
      >
        <TabsList className="h-auto w-full justify-start gap-1 rounded-none border-b border-border bg-transparent p-0">
          {TABS.map((t) => (
            <TabsTrigger
              key={t.id}
              value={t.id}
              className="relative -mb-px h-10 flex-none rounded-none border-0 border-b-2 border-transparent px-3 data-[active]:border-primary data-[active]:bg-transparent data-[active]:shadow-none"
            >
              <t.icon aria-hidden /> {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="notes" className="py-6">
          <NotesTab groupId={groupId} myId={user?.id ?? ''} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function GroupHeader({ group, members, myId }: { group: Group; members: Member[]; myId: string }) {
  const { peers } = usePresenceRoom(`group:${group.groupId}`)
  const online = useMemo(() => new Set([myId, ...peers.map((p) => p.userId)]), [peers, myId])
  const sorted = useMemo(
    () => [...members].sort((a, b) => Number(online.has(b.userId)) - Number(online.has(a.userId))),
    [members, online],
  )
  const hereNow = members.filter((m) => online.has(m.userId)).length

  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold tracking-tight md:text-3xl">{group.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {members.length} {members.length === 1 ? 'member' : 'members'}
          <span aria-hidden> · </span>
          <span className="text-brand-ink">{hereNow} here now</span>
        </p>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex -space-x-2" aria-label="Members">
          {sorted.slice(0, 6).map((m) => (
            <MemberAvatar
              key={m.userId}
              userId={m.userId}
              name={m.userId === myId ? `${m.displayName ?? 'You'} (you)` : m.displayName}
              imageUrl={m.imageUrl}
              online={online.has(m.userId)}
            />
          ))}
          {sorted.length > 6 && (
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[11px] font-medium ring-2 ring-background">
              +{sorted.length - 6}
            </span>
          )}
        </div>
        <JoinCodeChip code={group.joinCode} />
        <GroupMenu group={group} isOwner={group.ownerId === myId} />
      </div>
    </header>
  )
}

function JoinCodeChip({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const toast = useToast()
  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      toast.info('Join code', code)
    }
  }
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={copy}
            data-testid="join-code"
            aria-label={`Copy join code ${code}`}
            className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-card pl-2.5 pr-2 font-mono text-sm tracking-[0.18em] transition-colors hover:border-ring"
          >
            {code}
            {copied ? (
              <Check className="h-3.5 w-3.5 text-brand-ink" aria-hidden />
            ) : (
              <Copy className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            )}
          </button>
        }
      />
      <TooltipContent>{copied ? 'Copied' : 'Copy join code'}</TooltipContent>
    </Tooltip>
  )
}

function GroupMenu({ group, isOwner }: { group: Group; isOwner: boolean }) {
  const [confirm, setConfirm] = useState(false)
  const [pending, setPending] = useState(false)
  const navigate = useNavigate()
  const toast = useToast()
  if (isOwner) return null

  async function leave() {
    setPending(true)
    const r = await callAction('leaveGroup', { groupId: group.groupId })
    setPending(false)
    if (!r.success) return toast.error('Couldn’t leave group', r.error)
    setConfirm(false)
    toast.success(`Left ${group.name}`)
    navigate('/home')
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Group options">
              <MoreHorizontal aria-hidden />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setConfirm(true)}>
            <LogOut aria-hidden /> Leave group
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmModal
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={leave}
        loading={pending}
        variant="destructive"
        title={`Leave ${group.name}?`}
        description="You’ll lose access to its notes. You can rejoin later with the code."
        confirmText="Leave group"
      />
    </>
  )
}

function GroupSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-6 pt-8 md:px-10" aria-busy="true">
      <div className="h-8 w-64 animate-pulse rounded-md bg-muted" />
      <div className="mt-2 h-4 w-40 animate-pulse rounded bg-muted" />
      <div className={cn('mt-8 h-10 w-full border-b border-border')} />
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  )
}
