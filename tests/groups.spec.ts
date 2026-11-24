/**
 * Core path, part 1: groups, join codes, team-scoped notes.
 *
 * A creates a group, B joins by code, B sees A's note live, and C (not a
 * member) can neither read the group's notes nor write into it — proving the
 * permissions are enforced server-side, not just hidden in the UI.
 */
import type { Page } from '@playwright/test'
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'

test.skip(loadAllTestAccounts().length < 3, 'Needs 3 usable test accounts')

/** Calls a server action as the page's signed-in user. */
async function action<T = unknown>(page: Page, name: string, params: Record<string, unknown>) {
  return page.evaluate(
    async ([n, p]) => {
      const t = await fetch('/api/auth/token', { method: 'POST', credentials: 'include' })
      const { token } = (await t.json()) as { token: string }
      const res = await fetch(`/api/actions/${n}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(p),
      })
      return res.json()
    },
    [name, params] as const,
  ) as Promise<{ success: true; data: T } | { success: false; error: string }>
}

test('create → join by code → live notes → outsider locked out', async ({ users }) => {
  test.setTimeout(120_000)
  const [a, b, c] = await users(3)
  const stamp = `__test-${Date.now()}__`

  // A creates a group through the UI.
  await a.page.goto('/home')
  await a.page.getByRole('button', { name: 'New group' }).first().click()
  await a.page.getByLabel('Group name').fill(`${stamp} Calc`)
  await a.page.getByRole('button', { name: 'Create group' }).click()
  await expect(a.page).toHaveURL(/\/groups\/[0-9a-f-]{36}/, { timeout: 20_000 })
  const groupId = a.page.url().split('/groups/')[1].split(/[?#]/)[0]
  const code = (await a.page.getByTestId('join-code').innerText()).trim()
  expect(code).toMatch(/^[A-Z2-9]{6}$/)

  // B: a wrong code fails, the right code joins.
  await b.page.goto('/home')
  const bad = await action(b.page, 'joinGroup', { code: 'ZZZZZ2' })
  expect(bad.success).toBe(false)
  await b.page.getByRole('button', { name: 'Join with code' }).click()
  await b.page.getByLabel('Join code').fill(code.toLowerCase())
  await b.page.getByRole('button', { name: 'Join group' }).click()
  await expect(b.page).toHaveURL(new RegExp(`/groups/${groupId}`), { timeout: 20_000 })
  await expect(b.page.getByRole('heading', { name: `${stamp} Calc` })).toBeVisible({ timeout: 20_000 })

  // A adds a note; B sees it without reloading.
  await a.page.getByRole('button', { name: 'Add your notes' }).click()
  await a.page.getByRole('textbox', { name: 'Lecture' }).fill('Lecture 1: Limits')
  await a.page.getByRole('textbox', { name: 'Notes' }).fill(`${stamp} A limit describes what f(x) approaches.`)
  await a.page.getByRole('button', { name: 'Add notes' }).click()
  await expect(b.page.getByText(`${stamp} A limit describes`)).toBeVisible({ timeout: 20_000 })

  // C is not a member: the page shows nothing and the server refuses writes.
  await c.page.goto(`/groups/${groupId}`)
  await expect(c.page.getByRole('heading', { name: 'Group not found' })).toBeVisible({ timeout: 20_000 })
  await expect(c.page.getByText(`${stamp} A limit describes`)).toHaveCount(0)
  const sneaky = await action(c.page, 'addNote', {
    groupId,
    lectureLabel: 'x',
    body: 'should be refused',
  })
  expect(sneaky).toMatchObject({ success: false })

  // B sees A's note read-only (no edit controls on someone else's note).
  await expect(b.page.getByTestId('note-card').getByRole('button', { name: 'Edit note' })).toHaveCount(0)

  const leave = await action(a.page, 'leaveGroup', { groupId })
  expect(leave).toMatchObject({ success: false }) // owner cannot leave
})
