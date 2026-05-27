'use client'

import { useState } from 'react'

interface HandoffModalProps {
  quoteId: string
  planName: string
  providerName: string
  termMonths: number
  isOpen: boolean
  onClose: () => void
}

/**
 * Intercepts the "View Plan & Enroll" click to capture email + contract end date
 * before redirecting to the provider. Capture failure never blocks enrollment —
 * the skip path and the error fallback both redirect unconditionally.
 */
export function HandoffModal({
  quoteId,
  planName,
  providerName,
  termMonths,
  isOpen,
  onClose,
}: HandoffModalProps) {
  const [email, setEmail] = useState('')
  const [month, setMonth] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + termMonths)
    return String(d.getMonth() + 1) // 1-12
  })
  const [year, setYear] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + termMonths)
    return String(d.getFullYear())
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const enrollUrl = `/api/handoff/${quoteId}`

  function redirect(ra?: string) {
    const url = ra ? `${enrollUrl}?ra=${encodeURIComponent(ra)}` : enrollUrl
    window.location.href = url
  }

  function handleSkip() {
    redirect()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)

    // Build YYYY-MM-DD from the month/year selects
    const mm = month.padStart(2, '0')
    const contractEndDate = `${year}-${mm}-01`

    try {
      const res = await fetch(`/api/handoff/${quoteId}/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, contractEndDate, termMonths }),
      })

      if (res.ok) {
        const data = await res.json()
        redirect(data.renewalAlertId)
      } else {
        // API returned an error — still redirect without the alert ID
        redirect()
      }
    } catch {
      // Network error — still redirect, capture must never block enrollment
      redirect()
    }
    // Note: setIsSubmitting(false) is intentionally omitted — the page is
    // navigating away, so resetting state would cause a flash.
  }

  // Build month/year options. Allow any month in the coming 3 years.
  const today = new Date()
  const months = [
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ]
  const currentYear = today.getFullYear()
  const years = [currentYear, currentYear + 1, currentYear + 2, currentYear + 3]

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={(e) => {
        // Close on backdrop click (same as skip — no capture)
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl leading-none"
          aria-label="Close"
        >
          &times;
        </button>

        {/* Header */}
        <div className="mb-5">
          <h2 className="text-xl font-bold text-gray-900 mb-1">
            One last thing before you enroll
          </h2>
          <p className="text-sm text-gray-500">
            Get a reminder before your plan expires so you never get stuck on a higher rate.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {planName} &mdash; {providerName}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Email address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* Contract end date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              When does your plan end?
            </label>
            <p className="text-xs text-gray-400 mb-2">
              We&apos;ll estimate based on a {termMonths}-month term if you&apos;re not sure.
            </p>
            <div className="flex gap-2">
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {months.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                min={currentYear}
                max={currentYear + 5}
                className="w-24 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Year"
              />
            </div>
          </div>

          {/* Primary CTA */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving…' : 'Get reminders & continue →'}
          </button>
        </form>

        {/* Skip link */}
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={handleSkip}
            disabled={isSubmitting}
            className="text-sm text-gray-400 hover:text-gray-600 underline disabled:opacity-60"
          >
            Skip &mdash; just take me to the plan
          </button>
        </div>

        {/* Small print */}
        <p className="mt-4 text-xs text-gray-400 text-center">
          We&apos;ll only email you about your electricity plan. Unsubscribe any time.
        </p>
      </div>
    </div>
  )
}
