/** Join codes: 6 chars, uppercase, no ambiguous characters (0/O/1/I). */

export const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const JOIN_CODE_LENGTH = 6

const CODE_RE = new RegExp(`^[${JOIN_CODE_ALPHABET}]{${JOIN_CODE_LENGTH}}$`)

/** Uses crypto randomness; `rand` is injectable for tests. */
export function generateJoinCode(
  rand: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n)),
): string {
  const bytes = rand(JOIN_CODE_LENGTH)
  let out = ''
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
    // 256 % 32 === 0, so modulo introduces no bias.
    out += JOIN_CODE_ALPHABET[bytes[i] % JOIN_CODE_ALPHABET.length]
  }
  return out
}

/** Accepts user input like " ab-cd 23 " → "ABCD23"; returns null if invalid. */
export function normalizeJoinCode(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const cleaned = input.toUpperCase().replace(/[\s-]/g, '')
  return CODE_RE.test(cleaned) ? cleaned : null
}
