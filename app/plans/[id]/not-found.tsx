import Link from 'next/link'

export default function PlanNotFound() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Plan Not Found</h1>
        <p className="text-gray-600 mb-6">
          This plan may no longer be available or the link may be incorrect.
        </p>
        <Link
          href="/compare"
          className="inline-block bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Find Available Plans →
        </Link>
      </div>
    </main>
  )
}
