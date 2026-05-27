'use client'

import { useRouter } from 'next/navigation'

/**
 * Client-side back button that uses router.back() to return to the previous
 * page — preserving React state (search results, scroll position) rather than
 * doing a hard navigation to /compare that would reset the comparison form.
 */
export function BackButton() {
  const router = useRouter()

  return (
    <button
      onClick={() => router.back()}
      className="text-sm text-blue-600 hover:underline mb-6 block"
    >
      ← Compare all plans
    </button>
  )
}
