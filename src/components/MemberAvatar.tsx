import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage, Tooltip, TooltipContent, TooltipTrigger } from './ui'

const MEMBER_COLORS = [
  'bg-member-1',
  'bg-member-2',
  'bg-member-3',
  'bg-member-4',
  'bg-member-5',
  'bg-member-6',
] as const

/** Stable muted colour per user id. */
export function memberColor(userId: string): string {
  let h = 0
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0
  return MEMBER_COLORS[h % MEMBER_COLORS.length]
}

export function initials(name: string | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter((w) => /^[\p{L}\p{N}]/u.test(w))
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

interface Props {
  userId: string
  name?: string
  imageUrl?: string
  size?: 'xs' | 'sm' | 'md'
  online?: boolean
  className?: string
  tooltip?: boolean
}

export function MemberAvatar({ userId, name, imageUrl, size = 'sm', online, className, tooltip = true }: Props) {
  const dims = { xs: 'h-5 w-5 text-[9px]', sm: 'h-7 w-7 text-[11px]', md: 'h-9 w-9 text-xs' }[size]
  const avatar = (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <Avatar className={cn(dims, 'ring-2 ring-background')}>
        {imageUrl && <AvatarImage src={imageUrl} referrerPolicy="no-referrer" alt="" />}
        <AvatarFallback className={cn(memberColor(userId), 'font-semibold text-white')}>
          {size === 'xs' ? initials(name)[0] : initials(name)}
        </AvatarFallback>
      </Avatar>
      {online !== undefined && (
        <span
          aria-hidden
          className={cn(
            'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-background',
            online ? 'bg-primary animate-live' : 'bg-muted-foreground',
          )}
        />
      )}
    </span>
  )
  if (!tooltip) return avatar
  return (
    <Tooltip>
      <TooltipTrigger render={avatar} />
      <TooltipContent>
        {name ?? 'Member'}
        {online !== undefined && (online ? ' · here now' : ' · away')}
      </TooltipContent>
    </Tooltip>
  )
}
