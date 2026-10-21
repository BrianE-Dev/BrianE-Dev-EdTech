import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { courseStructuredData } from '../src/data/structuredData.js'

export const publicPageMetadata = {
  '/about': {
    title: 'About BrianE-Dev | Our Mission, Technology & Founder',
    description: 'Meet BrianE-Dev, a technology brand building digital solutions and practical software engineering resources, founded by Chukwuemeka Brian Nkama.',
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
  }
  return page.replace('</head>', `    <script type="application/ld+json" id="about-page-structured-data">${JSON.stringify(schema)}</script>\n  </head>`)
}

export function renderCourseHtml(html) {
  const page = renderPublicPageHtml(html, publicPageMetadata['/course/ai-powered-developer-productivity'])
  const script = `<script type="application/ld+json" id="course-structured-data">${JSON.stringify(courseStructuredData)}</script>`
  return page.replace('</head>', `    ${script}\n  </head>`)
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
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await generate()
}
