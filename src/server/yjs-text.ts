/**
 * Server-side access to record-bound Yjs text (the live merged notes).
 *
 * The actions `tools` API has no Yjs methods, so this calls the record room's
 * built-in `yjs.getText` / `yjs.setText` tools directly — the same
 * `/api/tools/execute` channel action-routes.ts uses. The room checks the
 * caller's read/update permission on the record (members only), and
 * `setText` broadcasts the change to every connected editor.
 */

import type { Env } from '../../worker'

async function exec<T>(env: Env, userId: string, tool: string, params: Record<string, unknown>): Promise<T> {
  const stub = env.RECORD_ROOMS.get(env.RECORD_ROOMS.idFromName(`app:${env.DEEPSPACE_APP_ID}`))
  const res = await stub.fetch(
    new Request('https://internal/api/tools/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': userId, 'X-App-Action': 'true' },
      body: JSON.stringify({ tool, params }),
    }),
  )
  const json = (await res.json()) as { success: boolean; data?: T; error?: string }
  if (!json.success) throw new Error(json.error ?? `${tool} failed`)
  return json.data as T
}

export const MERGED_FIELD = 'mergedNotes'

export async function getMergedText(env: Env, userId: string, groupId: string): Promise<string> {
  const data = await exec<{ text: string }>(env, userId, 'yjs.getText', {
    collection: 'groups',
    recordId: groupId,
    fieldName: MERGED_FIELD,
  })
  return data.text ?? ''
}

export async function setMergedText(env: Env, userId: string, groupId: string, text: string): Promise<void> {
  await exec(env, userId, 'yjs.setText', {
    collection: 'groups',
    recordId: groupId,
    fieldName: MERGED_FIELD,
    text,
  })
}
