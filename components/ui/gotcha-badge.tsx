'use client'

import { useState } from 'react'
import { Gotcha } from '@/types/database'

interface GotchaBadgeProps {
  gotcha: Gotcha
  compact?: boolean
}

const severityStyles = {
  high: {
    container: 'bg-red-50 border-red-200 text-red-700',
    detail: 'text-red-600',
  },
  medium: {
    container: 'bg-amber-50 border-amber-200 text-amber-700',
    detail: 'text-amber-600',
  },
  low: {
    container: 'bg-gray-50 border-gray-200 text-gray-500',
    detail: 'text-gray-400',
  },
}

const severityIcon: Record<Gotcha['severity'], string> = {
  high: '⚠️',
  medium: '⚠️',
  low: 'ℹ️',
}

export function GotchaBadge({ gotcha, compact = true }: GotchaBadgeProps) {
  const [expanded, setExpanded] = useState(false)
  const styles = severityStyles[gotcha.severity]
  const icon = severityIcon[gotcha.severity]

  if (!compact) {
    // Non-compact: always show full title + detail
    return (
      <div className={`inline-flex flex-col gap-1 text-xs font-medium px-2 py-1.5 rounded-md border ${styles.container}`}>
        <span>{icon} {gotcha.title}</span>
        <span className={`font-normal leading-snug ${styles.detail}`}>{gotcha.detail}</span>
      </div>
    )
  }

  // Compact: collapsed by default, expands on click
  return (
    <button
      type="button"
      onClick={() => setExpanded(prev => !prev)}
      className={`inline-flex flex-col items-start text-left text-xs font-medium px-2 py-1 rounded-md border cursor-pointer transition-colors ${styles.container}`}
      aria-expanded={expanded}
    >
      <span className="flex items-center gap-1">
        {icon} {gotcha.title}
        <span className="ml-0.5 opacity-70" aria-hidden="true">
          {expanded ? '▲' : '▾'}
        </span>
      </span>
      {expanded && (
        <span className={`mt-1 font-normal leading-snug max-w-xs ${styles.detail}`}>
          {gotcha.detail}
        </span>
      )}
    </button>
  )
}
