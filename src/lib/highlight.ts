/**
 * Highlights text inside a rendered container with the CSS Custom Highlight
 * API (no DOM mutation, so React's tree is untouched). No-ops where the API
 * is unavailable.
 */

type HighlightRegistry = Map<string, unknown>
type HighlightCtor = new (...ranges: Range[]) => unknown

function registry(): { reg: HighlightRegistry; Highlight: HighlightCtor } | null {
  const css = (globalThis as { CSS?: { highlights?: HighlightRegistry } }).CSS
  const Highlight = (globalThis as { Highlight?: HighlightCtor }).Highlight
  if (!css?.highlights || !Highlight) return null
  return { reg: css.highlights, Highlight }
}

const squash = (s: string) => s.replace(/\s+/g, ' ').trim()

/** Find `needle` across text nodes (whitespace-insensitive, markdown stripped). */
export function findRange(root: HTMLElement, needle: string): Range | null {
  const target = squash(needle.replace(/[*_`#>]/g, ''))
  if (!target) return null
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  let flat = ''
  const map: Array<{ node: Text; offset: number }> = []
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n as Text
    nodes.push(t)
    for (let i = 0; i < t.data.length; i++) {
      const ch = /\s/.test(t.data[i]) ? ' ' : t.data[i]
      if (ch === ' ' && flat.endsWith(' ')) continue
      flat += ch
      map.push({ node: t, offset: i })
    }
  }
  const idx = flat.indexOf(target)
  if (idx === -1) return null
  const start = map[idx]
  const end = map[idx + target.length - 1]
  const range = document.createRange()
  range.setStart(start.node, start.offset)
  range.setEnd(end.node, end.offset + 1)
  return range
}

export function setHighlight(name: string, root: HTMLElement | null, needle: string | null): boolean {
  const r = registry()
  if (!r) return false
  if (!root || !needle) {
    r.reg.delete(name)
    return false
  }
  const range = findRange(root, needle)
  if (!range) {
    r.reg.delete(name)
    return false
  }
  r.reg.set(name, new r.Highlight(range))
  return true
}

export function scrollToText(root: HTMLElement | null, needle: string) {
  if (!root) return
  const range = findRange(root, needle)
  const el = range?.startContainer.parentElement
  el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}
