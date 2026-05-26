import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Find Cheaper Electricity in Texas
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Enter your ZIP and usage — get plans ranked by your actual estimated cost,
          not misleading headline rates. Free, instant, no sign-up required.
        </p>
        <Link
          href="/compare"
          className="inline-block bg-blue-600 text-white text-lg font-semibold px-8 py-4 rounded-xl hover:bg-blue-700 transition-colors"
        >
          Compare Plans Free →
        </Link>
        <p className="mt-4 text-sm text-gray-400">
          Texas deregulated electricity market only.
        </p>
      </div>
    </main>
  )
}
