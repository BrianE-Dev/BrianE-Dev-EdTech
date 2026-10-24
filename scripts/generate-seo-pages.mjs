import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { courseStructuredData } from '../src/data/structuredData.js'
import { insightsArticles } from '../src/data/insights.js'

const insightsListingMetadata = {
  title: 'Developer Insights on AI and Software Engineering | BrianE-Dev',
  description: 'Practical guidance for using AI thoughtfully in software development, from codebase exploration and debugging to testing and responsible use.',
  url: 'https://briane-dev.online/insights',
}

export const publicPageMetadata = {
  '/about': {
    title: 'About BrianE-Dev | Technology for Better Digital Work',
    description: 'Meet BrianE-Dev, a technology brand founded by Chukwuemeka Brian Nkama, building digital solutions, developer resources, and practical AI-assisted engineering education.',
    url: 'https://briane-dev.online/about',
  },
  '/quote': {
    title: 'Request a Project Quote | BrianE-Dev',
    description: 'Share your website, commerce, or custom software project requirements with BrianE-Dev.',
    url: 'https://briane-dev.online/quote',
  },
  '/course/ai-powered-developer-productivity': {
    title: 'AI-Powered Developer Productivity Course | BrianE-Dev',
    description: 'Learn AI-powered developer workflows, coding with AI, debugging strategies and practical techniques to improve software engineering productivity with BrianE-Dev.',
    url: 'https://briane-dev.online/course/ai-powered-developer-productivity',
  },
  '/services': {
    title: 'Digital Services | BrianE-Dev',
    description: 'Explore BrianE-Dev website, e-commerce, web application, and integration services.',
    url: 'https://briane-dev.online/services',
  },
  '/pricing': {
    title: 'Course Pricing | BrianE-Dev',
    description: 'Review BrianE-Dev course pricing, create and verify your learner account, and purchase full course access.',
    url: 'https://briane-dev.online/pricing',
  },
  '/privacy': {
    title: 'BrianE-Dev Privacy Policy',
    description: 'Learn how BrianE-Dev handles learner account, course, payment, progress, certificate, and enquiry information.',
    url: 'https://briane-dev.online/privacy',
  },
}

function replaceAttribute(html, tagPattern, attribute, value) {
  const escaped = value.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
  const replacement = (tag) => tag.replace(new RegExp(`${attribute}="[^"]*"`), `${attribute}="${escaped}"`)
  const updated = html.replace(tagPattern, replacement)
  if (updated === html) throw new Error(`Could not update ${attribute} for course metadata`)
  return updated
}

export function renderPublicPageHtml(html, metadata) {
  const escapedTitle = metadata.title.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  let result = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapedTitle}</title>`)
  result = replaceAttribute(result, /<meta\s+name="description"[^>]*>/i, 'content', metadata.description)
  result = replaceAttribute(result, /<link\s+rel="canonical"[^>]*>/i, 'href', metadata.url)
  result = replaceAttribute(result, /<meta\s+property="og:title"[^>]*>/i, 'content', metadata.title)
  result = replaceAttribute(result, /<meta\s+property="og:description"[^>]*>/i, 'content', metadata.description)
  result = replaceAttribute(result, /<meta\s+property="og:url"[^>]*>/i, 'content', metadata.url)
  result = replaceAttribute(result, /<meta\s+name="twitter:title"[^>]*>/i, 'content', metadata.title)
  result = replaceAttribute(result, /<meta\s+name="twitter:description"[^>]*>/i, 'content', metadata.description)
  return result
}

export function renderAboutHtml(html) {
  const page = renderPublicPageHtml(html, publicPageMetadata['/about'])
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    '@id': 'https://briane-dev.online/about#webpage',
    name: publicPageMetadata['/about'].title,
    url: publicPageMetadata['/about'].url,
    description: publicPageMetadata['/about'].description,
    isPartOf: { '@id': 'https://briane-dev.online/#website' },
    about: { '@id': 'https://briane-dev.online/#organization' },
    mainEntity: { '@id': 'https://briane-dev.online/#organization' },
    author: { '@id': 'https://briane-dev.online/about#founder' },
    primaryImageOfPage: { '@type': 'ImageObject', url: 'https://briane-dev.online/branding/briane-dev-social.png' },
  }
  const founder = {
    '@type': 'Person',
    '@id': 'https://briane-dev.online/about#founder',
    name: 'Chukwuemeka Brian Nkama',
    url: 'https://briane-dev.online/about#founder',
    sameAs: ['https://www.linkedin.com/in/briane-dev'],
    image: 'https://briane-dev.online/brian-profile.jpeg',
    jobTitle: 'Founder',
    founder: { '@id': 'https://briane-dev.online/#organization' },
    worksFor: { '@id': 'https://briane-dev.online/#organization' },
  }
  const founderScript = `<script type="application/ld+json" id="about-founder-structured-data">${JSON.stringify({ '@context': 'https://schema.org', ...founder })}</script>`
  return page.replace('</head>', `    <script type="application/ld+json" id="about-page-structured-data">${JSON.stringify(schema)}</script>\n    ${founderScript}\n  </head>`)
}

export function renderCourseHtml(html) {
  const page = renderPublicPageHtml(html, publicPageMetadata['/course/ai-powered-developer-productivity'])
  const script = `<script type="application/ld+json" id="course-structured-data">${JSON.stringify(courseStructuredData)}</script>`
  return page.replace('</head>', `    ${script}\n  </head>`)
}

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

export function renderInsightHtml(html, article) {
  const metadata = { title: `${article.title} | BrianE-Dev`, description: article.description, url: `https://briane-dev.online/insights/${article.slug}` }
  const page = renderPublicPageHtml(html, metadata)
  const body = `<div class="business-page"><main class="article-main"><a class="article-back" href="/insights">← All insights</a><article><header class="article-header"><span class="eyebrow">${escapeHtml(article.category)} / ${article.readingTime} MIN READ</span><h1>${escapeHtml(article.title)}</h1><p class="article-deck">${escapeHtml(article.excerpt)}</p><div class="article-byline"><span>By BrianE-Dev</span><time datetime="${article.date}">Published ${article.date}</time></div></header><div class="article-content">${article.sections.map((section, index) => { const hasFeatureImage = article.slug === 'ai-assisted-development-workflows-for-junior-developers' && index === 0; return `<section${index % 2 === 1 ? ' class="is-sticky-section"' : hasFeatureImage ? ' class="has-feature-image"' : ''}>${hasFeatureImage ? '<figure class="article-feature-image"><img src="/insights/ai-assisted-development-junior.png" alt="A junior developer works with an AI assistant for code generation, debugging, code review, and learning."><figcaption>AI-assisted development workflow</figcaption></figure>' : ''}<h2>${escapeHtml(section.heading)}</h2>${(section.paragraphs || []).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}${section.bullets ? `<ul>${section.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}${hasFeatureImage ? '<div class="article-image-clear" aria-hidden="true"></div>' : ''}</section>` }).join('')}<section><h2>Keep learning</h2><p>Explore the <a href="/course/ai-powered-developer-productivity">AI-Powered Developer Productivity course</a> or <a href="/courses/ai-powered-developer-productivity/learn/chapter-ai-assisted-developer">read the free chapter preview</a>.</p></section></div></article></main></div>`
  const schema = { '@context': 'https://schema.org', '@type': 'Article', headline: article.title, description: article.description, datePublished: article.date, dateModified: article.date, author: { '@type': 'Organization', name: 'BrianE-Dev', url: 'https://briane-dev.online/about' }, publisher: { '@type': 'Organization', name: 'BrianE-Dev', url: 'https://briane-dev.online/' }, mainEntityOfPage: metadata.url, url: metadata.url }
  const breadcrumb = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: 'https://briane-dev.online/' }, { '@type': 'ListItem', position: 2, name: 'Insights', item: insightsListingMetadata.url }, { '@type': 'ListItem', position: 3, name: article.title, item: metadata.url }] }
  return page.replace('<div id="root"></div>', `<div id="root">${body}</div>`).replace('</head>', `<script type="application/ld+json">${JSON.stringify(schema)}</script><script type="application/ld+json">${JSON.stringify(breadcrumb)}</script></head>`)
}

export function renderInsightsListingHtml(html) {
  const page = renderPublicPageHtml(html, insightsListingMetadata)
  const body = `<div class="business-page"><main class="insights-main"><header class="insights-intro"><h1>Practical insight for thoughtful AI assisted development</h1><p>Guides for using AI effectively and responsibly in real software engineering work.</p></header><section class="insights-grid">${insightsArticles.map((article) => `<article class="insight-card"><div class="insight-meta"><span>${escapeHtml(article.category)}</span><span>${article.readingTime} min read</span></div><h2><a href="/insights/${article.slug}">${escapeHtml(article.title)}</a></h2><p>${escapeHtml(article.excerpt)}</p><div class="insight-card-footer"><time datetime="${article.date}">${article.date}</time><a href="/insights/${article.slug}">Read article</a></div></article>`).join('')}</section></main></div>`
  return page.replace('<div id="root"></div>', `<div id="root">${body}</div>`)
}

export function renderInsightsNotFoundHtml(html) {
  const page = renderPublicPageHtml(html, { title: 'Insight Not Found | BrianE-Dev', description: 'This insight could not be found.', url: 'https://briane-dev.online/insights/not-found' })
  return page.replace('<div id="root"></div>', '<div id="root"><main class="business-page"><section class="business-hero compact"><span class="eyebrow">BRIANE-DEV / 404</span><h1>Insight not found.</h1><p>This article may have moved or the address may be incorrect.</p><a href="/insights">Browse Insights</a></section></main></div>')
}

async function generate() {
  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const html = await readFile(resolve(projectRoot, 'dist/index.html'), 'utf8')
  for (const [path, metadata] of Object.entries(publicPageMetadata)) {
    const output = resolve(projectRoot, 'dist', path.slice(1), 'index.html')
    await mkdir(dirname(output), { recursive: true })
    const page = path === '/course/ai-powered-developer-productivity'
      ? renderCourseHtml(html)
      : path === '/about'
        ? renderAboutHtml(html)
        : renderPublicPageHtml(html, metadata)
    await writeFile(output, page)
  }
  const listing = resolve(projectRoot, 'dist/insights/index.html')
  await mkdir(dirname(listing), { recursive: true })
  await writeFile(listing, renderInsightsListingHtml(html))
  for (const article of insightsArticles) {
    const output = resolve(projectRoot, 'dist/insights', article.slug, 'index.html')
    await mkdir(dirname(output), { recursive: true })
    await writeFile(output, renderInsightHtml(html, article))
  }
  await writeFile(resolve(projectRoot, 'dist/insights/404.html'), renderInsightsNotFoundHtml(html))
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>https://briane-dev.online/</loc></url>\n  <url><loc>https://briane-dev.online/about</loc></url>\n  <url><loc>https://briane-dev.online/course/ai-powered-developer-productivity</loc></url>\n  <url><loc>https://briane-dev.online/services</loc></url>\n  <url><loc>https://briane-dev.online/pricing</loc></url>\n  <url><loc>https://briane-dev.online/privacy</loc></url>\n  <url><loc>${insightsListingMetadata.url}</loc><lastmod>2026-10-24</lastmod></url>\n${insightsArticles.map((article) => `  <url><loc>https://briane-dev.online/insights/${article.slug}</loc><lastmod>${article.date}</lastmod></url>`).join('\n')}\n</urlset>\n`
  await writeFile(resolve(projectRoot, 'dist/sitemap.xml'), sitemap)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await generate()
}
