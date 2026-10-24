import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { publicPageMetadata, renderAboutHtml, renderCourseHtml, renderPublicPageHtml, renderInsightHtml, renderInsightsListingHtml } from '../scripts/generate-seo-pages.mjs'
import { insightsArticles } from '../src/data/insights.js'
import { courseStructuredData } from '../src/data/structuredData.js'

const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8')
const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
const sitemap = await readFile(new URL('../public/sitemap.xml', import.meta.url), 'utf8')
const robots = await readFile(new URL('../public/robots.txt', import.meta.url), 'utf8')
const vercelConfig = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'))

test('homepage has a single initial title, description, and canonical with matching Open Graph URL', () => {
  assert.equal((indexHtml.match(/<title>/gi) || []).length, 1)
  assert.equal((indexHtml.match(/<meta\s+name="description"/gi) || []).length, 1)
  assert.equal((indexHtml.match(/<link\s+rel="canonical"/gi) || []).length, 1)
  assert.match(indexHtml, /<title>BrianE-Dev \| Digital Technology &amp; Developer Productivity<\/title>/)
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

test('course landing page gets distinct metadata and one valid Course entity in initial HTML', () => {
  const courseHtml = renderCourseHtml(indexHtml)
  assert.equal((courseHtml.match(/<title>/gi) || []).length, 1)
  assert.equal((courseHtml.match(/<meta\s+name="description"/gi) || []).length, 1)
  assert.equal((courseHtml.match(/<link\s+rel="canonical"/gi) || []).length, 1)
  assert.match(courseHtml, new RegExp(`<title>${publicPageMetadata['/course/ai-powered-developer-productivity'].title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<\\/title>`))
  assert.match(courseHtml, new RegExp(`<link rel="canonical" href="${publicPageMetadata['/course/ai-powered-developer-productivity'].url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`))
  assert.match(courseHtml, /<meta property="og:url" content="https:\/\/briane-dev\.online\/course\/ai-powered-developer-productivity"/)
  assert.match(courseHtml, /<meta name="twitter:title" content="AI-Powered Developer Productivity Course \| BrianE-Dev"/)
  assert.doesNotMatch(courseHtml, /noindex/i)
  const courseScripts = [...courseHtml.matchAll(/<script type="application\/ld\+json"(?: id="[^"]+")?>([\s\S]*?)<\/script>/g)]
  const jsonLd = courseScripts.map((match) => JSON.parse(match[1]))
  const courseEntities = jsonLd.filter((item) => item['@type'] === 'Course')
  assert.equal(courseEntities.length, 1)
  assert.deepEqual(courseEntities[0], courseStructuredData)
  assert.equal(courseEntities[0].url, 'https://briane-dev.online/course/ai-powered-developer-productivity')
  assert.equal(courseEntities[0].provider['@id'], 'https://briane-dev.online/#organization')
  assert.equal(jsonLd.flatMap((item) => item['@graph'] || [item]).filter((item) => item['@type'] === 'Organization').length, 1)
})

test('course SPA route injects Course JSON-LD only when the initial HTML did not include it', () => {
  assert.match(app, /function PublicCourseStructuredData\(\)/)
  assert.match(app, /document\.getElementById\('course-structured-data'\)/)
  assert.match(app, /return <><PublicCourseStructuredData\/>/)
})

test('About page gets distinct first-response metadata and links its page entity to the shared organization', () => {
  const html = renderAboutHtml(indexHtml)
  const metadata = publicPageMetadata['/about']
  assert.ok(html.includes(`<title>${metadata.title.replaceAll('&', '&amp;')}</title>`))
  assert.ok(html.includes(`href="${metadata.url}"`))
  assert.ok(html.includes(`content="${metadata.url}"`))
  const aboutData = JSON.parse(html.match(/<script type="application\/ld\+json" id="about-page-structured-data">([\s\S]*?)<\/script>/)?.[1])
  assert.equal(aboutData['@type'], 'AboutPage')
  assert.equal(aboutData.about['@id'], 'https://briane-dev.online/#organization')
  assert.match(html, /Chukwuemeka Brian Nkama/)
})

test('public services, pricing, and privacy sitemap pages get matching first-response canonical metadata', () => {
  for (const path of ['/services', '/pricing', '/privacy']) {
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
    ['/about', '/about/index.html'],
    ['/services', '/services/index.html'],
    ['/pricing', '/pricing/index.html'],
    ['/contact', '/contact/index.html'],
    ['/quote', '/quote/index.html'],
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
  assert.match(app, /<a className="text-link" href="\/course\/ai-powered-developer-productivity">Explore the full course/)
  assert.match(app, /href="\/privacy">Read the BrianE-Dev Privacy Policy/)
  assert.match(app, /href="#pricing">Explore enrollment/)
  assert.match(app, /href="\/courses\/ai-powered-developer-productivity\/learn\/chapter-ai-assisted-developer">Read the free Chapter 1 preview/)
})

test('sitemap includes public canonical pages and excludes restricted routes', () => {
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])
  assert.deepEqual(urls, [
    'https://briane-dev.online/',
    'https://briane-dev.online/about',
    'https://briane-dev.online/course/ai-powered-developer-productivity',
    'https://briane-dev.online/services',
    'https://briane-dev.online/pricing',
    'https://briane-dev.online/privacy',
    'https://briane-dev.online/insights',
    'https://briane-dev.online/insights/using-ai-effectively-in-software-development',
    'https://briane-dev.online/insights/when-not-to-use-ai-for-coding',
    'https://briane-dev.online/insights/ai-assisted-development-workflows-for-junior-developers',
  ])
  assert.doesNotMatch(sitemap, /\/admin|\/super-admin|\/learn|\/courses\/.*\/learn/)
})

test('robots rules allow public pages and point crawlers to the sitemap', () => {
  assert.match(robots, /User-agent: \*\s+Allow: \/\s/)
  assert.match(robots, /Sitemap: https:\/\/briane-dev\.online\/sitemap\.xml/)
  assert.doesNotMatch(robots, /Disallow: \/(?:$|about(?:\/|$)|course(?:\/|$)|services(?:\/|$)|privacy(?:\/|$))/m)
})

test('insights listing and articles provide crawler readable content and unique canonical metadata', () => {
  const listing = renderInsightsListingHtml(indexHtml)
  assert.match(listing, /<h1>Practical insight/)
  for (const article of insightsArticles) {
    const html = renderInsightHtml(indexHtml, article)
    assert.match(html, new RegExp(`<title>${article.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\| BrianE-Dev</title>`))
    assert.ok(html.includes(`https://briane-dev.online/insights/${article.slug}`))
    assert.ok(html.includes(article.sections[0].paragraphs[0]))
    assert.match(html, /application\/ld\+json/)
    assert.match(html, /chapter-ai-assisted-developer/)
  }
  assert.match(sitemap, /\/insights\/using-ai-effectively-in-software-development/)
  assert.match(sitemap, /\/insights\/when-not-to-use-ai-for-coding/)
  assert.match(sitemap, /\/insights\/ai-assisted-development-workflows-for-junior-developers/)
})
