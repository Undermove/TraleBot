#!/usr/bin/env node
// Static site generator for tralebot.com public pages.
//
//   node build.mjs                 → writes into ../src/Trale/wwwroot (default)
//   node build.mjs --out <dir>     → writes elsewhere (tests use a temp dir)
//   node build.mjs --lock-slugs    → adds slugs of new verbs to data/verb-slugs.json (never changes old ones)
//
// Two kinds of pages, one output format:
//   * hand-written:  content/<section>/_index.md + content/<section>/<slug>.md
//   * data-driven:   /verbs/* from src/Trale/Verbs/verbs.json, /phrases/* and /words/* from the
//                    lesson theory and lexicons, cross-verb tables in /grammar/ (lib/pages/*)
// Output: <out>/<section>/index.html, <out>/<section>/<slug>/index.html, <out>/sitemap.xml,
//         plus everything from static/ copied to <out>/ (verification files, IndexNow key, og images).
//
// Rules (see ../CLAUDE.md → "Сайт vs мини-апп"):
//  * never touch <out>/index.html or <out>/assets — those belong to the mini-app build
//  * pages are pure HTML + inline CSS, no JS, no calls to /api
//  * Georgian comes only from the repo data; the generator never invents a form

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync, existsSync, copyFileSync } from 'node:fs'
import { join, dirname, resolve, relative, basename } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { marked } from 'marked'
import { parseFrontmatter } from './lib/frontmatter.mjs'
import { renderLayout, renderCta, renderCards, markGeorgian, esc } from './lib/template.mjs'
import { loadVerbs, slugRule } from './lib/data/verbs.mjs'
import { loadTheory } from './lib/data/theory.mjs'
import { loadLexicons } from './lib/data/lessons.mjs'
import { verbPage, verbsIndex } from './lib/pages/verbs.mjs'
import { grammarPages } from './lib/pages/grammar.mjs'
import { makeSelectors, referencePage } from './lib/pages/reference.mjs'
import { SECTIONS, referenceDefs } from './data/reference.mjs'

const here = dirname(fileURLToPath(import.meta.url))
export const SLUG_LOCK = join(here, 'data', 'verb-slugs.json')

// Sections the SPA or the API already own. A section with one of these names
// would shadow real routes, so the build refuses it outright.
const RESERVED_SECTIONS = new Set(['api', 'assets', 'audio', 'metrics', 'healthz'])

/** Where the data-driven pages read from, relative to the repository root. */
export const DATA_FILES = {
  verbs: 'src/Trale/Verbs/verbs.json',
  theory: 'src/Trale/MiniApp/MiniAppContentProvider.cs',
  lessons: 'src/Trale/Lessons'
}

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

/** Hand-written sections: content/<section>/_index.md + pages. */
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
        md: body
      })
    }
    sections.push({
      name,
      path: `/${name}/`,
      title: index.data.title,
      h1: index.data.h1 || index.data.title,
      description: index.data.description,
      label: index.data.label || index.data.title,
      updated: index.data.updated ? String(index.data.updated) : '',
      md: index.body,
      pages
    })
  }
  return sections
}

const byOrder = (a, b) => (a.order ?? 1000) - (b.order ?? 1000) || a.title.localeCompare(b.title, 'ru')
const card = (p) => ({ path: p.path, title: p.card || p.h1 || p.title, description: p.description })

function breadcrumbLd(config, crumbs) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.title, item: config.baseUrl + c.path }))
  }
}

/** A hand-written page → the common page shape. */
function markdownPage(section, page) {
  const draftNote = page.draft
    ? '<p class="draft-note">Черновик: страница не индексируется поисковиками, пока автор не снял пометку draft.</p>'
    : ''
  return {
    ...page,
    body: `<article>
  <div class="eyebrow">${esc(section.title)}</div>
  <h1>${esc(page.h1)}</h1>
  <p class="lead">${esc(page.description)}</p>
  ${draftNote}
${renderMarkdown(page.md)}
</article>`,
    crumbs: [{ title: 'Главная', path: '/' }, { title: section.title, path: section.path }, { title: page.h1, path: page.path }],
    ctaTag: `seo_${section.name}_${page.slug}`,
    cta: { heading: 'Потренировать в TraleBot', text: 'В мини-аппе эта тема разобрана по шагам: теория карточками, потом квиз. Бесплатно, без регистрации.' },
    related: [],
    relatedPaths: page.related.map((slug) => `/${section.name}/${slug}/`),
    backLink: { path: section.path, label: `Все темы раздела «${section.title}»` },
    ld: [],
    sitemap: { changefreq: 'monthly', priority: '0.7' }
  }
}

/** The page of a section itself: intro, cards of its pages, links to the other sections. */
function hubPage(section, pages, { teaser = '' } = {}) {
  const listed = pages.filter((p) => !p.draft).sort(byOrder)
  return {
    section: section.name,
    slug: 'index',
    path: section.path,
    title: section.title,
    h1: section.h1,
    description: section.description,
    hub: true,
    handWritten: section.md !== undefined,
    hubParts: listed.map((p) => ({ path: p.path, name: p.h1 })),
    body: `<article>
  <div class="eyebrow">TraleBot</div>
  <h1>${esc(section.h1)}</h1>
  <p class="lead">${esc(section.lead || section.description)}</p>
${section.md ? renderMarkdown(section.md) : ''}
${teaser}
</article>
<section class="related"><h2>Темы</h2>${renderCards(pages.sort(byOrder).map(card))}</section>`,
    crumbs: [{ title: 'Главная', path: '/' }, { title: section.label || section.title, path: section.path }],
    ctaTag: `seo_${section.name}_index`,
    cta: section.cta || { heading: 'Учить грузинский в Telegram', text: 'TraleBot: алфавит, грамматика, тематический словарь и квизы в одном мини-аппе.' },
    updated: section.updated,
    ld: [],
    sitemap: { changefreq: 'weekly', priority: '0.8' }
  }
}

function renderPage(config, page, byPath, hubs) {
  const related = [...(page.related || []), ...(page.relatedPaths || []).map((p) => byPath.get(p)).filter((p) => p && !p.draft).map(card)]
  const otherHubs = page.hub ? hubs.filter((h) => h.path !== page.path) : []
  const body = `${page.body}
${renderCta(config, page.ctaTag, page.cta)}
${related.length ? `<section class="related"><h2>${esc(page.relatedHeading || 'Смотрите также')}</h2>${renderCards(related)}</section>` : ''}
${otherHubs.length ? `<section class="related"><h2>Другие разделы</h2>${renderCards(otherHubs)}</section>` : ''}
${page.backLink ? `<p style="margin-top:24px;font-size:14px"><a href="${page.backLink.path}">← ${esc(page.backLink.label)}</a></p>` : ''}`

  const main = page.hub
    ? {
        '@type': 'CollectionPage',
        name: page.h1,
        description: page.description,
        inLanguage: config.language,
        url: config.baseUrl + page.path,
        hasPart: (page.hubParts || []).map((p) => ({ '@type': 'WebPage', name: p.name, url: config.baseUrl + p.path }))
      }
    : {
        '@type': 'Article',
        headline: page.h1,
        description: page.description,
        inLanguage: config.language,
        about: { '@type': 'Language', name: 'Georgian', alternateName: 'ka' },
        mainEntityOfPage: config.baseUrl + page.path,
        ...(page.updated ? { dateModified: page.updated } : {}),
        author: { '@type': 'Person', name: config.author },
        publisher: { '@type': 'Organization', name: config.siteName, url: config.baseUrl }
      }

  return renderLayout({
    config,
    title: `${page.title} — ${config.siteName}`,
    description: page.description,
    path: page.path,
    robots: page.draft ? 'noindex, nofollow' : 'index, follow',
    ogType: page.hub ? 'website' : 'article',
    jsonLd: { '@context': 'https://schema.org', '@graph': [main, breadcrumbLd(config, page.crumbs), ...(page.ld || [])] },
    body,
    ctaTag: page.ctaTag,
    breadcrumbs: page.crumbs,
    updated: page.updated
  })
}

function renderSitemap(config, pages) {
  const entries = [...(config.extraSitemapUrls || []).map((e) => ({ loc: e.path, changefreq: e.changefreq, priority: e.priority }))]
  for (const p of pages) if (!p.draft) entries.push({ loc: p.path, lastmod: p.updated, ...p.sitemap })
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

/** Data-driven pages. Returns hubs (sections) and pages in the common page shape. */
function generatedPages(config, repoRoot, grammarSection) {
  const updated = config.generatedUpdated || ''
  const { verbs, byLemma } = loadVerbs(join(repoRoot, DATA_FILES.verbs), SLUG_LOCK)
  const theory = loadTheory(join(repoRoot, DATA_FILES.theory))
  const lexicons = loadLexicons(join(repoRoot, DATA_FILES.lessons))

  const link = {
    verb(ru) {
      const v = verbs.find((x) => x.ru === ru)
      if (!v) throw new Error(`site: page definitions link to the verb «${ru}», which is not in the catalog`)
      return `<a href="${v.path}"><span lang="ka">${v.lemma}</span> «${esc(v.ru)}»</a>`
    }
  }

  const grammar = grammarSection ? grammarPages({ verbs, byLemma, theory, lexicons, updated }) : []
  const verbPages = verbs.map((v) => verbPage(v, { verbs, byLemma, config, updated }))
  const verbsHub = verbsIndex({ verbs, config, updated, extraLinks: grammar.map((p) => ({ path: p.path, label: p.card.toLowerCase() })) })

  const defs = referenceDefs(makeSelectors({ theory, lexicons }), link)
  const refPages = defs.map((d) => referencePage(d, { sectionTitle: SECTIONS[d.section].label, updated }))
  const refHubs = Object.entries(SECTIONS).map(([name, s]) =>
    hubPage({ name, path: `/${name}/`, updated, ...s }, refPages.filter((p) => p.section === name))
  )

  return { verbs, grammar, verbPages, verbsHub, refPages, refHubs }
}

export function build({
  outDir,
  contentDir = join(here, 'content'),
  staticDir = join(here, 'static'),
  config = loadConfig(),
  repoRoot = join(here, '..'),
  generated = true
} = {}) {
  if (!outDir) throw new Error('outDir is required')
  outDir = resolve(outDir)
  const sections = loadContent(contentDir)
  const grammarSection = sections.find((s) => s.name === 'grammar')
  const gen = generated ? generatedPages(config, repoRoot, grammarSection) : null

  // 1. collect every page in the common shape
  const pages = []
  const hubs = []
  if (gen) {
    hubs.push(gen.verbsHub)
    pages.push(gen.verbsHub, ...gen.verbPages)
  }
  for (const s of sections) {
    const own = s.pages.map((p) => markdownPage(s, p))
    const extra = gen && s === grammarSection ? gen.grammar : []
    const hub = hubPage(s, [...own, ...extra])
    hubs.push(hub)
    pages.push(hub, ...own, ...extra)
  }
  if (gen) {
    for (const hub of gen.refHubs) {
      hubs.push(hub)
      pages.push(hub, ...gen.refPages.filter((p) => p.section === hub.section))
    }
  }

  const sectionNames = [...new Set(pages.map((p) => p.section))]
  for (const name of sectionNames) if (RESERVED_SECTIONS.has(name)) throw new Error(`Section "${name}" collides with an app route`)
  const byPath = new Map()
  for (const p of pages) {
    if (byPath.has(p.path)) throw new Error(`Two pages claim ${p.path}`)
    byPath.set(p.path, p)
  }

  // Header and footer link to every section; the order is the order of importance.
  const NAV_ORDER = ['verbs', 'phrases', 'words', 'grammar']
  const NAV_LABEL = { verbs: 'Глаголы', grammar: 'Грамматика' }
  const navHubs = [...hubs].sort((a, b) => (NAV_ORDER.indexOf(a.section) + 99) % 99 - (NAV_ORDER.indexOf(b.section) + 99) % 99)
  const layoutConfig = { ...config, nav: navHubs.map((h) => ({ path: h.path, label: NAV_LABEL[h.section] || h.crumbs.at(-1).title })) }
  const hubCards = navHubs.map((h) => ({ path: h.path, title: h.h1, description: h.description }))

  // 2. write. Only the section folders we generate are cleaned; index.html/assets/audio stay untouched.
  for (const name of sectionNames) rmSync(join(outDir, name), { recursive: true, force: true })
  const written = []
  let bytes = 0
  for (const p of pages) {
    const file = join(outDir, p.path, 'index.html')
    const html = renderPage(layoutConfig, p, byPath, hubCards)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, html)
    bytes += Buffer.byteLength(html)
    written.push(p.path)
  }

  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'sitemap.xml'), renderSitemap(config, pages))
  const staticCount = copyStatic(staticDir, outDir)

  const drafts = pages.filter((p) => p.draft).length
  return { outDir, written, drafts, staticCount, sections, pages, bytes, verbs: gen?.verbs || [] }
}

/** Freezes the slugs of verbs that are not in the lock yet. Existing entries are never rewritten. */
export function lockSlugs(repoRoot = join(here, '..')) {
  const { verbs } = JSON.parse(readFileSync(join(repoRoot, DATA_FILES.verbs), 'utf8'))
  const lock = existsSync(SLUG_LOCK) ? JSON.parse(readFileSync(SLUG_LOCK, 'utf8')) : {}
  let added = 0
  for (const v of verbs) if (!lock[v.lemma]) { lock[v.lemma] = slugRule(v); added++ }
  mkdirSync(dirname(SLUG_LOCK), { recursive: true })
  writeFileSync(SLUG_LOCK, JSON.stringify(lock, null, 2) + '\n')
  return added
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (isMain) {
  if (process.argv.includes('--lock-slugs')) {
    console.log(`site: ${lockSlugs()} new verb slug(s) added to data/verb-slugs.json`)
  } else {
    const outIdx = process.argv.indexOf('--out')
    const outDir = outIdx !== -1 ? process.argv[outIdx + 1] : join(here, '..', 'src', 'Trale', 'wwwroot')
    const result = build({ outDir })
    const bySection = {}
    for (const p of result.pages) bySection[p.section] = (bySection[p.section] || 0) + 1
    console.log(`site: ${result.written.length} pages → ${result.outDir} (${(result.bytes / 1024 / 1024).toFixed(1)} MB of HTML, ${result.drafts} draft/noindex, ${result.staticCount} static files, sitemap.xml)`)
    for (const [s, n] of Object.entries(bySection)) console.log(`  /${s}/  ${n}`)
  }
}
