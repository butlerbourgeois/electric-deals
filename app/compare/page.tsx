'use client'

import { useState } from 'react'
import { estimateKwhFromBill } from '@/lib/calculator'
import { lookupZipStatic, ZipLookupResult } from '@/lib/supabase/zip-lookup'

type UsageMethod = 'kwh' | 'bill'
type HomeType = 'apartment' | 'small_home' | 'large_home'

interface QuoteResult {
  quoteId: string
  rank: number
  rankReason: string
  estimatedMonthlyBill: number
  estimatedAnnualCost: number
  effectiveRatePerKwh: number
  plan: {
    id: string
    name: string
    planType: string
    termMonths: number
    renewablePercent: number
    cancellationFee: number
    eflUrl: string | null
    provider: { name: string; logoUrl: string | null }
  }
}

export default function ComparePage() {
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Step 1 state
  const [zip, setZip] = useState('')
  const [zipResult, setZipResult] = useState<ZipLookupResult | null>(null)
  const [zipError, setZipError] = useState('')

  // Step 2 state
  const [usageMethod, setUsageMethod] = useState<UsageMethod>('bill')
  const [kwhInput, setKwhInput] = useState('')
  const [billInput, setBillInput] = useState('')
  const [homeType, setHomeType] = useState<HomeType>('small_home')

  // Step 3 state
  const [quotes, setQuotes] = useState<QuoteResult[]>([])
  const [monthlyKwh, setMonthlyKwh] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [apiError, setApiError] = useState('')

  function handleZipSubmit(e: React.FormEvent) {
    e.preventDefault()
    setZipError('')
    const cleaned = zip.trim().replace(/\D/g, '').slice(0, 5)
    if (cleaned.length !== 5) {
      setZipError('Please enter a valid 5-digit ZIP code.')
      return
    }
    const result = lookupZipStatic(cleaned)
    if (!result) {
      setZipError("We don't have data for that ZIP yet. Try 77002 (Houston) or 75201 (Dallas).")
      return
    }
    setZipResult(result)
    setStep(2)
  }

  async function handleUsageSubmit(e: React.FormEvent) {
    e.preventDefault()
    setApiError('')

    let kwh: number
    let billAmount: number | null = null

    if (usageMethod === 'kwh') {
      kwh = parseInt(kwhInput, 10)
      if (isNaN(kwh) || kwh < 1 || kwh > 5000) {
        setApiError('Please enter a usage between 1 and 5,000 kWh.')
        return
      }
    } else {
      const bill = parseFloat(billInput)
      if (isNaN(bill) || bill < 10 || bill > 2000) {
        setApiError('Please enter a bill amount between $10 and $2,000.')
        return
      }
      billAmount = bill
      kwh = estimateKwhFromBill(bill, homeType)
    }

    setMonthlyKwh(kwh)
    setIsLoading(true)
    setStep(3)

    try {
      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zip: zipResult!.zip,
          tdu: zipResult!.tdu,
          monthlyKwh: kwh,
          monthlyBill: billAmount,
          homeType: usageMethod === 'bill' ? homeType : null,
          usageMethod,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setApiError(data.error ?? 'Failed to load plans. Please try again.')
        setIsLoading(false)
        return
      }

      setQuotes(data.quotes ?? [])
    } catch {
      setApiError('Network error. Please check your connection and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const tduLabel = zipResult?.tdu.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) ?? ''

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <a href="/" className="text-sm text-blue-600 hover:underline mb-4 block">&#8592; Home</a>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Find Your Best Electricity Plan
          </h1>
          <p className="text-gray-600">
            Plans ranked by your actual estimated cost — not misleading headline rates.
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-3 mb-8 text-sm">
          {['Your ZIP', 'Your Usage', 'Your Plans'].map((label, i) => (
            <div key={label} className="flex items-center gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold
                ${step > i + 1 ? 'bg-green-500 text-white' : step === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span className={step === i + 1 ? 'text-gray-900 font-medium' : 'text-gray-400'}>
                {label}
              </span>
              {i < 2 && <span className="text-gray-300">&#8594;</span>}
            </div>
          ))}
        </div>

        {/* ── Step 1: ZIP ── */}
        {step === 1 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">What&apos;s your ZIP code?</h2>
            <form onSubmit={handleZipSubmit} className="flex gap-3">
              <input
                type="text"
                inputMode="numeric"
                value={zip}
                onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
                placeholder="e.g. 77002"
                maxLength={5}
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <button
                type="submit"
                className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Find Plans
              </button>
            </form>
            {zipError && <p className="mt-3 text-red-600 text-sm">{zipError}</p>}
            <p className="mt-4 text-xs text-gray-400">
              Texas deregulated market only. Austin and San Antonio are served by municipal utilities.
            </p>
          </div>
        )}

        {/* ── Step 2: Usage (non-deregulated notice) ── */}
        {step === 2 && zipResult && !zipResult.isDeregulated && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
            <h2 className="font-semibold text-amber-900 mb-2">
              {zipResult.city} is served by a municipal utility
            </h2>
            <p className="text-sm text-amber-800 mb-4">
              Electricity in {zipResult.city} is provided by a municipal utility or co-op —
              not the deregulated ERCOT market. You can&apos;t switch REPs.
            </p>
            <p className="text-sm text-amber-700">
              Want to be notified if deregulation expands?{' '}
              <a
                href={`mailto:bourgeoisbh@gmail.com?subject=Notify+me+about+deregulation+in+${encodeURIComponent(zipResult.city)}`}
                className="underline font-medium"
              >
                Leave your email
              </a>{' '}
              and we&apos;ll let you know.
            </p>
            <button onClick={() => { setZip(''); setStep(1) }} className="mt-4 text-sm text-blue-600 hover:underline">
              &#8592; Try a different ZIP
            </button>
          </div>
        )}

        {/* ── Step 2: Usage (deregulated) ── */}
        {step === 2 && zipResult && zipResult.isDeregulated && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <span className="text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium">
                {zipResult.city}, TX {zipResult.zip} — {tduLabel}
              </span>
              <button onClick={() => setStep(1)} className="text-xs text-gray-400 hover:text-gray-600 ml-auto">
                Change ZIP
              </button>
            </div>

            <h2 className="text-lg font-semibold mb-4">How much electricity do you use?</h2>

            <div className="flex gap-2 mb-5">
              <button
                type="button"
                onClick={() => setUsageMethod('bill')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors
                  ${usageMethod === 'bill' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}
              >
                Estimate from my bill
              </button>
              <button
                type="button"
                onClick={() => setUsageMethod('kwh')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors
                  ${usageMethod === 'kwh' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}
              >
                I know my kWh
              </button>
            </div>

            <form onSubmit={handleUsageSubmit} className="space-y-4">
              {usageMethod === 'bill' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Average monthly bill ($)
                    </label>
                    <input
                      type="number"
                      value={billInput}
                      onChange={e => setBillInput(e.target.value)}
                      placeholder="e.g. 150"
                      min={10}
                      max={2000}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Home type</label>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { value: 'apartment' as HomeType, label: 'Apartment', hint: '~700 kWh/mo' },
                        { value: 'small_home' as HomeType, label: 'House (small)', hint: '~1,000 kWh/mo' },
                        { value: 'large_home' as HomeType, label: 'House (large)', hint: '~1,500 kWh/mo' },
                      ]).map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setHomeType(opt.value)}
                          className={`p-3 rounded-lg border text-left transition-colors
                            ${homeType === opt.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                        >
                          <div className="text-sm font-medium">{opt.label}</div>
                          <div className="text-xs text-gray-400">{opt.hint}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Monthly usage (kWh)
                  </label>
                  <input
                    type="number"
                    value={kwhInput}
                    onChange={e => setKwhInput(e.target.value)}
                    placeholder="e.g. 1000"
                    min={1}
                    max={5000}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <p className="mt-1.5 text-xs text-gray-400">
                    Find this on your bill. Texas average is ~1,100 kWh/month.
                  </p>
                </div>
              )}

              {apiError && <p className="text-red-600 text-sm">{apiError}</p>}

              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors mt-2"
              >
                Compare Plans &#8594;
              </button>
            </form>
          </div>
        )}

        {/* ── Step 3: Results ── */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {isLoading ? 'Finding best plans…' : `Best plans for ${zipResult?.city}, TX`}
                </h2>
                {!isLoading && monthlyKwh && (
                  <p className="text-sm text-gray-500">
                    Based on <strong>{monthlyKwh.toLocaleString()} kWh/month</strong> — sorted by estimated annual cost
                  </p>
                )}
              </div>
              {!isLoading && (
                <button onClick={() => setStep(2)} className="text-sm text-blue-600 hover:underline">
                  Change usage
                </button>
              )}
            </div>

            {/* Loading skeleton */}
            {isLoading && (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-48 mb-3" />
                    <div className="h-3 bg-gray-100 rounded w-32 mb-4" />
                    <div className="h-8 bg-gray-200 rounded w-24" />
                  </div>
                ))}
              </div>
            )}

            {/* Error */}
            {apiError && !isLoading && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                <p className="text-red-700 text-sm">{apiError}</p>
                <button onClick={() => setStep(2)} className="mt-2 text-sm text-red-600 underline">
                  Go back and try again
                </button>
              </div>
            )}

            {/* No results */}
            {!isLoading && !apiError && quotes.length === 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-center">
                <p className="text-gray-600">No plans found for this area yet.</p>
                <p className="text-sm text-gray-400 mt-1">Run <code>npm run ingest</code> to load plan data.</p>
              </div>
            )}

            {/* Plan cards */}
            {!isLoading && quotes.map((quote, i) => (
              <div
                key={quote.quoteId}
                className={`bg-white rounded-xl border p-5 shadow-sm
                  ${i === 0 ? 'border-blue-300 ring-1 ring-blue-200' : 'border-gray-200'}`}
              >
                {i === 0 && (
                  <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">
                    Best match
                  </div>
                )}
                <div className="text-xs text-gray-400 mb-2">{quote.rankReason}</div>

                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">{quote.plan.name}</div>
                    <div className="text-sm text-gray-500">{quote.plan.provider.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">
                      ${quote.estimatedMonthlyBill.toFixed(2)}
                      <span className="text-sm font-normal text-gray-400">/mo</span>
                    </div>
                    <div className="text-sm text-gray-500">
                      ~${quote.estimatedAnnualCost.toFixed(0)}/year
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-3 text-xs text-gray-500">
                  <span className="bg-gray-100 px-2 py-1 rounded">
                    {quote.plan.termMonths === 0 ? 'Month-to-month' : `${quote.plan.termMonths}-month contract`}
                  </span>
                  <span className="bg-gray-100 px-2 py-1 rounded">
                    {quote.effectiveRatePerKwh.toFixed(1)}&#162;/kWh effective
                  </span>
                  {quote.plan.renewablePercent > 0 && (
                    <span className="bg-green-50 text-green-700 px-2 py-1 rounded">
                      {quote.plan.renewablePercent}% renewable
                    </span>
                  )}
                  {quote.plan.cancellationFee > 0 && (
                    <span className="bg-gray-100 px-2 py-1 rounded">
                      ${quote.plan.cancellationFee} ETF
                    </span>
                  )}
                </div>

                <div className="mt-4 flex gap-2">
                  <a
                    href={`/api/handoff/${quote.quoteId}`}
                    target="_blank"
                    rel="sponsored noopener nofollow"
                    className="flex-1 text-center py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    View Plan &amp; Enroll &#8594;
                  </a>
                  {quote.plan.eflUrl && (
                    <a
                      href={`/plans/${quote.plan.id}`}
                      className="px-4 py-2.5 border border-gray-200 text-gray-600 text-sm rounded-lg hover:border-gray-300 transition-colors"
                    >
                      Details
                    </a>
                  )}
                </div>
              </div>
            ))}

            {!isLoading && quotes.length > 0 && (
              <p className="text-xs text-gray-400 text-center pt-2">
                Estimated costs based on {monthlyKwh?.toLocaleString()} kWh/month in the{' '}
                {zipResult?.tdu.replace(/_/g, ' ')} service area. Plan data from PowerToChoose.org.{' '}
                Actual bills vary.{' '}
                <a href="/methodology" className="underline">See methodology</a>.
                {' '}<em>Affiliate disclosure: we may earn a commission if you enroll.</em>
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
