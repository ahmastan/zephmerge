import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { getActiveTheme, setActiveTheme, type ThemeId } from '../themes'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui'

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeId>('zeph-light')
  useEffect(() => setTheme(getActiveTheme()), [])

  const next: ThemeId = theme === 'zeph-dark' ? 'zeph-light' : 'zeph-dark'
  const label = next === 'zeph-dark' ? 'Switch to dark mode' : 'Switch to light mode'

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            onClick={() => {
              setActiveTheme(next)
              setTheme(next)
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {theme === 'zeph-dark' ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
          </button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
