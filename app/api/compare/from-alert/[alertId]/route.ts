import { NextRequest, NextResponse } from 'next/server'
import { getRenewalAlertById } from '@/lib/db/renewal-alerts'

/**
 * GET /api/compare/from-alert/[alertId]
 *
 * Landing route for the "Compare now" link in renewal reminder emails.
 * Looks up the alert to recover the user's TDU territory and monthly kWh,
 * then redirects to /compare with those values pre-populated as query params.
 *
 * The `from_alert` param is preserved for future analytics (track which email
 * campaign drove a compare session).
 *
 * TODO (future sprint): The /compare page does not currently consume `tdu` or
 * `kwh` query params to pre-fill the usage form. Wire that up so users who
 * click from a reminder email land directly on ranked results rather than the
 * blank form.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ alertId: string }> }
) {
  const { alertId } = await params

  try {
    const alert = await getRenewalAlertById(alertId)

    if (!alert) {
      // Alert not found — redirect to compare without pre-fill rather than
      // showing an error page (the user still wants to compare plans)
      console.warn(`[from-alert] No renewal_alert found for id=${alertId}`)
      return NextResponse.redirect(new URL('/compare', req.url))
    }

    // Build the pre-fill URL. The compare page will ignore unknown params today
    // but they're there and ready once the pre-fill feature is built.
    const compareUrl = new URL('/compare', req.url)
    compareUrl.searchParams.set('tdu', alert.tdu_territory)
    compareUrl.searchParams.set('kwh', String(alert.monthly_kwh))
    compareUrl.searchParams.set('from_alert', alertId)

    return NextResponse.redirect(compareUrl, { status: 302 })
  } catch (err) {
    console.error(`[from-alert] Unexpected error for alertId=${alertId}:`, err)
    // Fallback to compare rather than surfacing a 500 to the user
    return NextResponse.redirect(new URL('/compare', req.url))
  }
}
