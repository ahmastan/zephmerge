/**
 * Core path, part 2 (real AI): demo notes → merge → suggestions quote real
 * notes → accept/reject → live merged text for both members → flashcards.
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import { action, cleanupTestGroups } from './helpers/actions'
import { DEMO_NOTES } from '../src/demo/demoNotes'

test.skip(loadAllTestAccounts().length < 3, 'Needs 3 usable test accounts')


const norm = (s: string) => s.replace(/[−–—]/g, '-').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim()

test('merge → review suggestions → live text → flashcards', async ({ users }) => {
  test.setTimeout(300_000)
  // Bob drives the AI steps here; quiz.spec also uses Bob for two calls. Each
  // account has a 25/day AI cap, so heavy local re-runs can exhaust it.
  const [b, a, c] = await users(3)
  await Promise.all([cleanupTestGroups(a.page), cleanupTestGroups(b.page), cleanupTestGroups(c.page)])
  const stamp = `__test-${Date.now()}__`

  await Promise.all([a.page.goto('/home'), b.page.goto('/home'), c.page.goto('/home')])
  const created = await action<{ groupId: string; joinCode: string }>(a.page, 'createGroup', { name: `${stamp} Merge` })
  expect(created.success).toBe(true)
  if (!created.success) return
  const { groupId, joinCode } = created.data
  const joined = await action(b.page, 'joinGroup', { code: joinCode })
  expect(joined).toMatchObject({ success: true })

  // Seed demo notes from the UI empty state.
  await a.page.goto(`/groups/${groupId}`)
  await a.page.getByRole('button', { name: 'Try with demo notes' }).click()
  await expect(a.page.getByTestId('note-card')).toHaveCount(3, { timeout: 20_000 })
  await expect(a.page.getByText('Sample').first()).toBeVisible()

  // Merge.
  await a.page.getByRole('tab', { name: 'Merged' }).click()
  await a.page.getByRole('button', { name: 'Merge notes' }).click()
  await expect(a.page.getByTestId('merge-progress')).toBeVisible()
  await expect(a.page.getByTestId('merged-doc')).toBeVisible({ timeout: 180_000 })
  const cards = a.page.getByTestId('suggestion-card')
  await expect(cards.first()).toBeVisible({ timeout: 20_000 })
  const count = await cards.count()
  console.log(`[merge.spec] suggestions shown: ${count}`)
  expect(count).toBeGreaterThan(0)

  // Every displayed quote must exist in some demo note (the validator's promise).
  const quotes = await a.page.locator('[data-testid="suggestion-card"] blockquote .font-mono').allInnerTexts()
  const bodies = DEMO_NOTES.map((n) => norm(n.body))
  for (const q of quotes) expect(bodies.some((b) => b.includes(norm(q)))).toBe(true)
  console.log(`[merge.spec] quotes verified: ${quotes.length}`)
  for (const t of await cards.allInnerTexts()) console.log(`[merge.spec] SUGGESTION: ${t.replace(/\s+/g, ' ').slice(0, 260)}`)

  // B opens the merged tab and sees the same text.
  await b.page.goto(`/groups/${groupId}?tab=merged`)
  await expect(b.page.getByTestId('merged-doc')).toBeVisible({ timeout: 30_000 })

  // A accepts the first suggestion; B's view updates live with the replacement.
  const firstSuggested = (await cards.first().locator('.bg-brand-soft').innerText()).trim()
  await cards.first().getByRole('button', { name: 'Accept' }).click()
  await expect(a.page.getByRole('button', { name: /resolved 1/i })).toBeVisible({ timeout: 20_000 })
  if (firstSuggested && firstSuggested !== '(remove)') {
    await expect(b.page.getByTestId('merged-doc')).toContainText(norm(firstSuggested).slice(0, 25), { timeout: 20_000 })
  }

  // B rejects the next open one (if any).
  const bOpen = b.page.getByTestId('suggestion-card')
  if ((await bOpen.count()) > 0) {
    await bOpen.first().getByRole('button', { name: 'Reject' }).click()
    await expect(b.page.getByRole('button', { name: /resolved 2/i })).toBeVisible({ timeout: 20_000 })
  }

  // Live editing: B types, A sees it.
  await b.page.getByRole('tab', { name: 'Edit' }).click()
  const editor = b.page.getByTestId('merged-editor')
  await expect.poll(() => editor.isDisabled(), { timeout: 30_000, intervals: [500] }).toBe(false)
  await editor.evaluate((el: HTMLTextAreaElement) => {
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  })
  const marker = `live edit ${Date.now()} from B`
  await editor.pressSequentially(`\n\n${marker}`)
  await expect(a.page.getByTestId('merged-doc')).toContainText(marker, { timeout: 20_000 })

  // Outsider C cannot decide suggestions or read the group.
  const cTry = await action(c.page, 'mergeNotes', { groupId })
  expect(cTry).toMatchObject({ success: false })

  // Flashcards.
  await a.page.getByRole('tab', { name: 'Cards' }).click()
  await a.page.getByRole('button', { name: 'Make flashcards' }).click()
  await expect(a.page.getByTestId('cards-count')).toBeVisible({ timeout: 120_000 })
  console.log(`[merge.spec] ${await a.page.getByTestId('cards-count').innerText()}`)
  await a.page.getByRole('button', { name: /Study now/ }).click()
  const card = a.page.getByTestId('study-card')
  await expect(card).toBeVisible()
  for (const answer of ['got-it', 'missed-it'] as const) {
    // Wait for the next card to settle (flips are ignored mid-transition).
    await expect(card).toHaveAttribute('aria-pressed', 'false', { timeout: 10_000 })
    await expect(card).toHaveAttribute('aria-label', /^Question:/)
    await a.page.waitForTimeout(400)
    await a.page.keyboard.press('Space')
    await expect(card).toHaveAttribute('aria-pressed', 'true', { timeout: 5_000 })
    await a.page.getByTestId(answer).click({ timeout: 10_000 })
  }
  await expect(card).toHaveAttribute('aria-label', /^Question:/, { timeout: 10_000 })
  await expect(a.page.getByText(/^3 of \d+$/)).toBeVisible()
})
