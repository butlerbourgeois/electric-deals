import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/webhooks/resend
 *
 * Receives lifecycle events from Resend for emails sent through the renewal
 * alert system. We act on bounce/complaint events (mark alert as bounced so
 * the cron skips it) and track open/click for analytics.
 *
 * Signature verification:
 *   Resend uses svix under the hood. For MVP we do a simple shared-secret
 *   check via the RESEND_WEBHOOK_SECRET env var. If the secret is not
 *   configured (dev/staging without a real webhook), we proceed with a
 *   console warning rather than hard-failing.
 *
 * To enable full svix HMAC verification in a future sprint, install the
 * `svix` npm package and use `new Webhook(secret).verify(rawBody, headers)`.
 */

interface ResendEvent {
  type:
    | 'email.sent'
    | 'email.delivered'
    | 'email.bounced'
    | 'email.complained'
    | 'email.opened'
    | 'email.clicked'
  data: {
    message_id: string
    [key: string]: unknown
  }
}

/** Maps Resend event types to our email_send.status values. */
const EVENT_STATUS_MAP: Partial<Record<ResendEvent['type'], string>> = {
  'email.sent':       'sent',
  'email.delivered':  'sent',     // delivered is a superset of sent — keep as sent
  'email.bounced':    'bounced',
  'email.complained': 'bounced',  // treat complaints the same as hard bounces
  'email.opened':     'opened',
  'email.clicked':    'clicked',
}

const BOUNCE_TYPES = new Set<ResendEvent['type']>(['email.bounced', 'email.complained'])

export async function POST(req: NextRequest) {
  // ── 1. Signature verification (shared-secret, MVP approach) ──────────────────
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET

  if (webhookSecret) {
    // Resend sends the signature in svix-compatible headers (svix-signature)
    // or a simpler x-resend-signature header depending on configuration.
    const signature =
      req.headers.get('svix-signature') ?? req.headers.get('x-resend-signature')

    if (!signature || !signature.includes(webhookSecret)) {
      console.warn('[webhook/resend] Signature verification failed')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  } else {
    // No secret configured — allow through but log so ops can notice in dev/staging.
    // In production, RESEND_WEBHOOK_SECRET must be set.
    console.warn(
      '[webhook/resend] RESEND_WEBHOOK_SECRET not configured — skipping signature check. ' +
      'Set this env var in production to prevent spoofed webhook calls.'
    )
  }

  // ── 2. Parse body ─────────────────────────────────────────────────────────────
  let event: ResendEvent
  try {
    event = (await req.json()) as ResendEvent
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!event.type || !event.data?.message_id) {
    return NextResponse.json({ error: 'Missing type or data.message_id' }, { status: 400 })
  }

  const newStatus = EVENT_STATUS_MAP[event.type]
  if (!newStatus) {
    // Unknown event type — acknowledge without acting (forward-compat)
    return NextResponse.json({ received: true })
  }

  // ── 3. Find the email_send row by resend_message_id ───────────────────────────
  const supabase = createAdminClient()

  const { data: emailSend, error: findError } = await supabase
    .from('email_send')
    .select('id, renewal_alert_id')
    .eq('resend_message_id', event.data.message_id)
    .single()

  if (findError || !emailSend) {
    // Could be a message we sent outside the renewal alert system (e.g. welcome
    // email from a future integration). Log and return 200 to prevent Resend retries.
    console.warn(
      `[webhook/resend] No email_send row for message_id=${event.data.message_id} ` +
      `(event: ${event.type}). Acknowledging without action.`
    )
    return NextResponse.json({ received: true })
  }

  // ── 4. Update email_send.status ───────────────────────────────────────────────
  const { error: updateSendError } = await supabase
    .from('email_send')
    .update({ status: newStatus })
    .eq('id', emailSend.id)

  if (updateSendError) {
    console.error(
      `[webhook/resend] Failed to update email_send ${emailSend.id} to status=${newStatus}:`,
      updateSendError
    )
    // Return 500 so Resend retries the webhook
    return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
  }

  // ── 5. For bounces/complaints, also mark the renewal_alert as bounced ─────────
  if (BOUNCE_TYPES.has(event.type)) {
    const { error: updateAlertError } = await supabase
      .from('renewal_alert')
      .update({ status: 'bounced' })
      .eq('id', emailSend.renewal_alert_id)

    if (updateAlertError) {
      console.error(
        `[webhook/resend] Failed to mark renewal_alert ${emailSend.renewal_alert_id} as bounced:`,
        updateAlertError
      )
      // Return 500 so Resend retries — we want this update to land
      return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
    }

    console.info(
      `[webhook/resend] Marked renewal_alert ${emailSend.renewal_alert_id} as bounced ` +
      `(event: ${event.type}, message_id: ${event.data.message_id})`
    )
  }

  return NextResponse.json({ received: true })
}
