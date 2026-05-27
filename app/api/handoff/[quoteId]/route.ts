import { NextRequest, NextResponse } from 'next/server'
import { getQuoteWithPlan } from '@/lib/db/quotes'
import { recordHandoff } from '@/lib/db/handoffs'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> }
) {
  try {
    const { quoteId } = await params

    const quoteWithPlan = await getQuoteWithPlan(quoteId)

    if (!quoteWithPlan) {
      return NextResponse.redirect(new URL('/compare', req.url))
    }

    const { plan } = quoteWithPlan

    // Generate a short, sortable sub_id for commission reconciliation
    const subId = `${quoteId.slice(0, 8)}-${Date.now().toString(36)}`

    // Determine aggregator — Week 2: all plans go through PowerToChoose as the landing
    // Week 3+: branch on plan.source or aggregator partner ID
    const aggregator = 'powertochoose'

    // Build handoff URL — prefer enrollment_url (signup page) over efl_url (regulatory PDF)
    const baseUrl = plan.enrollment_url ?? plan.efl_url ?? `https://www.powertochoose.org`
    let handoffUrl: string
    try {
      const url = new URL(baseUrl)
      url.searchParams.set('sub_id', subId)
      url.searchParams.set('utm_source', 'electric-deals')
      url.searchParams.set('utm_medium', 'affiliate')
      url.searchParams.set('utm_campaign', 'compare')
      handoffUrl = url.toString()
    } catch {
      // If efl_url is malformed, fall back to PTC with plan external_id
      handoffUrl = `https://www.powertochoose.org/en-us/Plan/Details/${plan.external_id ?? ''}?sub_id=${subId}&utm_source=electric-deals&utm_medium=affiliate`
    }

    // Record the handoff for attribution
    await recordHandoff({
      quote_id: quoteId,
      usage_profile_id: quoteWithPlan.usage_profile_id,
      plan_id: plan.id,
      aggregator,
      handoff_url: handoffUrl,
      sub_id: subId,
      clicked_at: new Date().toISOString(),
      reconciled_status: null,
      commission_amount: null,
      reconciled_at: null,
    })

    return NextResponse.redirect(handoffUrl, { status: 302 })
  } catch (err) {
    console.error('[/api/handoff] Error:', err)
    // On error, redirect to compare rather than showing a raw 500
    return NextResponse.redirect(new URL('/compare', req.url))
  }
}
