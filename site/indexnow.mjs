#!/usr/bin/env node
// IndexNow: tells Yandex and Bing which URLs are new or changed, so they are crawled within
// hours instead of waiting for the next sitemap visit. Run AFTER the deploy is live:
//
//   cd site && node indexnow.mjs                 → submits every URL of https://tralebot.com/sitemap.xml
//   node indexnow.mjs --dry-run                  → prints what would be sent
//   node indexnow.mjs --sitemap ../src/Trale/wwwroot/sitemap.xml   → URLs from a local build
//   node indexnow.mjs --only /verbs/             → only URLs whose path starts with the prefix
//
// The key is public by design: static/<key>.txt is served from the site root and proves that the
// sender controls the host. Google does not take part in IndexNow — for Google the sitemap is enough.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const config = JSON.parse(readFileSync(join(here, 'site.config.json'), 'utf8'))
const ENDPOINTS = ['https://api.indexnow.org/indexnow', 'https://yandex.com/indexnow']

export const urlsFromSitemap = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim())

export function payload(urls, cfg = config) {
  const host = new URL(cfg.baseUrl).host
  return { host, key: cfg.indexNowKey, keyLocation: `${cfg.baseUrl}/${cfg.indexNowKey}.txt`, urlList: urls.filter((u) => new URL(u).host === host) }
}

async function main() {
  const arg = (name) => { const i = process.argv.indexOf(name); return i === -1 ? undefined : process.argv[i + 1] }
  const dry = process.argv.includes('--dry-run')
  const source = arg('--sitemap') || `${config.baseUrl}/sitemap.xml`
  const only = arg('--only')
  if (!config.indexNowKey) throw new Error('indexNowKey is missing in site.config.json')

  const xml = /^https?:/.test(source) ? await (await fetch(source)).text() : readFileSync(source, 'utf8')
  let urls = urlsFromSitemap(xml)
  if (only) urls = urls.filter((u) => new URL(u).pathname.startsWith(only))
  if (!urls.length) throw new Error(`no URLs found in ${source}`)
  const body = payload(urls)
  console.log(`indexnow: ${body.urlList.length} URLs from ${source}, key file ${body.keyLocation}`)
  if (dry) { console.log(body.urlList.join('\n')); return }

  const keyCheck = await fetch(body.keyLocation)
  if (!keyCheck.ok || (await keyCheck.text()).trim() !== config.indexNowKey) {
    throw new Error(`the key file is not live at ${body.keyLocation} (HTTP ${keyCheck.status}) — deploy first, then run again`)
  }
  let failed = false
  for (const endpoint of ENDPOINTS) {
    const res = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(body) })
    // 200 = accepted, 202 = accepted, key will be checked later; anything else is a refusal.
    console.log(`  ${endpoint} → HTTP ${res.status}${res.ok ? '' : ' ' + (await res.text()).slice(0, 200)}`)
    if (!res.ok) failed = true
  }
  if (failed) process.exitCode = 1
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main().catch((e) => { console.error('indexnow: ' + e.message); process.exit(1) })
