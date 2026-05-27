import { NextRequest, NextResponse } from 'next/server'
import { getRenewalAlertByToken, unsubscribeAlert } from '@/lib/db/renewal-alerts'

/**
 * GET /api/unsubscribe?token=XXX
 *
 * One-click unsubscribe handler — included in every renewal reminder email to
 * comply with CAN-SPAM. The token is the unsubscribe_token UUID generated at
 * renewal_alert insert time.
 *
 * Redirect targets:
 *   /unsubscribe/success  — alert found and successfully marked unsubscribed
 *   /unsubscribe/error    — token missing, malformed, or DB error
 *
 * Note: already-unsubscribed alerts redirect to /unsubscribe/success as well
 * (idempotent UX — the user's intent is already satisfied).
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')

  // Missing or obviously invalid token
  if (!token || token.trim() === '') {
    return NextResponse.redirect(new URL('/unsubscribe/error', req.url))
  }

  try {
    const alert = await getRenewalAlertByToken(token)

    if (!alert) {
      // Token not found — could be expired, tampered, or never existed
      return NextResponse.redirect(new URL('/unsubscribe/error', req.url))
    }

    // Idempotent: already unsubscribed or bounced → success (user's intent satisfied)
    if (alert.status === 'unsubscribed' || alert.status === 'bounced') {
      return NextResponse.redirect(new URL('/unsubscribe/success', req.url))
    }

    await unsubscribeAlert(alert.id)

    return NextResponse.redirect(new URL('/unsubscribe/success', req.url))
  } catch (err) {
    // DB error — log server-side but redirect to a friendly error page
    console.error('[/api/unsubscribe] Unexpected error:', err)
    return NextResponse.redirect(new URL('/unsubscribe/error', req.url))
  }
}
