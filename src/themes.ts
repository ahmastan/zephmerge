/** Theme catalog (metadata only — colours live in styles.css / themes.css). */

export const THEMES = [
  { id: 'zeph-light', label: 'Light', description: 'Graphite on off-white with aquamarine accents.' },
  { id: 'zeph-dark', label: 'Dark', description: 'Near-black with glowing aquamarine accents.' },
] as const

export type ThemeId = (typeof THEMES)[number]['id']

export function getActiveTheme(): ThemeId {
  if (typeof document === 'undefined') return 'zeph-light'
  const id = document.documentElement.getAttribute('data-theme') as ThemeId | null
  return id ?? 'zeph-light'
}

export function setActiveTheme(id: ThemeId): void {
  document.documentElement.setAttribute('data-theme', id)
  try {
    localStorage.setItem('zeph-theme', id === 'zeph-dark' ? 'dark' : 'light')
  } catch {
    /* private mode: theme just won't persist */
  }
}

export function getTheme(id: string) {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}
