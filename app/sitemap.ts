import { MetadataRoute } from 'next'
import { getAllActivePlanIds } from '@/lib/db/plans'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://electric-deals.vercel.app'

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/compare`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
  ]

  // Plan pages — try to fetch from DB; gracefully skip if DB not connected
  let planPages: MetadataRoute.Sitemap = []
  try {
    const plans = await getAllActivePlanIds()
    planPages = plans.map(plan => ({
      url: `${baseUrl}/plans/${plan.id}`,
      lastModified: new Date(plan.updated_at),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))
  } catch {
    // DB not available during build — return static pages only
    console.warn('sitemap: could not fetch plan IDs (DB unavailable), returning static pages only')
  }

  return [...staticPages, ...planPages]
}
