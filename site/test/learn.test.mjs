// The English waitlist pages /learn/*: what the form sends is what the server accepts, and the
// pages keep the site's rules (plain HTML, no scripts, honest about what is not built).

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build, loadConfig } from '../build.mjs'
import { LANGUAGES, PLATFORMS } from '../data/learn.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..', '..')
const config = loadConfig()

let out, result
const html = (path) => readFileSync(join(out, path, 'index.html'), 'utf8')

before(() => {
  out = mkdtempSync(join(tmpdir(), 'tralebot-site-learn-'))
  result = build({ outDir: out })
})
after(() => rmSync(out, { recursive: true, force: true }))

/** The string set a C# `new HashSet<string> { ... }` of the given name is initialised with. */
function serverSet(name) {
  const source = readFileSync(join(repo, 'src/Application/Waitlist/JoinWaitlistService.cs'), 'utf8')
  const block = source.match(new RegExp(`${name} =\\s*new HashSet<string> \\{([^}]*)\\}`))
  assert.ok(block, `WaitlistOptions.${name} not found`)
  return [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort()
}

test('the form offers exactly the languages and platforms the server accepts', () => {
  assert.deepEqual(LANGUAGES.map((l) => l.key).sort(), serverSet('Languages'))
  assert.deepEqual(PLATFORMS.map((p) => p.key).sort(), serverSet('Platforms'))
})

test('a page per language, a hub and a thank-you page', () => {
  assert.deepEqual(
    result.learn.map((p) => p.path).sort(),
    ['/learn/', '/learn/thanks/', ...LANGUAGES.map((l) => `/learn/${l.key}/`)].sort()
  )
})

test('language pages: English, a plain form to /waitlist with every field, no scripts', () => {
  const titles = new Set()
  for (const l of LANGUAGES) {
    const h = html(`/learn/${l.key}/`)
    assert.ok(h.includes('<html lang="en">'), `${l.key}: lang`)
    assert.ok(h.includes(`<link rel="canonical" href="${config.baseUrl}/learn/${l.key}/" />`), `${l.key}: canonical`)
    assert.ok(h.includes('<meta name="robots" content="index, follow" />'), `${l.key}: indexable`)
    assert.ok(h.includes('<form method="post" action="/waitlist">'), `${l.key}: form`)
    assert.ok(h.includes(`<input type="hidden" name="lang" value="${l.key}" />`), `${l.key}: language field`)
    assert.ok(/<input[^>]*type="email"[^>]*name="email"[^>]*required/.test(h), `${l.key}: email field`)
    for (const p of PLATFORMS) assert.ok(h.includes(`name="platform" value="${p.key}"`), `${l.key}: platform ${p.key}`)
    assert.ok(h.includes('name="website"'), `${l.key}: trap field`)
    assert.ok(!/<script(?![^>]*application\/ld\+json)/.test(h), `${l.key}: no scripts`)
    assert.ok(!h.includes('/api/'), `${l.key}: no API coupling`)
    assert.ok(!/[а-яё]/i.test(h.replace(/<style[\s\S]*?<\/style>/g, '')), `${l.key}: no Russian on an English page`)
    const title = h.match(/<title>(.*?)<\/title>/)[1]
    assert.ok(!titles.has(title), `duplicate title: ${title}`)
    titles.add(title)
  }
})

test('a language that is not taught yet says so; only Georgian offers the Russian version', () => {
  for (const l of LANGUAGES) {
    const h = html(`/learn/${l.key}/`)
    if (l.live) {
      assert.ok(h.includes(`https://t.me/${config.botUsername}?start=learn_${l.key}_ru`), `${l.key}: link to the Russian version`)
    } else {
      assert.ok(h.includes('Not built yet'), `${l.key}: must say it is not built`)
      assert.ok(!h.includes('t.me/'), `${l.key}: nothing to open in Telegram`)
    }
  }
  assert.deepEqual(LANGUAGES.filter((l) => l.live).map((l) => l.key), ['georgian'])
})

test('the thank-you page is not indexed and not in the sitemap', () => {
  assert.ok(html('/learn/thanks/').includes('<meta name="robots" content="noindex, nofollow" />'))
  const sitemap = readFileSync(join(out, 'sitemap.xml'), 'utf8')
  assert.ok(!sitemap.includes('/learn/thanks/'))
  for (const l of LANGUAGES) assert.ok(sitemap.includes(`<loc>${config.baseUrl}/learn/${l.key}/</loc>`))
})
