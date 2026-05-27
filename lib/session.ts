import { cookies } from 'next/headers'

const SESSION_COOKIE = 'ed_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 90 // 90 days

/**
 * Returns the current session ID from the ed_session cookie,
 * or generates and sets a new one if absent.
 * Server-side only (uses next/headers cookies()).
 */
export async function getOrCreateSessionId(): Promise<string> {
  const cookieStore = await cookies()
  const existing = cookieStore.get(SESSION_COOKIE)?.value

  if (existing) return existing

  const newId = crypto.randomUUID()
  cookieStore.set(SESSION_COOKIE, newId, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  })

  return newId
}
