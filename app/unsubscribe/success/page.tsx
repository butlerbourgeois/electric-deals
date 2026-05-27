import Link from 'next/link'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Unsubscribed | Electric Deals',
  description: "You've been successfully unsubscribed from renewal reminders.",
  robots: { index: false, follow: false },
}

export default function UnsubscribeSuccessPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-6 h-6 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-2">
          You&apos;ve been unsubscribed
        </h1>
        <p className="text-gray-600 mb-6">
          You won&apos;t receive any more renewal reminders from us.
          If your contract is coming up soon, we&apos;re still here when you need us.
        </p>

        <Link
          href="/compare"
          className="inline-block bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Find a new plan &rarr;
        </Link>

        <p className="text-xs text-gray-400 mt-6">
          Changed your mind? You can re-enroll for reminders the next time you
          compare plans.
        </p>
      </div>
    </main>
  )
}
