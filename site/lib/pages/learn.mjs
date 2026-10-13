// The English pages /learn/, /learn/<language>/ and /learn/thanks/ (definitions in data/learn.mjs).
// Their own layout: English chrome, no Russian navigation, and a form instead of the Telegram button —
// the people these pages are for cannot use the Russian mini-app.

import { CSS, FONTS_HREF, esc } from '../template.mjs'
import { LANGUAGES, PLATFORMS, NOT_BUILT_LEAD } from '../../data/learn.mjs'

const LEARN_CSS = `
body{padding-bottom:0}
.feat{list-style:none;padding:0;margin:0 0 8px;display:grid;gap:12px}
.feat li{padding:14px 16px;background:var(--tile);border:1.5px solid var(--edge);border-radius:14px}
.feat b{display:block;font-size:16px;font-weight:800}
.feat span{display:block;font-size:15px;color:var(--ink-mid);margin-top:2px}
.join{margin:32px 0 8px;padding:22px 20px;background:var(--tile);border:1.5px solid var(--ink);border-radius:16px;box-shadow:4px 4px 0 var(--ink)}
.join h2{margin:0 0 4px;font-size:22px;font-weight:800;letter-spacing:-.02em}
.join p{margin:0 0 16px;color:var(--ink-soft);font-size:15px}
.join fieldset{border:0;padding:0;margin:0 0 16px}
.join legend{font-weight:800;font-size:15px;padding:0;margin-bottom:8px}
.opts{display:flex;flex-wrap:wrap;gap:8px}
.opts label{position:relative;cursor:pointer}
.opts input{position:absolute;opacity:0;inset:0;margin:0;cursor:pointer}
.opts span{display:block;padding:9px 14px;min-height:44px;border:1.5px solid var(--ink);border-radius:999px;background:var(--cream);font-weight:700;font-size:15px;line-height:23px}
.opts input:checked+span{background:var(--gold);box-shadow:2px 2px 0 var(--ink)}
.opts input:focus-visible+span{outline:3px solid var(--navy);outline-offset:2px}
.join label.f{display:block;font-weight:800;font-size:15px;margin-bottom:8px}
.join input[type=email]{width:100%;min-height:48px;padding:10px 14px;border:1.5px solid var(--ink);border-radius:12px;background:#fff;font:inherit;font-size:16px;color:var(--ink)}
.join button{margin-top:16px;width:100%;cursor:pointer;font-family:inherit}
.join .small{margin:12px 0 0;font-size:13px;color:var(--ink-hint)}
.trap{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
.ru-note{margin:20px 0 0;padding:14px 16px;border:1.5px dashed var(--ink-mid);border-radius:14px;font-size:15px}
.ru-note a{font-weight:800}
@media (min-width:720px){.feat{grid-template-columns:1fr 1fr}}
`

function layout({ config, title, description, path, robots, body, jsonLd }) {
  const url = config.baseUrl + path
  const ogImage = config.ogImage ? `<meta property="og:image" content="${esc(config.baseUrl + config.ogImage)}" />` : ''
  const verification = config.verification?.google ? `<meta name="google-site-verification" content="${esc(config.verification.google)}" />\n    ` : ''
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#FBF6EC" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <meta name="robots" content="${robots}" />
    <link rel="canonical" href="${url}" />
    <link rel="icon" href="/favicon.ico" sizes="48x48" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    ${verification}<meta property="og:type" content="website" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:site_name" content="${esc(config.siteName)}" />
    ${ogImage ? ogImage + '\n    ' : ''}<meta name="twitter:card" content="summary" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="${FONTS_HREF}" />
    ${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>\n    ` : ''}<style>${CSS}${LEARN_CSS}</style>
  </head>
  <body>
    <div class="kilim"></div>
    <div class="wrap">
      <header class="top">
        <a class="brand" href="/learn/"><span class="paw" aria-hidden="true">T</span>TraleBot</a>
      </header>
      <main>
${body}
      </main>
      <footer class="bottom">
        <nav><a href="/learn/">All languages</a><a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a></nav>
        <div>© ${new Date().getUTCFullYear()} TraleBot · language courses in short daily sessions</div>
      </footer>
    </div>
  </body>
</html>
`
}

function form(language) {
  const options = PLATFORMS.map(
    (p, i) => `<label><input type="radio" name="platform" value="${p.key}" required${i === 0 ? '' : ''} /><span>${esc(p.label)}</span></label>`
  ).join('')
  return `<section class="join" id="join">
  <h2>Join the waitlist</h2>
  <p>${language.live ? 'Be the first to get the English version.' : `Be the first to learn ${esc(language.name)} with us.`}</p>
  <form method="post" action="/waitlist">
    <input type="hidden" name="lang" value="${language.key}" />
    <div class="trap" aria-hidden="true"><label>Website <input type="text" name="website" tabindex="-1" autocomplete="off" /></label></div>
    <fieldset>
      <legend>Where would you use it?</legend>
      <div class="opts">${options}</div>
    </fieldset>
    <label class="f" for="email">Your email</label>
    <input id="email" type="email" name="email" required maxlength="254" autocomplete="email" placeholder="you@example.com" />
    <button class="tg-btn" type="submit">Join the waitlist</button>
    <p class="small">One email when it opens. No newsletter, no account. See <a href="/privacy.html#waitlist">how we keep your address</a>.</p>
  </form>
</section>`
}

function languagePage(config, language) {
  const path = `/learn/${language.key}/`
  const others = LANGUAGES.filter((l) => l.key !== language.key)
  const lead = language.lead || NOT_BUILT_LEAD(language.name)
  const russian = language.live
    ? `<p class="ru-note">Do you read Russian? The Russian version is open today: <a href="https://t.me/${config.botUsername}?start=learn_${language.key}_ru" rel="noopener">start in Telegram</a>.</p>`
    : ''
  const body = `<article>
  <div class="eyebrow">${language.live ? 'English version · coming' : 'Not built yet · waitlist'}</div>
  <h1>${esc(language.title)}</h1>
  <p class="lead">${esc(lead)}</p>
  <ul class="feat">${language.features.map((f) => `<li><b>${esc(f.t)}</b><span>${esc(f.d)}</span></li>`).join('')}</ul>
</article>
${form(language)}
${russian}
<section class="related"><h2>Other languages</h2><ul class="cards">${others
    .map((l) => `<li><a href="/learn/${l.key}/"><div class="t">${esc(l.name)}</div><div class="d">${l.live ? 'Taught today in Russian. English version: waitlist.' : 'Not built yet. Join the waitlist.'}</div></a></li>`)
    .join('')}</ul></section>`
  return {
    path,
    language: language.key,
    html: layout({
      config,
      title: `${language.title} — ${config.siteName}`,
      description: language.description,
      path,
      robots: 'index, follow',
      body,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: language.title,
        description: language.description,
        inLanguage: 'en',
        url: config.baseUrl + path,
        about: { '@type': 'Language', name: language.name }
      }
    }),
    sitemap: { changefreq: 'monthly', priority: '0.6' }
  }
}

function hubPage(config) {
  const path = '/learn/'
  const title = 'Learn a language in a few minutes a day'
  const description = 'TraleBot teaches Georgian in short daily sessions. Armenian, Azerbaijani, Kazakh and Uzbek may follow: join the waitlist of the language you want.'
  const body = `<article>
  <div class="eyebrow">TraleBot</div>
  <h1>${esc(title)}</h1>
  <p class="lead">We teach Georgian today, in Russian, inside Telegram. An English version is on its way, and other languages may follow. Each one has a waitlist: it is how we decide what to build next.</p>
</article>
<section class="related"><h2>Languages</h2><ul class="cards">${LANGUAGES.map(
    (l) => `<li><a href="/learn/${l.key}/"><div class="t">${esc(l.name)}</div><div class="d">${l.live ? 'Taught today in Russian. English version: waitlist.' : 'Not built yet. Join the waitlist.'}</div></a></li>`
  ).join('')}</ul></section>`
  return {
    path,
    html: layout({ config, title: `${title} — ${config.siteName}`, description, path, robots: 'index, follow', body }),
    sitemap: { changefreq: 'monthly', priority: '0.5' }
  }
}

function thanksPage(config) {
  const path = '/learn/thanks/'
  const body = `<article>
  <div class="eyebrow">TraleBot</div>
  <h1>You are on the list</h1>
  <p class="lead">Thank you. We will write to you once: when the course opens, or when we decide not to build it. Nothing else will come to your address.</p>
  <p><a href="/learn/">← All languages</a></p>
</article>`
  return {
    path,
    html: layout({ config, title: `You are on the list — ${config.siteName}`, description: 'You joined the waitlist.', path, robots: 'noindex, nofollow', body }),
    draft: true
  }
}

/** Every page of the /learn/ section, ready to write: { path, html, sitemap?, draft? }. */
export function learnPages(config, updated = '') {
  return [hubPage(config), ...LANGUAGES.map((l) => languagePage(config, l)), thanksPage(config)].map((p) => ({ ...p, section: 'learn', updated }))
}
