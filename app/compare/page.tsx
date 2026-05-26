'use client'

import { useState } from 'react'
import { calculateMonthlyCost, estimateKwhFromBill, PlanRateInputs } from '@/lib/calculator'
import { lookupZipStatic, ZipLookupResult } from '@/lib/supabase/zip-lookup'

// Mock plans for testing before DB is wired up
const MOCK_PLANS: Array<{ id: string; name: string; provider: string; rates: PlanRateInputs; term_months: number; renewable_percent: number; efl_url: string }> = [
  {
    id: '1',
    name: 'Simple Value 12',
    provider: 'Gexa Energy',
    term_months: 12,
    renewable_percent: 0,
    efl_url: 'https://www.powertochoose.org',
    rates: {
      base_monthly_charge: 9.95,
      energy_charge_per_kwh: 0.072,
      tdu_charges_per_kwh: 0.038,
      tdu_monthly_charge: 3.42,
      bill_credit_amount: null,
      bill_credit_threshold: null,
      rate_500_kwh: 13.2,
      rate_1000_kwh: 11.8,
      rate_2000_kwh: 11.1,
      cancellation_fee: 150,
      term_months: 12,
    },
  },
  {
    id: '2',
    name: 'Green Power 24',
    provider: 'Rhythm Energy',
    term_months: 24,
    renewable_percent: 100,
    efl_url: 'https://www.powertochoose.org',
    rates: {
      base_monthly_charge: 4.95,
      energy_charge_per_kwh: 0.081,
      tdu_charges_per_kwh: 0.038,
      tdu_monthly_charge: 3.42,
      bill_credit_amount: null,
      bill_credit_threshold: null,
      rate_500_kwh: 15.1,
      rate_1000_kwh: 12.8,
      rate_2000_kwh: 12.2,
      cancellation_fee: 200,
      term_months: 24,
    },
  },
  {
    id: '3',
    name: 'Bill Buster Flex',
    provider: 'TXU Energy',
    term_months: 12,
    renewable_percent: 15,
    efl_url: 'https://www.powertochoose.org',
    rates: {
      base_monthly_charge: 0,
      energy_charge_per_kwh: null,
      tdu_charges_per_kwh: null,
      tdu_monthly_charge: null,
      bill_credit_amount: 100,
      bill_credit_threshold: 1000,
      rate_500_kwh: 18.5,
      rate_1000_kwh: 7.3,
      rate_2000_kwh: 9.6,
      cancellation_fee: 150,
      term_months: 12,
    },
  },
  {
    id: '4',
    name: 'Fixed Rate Select',
    provider: 'Constellation',
    term_months: 12,
    renewable_percent: 0,
    efl_url: 'https://www.powertochoose.org',
    rates: {
      base_monthly_charge: 7.99,
      energy_charge_per_kwh: 0.085,
      tdu_charges_per_kwh: 0.040,
      tdu_monthly_charge: 3.42,
      bill_credit_amount: null,
      bill_credit_threshold: null,
      rate_500_kwh: 15.8,
      rate_1000_kwh: 13.6,
      rate_2000_kwh: 12.9,
      cancellation_fee: 175,
      term_months: 12,
    },
  },
]

type UsageMethod = 'kwh' | 'bill'
type HomeType = 'apartment' | 'small_home' | 'large_home'

interface RankedPlan {
  id: string
  name: string
  provider: string
  term_months: number
  renewable_percent: number
  efl_url: string
  estimatedMonthlyBill: number
  estimatedAnnualCost: number
  effectiveRatePerKwh: number
  rank: number
}

export default function ComparePage() {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [zip, setZip] = useState('')
  const [zipResult, setZipResult] = useState<ZipLookupResult | null>(null)
  const [zipError, setZipError] = useState('')
  const [usageMethod, setUsageMethod] = useState<UsageMethod>('kwh')
  const [kwhInput, setKwhInput] = useState('')
  const [billInput, setBillInput] = useState('')
  const [homeType, setHomeType] = useState<HomeType>('small_home')
  const [monthlyKwh, setMonthlyKwh] = useState<number | null>(null)
  const [rankedPlans, setRankedPlans] = useState<RankedPlan[]>([])

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

  function handleUsageSubmit(e: React.FormEvent) {
    e.preventDefault()
    let kwh: number

    if (usageMethod === 'kwh') {
      kwh = parseInt(kwhInput, 10)
      if (isNaN(kwh) || kwh < 1 || kwh > 5000) {
        return
      }
    } else {
      const bill = parseFloat(billInput)
      if (isNaN(bill) || bill < 10 || bill > 2000) {
        return
      }
      kwh = estimateKwhFromBill(bill, homeType)
    }

    setMonthlyKwh(kwh)

    // Rank plans
    const ranked = MOCK_PLANS
      .map((plan) => {
        const cost = calculateMonthlyCost(plan.rates, kwh)
        return {
          id: plan.id,
          name: plan.name,
          provider: plan.provider,
          term_months: plan.term_months,
          renewable_percent: plan.renewable_percent,
          efl_url: plan.efl_url,
          estimatedMonthlyBill: cost.estimatedMonthlyBill,
          estimatedAnnualCost: cost.estimatedAnnualCost,
          effectiveRatePerKwh: cost.effectiveRatePerKwh,
          rank: 0,
        }
      })
      .sort((a, b) => a.estimatedAnnualCost - b.estimatedAnnualCost)
      .map((plan, i) => ({ ...plan, rank: i + 1 }))

    setRankedPlans(ranked)
    setStep(3)
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Find Your Best Electricity Plan
          </h1>
          <p className="text-gray-600">
            Plans ranked by your actual estimated cost — not misleading headline rates.
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-3 mb-8 text-sm">
          {(['1','2','3'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold
                ${step > i + 1 ? 'bg-green-500 text-white' : step === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {step > i + 1 ? '✓' : s}
              </div>
              <span className={step === i + 1 ? 'text-gray-900 font-medium' : 'text-gray-400'}>
                {(['Your ZIP', 'Your Usage', 'Your Plans'] as const)[i]}
              </span>
              {i < 2 && <span className="text-gray-300">→</span>}
            </div>
          ))}
        </div>

        {/* Step 1: ZIP */}
        {step === 1 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">What&apos;s your ZIP code?</h2>
            <form onSubmit={handleZipSubmit} className="flex gap-3">
              <input
                type="text"
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
            {zipError && (
              <p className="mt-3 text-red-600 text-sm">{zipError}</p>
            )}
            <p className="mt-4 text-xs text-gray-400">
              Texas deregulated market only. Austin and San Antonio are served by municipal utilities.
            </p>
          </div>
        )}

        {/* Step 2: Usage */}
        {step === 2 && zipResult && zipResult.isDeregulated && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <span className="text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium">
                📍 {zipResult.city}, TX {zipResult.zip} — {zipResult.tdu.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </span>
              <button onClick={() => setStep(1)} className="text-xs text-gray-400 hover:text-gray-600 ml-auto">
                Change ZIP
              </button>
            </div>

            <h2 className="text-lg font-semibold mb-4">How much electricity do you use?</h2>

            {/* Toggle */}
            <div className="flex gap-2 mb-5">
              <button
                onClick={() => setUsageMethod('kwh')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors
                  ${usageMethod === 'kwh' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}
              >
                I know my kWh
              </button>
              <button
                onClick={() => setUsageMethod('bill')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors
                  ${usageMethod === 'bill' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}
              >
                Estimate from my bill
              </button>
            </div>

            <form onSubmit={handleUsageSubmit} className="space-y-4">
              {usageMethod === 'kwh' ? (
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
              ) : (
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
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Home type
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { value: 'apartment', label: 'Apartment', hint: '~700 kWh/mo' },
                        { value: 'small_home', label: 'House (small)', hint: '~1,000 kWh/mo' },
                        { value: 'large_home', label: 'House (large)', hint: '~1,500 kWh/mo' },
                      ] as const).map(opt => (
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
              )}

              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors mt-2"
              >
                Compare Plans →
              </button>
            </form>
          </div>
        )}

        {/* Non-deregulated notice */}
        {step === 2 && zipResult && !zipResult.isDeregulated && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
            <h2 className="font-semibold text-amber-900 mb-2">
              {zipResult.city} is served by a municipal utility
            </h2>
            <p className="text-sm text-amber-800 mb-4">
              Electricity in {zipResult.city} is provided by a municipal utility or co-op,
              not the deregulated ERCOT market. You can&apos;t switch providers.
            </p>
            <p className="text-sm text-amber-700">
              Want to be notified if deregulation expands? Leave your email and we&apos;ll let you know.
            </p>
          </div>
        )}

        {/* Step 3: Results */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Best plans for {zipResult?.city}, TX
                </h2>
                <p className="text-sm text-gray-500">
                  Based on <strong>{monthlyKwh?.toLocaleString()} kWh/month</strong> — sorted by estimated annual cost
                </p>
              </div>
              <button
                onClick={() => setStep(2)}
                className="text-sm text-blue-600 hover:underline"
              >
                Change usage
              </button>
            </div>

            {rankedPlans.map((plan, i) => (
              <div
                key={plan.id}
                className={`bg-white rounded-xl border p-5 shadow-sm
                  ${i === 0 ? 'border-blue-300 ring-1 ring-blue-200' : 'border-gray-200'}`}
              >
                {i === 0 && (
                  <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">
                    ⭐ Best match
                  </div>
                )}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">{plan.name}</div>
                    <div className="text-sm text-gray-500">{plan.provider}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">
                      ${plan.estimatedMonthlyBill.toFixed(2)}
                      <span className="text-sm font-normal text-gray-400">/mo</span>
                    </div>
                    <div className="text-sm text-gray-500">
                      ~${plan.estimatedAnnualCost.toFixed(0)}/year
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-3 text-xs text-gray-500">
                  <span className="bg-gray-100 px-2 py-1 rounded">
                    {plan.term_months === 0 ? 'Month-to-month' : `${plan.term_months}-month contract`}
                  </span>
                  <span className="bg-gray-100 px-2 py-1 rounded">
                    {plan.effectiveRatePerKwh.toFixed(1)}¢/kWh effective
                  </span>
                  {plan.renewable_percent > 0 && (
                    <span className="bg-green-50 text-green-700 px-2 py-1 rounded">
                      🌿 {plan.renewable_percent}% renewable
                    </span>
                  )}
                </div>

                <div className="mt-4 flex gap-2">
                  <a
                    href={plan.efl_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-center py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    View Plan &amp; Enroll →
                  </a>
                  <a
                    href={plan.efl_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:border-gray-300 transition-colors"
                  >
                    EFL
                  </a>
                </div>
              </div>
            ))}

            <p className="text-xs text-gray-400 text-center pt-2">
              Estimated costs based on {monthlyKwh?.toLocaleString()} kWh/month in the{' '}
              {zipResult?.tdu.replace(/_/g, ' ')} service area. Actual bills may vary.{' '}
              <a href="#" className="underline">See methodology</a>.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
