import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { publicPageMetadata, renderCourseHtml, renderPublicPageHtml } from '../scripts/generate-seo-pages.mjs'

const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8')
const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
const sitemap = await readFile(new URL('../public/sitemap.xml', import.meta.url), 'utf8')
const robots = await readFile(new URL('../public/robots.txt', import.meta.url), 'utf8')
const vercelConfig = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'))

test('homepage has a single initial title, description, and canonical with matching Open Graph URL', () => {
  assert.equal((indexHtml.match(/<title>/gi) || []).length, 1)
  assert.equal((indexHtml.match(/<meta\s+name="description"/gi) || []).length, 1)
  assert.equal((indexHtml.match(/<link\s+rel="canonical"/gi) || []).length, 1)
  assert.match(indexHtml, /<title>BrianE-Dev \| AI-Powered Developer Productivity<\/title>/)
  assert.match(indexHtml, /<link rel="canonical" href="https:\/\/briane-dev\.online\/"/)
  assert.match(indexHtml, /<meta property="og:url" content="https:\/\/briane-dev\.online\/"/)
  assert.match(indexHtml, /<meta name="description" content="[^"]*developer productivity[^"]*"/i)
  assert.doesNotMatch(indexHtml, /noindex/i)
})

test('homepage Organization and WebSite structured data is valid JSON-LD without course claims', () => {
  const jsonLd = indexHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1]
  assert.ok(jsonLd)
  const data = JSON.parse(jsonLd)
  assert.deepEqual(data['@graph'].map((item) => item['@type']), ['Organization', 'WebSite'])
})

test('course landing page gets distinct metadata in its initial HTML response', () => {
  const courseHtml = renderCourseHtml(indexHtml)
  assert.equal((courseHtml.match(/<title>/gi) || []).length, 1)
  assert.equal((courseHtml.match(/<meta\s+name="description"/gi) || []).length, 1)
  assert.equal((courseHtml.match(/<link\s+rel="canonical"/gi) || []).length, 1)
  assert.match(courseHtml, new RegExp(`<title>${publicPageMetadata['/course/ai-powered-developer-productivity'].title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<\\/title>`))
  assert.match(courseHtml, new RegExp(`<link rel="canonical" href="${publicPageMetadata['/course/ai-powered-developer-productivity'].url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`))
  assert.match(courseHtml, /<meta property="og:url" content="https:\/\/briane-dev\.online\/course\/ai-powered-developer-productivity"/)
  assert.match(courseHtml, /<meta name="twitter:title" content="AI-Powered Developer Productivity Course \| BrianE-Dev"/)
  assert.doesNotMatch(courseHtml, /noindex/i)
  assert.doesNotMatch(courseHtml, /"@type":"Course"/)
})

test('public services and privacy sitemap pages get matching first-response canonical metadata', () => {
  for (const path of ['/services', '/privacy']) {
    const metadata = publicPageMetadata[path]
    const html = renderPublicPageHtml(indexHtml, metadata)
    assert.equal((html.match(/<link\s+rel="canonical"/gi) || []).length, 1)
    assert.ok(html.includes(`<title>${metadata.title}</title>`))
    assert.ok(html.includes(`href="${metadata.url}"`))
    assert.ok(html.includes(`content="${metadata.url}"`))
    assert.doesNotMatch(html, /noindex/i)
  }
})

test('deployment rewrites route public URLs to their generated HTML before the SPA fallback', () => {
  const rewrites = vercelConfig.rewrites
  for (const [source, destination] of [
    ['/course/ai-powered-developer-productivity', '/course/ai-powered-developer-productivity/index.html'],
    ['/services', '/services/index.html'],
    ['/privacy', '/privacy/index.html'],
  ]) {
    const routeIndex = rewrites.findIndex((rule) => rule.source === source)
    const fallbackIndex = rewrites.findIndex((rule) => rule.source === '/(.*)')
    assert.ok(routeIndex >= 0)
    assert.equal(rewrites[routeIndex].destination, destination)
    assert.ok(routeIndex < fallbackIndex)
  }
})

test('homepage exposes a crawlable link to the public course page and course content links to privacy', () => {
  assert.match(app, /<a className="text-link" href="\/course\/ai-powered-developer-productivity">Explore the Course/)
  assert.match(app, /href="\/privacy">Read the BrianE-Dev Privacy Policy/)
  assert.match(app, /href="\/#pricing">Explore enrollment/)
  assert.match(app, /href="\/courses\/ai-powered-developer-productivity\/learn\/chapter-ai-assisted-developer">Read the free Chapter 1 preview/)
})

test('sitemap includes the four public canonical pages and excludes restricted routes', () => {
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])
  assert.deepEqual(urls, [
    'https://briane-dev.online/',
    'https://briane-dev.online/course/ai-powered-developer-productivity',
    'https://briane-dev.online/services',
    'https://briane-dev.online/privacy',
  ])
  assert.doesNotMatch(sitemap, /\/admin|\/super-admin|\/learn|\/courses\/.*\/learn/)
})

test('robots rules allow public pages and point crawlers to the sitemap', () => {
  assert.match(robots, /User-agent: \*\s+Allow: \/\s/)
  assert.match(robots, /Sitemap: https:\/\/briane-dev\.online\/sitemap\.xml/)
  assert.doesNotMatch(robots, /Disallow: \/(?:$|course(?:\/|$)|services(?:\/|$)|privacy(?:\/|$))/m)
})
