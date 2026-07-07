import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://zipzipworld.com'
  const routes = ['', '/faq', '/terms', '/privacy']
  return routes.map(r => ({
    url: `${base}${r}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: r === '' ? 1 : 0.6,
  }))
}
