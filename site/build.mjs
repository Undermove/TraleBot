#!/usr/bin/env node
// Static site generator for tralebot.com public pages (grammar reference etc.).
//
//   node build.mjs                 → writes into ../src/Trale/wwwroot (default)
//   node build.mjs --out <dir>     → writes elsewhere (tests use a temp dir)
//
// Input:  content/<section>/_index.md  (section hub)  +  content/<section>/<slug>.md (pages)
// Output: <out>/<section>/index.html, <out>/<section>/<slug>/index.html, <out>/sitemap.xml,
//         plus everything from static/ copied to <out>/ (search-engine verification files).
//
// Rules (see ../CLAUDE.md → "Сайт vs мини-апп"):
//  * never touch <out>/index.html or <out>/assets — those belong to the mini-app build
//  * pages are pure HTML + inline CSS, no JS, no calls to /api
//  * grammar facts come only from the repo content; the generator never invents forms

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync, existsSync, copyFileSync } from 'node:fs'
import { join, dirname, resolve, relative, basename } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { marked } from 'marked'
import { parseFrontmatter } from './lib/frontmatter.mjs'
import { renderLayout, renderCta, renderCards, markGeorgian, esc } from './lib/template.mjs'

const here = dirname(fileURLToPath(import.meta.url))

// Sections the SPA or the API already own. A content folder with one of these names
// would shadow real routes, so the build refuses it outright.
const RESERVED_SECTIONS = new Set(['api', 'assets', 'audio', 'metrics', 'healthz'])

export function loadConfig(configPath = join(here, 'site.config.json')) {
  return JSON.parse(readFileSync(configPath, 'utf8'))
}

function readMarkdown(file) {
  const { data, body } = parseFrontmatter(readFileSync(file, 'utf8'))
  return { data, body }
}

function renderMarkdown(md) {
  const html = marked.parse(md, { gfm: true, breaks: false })
  // Wrap tables so wide paradigms scroll horizontally on phones instead of breaking layout.
  return markGeorgian(html.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, '</table></div>'))
}

function requireFields(data, fields, file) {
  for (const f of fields) {
    if (data[f] === undefined || data[f] === '') throw new Error(`${file}: front matter is missing "${f}"`)
  }
}

export function loadContent(contentDir) {
  const sections = []
  for (const name of readdirSync(contentDir).sort()) {
    const dir = join(contentDir, name)
    if (!statSync(dir).isDirectory()) continue
    if (RESERVED_SECTIONS.has(name)) throw new Error(`Section "${name}" collides with an app route`)
    const indexFile = join(dir, '_index.md')
    if (!existsSync(indexFile)) throw new Error(`Section "${name}" has no _index.md`)
    const index = readMarkdown(indexFile)
    requireFields(index.data, ['title', 'description'], indexFile)

    const pages = []
    for (const f of readdirSync(dir).sort()) {
      if (!f.endsWith('.md') || f.startsWith('_')) continue
      const file = join(dir, f)
      const { data, body } = readMarkdown(file)
      requireFields(data, ['title', 'description'], file)
      const slug = basename(f, '.md')
      if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`${file}: file name must be a lowercase slug`)
      pages.push({
        slug,
        section: name,
        path: `/${name}/${slug}/`,
        title: data.title,
        h1: data.h1 || data.title,
        description: data.description,
        order: typeof data.order === 'number' ? data.order : 1000,
        draft: data.draft === true,
        related: Array.isArray(data.related) ? data.related : [],
        updated: data.updated ? String(data.updated) : '',
        source: data.source || '',
        body
      })
    }
    pages.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'ru'))
    sections.push({
      name,
      path: `/${name}/`,
      title: index.data.title,
      h1: index.data.h1 || index.data.title,
      description: index.data.description,
      updated: index.data.updated ? String(index.data.updated) : '',
      body: index.body,
      pages
    })
  }
  return sections
}

function breadcrumbLd(config, crumbs) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.title, item: config.baseUrl + c.path }))
  }
}

function renderPage(config, section, page) {
  const crumbs = [{ title: 'Главная', path: '/' }, { title: section.title, path: section.path }, { title: page.h1, path: page.path }]
  const relatedPages = page.related
    .map((slug) => section.pages.find((p) => p.slug === slug && !p.draft))
    .filter(Boolean)
  const draftNote = page.draft
    ? '<p class="draft-note">Черновик: страница не индексируется поисковиками, пока автор не снял пометку draft.</p>'
    : ''
  const body = `<article>
  <div class="eyebrow">${esc(section.title)}</div>
  <h1>${esc(page.h1)}</h1>
  <p class="lead">${esc(page.description)}</p>
  ${draftNote}
${renderMarkdown(page.body)}
</article>
${renderCta(config, `seo_${section.name}_${page.slug}`, {
    heading: 'Потренировать в TraleBot',
    text: 'В мини-аппе эта тема разобрана по шагам: теория карточками, потом квиз. Бесплатно, без регистрации.'
  })}
${relatedPages.length ? `<section class="related"><h2>Смотрите также</h2>${renderCards(relatedPages)}</section>` : ''}
<p style="margin-top:24px;font-size:14px"><a href="${section.path}">← Все темы раздела «${esc(section.title)}»</a></p>`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: page.h1,
        description: page.description,
        inLanguage: config.language,
        about: { '@type': 'Language', name: 'Georgian', alternateName: 'ka' },
        mainEntityOfPage: config.baseUrl + page.path,
        ...(page.updated ? { dateModified: page.updated } : {}),
        author: { '@type': 'Person', name: config.author },
        publisher: { '@type': 'Organization', name: config.siteName, url: config.baseUrl }
      },
      breadcrumbLd(config, crumbs)
    ]
  }

  return renderLayout({
    config,
    title: `${page.title} — ${config.siteName}`,
    description: page.description,
    path: page.path,
    robots: page.draft ? 'noindex, nofollow' : 'index, follow',
    ogType: 'article',
    jsonLd,
    body,
    ctaTag: `seo_${section.name}_${page.slug}`,
    breadcrumbs: crumbs,
    updated: page.updated
  })
}

function renderHub(config, section) {
  const crumbs = [{ title: 'Главная', path: '/' }, { title: section.title, path: section.path }]
  const body = `<article>
  <div class="eyebrow">${esc(config.siteName)}</div>
  <h1>${esc(section.h1)}</h1>
  <p class="lead">${esc(section.description)}</p>
${renderMarkdown(section.body)}
</article>
<section class="related"><h2>Темы</h2>${renderCards(section.pages)}</section>
${renderCta(config, `seo_${section.name}_index`, {
    heading: 'Учить грузинский в Telegram',
    text: 'TraleBot: алфавит, грамматика, тематический словарь и квизы в одном мини-аппе.'
  })}`
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: section.h1,
        description: section.description,
        inLanguage: config.language,
        url: config.baseUrl + section.path,
        hasPart: section.pages.filter((p) => !p.draft).map((p) => ({ '@type': 'Article', headline: p.h1, url: config.baseUrl + p.path }))
      },
      breadcrumbLd(config, crumbs)
    ]
  }
  return renderLayout({
    config,
    title: `${section.title} — ${config.siteName}`,
    description: section.description,
    path: section.path,
    robots: 'index, follow',
    ogType: 'website',
    jsonLd,
    body,
    ctaTag: `seo_${section.name}_index`,
    breadcrumbs: crumbs,
    updated: section.updated
  })
}

function renderSitemap(config, sections) {
  const entries = [...(config.extraSitemapUrls || []).map((e) => ({ loc: e.path, changefreq: e.changefreq, priority: e.priority }))]
  for (const s of sections) {
    entries.push({ loc: s.path, changefreq: 'weekly', priority: '0.8', lastmod: s.updated })
    for (const p of s.pages) if (!p.draft) entries.push({ loc: p.path, changefreq: 'monthly', priority: '0.7', lastmod: p.updated })
  }
  const xml = entries
    .map(
      (e) =>
        `  <url>\n    <loc>${config.baseUrl}${e.loc}</loc>\n` +
        (e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>\n` : '') +
        (e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>\n` : '') +
        (e.priority ? `    <priority>${e.priority}</priority>\n` : '') +
        `  </url>`
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${xml}\n</urlset>\n`
}

function copyStatic(staticDir, outDir) {
  if (!existsSync(staticDir)) return 0
  let n = 0
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const src = join(dir, f)
      if (statSync(src).isDirectory()) {
        walk(src)
        continue
      }
      if (f === 'README.md' || f === '.gitkeep') continue
      const dest = join(outDir, relative(staticDir, src))
      mkdirSync(dirname(dest), { recursive: true })
      copyFileSync(src, dest)
      n++
    }
  }
  walk(staticDir)
  return n
}

export function build({ outDir, contentDir = join(here, 'content'), staticDir = join(here, 'static'), config = loadConfig() } = {}) {
  if (!outDir) throw new Error('outDir is required')
  outDir = resolve(outDir)
  const sections = loadContent(contentDir)
  const written = []

  for (const s of sections) {
    // Only the section folders we generate are cleaned; index.html/assets/audio stay untouched.
    rmSync(join(outDir, s.name), { recursive: true, force: true })
    const hubFile = join(outDir, s.name, 'index.html')
    mkdirSync(dirname(hubFile), { recursive: true })
    writeFileSync(hubFile, renderHub(config, s))
    written.push(s.path)
    for (const p of s.pages) {
      const file = join(outDir, s.name, p.slug, 'index.html')
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, renderPage(config, s, p))
      written.push(p.path)
    }
  }

  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'sitemap.xml'), renderSitemap(config, sections))
  const staticCount = copyStatic(staticDir, outDir)

  const drafts = sections.flatMap((s) => s.pages).filter((p) => p.draft).length
  return { outDir, written, drafts, staticCount, sections }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (isMain) {
  const outIdx = process.argv.indexOf('--out')
  const outDir = outIdx !== -1 ? process.argv[outIdx + 1] : join(here, '..', 'src', 'Trale', 'wwwroot')
  const result = build({ outDir })
  console.log(`site: ${result.written.length} pages → ${result.outDir} (${result.drafts} draft/noindex, ${result.staticCount} static files, sitemap.xml)`)
  for (const p of result.written) console.log('  ' + p)
}
