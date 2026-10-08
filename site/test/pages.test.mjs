// Quality gates for the data-driven pages (/verbs/, /phrases/, /words/, generated /grammar/ pages).
// One real build into a temp dir, then every claim the pages make is checked against the data.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, readdirSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build, loadConfig, DATA_FILES, SLUG_LOCK } from '../build.mjs'
import { slugRule, allForms, cyr, CYR_TABLE, TENSES } from '../lib/data/verbs.mjs'
import { urlsFromSitemap, payload } from '../indexnow.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..', '..')
const config = loadConfig()
const catalog = JSON.parse(readFileSync(join(repo, DATA_FILES.verbs), 'utf8')).verbs
const lock = JSON.parse(readFileSync(SLUG_LOCK, 'utf8'))

let out, result
const html = (path) => readFileSync(join(out, path, 'index.html'), 'utf8')
const GEORGIAN = /[ა-ჿ]+/g
/** Text of the page without tags, scripts and styles. */
const text = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ')
const mainOf = (h) => h.slice(h.indexOf('<main>'), h.indexOf('</main>'))
/** The page's own content, without the cards that quote other pages' descriptions. */
const articleOf = (h) => h.slice(h.indexOf('<article>'), h.indexOf('</article>'))

before(() => {
  out = mkdtempSync(join(tmpdir(), 'tralebot-site-pages-'))
  result = build({ outDir: out })
})
after(() => rmSync(out, { recursive: true, force: true }))

const generated = () => result.pages.filter((p) => p.md === undefined && !p.handWritten)
const verbPages = () => result.pages.filter((p) => p.section === 'verbs' && !p.hub)

test('every verb of the catalog has exactly one page, and nothing else lives in /verbs/', () => {
  assert.equal(verbPages().length, catalog.length)
  const dirs = readdirSync(join(out, 'verbs')).filter((f) => statSync(join(out, 'verbs', f)).isDirectory())
  assert.equal(dirs.length, catalog.length)
  for (const v of catalog) {
    const matches = result.verbs.filter((x) => x.lemma === v.lemma)
    assert.equal(matches.length, 1, v.lemma)
    assert.ok(dirs.includes(matches[0].slug), `no page for ${v.lemma}`)
  }
})

test('slug rule: <first Russian gloss>-<Georgian dictionary form>, both romanised', () => {
  assert.equal(slugRule({ lemma: 'მიდის', ru: 'идти, уходить' }), 'idti-midis')
  assert.equal(slugRule({ lemma: 'სწერს', ru: 'писать (кому-то)' }), 'pisat-stsers')
  assert.equal(slugRule({ lemma: 'ჰყავს', ru: 'иметь (кого-то)' }), 'imet-hqavs')
  assert.equal(slugRule({ lemma: 'უნდა', ru: 'хотеть' }), 'khotet-unda')
  assert.equal(slugRule({ lemma: 'ჭამს', ru: 'есть, кушать' }), 'est-chams')
})

test('slugs are unique and frozen: the lock has every verb, and pages use the lock', () => {
  const slugs = Object.values(lock)
  assert.equal(new Set(slugs).size, slugs.length, 'duplicate slug in data/verb-slugs.json')
  for (const v of result.verbs) {
    assert.ok(lock[v.lemma], `${v.lemma} is not in data/verb-slugs.json — run "npm run lock-slugs" and commit the file`)
    assert.equal(v.slug, lock[v.lemma], 'a shipped slug must never change')
    assert.match(v.slug, /^[a-z0-9]+(-[a-z0-9]+)+$/)
    assert.ok(`seo_verbs_${v.slug}`.length <= 64, 'Telegram start parameter is at most 64 characters')
  }
  // Slugs shipped on 2026-10-06. If one of these fails, a URL that search engines already know has moved.
  const shipped = { არის: 'byt-aris', მიდის: 'idti-midis', უნდა: 'khotet-unda', აკეთებს: 'delat-aketebs', წერს: 'pisat-tsers', ჰყავს: 'imet-hqavs', აჩვენებს: 'pokazyvat-achvenebs', ანახებს: 'pokazyvat-anakhebs' }
  for (const [lemma, slug] of Object.entries(shipped)) assert.equal(lock[lemma], slug)
})

test('every page: unique title, description and canonical; h1; bot link with its own tag; no JS, no API', () => {
  const seen = { title: new Map(), description: new Map(), canonical: new Map() }
  for (const p of result.pages) {
    const h = html(p.path)
    const got = {
      title: h.match(/<title>(.*?)<\/title>/)[1],
      description: h.match(/<meta name="description" content="(.*?)" \/>/)[1],
      canonical: h.match(/<link rel="canonical" href="(.*?)" \/>/)[1]
    }
    for (const k of Object.keys(seen)) {
      assert.ok(got[k].length > 10, `${k} on ${p.path}`)
      assert.ok(!seen[k].has(got[k]), `duplicate ${k}: ${p.path} and ${seen[k].get(got[k])}`)
      seen[k].set(got[k], p.path)
    }
    assert.equal(got.canonical, config.baseUrl + p.path)
    assert.equal((h.match(/<h1>/g) || []).length, 1, `exactly one h1 on ${p.path}`)
    assert.ok(h.includes(`https://t.me/${config.botUsername}?start=${p.ctaTag}"`), `bot link with tag ${p.ctaTag} on ${p.path}`)
    assert.match(p.ctaTag, /^seo_[a-z]+_[a-z0-9-]+$/)
    assert.ok(!/<script(?! type="application\/ld\+json")/.test(h), `no scripts on ${p.path}`)
    assert.ok(!h.includes('/api/'), 'no API coupling')
    assert.ok(h.includes('<meta property="og:image"'), 'og:image')
    for (const m of h.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)) JSON.parse(m[1])
  }
})

test('verb pages: every Georgian form is a form of that verb in verbs.json', () => {
  for (const v of result.verbs) {
    const forms = allForms(v)
    const h = mainOf(html(v.path))
    const cells = [...h.matchAll(/<span lang="ka" class="f">(.*?)<\/span>/g)].map((m) => m[1])
    assert.ok(cells.length >= 6, `${v.path} shows forms`)
    for (const c of cells) for (const f of c.split(' / ')) assert.ok(forms.has(f), `${v.path}: «${f}» is not a form of ${v.lemma}`)
    // and the page shows all six persons of the present
    for (const variants of v.tenses.present) for (const f of variants) assert.ok(h.includes(f), `${v.path} lacks ${f}`)
  }
})

test('generated pages: every Georgian word exists in the repo data (catalog, lesson theory, lessons)', () => {
  const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]))
  const sources = [join(repo, DATA_FILES.verbs), join(repo, DATA_FILES.theory), ...walk(join(repo, DATA_FILES.lessons)).filter((f) => f.endsWith('.json'))]
  const known = new Set()
  for (const f of sources) for (const w of readFileSync(f, 'utf8').match(GEORGIAN) || []) known.add(w)
  for (const p of generated()) {
    for (const w of text(mainOf(html(p.path))).match(GEORGIAN) || []) assert.ok(known.has(w), `${p.path}: «${w}» is not in the repo data`)
  }
})

test('verb pages: example sentences are the catalog\'s Tatoeba sentences, each linked by id', () => {
  let withExamples = 0
  for (const v of result.verbs) {
    const h = html(v.path)
    const ids = [...h.matchAll(/https:\/\/tatoeba\.org\/sentences\/show\/(\d+)/g)].map((m) => Number(m[1]))
    assert.ok(ids.length <= 5)
    assert.equal(ids.length, Math.min(5, v.sentences.length), `${v.path}: 3–5 examples when the catalog has them`)
    for (const id of ids) {
      const s = v.sentences.find((x) => x.id === id)
      assert.ok(s, `${v.path}: sentence ${id} is not in the catalog for this verb`)
      assert.ok(h.includes(s.ka) && h.includes(s.ru.replace(/&/g, '&amp;').replace(/"/g, '&quot;')), `${v.path}: text of sentence ${id}`)
    }
    if (ids.length) { withExamples++; assert.ok(h.includes('CC BY 2.0 FR'), 'Tatoeba licence') }
    assert.ok(h.includes('CC BY-SA 4.0') && h.includes(v.source.replace(/&/g, '&amp;')), `${v.path}: Wiktionary attribution with the entry link`)
  }
  assert.ok(withExamples > 90)
})

test('textbook terms appear only in the secondary spot (class "term"), never as labels', () => {
  const TERMS = /аорист|имперфект|оптатив|конъюнктив|перфект|масдар|преверб|эргатив|наклонени/i
  const termWords = new Set(Object.values(TENSES).map((t) => t.term))
  for (const p of generated()) {
    const h = html(p.path)
    const outside = text(articleOf(h).replace(/<span class="term">.*?<\/span>/g, ' '))
    assert.ok(!TERMS.test(outside), `${p.path}: a textbook term outside <span class="term">: «${outside.match(TERMS)?.[0]}»`)
    assert.ok(!TERMS.test(p.title + p.h1 + p.description), `${p.path}: a textbook term in title/h1/description`)
    for (const m of mainOf(h).matchAll(/<span class="term">в учебниках — (.*?)<\/span>/g)) assert.ok(termWords.has(m[1]) || m[1] === 'масдар', `unknown term «${m[1]}»`)
  }
})

test('transcription is Cyrillic only and follows the mini-app rule', () => {
  assert.equal(cyr('მივდივარ'), 'мивдивар')
  assert.equal(cyr('წერს'), 'ц’эрс')
  const types = readFileSync(join(repo, 'src/Trale/miniapp-src/src/verbs/types.ts'), 'utf8')
  for (const [ka, ru] of Object.entries(CYR_TABLE)) assert.ok(types.includes(`${ka}: '${ru}'`), `cyr() differs from the mini-app for ${ka}`)
  for (const [key, t] of Object.entries(TENSES)) assert.ok(types.includes(`${key}: { name: '${t.name}', term: '${t.term}' }`), `TENSES.${key} differs from the mini-app`)
  for (const p of generated()) {
    const h = mainOf(html(p.path))
    for (const m of h.matchAll(/<(?:span|p) class="tr">(.*?)<\/(?:span|p)>/g)) {
      const t = m[1].replace(/<[^>]+>/g, '')
      assert.ok(!/[A-Za-z]/.test(t), `${p.path}: Latin letters in a transcription: «${t}»`)
    }
    assert.ok(!/\([a-z]+(-[a-z]+)+\)/.test(text(h)), `${p.path}: Latin syllable transcription left in the text`)
  }
})

test('no empty tables, no empty cells, no emoji', () => {
  for (const p of generated()) {
    const h = mainOf(html(p.path))
    for (const t of h.matchAll(/<table[\s\S]*?<\/table>/g)) {
      const rows = [...t[0].matchAll(/<tbody>([\s\S]*?)<\/tbody>/g)].flatMap((b) => [...b[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)])
      assert.ok(rows.length > 0, `${p.path}: empty table`)
      for (const r of rows) for (const c of r[1].matchAll(/<td>([\s\S]*?)<\/td>/g)) assert.ok(text(c[1]).trim().length > 0, `${p.path}: empty cell`)
    }
    assert.ok(!/<details>\s*<summary>[^<]*<\/summary>\s*<div class="in">\s*<\/div>/.test(h), `${p.path}: empty details`)
    assert.ok(!/\p{Extended_Pictographic}/u.test(text(h)) && !html(p.path).includes('class="paw">🐶'), `${p.path}: emoji`)
  }
  for (const v of result.verbs) assert.ok((mainOf(html(v.path)).match(/<section class="tense"/g) || []).length >= 2, `${v.path}: at least two times`)
})

test('sitemap lists every indexable page exactly once, with lastmod', () => {
  const xml = readFileSync(join(out, 'sitemap.xml'), 'utf8')
  const urls = urlsFromSitemap(xml)
  assert.equal(new Set(urls).size, urls.length, 'duplicate URL in sitemap')
  const pages = result.pages.filter((p) => !p.draft)
  for (const p of pages) {
    assert.ok(urls.includes(config.baseUrl + p.path), `${p.path} is missing from sitemap`)
    assert.match(p.updated, /^\d{4}-\d{2}-\d{2}$/, `${p.path} has no lastmod`)
  }
  assert.equal(urls.length, pages.length + config.extraSitemapUrls.length)
  assert.equal((xml.match(/<lastmod>/g) || []).length, pages.length)
})

test('internal links: none is broken; every page is one click from its hub and links to 3+ other pages; hubs are on every page', () => {
  const paths = new Set(result.pages.map((p) => p.path))
  const hubs = result.pages.filter((p) => p.hub)
  assert.deepEqual(hubs.map((h) => h.path).sort(), ['/grammar/', '/phrases/', '/verbs/', '/words/'])
  const hubLinks = new Map(hubs.map((hub) => [hub.section, new Set([...mainOf(html(hub.path)).matchAll(/href="(\/[^"#]*)"/g)].map((m) => m[1]))]))
  for (const p of result.pages) {
    const h = html(p.path)
    const links = [...h.matchAll(/href="(\/[^"#]*)"/g)].map((m) => m[1])
    // A link to a static file (the site icon) is fine as long as the file is really in the build.
    for (const l of links) assert.ok(paths.has(l) || ['/', '/privacy.html', '/terms.html'].includes(l) || existsSync(join(out, l)), `${p.path}: broken link ${l}`)
    for (const hub of hubs) assert.ok(links.includes(hub.path), `${p.path} does not link to ${hub.path}`)
    if (!p.hub) {
      assert.ok(hubLinks.get(p.section).has(p.path), `${p.path} is not linked from its hub`)
      const inMain = new Set([...mainOf(h).matchAll(/href="(\/[^"#]*)"/g)].map((m) => m[1]).filter((l) => l !== p.path && !hubs.some((x) => x.path === l)))
      assert.ok(inMain.size >= 3 || p.md !== undefined, `${p.path}: only ${inMain.size} links to related pages`)
    }
  }
  // The home page (SPA shell) exposes the hubs to crawlers without JavaScript.
  const shell = readFileSync(join(repo, 'src/Trale/miniapp-src/index.html'), 'utf8')
  const noscript = shell.slice(shell.indexOf('<noscript>'), shell.indexOf('</noscript>'))
  for (const hub of hubs) assert.ok(noscript.includes(`href="${hub.path}"`), `home page <noscript> lacks ${hub.path}`)
})

test('phrase and word pages: every row has Georgian, a translation and a transcription', () => {
  const pages = result.pages.filter((p) => ['phrases', 'words'].includes(p.section) && !p.hub)
  assert.equal(pages.length, 12)
  for (const p of pages) {
    const h = mainOf(html(p.path))
    const rows = [...h.matchAll(/<tr><td>([^<]+)<\/td><td><span lang="ka" class="f">([^<]+)<\/span> <span class="tr">([^<]+)<\/span><\/td><\/tr>/g)]
    assert.ok(rows.length >= 7, `${p.path}: ${rows.length} rows`)
    for (const [, ru, ka, tr] of rows) {
      assert.match(ru, /[А-Яа-яё0-9]/)
      assert.equal(tr, cyr(ka).replace(/&/g, '&amp;'))
    }
  }
  // «В названиях от понедельника до четверга слышны числа от двух до пяти» — check it on the data.
  const rowsOf = (path) => [...mainOf(html(path)).matchAll(/<tr><td>([^<]+)<\/td><td><span lang="ka" class="f">([^<]+)<\/span>/g)].map((m) => [m[1].toLowerCase(), m[2]])
  const numbers = new Map(rowsOf('/words/numbers/').map(([ru, ka]) => [ru.replace(/\s*\(.*/, ''), ka]))
  const days = new Map(rowsOf('/words/days/'))
  for (const [day, n] of [['понедельник', 'два'], ['вторник', 'три'], ['среда', 'четыре'], ['четверг', 'пять']]) {
    assert.ok(days.get(day).startsWith(numbers.get(n).replace(/ი$/, '')), `${day} / ${n}`)
  }
})

test('IndexNow: key file is published and the payload covers the sitemap', () => {
  assert.match(config.indexNowKey, /^[a-f0-9]{32}$/)
  assert.equal(readFileSync(join(out, `${config.indexNowKey}.txt`), 'utf8'), config.indexNowKey)
  const urls = urlsFromSitemap(readFileSync(join(out, 'sitemap.xml'), 'utf8'))
  const body = payload([...urls, 'https://example.com/x'])
  assert.equal(body.host, 'tralebot.com')
  assert.equal(body.keyLocation, `https://tralebot.com/${config.indexNowKey}.txt`)
  assert.equal(body.urlList.length, urls.length)
})

test('size budget (reported)', () => {
  const sizes = result.pages.map((p) => [p.path, Buffer.byteLength(html(p.path))]).sort((a, b) => b[1] - a[1])
  const total = sizes.reduce((n, s) => n + s[1], 0)
  const bySection = {}
  for (const p of result.pages) bySection[p.section] = (bySection[p.section] || 0) + 1
  console.log(`site size: ${result.pages.length} pages ${JSON.stringify(bySection)}, ${(total / 1024 / 1024).toFixed(2)} MB of HTML, average ${(total / sizes.length / 1024).toFixed(1)} KB, largest ${sizes[0][0]} ${(sizes[0][1] / 1024).toFixed(1)} KB`)
  assert.ok(sizes[0][1] < 150 * 1024, `largest page ${sizes[0][0]} is ${sizes[0][1]} bytes`)
  assert.ok(total < 15 * 1024 * 1024)
})
