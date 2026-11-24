import { describe, expect, it } from 'vitest'
import { generateJoinCode, JOIN_CODE_ALPHABET, normalizeJoinCode } from './joinCode'

describe('generateJoinCode', () => {
  it('produces 6 unambiguous uppercase characters', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateJoinCode()
      expect(code).toMatch(/^[A-Z2-9]{6}$/)
      expect(code).not.toMatch(/[01OI]/)
    }
  })

  it('maps bytes through the alphabet', () => {
    const code = generateJoinCode(() => new Uint8Array([0, 1, 31, 32, 255, 64]))
    expect(code).toBe(
      [0, 1, 31, 0, 31, 0].map((i) => JOIN_CODE_ALPHABET[i]).join(''),
    )
  })
})

describe('normalizeJoinCode', () => {
  it('uppercases and strips spaces and dashes', () => {
    expect(normalizeJoinCode(' ab-cd 23 ')).toBe('ABCD23')
  })

  it('rejects ambiguous characters, wrong length, and non-strings', () => {
    expect(normalizeJoinCode('ABCD0O')).toBeNull()
    expect(normalizeJoinCode('ABC')).toBeNull()
    expect(normalizeJoinCode('ABCDEFG')).toBeNull()
    expect(normalizeJoinCode(123456)).toBeNull()
    expect(normalizeJoinCode(undefined)).toBeNull()
  })
})
