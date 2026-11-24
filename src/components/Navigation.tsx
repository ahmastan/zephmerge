/**
 * App shell — Linear-style left sidebar (groups, create/join, account,
 * theme) with a collapsible drawer on mobile.
 *
 * Keeps the scaffold's test ids (`app-navigation`, `nav-sign-in-button`,
 * `nav-user-name`, `nav-user-email`) — the shipped tests rely on them.
 */

import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AuthOverlay, signOut, useAuthProfileReady, useQuery } from 'deepspace'
import { ChevronsUpDown, Hash, LogIn, LogOut, Menu, Plus, Settings, X } from 'lucide-react'
import { cn } from '../lib/utils'
import type { Group } from '../lib/types'
import { CreateGroupModal, JoinGroupModal } from './GroupDialogs'
import { Logo } from './Logo'
import { MemberAvatar } from './MemberAvatar'
import { ThemeToggle } from './ThemeToggle'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui'

export function AppShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()
  useEffect(() => setDrawerOpen(false), [location.pathname])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-sidebar md:flex md:flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-border bg-sidebar shadow-xl animate-in slide-in-from-left-2">
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center gap-2 border-b border-border px-3 md:hidden">
          <button
            aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((v) => !v)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {drawerOpen ? <X className="h-4 w-4" aria-hidden /> : <Menu className="h-4 w-4" aria-hidden />}
          </button>
          <Link to="/home">
            <Logo />
          </Link>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}

function SidebarContent() {
  const { isLoaded, isSignedIn, user, userLoading } = useAuthProfileReady({ requireUser: true })
  const [showAuth, setShowAuth] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)
  const profileReady = !isSignedIn || (!userLoading && !!user)

  return (
    <nav data-testid="app-navigation" aria-label="Main" className="flex h-full flex-col">
      <div className="flex h-14 items-center px-4">
        <Link to="/home" className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Logo />
        </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {isSignedIn && (
          <>
            <div className="mb-3 flex gap-1.5 px-2">
              <Button size="sm" className="flex-1" onClick={() => setCreateOpen(true)}>
                <Plus aria-hidden /> New group
              </Button>
              <Button size="sm" variant="outline" className="flex-1 bg-card" onClick={() => setJoinOpen(true)}>
                Join
              </Button>
            </div>
            <GroupList />
          </>
        )}
      </div>

      <div className="flex items-center gap-1 border-t border-border p-2">
        {!isLoaded ? (
          <div className="h-9 flex-1" />
        ) : isSignedIn && !profileReady ? (
          <div className="flex flex-1 items-center gap-2 px-2">
            <div className="h-7 w-7 animate-pulse rounded-full bg-muted" />
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          </div>
        ) : isSignedIn && user ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  aria-label="Account menu"
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
                >
                  <MemberAvatar
                    userId={user.id}
                    name={user.name || user.email}
                    imageUrl={user.imageUrl ?? undefined}
                    tooltip={false}
                  />
                  <span data-testid="nav-user-name" className="min-w-0 flex-1 truncate font-medium text-foreground">
                    {user.name || user.email}
                  </span>
                  <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              }
            />
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>
                <div className="truncate font-medium text-foreground">{user.name || 'Signed in'}</div>
                <div data-testid="nav-user-email" className="truncate text-xs font-normal text-muted-foreground">
                  {user.email}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<Link to="/settings" />}>
                <Settings aria-hidden /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => signOut()}>
                <LogOut aria-hidden /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            data-testid="nav-sign-in-button"
            size="sm"
            className="flex-1"
            onClick={() => setShowAuth(true)}
          >
            <LogIn aria-hidden /> Sign in
          </Button>
        )}
        <ThemeToggle />
      </div>

      {showAuth && <AuthOverlay onClose={() => setShowAuth(false)} />}
      <CreateGroupModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <JoinGroupModal open={joinOpen} onClose={() => setJoinOpen(false)} />
    </nav>
  )
}

function GroupList() {
  const { records, status } = useQuery<Group>('groups', { orderBy: 'createdAt', orderDir: 'asc' })
  const location = useLocation()

  return (
    <div>
      <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Your groups
      </p>
      {status === 'loading' ? (
        <div className="space-y-1 px-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-8 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : status === 'error' ? (
        <p className="px-3 py-2 text-xs text-danger-ink">Couldn’t load groups.</p>
      ) : records.length === 0 ? (
        <p className="px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          No groups yet. Create one, or join with a code from a classmate.
        </p>
      ) : (
        <ul className="space-y-0.5">
          {records.map((g) => {
            const href = `/groups/${g.recordId}`
            const active = location.pathname.startsWith(href)
            return (
              <li key={g.recordId}>
                <Link
                  to={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
                    active
                      ? 'bg-card font-medium text-foreground ring-1 ring-border'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <Hash
                    className={cn('h-3.5 w-3.5 shrink-0', active ? 'text-brand-ink' : 'text-muted-foreground')}
                    aria-hidden
                  />
                  <span className="truncate">{g.data.name}</span>
                  {active && <span aria-hidden className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default AppShell
