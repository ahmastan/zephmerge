/**
 * Core path, part 1: groups, join codes, team-scoped notes.
 *
 * A creates a group, B joins by code, B sees A's note live, and C (not a
 * member) can neither read the group's notes nor write into it — proving the
 * permissions are enforced server-side, not just hidden in the UI.
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import { action, cleanupTestGroups } from './helpers/actions'

test.skip(loadAllTestAccounts().length < 3, 'Needs 3 usable test accounts')

/** Calls a server action as the page's signed-in user. */

test('create → join by code → live notes → outsider locked out', async ({ users }) => {
  test.setTimeout(120_000)
  const [a, b, c] = await users(3)
  await Promise.all([cleanupTestGroups(a.page), cleanupTestGroups(b.page), cleanupTestGroups(c.page)])
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
  // Typing a bad code into the 6 boxes auto-submits and shakes with an error.
  await b.page.getByLabel('Character 1 of 6').pressSequentially('ZZZZZ2')
  await expect(b.page.getByRole('alert')).toContainText('No group uses that code', { timeout: 15_000 })
  await expect(b.page.getByRole('group', { name: 'Join code' })).toHaveClass(/code-shake/)
  await b.page.getByLabel('Character 1 of 6').pressSequentially(code.toLowerCase())
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

  // B leaves through the UI: the group drops out of B's sidebar live, and the
  // group page stops showing content.
  const sidebarLink = b.page.locator(`a[href="/groups/${groupId}"]`)
  await expect(sidebarLink.first()).toBeVisible()
  await b.page.getByRole('button', { name: 'Group options' }).click()
  await b.page.getByRole('menuitem', { name: 'Leave group' }).click()
  await b.page.getByRole('button', { name: 'Leave group' }).click()
  await expect(b.page).toHaveURL(/\/home$/, { timeout: 20_000 })
  await expect(sidebarLink).toHaveCount(0, { timeout: 20_000 })
  await b.page.goto(`/groups/${groupId}`)
  await expect(b.page.getByRole('heading', { name: 'Group not found' })).toBeVisible({ timeout: 20_000 })
  const afterLeave = await action(b.page, 'addNote', { groupId, lectureLabel: 'x', body: 'nope' })
  expect(afterLeave).toMatchObject({ success: false })

  // B rejoins with the same code (membership is reactivated, not duplicated).
  // (Back-to-back runs can trip the 5-per-minute join limit; that refusal is
  // itself the rate limiter working, so accept it explicitly.)
  const rejoin = await action<{ alreadyMember: boolean }>(b.page, 'joinGroup', { code })
  if (!rejoin.success) expect(rejoin.error).toMatch(/Too many join attempts/)
  else expect(rejoin.data.alreadyMember).toBe(false)
})
