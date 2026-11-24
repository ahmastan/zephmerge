import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from 'react'
import { JOIN_CODE_ALPHABET, JOIN_CODE_LENGTH } from '@/lib/joinCode'
import { cn } from '@/lib/utils'

const ALLOWED = new RegExp(`[${JOIN_CODE_ALPHABET}]`)

function clean(raw: string): string {
  return raw
    .toUpperCase()
    .split('')
    .filter((c) => ALLOWED.test(c))
    .join('')
}

interface Props {
  value: string
  onChange: (value: string) => void
  /** Fires when the 6th character is entered. */
  onComplete?: (value: string) => void
  /** Bump this number to replay the shake (e.g. after a wrong code). */
  errorKey?: number
  invalid?: boolean
  disabled?: boolean
  autoFocus?: boolean
  id?: string
}

/**
 * Six-box join code entry: type, paste, or backspace across boxes. Only the
 * join-code alphabet is accepted (no 0/O/1/I). Shakes red when `errorKey`
 * changes.
 */
export function CodeInput({ value, onChange, onComplete, errorKey = 0, invalid, disabled, autoFocus, id }: Props) {
  const refs = useRef<Array<HTMLInputElement | null>>([])
  const groupRef = useRef<HTMLDivElement>(null)
  const chars = value.padEnd(JOIN_CODE_LENGTH, ' ').slice(0, JOIN_CODE_LENGTH).split('')

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus()
  }, [autoFocus])

  // Replay the shake: remove + re-add the class on a fresh frame.
  useEffect(() => {
    if (!errorKey || !groupRef.current) return
    const el = groupRef.current
    el.classList.remove('code-shake')
    void el.offsetWidth
    el.classList.add('code-shake')
    refs.current[0]?.focus()
  }, [errorKey])

  function setAt(index: number, incoming: string) {
    const typed = clean(incoming)
    if (!typed) return
    const next = (value.slice(0, index) + typed + value.slice(index + typed.length)).slice(0, JOIN_CODE_LENGTH)
    onChange(next)
    const focusIndex = Math.min(index + typed.length, JOIN_CODE_LENGTH - 1)
    refs.current[focusIndex]?.focus()
    if (next.length === JOIN_CODE_LENGTH) onComplete?.(next)
  }

  function onKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (value[index]) {
        onChange(value.slice(0, index) + value.slice(index + 1))
      } else if (index > 0) {
        onChange(value.slice(0, index - 1) + value.slice(index))
        refs.current[index - 1]?.focus()
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      refs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < JOIN_CODE_LENGTH - 1) {
      refs.current[index + 1]?.focus()
    }
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const text = clean(e.clipboardData.getData('text'))
    if (!text) return
    const next = text.slice(0, JOIN_CODE_LENGTH)
    onChange(next)
    refs.current[Math.min(next.length, JOIN_CODE_LENGTH - 1)]?.focus()
    if (next.length === JOIN_CODE_LENGTH) onComplete?.(next)
  }

  return (
    <div
      ref={groupRef}
      role="group"
      aria-label="Join code"
      onAnimationEnd={() => groupRef.current?.classList.remove('code-shake')}
      className="flex items-center justify-center gap-2"
    >
      {chars.map((c, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          id={i === 0 ? id : undefined}
          aria-label={`Character ${i + 1} of ${JOIN_CODE_LENGTH}`}
          inputMode="text"
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={JOIN_CODE_LENGTH}
          disabled={disabled}
          value={c.trim()}
          onChange={(e) => setAt(i, e.target.value.replace(c.trim(), '') || e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          onFocus={(e) => e.target.select()}
          className={cn(
            'h-14 w-11 rounded-lg border bg-card text-center font-mono text-2xl font-semibold uppercase outline-none transition-[border-color,box-shadow,transform] duration-150',
            'focus:border-ring focus:ring-[3px] focus:ring-ring/25',
            c.trim() ? 'border-transparent ring-1 ring-border' : 'border-input',
            invalid && 'border-destructive text-danger-ink ring-destructive/20 focus:border-destructive focus:ring-destructive/20',
            i === 2 && 'mr-2',
          )}
        />
      ))}
    </div>
  )
}
