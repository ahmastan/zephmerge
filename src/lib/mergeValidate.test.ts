import { describe, expect, it } from 'vitest'
import { extractJson, MAX_SUGGESTIONS, parseMergeOutput, validateSuggestions, type InputNote } from './mergeValidate'
import { applyPatch, countOccurrences, quoteAppearsIn } from './textMatch'

const notes: InputNote[] = [
  { noteId: 'n1', authorId: 'u1', authorName: 'Alex', body: '- d/dx f(g(x)) = f(g(x))·g\'(x)\n- d/dx cos x = -sin x' },
  { noteId: 'n2', authorId: 'u2', authorName: 'Sam', body: "chain rule = f'(g(x))·g'(x)\n- d/dx cos x = sin x" },
]

const merged = "## Chain rule\nd/dx f(g(x)) = f(g(x))·g'(x)\n\n## Trig\nd/dx cos x = -sin x\n"

function out(suggestions: unknown[], mergedMarkdown = merged) {
  return JSON.stringify({ mergedMarkdown, suggestions })
}

const good = {
  kind: 'conflict',
  originalText: "f(g(x))·g'(x)",
  suggestedText: "f'(g(x))·g'(x)",
  explanation: 'Alex omits the derivative of the outer function; Sam has it.',
  sources: [
    { noteId: 'n1', quote: "d/dx f(g(x)) = f(g(x))·g'(x)" },
    { noteId: 'n2', quote: "chain rule = f'(g(x))·g'(x)" },
  ],
}

describe('parseMergeOutput', () => {
  it('accepts fenced JSON with surrounding prose', () => {
    const r = parseMergeOutput('Here you go:\n```json\n' + out([good]) + '\n```\nDone.')
    expect(r.ok).toBe(true)
  })

  it('rejects malformed JSON', () => {
    const r = parseMergeOutput('{"mergedMarkdown": "x", "suggestions": [}')
    expect(r).toMatchObject({ ok: false })
    if (!r.ok) expect(r.error).toMatch(/Invalid JSON/)
  })

  it('rejects schema mismatches with a path', () => {
    const r = parseMergeOutput(out([{ ...good, kind: 'typo' }]))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/suggestions\.0\.kind/)
  })

  it('throws a clear error when there is no JSON at all', () => {
    expect(() => extractJson('I cannot help with that.')).toThrow(/No JSON/)
  })
})

describe('validateSuggestions', () => {
  function run(suggestions: unknown[], mergedMarkdown = merged) {
    const parsed = parseMergeOutput(out(suggestions, mergedMarkdown))
    if (!parsed.ok) throw new Error(parsed.error)
    return validateSuggestions(parsed.value, notes)
  }

  it('keeps a suggestion with real quotes and attaches author names', () => {
    const { suggestions, stats } = run([good])
    expect(stats.kept).toBe(1)
    expect(suggestions[0].sources.map((s) => s.authorName)).toEqual(['Alex', 'Sam'])
  })

  it('drops fake quotes, and the suggestion when no source survives', () => {
    const fake = { ...good, sources: [{ noteId: 'n1', quote: 'the chain rule is optional' }] }
    const { suggestions, stats } = run([fake])
    expect(suggestions).toHaveLength(0)
    expect(stats.droppedNoValidSource).toBe(1)
    expect(stats.droppedSources).toBe(1)
  })

  it('drops individual fake sources but keeps the suggestion when one is real', () => {
    const mixed = { ...good, sources: [good.sources[0], { noteId: 'n2', quote: 'invented line' }] }
    const { suggestions, stats } = run([mixed])
    expect(suggestions[0].sources).toHaveLength(1)
    expect(stats.droppedSources).toBe(1)
  })

  it('drops sources pointing at unknown notes', () => {
    const { stats } = run([{ ...good, sources: [{ noteId: 'nope', quote: 'd/dx cos x' }] }])
    expect(stats.droppedNoValidSource).toBe(1)
  })

  it('drops non-unique originalText', () => {
    const twice = merged + "\nRecap: f(g(x))·g'(x)\n"
    const { stats } = run([good], twice)
    expect(stats.droppedNotUnique).toBe(1)
  })

  it('drops originalText missing from the merged text', () => {
    const { stats } = run([{ ...good, originalText: 'not in the doc' }])
    expect(stats.droppedNotUnique).toBe(1)
  })

  it('drops no-op suggestions and duplicates', () => {
    const noop = { ...good, suggestedText: good.originalText }
    const { stats } = run([noop, good, good])
    expect(stats.droppedNoop).toBe(1)
    expect(stats.kept).toBe(1)
    expect(stats.droppedNotUnique).toBe(1)
  })

  it('matches quotes across whitespace and unicode punctuation differences', () => {
    expect(quoteAppearsIn("d/dx cos x =  -sin x", 'd/dx cos x = −sin x')).toBe(true)
    expect(quoteAppearsIn('abc', 'ab')).toBe(false) // too short to count as evidence
  })

  it(`caps at ${MAX_SUGGESTIONS}`, () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line ${i} cos`).join('\n')
    const many = Array.from({ length: 20 }, (_, i) => ({
      ...good,
      originalText: `line ${i} cos`,
      suggestedText: `line ${i} -sin`,
      sources: [{ noteId: 'n2', quote: 'd/dx cos x = sin x' }],
    }))
    const { suggestions, stats } = run(many, lines)
    expect(suggestions).toHaveLength(MAX_SUGGESTIONS)
    expect(stats.capped).toBe(5)
  })
})

describe('applyPatch', () => {
  it('replaces an exactly-once substring', () => {
    expect(applyPatch('a X b', 'X', 'Y')).toEqual({ ok: true, text: 'a Y b' })
  })
  it('is stale when missing or repeated', () => {
    expect(applyPatch('a b', 'X', 'Y')).toEqual({ ok: false, reason: 'stale' })
    expect(applyPatch('X X', 'X', 'Y')).toEqual({ ok: false, reason: 'stale' })
    expect(applyPatch('X', '', 'Y')).toEqual({ ok: false, reason: 'stale' })
  })
  it('counts non-overlapping occurrences', () => {
    expect(countOccurrences('aaaa', 'aa')).toBe(2)
  })
})
