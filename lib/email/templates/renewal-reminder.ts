export interface RenewalReminderData {
  planName: string
  providerName: string
  daysUntilExpiry: number    // 45, 30, or 15
  contractEndDate: string
  monthlyKwh: number
  tduTerritory: string
  compareUrl: string         // URL to /api/compare/from-alert/[alertId]
  unsubscribeUrl: string
  // Optional: cheaper plan data if we have it
  cheaperPlan?: {
    name: string
    providerName: string
    estimatedMonthlySavings: number  // positive = savings vs current
  }
}

export function renewalReminderSubject(data: RenewalReminderData): string {
  switch (data.daysUntilExpiry) {
    case 45:
      return `Your electricity plan expires in 45 days — see if you can save`
    case 30:
      return `30 days left on your ${data.planName} plan — compare now`
    case 15:
      return `⚡ 15 days to switch and avoid a rate hike`
    default:
      return `Your electricity plan expires in ${data.daysUntilExpiry} days — compare now`
  }
}

export function renewalReminderText(data: RenewalReminderData): string {
  const urgencyLine = data.daysUntilExpiry <= 15
    ? `Your contract ends in ${data.daysUntilExpiry} days. Act soon to avoid rolling onto a higher rate.`
    : `Your contract ends in ${data.daysUntilExpiry} days.`

  const cheaperPlanSection = data.cheaperPlan
    ? `We found a plan that could save you ~$${data.cheaperPlan.estimatedMonthlySavings}/month:\n  ${data.cheaperPlan.name} by ${data.cheaperPlan.providerName}`
    : `Check if new plans are cheaper than ${data.planName} at your usage.`

  return `
${urgencyLine}

${cheaperPlanSection}

Compare plans now:
${data.compareUrl}

---
Plan: ${data.planName}
Provider: ${data.providerName}
Contract end: ${data.contractEndDate}
Usage: ${data.monthlyKwh.toLocaleString()} kWh/month
Service area: ${data.tduTerritory}

---
To stop receiving reminders, unsubscribe here:
${data.unsubscribeUrl}
`.trim()
}

export function renewalReminderHtml(data: RenewalReminderData): string {
  const isUrgent = data.daysUntilExpiry <= 15
  const daysColor = isUrgent ? '#dc2626' : '#1a56db'
  const daysLabel = `${data.daysUntilExpiry} days`

  const urgencyNote = isUrgent
    ? `<p style="margin:0 0 20px;font-size:14px;color:#dc2626;font-weight:600;">Act soon — if you don't switch, you may roll onto a higher variable rate.</p>`
    : ''

  const cheaperPlanBlock = data.cheaperPlan
    ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;margin-bottom:24px;">
        <tr>
          <td style="padding:20px 24px;">
            <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#15803d;text-transform:uppercase;letter-spacing:0.05em;">Potential savings found</p>
            <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#111827;">~$${data.cheaperPlan.estimatedMonthlySavings}/month</p>
            <p style="margin:0;font-size:14px;color:#374151;">
              <strong>${escapeHtml(data.cheaperPlan.name)}</strong> by ${escapeHtml(data.cheaperPlan.providerName)} could save you around $${data.cheaperPlan.estimatedMonthlySavings} per month compared to your current plan.
            </p>
          </td>
        </tr>
      </table>`
    : `
      <p style="margin:0 0 24px;font-size:15px;color:#374151;">
        Check if new plans are cheaper than <strong>${escapeHtml(data.planName)}</strong> at your usage of ${data.monthlyKwh.toLocaleString()} kWh/month.
      </p>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(renewalReminderSubject(data))}</title>
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

          <!-- Days remaining banner -->
          <tr>
            <td style="padding:24px 32px 0;text-align:center;">
              <p style="margin:0 0 4px;font-size:48px;font-weight:800;color:${daysColor};line-height:1;">${daysLabel}</p>
              <p style="margin:0 0 16px;font-size:16px;color:#6b7280;">until your electricity contract ends</p>
              ${urgencyNote}
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:0 32px 24px;">
              ${cheaperPlanBlock}

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="${data.compareUrl}"
                       style="display:inline-block;background-color:#1a56db;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:14px 32px;border-radius:6px;">
                      Compare plans now &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Current plan summary -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 10px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Your current plan</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#6b7280;width:40%;">Plan</td>
                        <td style="padding:4px 0;font-size:13px;color:#111827;font-weight:600;">${escapeHtml(data.planName)}</td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#6b7280;">Provider</td>
                        <td style="padding:4px 0;font-size:13px;color:#111827;">${escapeHtml(data.providerName)}</td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#6b7280;">Contract end</td>
                        <td style="padding:4px 0;font-size:13px;color:#111827;font-weight:600;">${escapeHtml(data.contractEndDate)}</td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#6b7280;">Usage</td>
                        <td style="padding:4px 0;font-size:13px;color:#111827;">${data.monthlyKwh.toLocaleString()} kWh/month</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
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
