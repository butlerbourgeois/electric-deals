export interface WelcomeEmailData {
  planName: string
  providerName: string
  contractEndDate: string   // formatted as "March 2027" or "March 15, 2027"
  tduTerritory: string      // human-readable: "Oncor (Dallas area)"
  monthlyKwh: number
  unsubscribeUrl: string    // full URL to one-click unsubscribe
}

export function welcomeEmailSubject(data: WelcomeEmailData): string {
  return `You're set up for renewal reminders — ${data.planName}`
}

export function welcomeEmailText(data: WelcomeEmailData): string {
  return `
You're set up for renewal reminders.

Plan: ${data.planName}
Provider: ${data.providerName}
Service area: ${data.tduTerritory}
Contract end: ${data.contractEndDate}
Typical usage: ${data.monthlyKwh.toLocaleString()} kWh/month

We'll send you reminders 45, 30, and 15 days before your contract ends so you have plenty of time to compare plans and avoid rolling onto a higher rate.

Nothing to do right now — we'll be in touch.

---
To stop receiving reminders, unsubscribe here:
${data.unsubscribeUrl}
`.trim()
}

export function welcomeEmailHtml(data: WelcomeEmailData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${welcomeEmailSubject(data)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background-color:#1a56db;padding:28px 32px;">
              <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">Electric Deals</p>
              <p style="margin:6px 0 0;font-size:14px;color:#bfdbfe;">Texas electricity comparison</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">
                You're set up for renewal reminders
              </h1>
              <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">
                We've saved your plan details. Here's what we have on file:
              </p>

              <!-- Plan details card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#6b7280;width:40%;">Plan</td>
                        <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:600;">${escapeHtml(data.planName)}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#6b7280;">Provider</td>
                        <td style="padding:6px 0;font-size:14px;color:#111827;">${escapeHtml(data.providerName)}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#6b7280;">Service area</td>
                        <td style="padding:6px 0;font-size:14px;color:#111827;">${escapeHtml(data.tduTerritory)}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#6b7280;">Contract end</td>
                        <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:600;">${escapeHtml(data.contractEndDate)}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#6b7280;">Typical usage</td>
                        <td style="padding:6px 0;font-size:14px;color:#111827;">${data.monthlyKwh.toLocaleString()} kWh/month</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- What happens next -->
              <h2 style="margin:0 0 12px;font-size:16px;font-weight:700;color:#111827;">What to expect</h2>
              <p style="margin:0 0 12px;font-size:15px;color:#374151;">
                We'll send you reminders at three points before your contract ends:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                ${['45 days out', '30 days out', '15 days out'].map((label, i) => `
                <tr>
                  <td style="padding:6px 0;vertical-align:top;width:28px;">
                    <span style="display:inline-block;width:22px;height:22px;background-color:#dbeafe;border-radius:50%;text-align:center;line-height:22px;font-size:12px;font-weight:700;color:#1a56db;">${i + 1}</span>
                  </td>
                  <td style="padding:6px 0;font-size:14px;color:#374151;vertical-align:top;">${label} — compare current market rates against your plan</td>
                </tr>`).join('')}
              </table>
              <p style="margin:0 0 0;font-size:14px;color:#6b7280;">
                Nothing to do right now. We'll be in touch when the time comes.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #e5e7eb;background-color:#f9fafb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
                You're receiving this because you signed up for renewal reminders on Electric Deals.<br />
                <a href="${data.unsubscribeUrl}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a> to stop all reminders for this plan.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/** Minimal HTML escaping for user-supplied strings rendered into email HTML. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
