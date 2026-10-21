import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const publicPageMetadata = {
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
  let result = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${metadata.title}</title>`)
  result = replaceAttribute(result, /<meta\s+name="description"[^>]*>/i, 'content', metadata.description)
  result = replaceAttribute(result, /<link\s+rel="canonical"[^>]*>/i, 'href', metadata.url)
  result = replaceAttribute(result, /<meta\s+property="og:title"[^>]*>/i, 'content', metadata.title)
  result = replaceAttribute(result, /<meta\s+property="og:description"[^>]*>/i, 'content', metadata.description)
  result = replaceAttribute(result, /<meta\s+property="og:url"[^>]*>/i, 'content', metadata.url)
  result = replaceAttribute(result, /<meta\s+name="twitter:title"[^>]*>/i, 'content', metadata.title)
  result = replaceAttribute(result, /<meta\s+name="twitter:description"[^>]*>/i, 'content', metadata.description)
  return result
}

export function renderCourseHtml(html) {
  return renderPublicPageHtml(html, publicPageMetadata['/course/ai-powered-developer-productivity'])
}

async function generate() {
  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const html = await readFile(resolve(projectRoot, 'dist/index.html'), 'utf8')
  for (const [path, metadata] of Object.entries(publicPageMetadata)) {
    const output = resolve(projectRoot, 'dist', path.slice(1), 'index.html')
    await mkdir(dirname(output), { recursive: true })
    await writeFile(output, renderPublicPageHtml(html, metadata))
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await generate()
}
