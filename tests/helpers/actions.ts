import type { Page } from '@playwright/test'

export type ActionResult<T> = { success: true; data: T } | { success: false; error: string }

/** Calls a server action as the page's signed-in user (page must be on the app origin). */
export async function action<T = unknown>(page: Page, name: string, params: Record<string, unknown>) {
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
  ) as Promise<ActionResult<T>>
}

/** Deletes (or leaves) every __test- group in the page user's sidebar. */
export async function cleanupTestGroups(page: Page) {
  await page.goto('/home')
  await page.getByTestId('app-navigation').waitFor()
  await page.waitForTimeout(1500)
  const links = page.locator('a[href^="/groups/"]', { hasText: '__test-' })
  const hrefs = [...new Set(await links.evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? '')))]
  for (const href of hrefs) {
    const groupId = href.split('/groups/')[1]
    const del = await action(page, 'deleteGroup', { groupId })
    if (!del.success) await action(page, 'leaveGroup', { groupId })
  }
}
