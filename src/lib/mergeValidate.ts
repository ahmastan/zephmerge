/**
 * The "verify the AI" layer for merges. Pure and unit-tested.
 *
 * The model's output is untrusted. We keep a suggestion only if:
 *  - its `originalText` occurs exactly once in the merged markdown (so it can
 *    be patched unambiguously), and
 *  - at least one of its quoted sources really appears in that member's note.
 * Fake quotes are the most common hallucination; this drops them.
 */

import { z } from 'zod'
import { countOccurrences, quoteAppearsIn } from './textMatch'

export const MAX_SUGGESTIONS = 15

const sourceSchema = z.object({
  noteId: z.string().min(1),
  quote: z.string().min(1).max(600),
})

const suggestionSchema = z.object({
  kind: z.enum(['conflict', 'error', 'gap']),
  originalText: z.string().min(1).max(1200),
  suggestedText: z.string().max(1500),
  explanation: z.string().min(1).max(600),
  sources: z.array(sourceSchema).min(1).max(6),
})

export const mergeOutputSchema = z.object({
  mergedMarkdown: z.string().min(1).max(80_000),
  suggestions: z.array(suggestionSchema).max(40),
})

export type MergeOutput = z.infer<typeof mergeOutputSchema>

export interface InputNote {
  noteId: string
  authorId: string
  authorName: string
  body: string
}

export interface ValidSuggestion {
  kind: 'conflict' | 'error' | 'gap'
  originalText: string
  suggestedText: string
  explanation: string
  sources: Array<{ noteId: string; authorId: string; authorName: string; quote: string }>
}

export interface ValidationStats {
  proposed: number
  kept: number
  droppedNotUnique: number
  droppedNoValidSource: number
  droppedNoop: number
  droppedSources: number
  capped: number
}

/** Pulls the first JSON object out of a model reply (tolerates ```json fences and prose). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1] : text
  const obj = candidate.indexOf('{')
  const arr = candidate.indexOf('[')
  const isArray = arr !== -1 && (obj === -1 || arr < obj)
  const start = isArray ? arr : obj
  const end = candidate.lastIndexOf(isArray ? ']' : '}')
  if (start === -1 || end <= start) throw new Error('No JSON object found in model output')
  return JSON.parse(candidate.slice(start, end + 1))
}

export type ParseResult = { ok: true; value: MergeOutput } | { ok: false; error: string }

export function parseMergeOutput(text: string): ParseResult {
  let raw: unknown
  try {
    raw = extractJson(text)
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${(e as Error).message}` }
  }
  const r = mergeOutputSchema.safeParse(raw)
  if (!r.success) {
    const issue = r.error.issues[0]
    return { ok: false, error: `Schema mismatch at ${issue.path.join('.') || '(root)'}: ${issue.message}` }
  }
  return { ok: true, value: r.data }
}

export function validateSuggestions(
  output: MergeOutput,
  notes: InputNote[],
): { suggestions: ValidSuggestion[]; stats: ValidationStats } {
  const byId = new Map(notes.map((n) => [n.noteId, n]))
  const stats: ValidationStats = {
    proposed: output.suggestions.length,
    kept: 0,
    droppedNotUnique: 0,
    droppedNoValidSource: 0,
    droppedNoop: 0,
    droppedSources: 0,
    capped: 0,
  }
  const kept: ValidSuggestion[] = []
  const seenOriginals = new Set<string>()

  for (const s of output.suggestions) {
    if (s.originalText.trim() === s.suggestedText.trim()) {
      stats.droppedNoop++
      continue
    }
    if (countOccurrences(output.mergedMarkdown, s.originalText) !== 1 || seenOriginals.has(s.originalText)) {
      stats.droppedNotUnique++
      continue
    }
    const sources: ValidSuggestion['sources'] = []
    for (const src of s.sources) {
      const note = byId.get(src.noteId)
      if (note && quoteAppearsIn(note.body, src.quote)) {
        sources.push({ noteId: note.noteId, authorId: note.authorId, authorName: note.authorName, quote: src.quote })
      } else {
        stats.droppedSources++
      }
    }
    if (sources.length === 0) {
      stats.droppedNoValidSource++
      continue
    }
    if (kept.length >= MAX_SUGGESTIONS) {
      stats.capped++
      continue
    }
    seenOriginals.add(s.originalText)
    kept.push({
      kind: s.kind,
      originalText: s.originalText,
      suggestedText: s.suggestedText,
      explanation: s.explanation,
      sources,
    })
  }
  stats.kept = kept.length
  return { suggestions: kept, stats }
}
