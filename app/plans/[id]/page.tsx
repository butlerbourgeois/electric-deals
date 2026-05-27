import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import Link from 'next/link'
import { getPlanById } from '@/lib/db/plans'
import { BackButton } from './back-button'
import { GotchaBadge } from '@/components/ui/gotcha-badge'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const plan = await getPlanById(id)

  if (!plan) {
    return { title: 'Plan Not Found | Electric Deals' }
  }

  const rate = plan.rate_1000_kwh?.toFixed(1) ?? '—'
  const provider = plan.provider?.name ?? 'Unknown Provider'

  return {
    title: `${plan.name} — ${provider} | Texas Electricity Plan`,
    description: `${plan.name} from ${provider}: ${rate}¢/kWh at 1,000 kWh, ${plan.term_months}-month ${plan.plan_type} rate. See full pricing, EFL, and compare against your usage.`,
    openGraph: {
      title: `${plan.name} — ${provider}`,
      description: `${rate}¢/kWh at 1,000 kWh · ${plan.term_months}-month ${plan.plan_type} rate · ${plan.renewable_percent}% renewable`,
    },
  }
}

export default async function PlanDetailPage({ params }: Props) {
  const { id } = await params
  const plan = await getPlanById(id)

  if (!plan) notFound()

  const provider = plan.provider
  const rate1000 = plan.rate_1000_kwh?.toFixed(2) ?? '—'
  const rate500 = plan.rate_500_kwh?.toFixed(2) ?? '—'
  const rate2000 = plan.rate_2000_kwh?.toFixed(2) ?? '—'
  // Fallback for rows that predate migration 000011 where gotchas column may be absent
  const gotchas = plan.gotchas ?? []

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Back button — uses router.back() to preserve compare page state */}
        <BackButton />

        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">{provider?.name ?? 'Unknown Provider'}</p>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h1>
              <div className="flex flex-wrap gap-2">
                <span className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded font-medium capitalize">
                  {plan.plan_type} rate
                </span>
                <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">
                  {plan.term_months === 0 ? 'Month-to-month' : `${plan.term_months}-month contract`}
                </span>
                {plan.renewable_percent > 0 && (
                  <span className="bg-green-50 text-green-700 text-xs px-2 py-1 rounded">
                    🌿 {plan.renewable_percent}% renewable
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-gray-900">{rate1000}¢</div>
              <div className="text-xs text-gray-400">per kWh at 1,000 kWh</div>
            </div>
          </div>
        </div>

        {/* Rate tiers */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-4">
          <h2 className="font-semibold text-gray-900 mb-4">Published Rates (from Electricity Facts Label)</h2>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: '500 kWh/mo', value: rate500 },
              { label: '1,000 kWh/mo', value: rate1000, highlight: true },
              { label: '2,000 kWh/mo', value: rate2000 },
            ].map(({ label, value, highlight }) => (
              <div key={label} className={`rounded-lg p-4 text-center ${highlight ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'}`}>
                <div className={`text-2xl font-bold ${highlight ? 'text-blue-700' : 'text-gray-800'}`}>
                  {value}¢
                </div>
                <div className="text-xs text-gray-500 mt-1">{label}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Rates shown are all-in (energy + TDU charges) at the stated usage tier per the EFL.
            Your actual rate will vary based on your exact usage.
          </p>
        </div>

        {/* Plan details */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-4">
          <h2 className="font-semibold text-gray-900 mb-4">Plan Details</h2>
          <dl className="space-y-3">
            <div className="flex justify-between text-sm">
              <dt className="text-gray-500">Contract length</dt>
              <dd className="font-medium">{plan.term_months === 0 ? 'Month-to-month' : `${plan.term_months} months`}</dd>
            </div>
            <div className="flex justify-between text-sm">
              <dt className="text-gray-500">Early termination fee</dt>
              <dd className="font-medium">{plan.cancellation_fee > 0 ? `$${plan.cancellation_fee}` : 'None'}</dd>
            </div>
            {plan.base_monthly_charge > 0 && (
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">Base monthly charge</dt>
                <dd className="font-medium">${plan.base_monthly_charge.toFixed(2)}/month</dd>
              </div>
            )}
            {plan.bill_credit_amount && plan.bill_credit_threshold && (
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">Bill credit</dt>
                <dd className="font-medium text-green-700">
                  ${plan.bill_credit_amount} off when you use {plan.bill_credit_threshold.toLocaleString()}+ kWh
                </dd>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <dt className="text-gray-500">Renewable energy</dt>
              <dd className="font-medium">{plan.renewable_percent}%</dd>
            </div>
            <div className="flex justify-between text-sm">
              <dt className="text-gray-500">Service area</dt>
              <dd className="font-medium capitalize">{plan.tdu_territory.replace(/_/g, ' ')}</dd>
            </div>
            <div className="flex justify-between text-sm">
              <dt className="text-gray-500">Data source</dt>
              <dd className="font-medium capitalize">{plan.source}</dd>
            </div>
          </dl>
        </div>

        {/* What to watch out for */}
        {gotchas.length > 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-4">
            <h2 className="font-semibold text-gray-900 mb-4">What to watch out for</h2>
            <div className="space-y-3">
              {gotchas.map((gotcha, i) => (
                <GotchaBadge key={`${gotcha.code}-${i}`} gotcha={gotcha} compact={false} />
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-4 flex items-start gap-3">
            <span className="text-green-600 text-xl mt-0.5">✓</span>
            <div>
              <p className="font-semibold text-green-800">Clean plan — no warnings detected</p>
              <p className="text-sm text-green-700 mt-1">
                We checked this plan for common gotchas: bill-credit cliffs, hidden base charges,
                rate spikes at low usage, and high cancellation fees. None found.
              </p>
            </div>
          </div>
        )}

        {/* Documents */}
        {(plan.efl_url || plan.tos_url || plan.yrac_url) && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-4">
            <h2 className="font-semibold text-gray-900 mb-3">Plan Documents</h2>
            <div className="flex flex-col gap-2">
              {plan.efl_url && (
                <a
                  href={plan.efl_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                >
                  📄 Electricity Facts Label (EFL)
                </a>
              )}
              {plan.tos_url && (
                <a
                  href={plan.tos_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                >
                  📄 Terms of Service
                </a>
              )}
              {plan.yrac_url && (
                <a
                  href={plan.yrac_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                >
                  📄 Your Rights as a Customer (YRAC)
                </a>
              )}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
          <p className="text-gray-700 mb-4">
            See how <strong>{plan.name}</strong> compares against your actual usage
          </p>
          <Link
            href={`/compare?highlight=${plan.id}`}
            className="inline-block bg-blue-600 text-white font-semibold px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Compare Against My Usage →
          </Link>
          <p className="text-xs text-gray-400 mt-3">
            We&apos;ll rank all available plans for your ZIP — not just this one.
          </p>
        </div>

        {/* Affiliate disclosure */}
        <p className="text-xs text-gray-400 text-center mt-6">
          Electric Deals may earn a commission if you enroll through our site.
          Plan data sourced from{' '}
          <a href="https://www.powertochoose.org" target="_blank" rel="noopener" className="underline">
            PowerToChoose.org
          </a>.
          Rates shown are as of the last data update and may have changed.
        </p>
      </div>
    </main>
  )
}
