import { useCallback, useState } from 'react'
import { getAuthToken } from 'deepspace'

export type ActionResponse<T> = { success: true; data: T } | { success: false; error: string }

/** POST /api/actions/:name with the caller's JWT. Never throws. */
export async function callAction<T = unknown>(
  name: string,
  params: Record<string, unknown> = {},
): Promise<ActionResponse<T>> {
  try {
    const token = await getAuthToken()
    if (!token) return { success: false, error: 'Please sign in again' }
    const res = await fetch(`/api/actions/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(params),
    })
    if (res.status === 401) return { success: false, error: 'Please sign in again' }
    const json = (await res.json()) as ActionResponse<T>
    if (!json || typeof json.success !== 'boolean') {
      return { success: false, error: `Unexpected response (${res.status})` }
    }
    return json
  } catch {
    return { success: false, error: 'Network error — check your connection' }
  }
}

/** Wraps callAction with a pending flag for buttons. */
export function useAction<T = unknown>(name: string) {
  const [pending, setPending] = useState(false)
  const run = useCallback(
    async (params: Record<string, unknown> = {}) => {
      setPending(true)
      try {
        return await callAction<T>(name, params)
      } finally {
        setPending(false)
      }
    },
    [name],
  )
  return { run, pending }
}
