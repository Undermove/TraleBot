import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, existsSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build, loadConfig } from '../build.mjs'
import { parseFrontmatter } from '../lib/frontmatter.mjs'
import { markGeorgian } from '../lib/template.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const read = (out, p) => readFileSync(join(out, p), 'utf8')

function freshOut() {
  return mkdtempSync(join(tmpdir(), 'tralebot-site-'))
}

test('front matter subset parses scalars, lists and booleans', () => {
  const { data, body } = parseFrontmatter('---\ntitle: "A: b"\norder: 20\ndraft: true\nrelated: [x, y]\n---\nBody')
  assert.deepEqual(data, { title: 'A: b', order: 20, draft: true, related: ['x', 'y'] })
  assert.equal(body, 'Body')
})

test('markGeorgian wraps Georgian text nodes but never tags', () => {
  const html = markGeorgian('<a href="/x">კაცი</a> и დედა, მამა')
  assert.equal(html, '<a href="/x"><span lang="ka">კაცი</span></a> и <span lang="ka">დედა, მამა</span>')
})

test('builds real content: text in HTML source, unique meta, canonical, bot button, sitemap', () => {
  const out = freshOut()
  // Simulate a pre-existing mini-app build so we can prove it is left alone.
  mkdirSync(join(out, 'assets'), { recursive: true })
  writeFileSync(join(out, 'index.html'), 'SPA')
  writeFileSync(join(out, 'assets', 'app.js'), 'js')

  const result = build({ outDir: out })
  assert.ok(result.written.includes('/grammar/'))
  assert.ok(result.written.length >= 4, 'hub + at least three pages')

  assert.equal(read(out, 'index.html'), 'SPA', 'mini-app index.html must not be touched')
  assert.equal(read(out, 'assets/app.js'), 'js', 'mini-app assets must not be touched')

  const titles = new Set()
  const descriptions = new Set()
  const config = loadConfig()
  for (const path of result.written) {
    const html = read(out, path + 'index.html')
    const title = html.match(/<title>(.*?)<\/title>/)[1]
    const desc = html.match(/<meta name="description" content="(.*?)" \/>/)[1]
    assert.ok(!titles.has(title), `duplicate title: ${title}`)
    assert.ok(!descriptions.has(desc), `duplicate description: ${desc}`)
    titles.add(title)
    descriptions.add(desc)
    assert.ok(html.includes(`<link rel="canonical" href="${config.baseUrl}${path}" />`), `canonical for ${path}`)
    assert.ok(html.includes(`<meta property="og:url" content="${config.baseUrl}${path}" />`), `og:url for ${path}`)
    assert.ok(html.includes(`https://t.me/${config.botUsername}?start=seo_`), `bot CTA on ${path}`)
    assert.ok(html.includes('<h1>'), `h1 on ${path}`)
    assert.ok(!html.includes('<script src'), 'no external scripts')
    assert.ok(!html.includes('/api/'), 'no API coupling')
    assert.ok(html.includes('application/ld+json'))
  }

  // Real prose is in the source, not a JS placeholder.
  const cases = read(out, 'grammar/cases/index.html')
  assert.match(cases, /<article>[\s\S]*Именительный[\s\S]*<\/article>/)
  assert.ok(cases.includes('<table>'), 'paradigm table is real HTML')
  assert.ok(cases.includes('<span lang="ka">კაცმა</span>'))
  assert.ok(cases.includes('href="/grammar/postpositions/"'), 'internal linking between grammar pages')

  const sitemap = read(out, 'sitemap.xml')
  assert.ok(sitemap.includes(`<loc>${config.baseUrl}/</loc>`))
  assert.ok(sitemap.includes(`<loc>${config.baseUrl}/grammar/</loc>`))
  for (const s of result.sections) {
    for (const p of s.pages) {
      const inSitemap = sitemap.includes(`<loc>${config.baseUrl}${p.path}</loc>`)
      const html = read(out, p.path + 'index.html')
      if (p.draft) {
        assert.ok(!inSitemap, `draft ${p.path} must not be in sitemap`)
        assert.ok(html.includes('content="noindex, nofollow"'), `draft ${p.path} must be noindex`)
      } else {
        assert.ok(inSitemap, `${p.path} must be in sitemap`)
        assert.ok(html.includes('content="index, follow"'))
      }
    }
  }
  rmSync(out, { recursive: true, force: true })
})

test('verification meta tags appear only when configured; static files are copied', () => {
  const out = freshOut()
  const staticDir = mkdtempSync(join(tmpdir(), 'tralebot-static-'))
  writeFileSync(join(staticDir, 'googleabc123.html'), 'google-site-verification: googleabc123.html')
  writeFileSync(join(staticDir, 'README.md'), 'not copied')

  const config = { ...loadConfig(), verification: { google: 'G-TOKEN', yandex: 'Y-TOKEN' } }
  build({ outDir: out, staticDir, config })
  const hub = read(out, 'grammar/index.html')
  assert.ok(hub.includes('<meta name="google-site-verification" content="G-TOKEN" />'))
  assert.ok(hub.includes('<meta name="yandex-verification" content="Y-TOKEN" />'))
  assert.ok(existsSync(join(out, 'googleabc123.html')))
  assert.ok(!existsSync(join(out, 'README.md')))

  const out2 = freshOut()
  build({ outDir: out2, staticDir, config: { ...loadConfig(), verification: { google: '', yandex: '' } } })
  assert.ok(!read(out2, 'grammar/index.html').includes('site-verification'))
  rmSync(out, { recursive: true, force: true })
  rmSync(out2, { recursive: true, force: true })
  rmSync(staticDir, { recursive: true, force: true })
})

test('refuses a section that would shadow an app route', () => {
  const contentDir = mkdtempSync(join(tmpdir(), 'tralebot-content-'))
  mkdirSync(join(contentDir, 'api'))
  writeFileSync(join(contentDir, 'api', '_index.md'), '---\ntitle: x\ndescription: y\n---\n')
  assert.throws(() => build({ outDir: freshOut(), contentDir }), /collides/)
  rmSync(contentDir, { recursive: true, force: true })
})
