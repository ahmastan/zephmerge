import { cn } from '@/lib/utils'

/** Wordmark: two strokes merging into one, with the aquamarine join. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn('h-6 w-6', className)}>
      <rect width="24" height="24" rx="6" className="fill-foreground" />
      <path
        d="M6 7.5h7.5M6 12h5M6 16.5h7.5"
        className="stroke-background"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M13.5 7.5c2.5 0 4.5 2 4.5 4.5s-2 4.5-4.5 4.5"
        className="stroke-primary"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-tight text-foreground">Zephmerge</span>
    </span>
  )
}
