export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Find Cheaper Electricity in Texas
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Enter your ZIP code to see plans ranked by your actual estimated cost — not misleading headline rates.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-left text-sm text-gray-600">
          <p className="font-semibold mb-2">🚧 Coming soon</p>
          <p>Plan comparison flow is being built. Check back shortly.</p>
        </div>
      </div>
    </main>
  )
}
