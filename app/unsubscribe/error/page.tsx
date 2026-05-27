import Link from 'next/link'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Unsubscribe Error | Electric Deals',
  description: 'Something went wrong with your unsubscribe link.',
  robots: { index: false, follow: false },
}

export default function UnsubscribeErrorPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-6 h-6 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-2">
          Something went wrong
        </h1>
        <p className="text-gray-600 mb-6">
          Your unsubscribe link may be invalid or expired. Please use the link
          directly from your renewal reminder email, or contact us and we&apos;ll
          remove you manually.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="mailto:support@electric-deals.com?subject=Unsubscribe%20Request"
            className="inline-block bg-gray-900 text-white font-semibold px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors"
          >
            Contact us
          </a>
          <Link
            href="/compare"
            className="inline-block border border-gray-300 text-gray-700 font-semibold px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Compare plans
          </Link>
        </div>
      </div>
    </main>
  )
}
