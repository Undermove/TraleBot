// HTML layout for the static pages. Everything is inlined (CSS, icons) so a page
// is a single self-contained file: no bundle, no JS, no dependency on the mini-app.
// Visual language mirrors the SPA landing (Minankari palette, Manrope + Noto Georgian).

const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Noto+Sans+Georgian:wght@400..900&family=Noto+Serif+Georgian:wght@400..900&display=swap'

const KILIM_SVG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 8' preserveAspectRatio='xMidYMid meet'%3E%3Cg fill='none' stroke='%231B5FB0' stroke-width='1.2'%3E%3Cpath d='M0 4 L4 0 L8 4 L4 8 Z'/%3E%3Cpath d='M8 4 L12 0 L16 4 L12 8 Z' stroke='%23E01A3C'/%3E%3Cpath d='M16 4 L20 0 L24 4 L20 8 Z' stroke='%23F5B820'/%3E%3Cpath d='M24 4 L28 0 L32 4 L28 8 Z'/%3E%3C/g%3E%3C/svg%3E\")"

const CSS = `
:root{--cream:#FBF6EC;--cream-deep:#F5EFE0;--tile:#FDFAEF;--edge:#E8DEC5;--ink:#15100A;--ink-soft:#3A2B1F;--ink-mid:#5A4735;--ink-hint:#7A6B52;--navy:#1B5FB0;--navy-deep:#0E3F7D;--ruby:#E01A3C;--gold:#F5B820;--gold-wash:#F9EAC1;--maxw:720px}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--cream);color:var(--ink);font-family:Manrope,'Noto Sans Georgian',-apple-system,BlinkMacSystemFont,system-ui,sans-serif;line-height:1.6;font-size:16px;-webkit-font-smoothing:antialiased;padding-bottom:96px}
[lang=ka]{font-family:'Noto Sans Georgian',Manrope,sans-serif;font-size:1.06em}
a{color:var(--navy)}
a:hover{color:var(--navy-deep)}
.kilim{height:8px;background-image:${KILIM_SVG};background-repeat:repeat-x;background-size:32px 8px}
.wrap{max-width:var(--maxw);margin:0 auto;padding-inline:20px}
header.top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-block:14px}
.brand{display:inline-flex;align-items:center;gap:8px;font-weight:800;font-size:18px;letter-spacing:-.02em;color:var(--ink);text-decoration:none}
.brand .paw{display:inline-grid;place-items:center;width:28px;height:28px;border:1.5px solid var(--ink);border-radius:8px;background:var(--gold);font-size:15px;font-weight:800;box-shadow:2px 2px 0 var(--ink)}
.top-nav{display:flex;align-items:center;gap:14px;font-size:14px;font-weight:600}
.top-nav a{color:var(--ink-mid);text-decoration:none}
.top-nav a:hover{color:var(--ink)}
.tg-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 18px;min-height:48px;border:1.5px solid var(--ink);border-radius:12px;background:var(--navy);color:var(--cream);font-weight:800;font-size:15px;text-decoration:none;box-shadow:3px 3px 0 var(--ink);transition:transform .08s ease,box-shadow .08s ease;white-space:nowrap}
.tg-btn:hover{color:var(--cream);transform:translate(1px,1px);box-shadow:2px 2px 0 var(--ink)}
.tg-btn:active{transform:translate(3px,3px);box-shadow:0 0 0 var(--ink)}
.tg-btn svg{width:18px;height:18px;flex:none}
.tg-btn.compact{min-height:44px;padding:8px 14px;font-size:14px;box-shadow:2px 2px 0 var(--ink)}
.crumbs{font-size:13px;color:var(--ink-hint);margin:8px 0 20px}
.crumbs ol{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px}
.crumbs li+li::before{content:'›';margin-right:6px;color:var(--ink-hint)}
.crumbs a{color:var(--ink-mid);text-decoration:none}
.eyebrow{font-weight:700;text-transform:uppercase;letter-spacing:.14em;font-size:11px;color:var(--ink-mid)}
h1{font-size:32px;line-height:1.1;letter-spacing:-.02em;font-weight:800;margin:6px 0 12px}
.lead{font-size:17px;color:var(--ink-soft);margin:0 0 28px}
article h2{font-size:22px;line-height:1.2;letter-spacing:-.02em;font-weight:800;margin:36px 0 12px;padding-top:8px}
article h3{font-size:18px;font-weight:800;margin:26px 0 8px}
article p{margin:0 0 14px}
article ul,article ol{padding-left:22px;margin:0 0 14px}
article li{margin:4px 0}
article blockquote{margin:16px 0;padding:12px 16px;background:var(--tile);border:1.5px solid var(--ink);border-radius:14px;box-shadow:3px 3px 0 var(--ink)}
article blockquote p{margin:0}
article blockquote p+p{margin-top:6px;color:var(--ink-mid);font-size:15px}
.table-wrap{overflow-x:auto;margin:16px 0 20px;border:1.5px solid var(--ink);border-radius:14px;background:var(--tile);box-shadow:3px 3px 0 var(--ink)}
table{border-collapse:collapse;width:100%;min-width:420px;font-size:15px}
th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--edge);vertical-align:top}
th{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-mid);background:var(--cream-deep)}
tr:last-child td{border-bottom:0}
code{font-family:inherit;background:var(--gold-wash);padding:1px 6px;border-radius:6px}
hr{border:0;border-top:1.5px dashed var(--edge);margin:32px 0}
.draft-note{font-size:13px;color:var(--ink-hint);background:var(--cream-deep);border:1px dashed var(--edge);border-radius:10px;padding:8px 12px;margin:0 0 20px}
.cta{margin:40px 0 8px;padding:22px 20px;background:var(--tile);border:1.5px solid var(--ink);border-radius:16px;box-shadow:4px 4px 0 var(--ink);text-align:center}
.cta h2{margin:0 0 6px;font-size:20px;padding:0}
.cta p{margin:0 0 16px;color:var(--ink-soft);font-size:15px}
.cta .tg-btn{width:100%;max-width:320px}
.related{margin-top:36px}
.related h2{font-size:18px;margin:0 0 12px}
.cards{list-style:none;padding:0;margin:0;display:grid;gap:12px}
.cards a{display:block;padding:14px 16px;background:var(--tile);border:1.5px solid var(--ink);border-radius:14px;box-shadow:3px 3px 0 var(--ink);text-decoration:none;color:var(--ink);transition:transform .08s ease,box-shadow .08s ease}
.cards a:hover{transform:translate(1px,1px);box-shadow:2px 2px 0 var(--ink)}
.cards .t{font-weight:800;font-size:16px;line-height:1.25}
.cards .d{font-size:14px;color:var(--ink-mid);margin-top:4px}
footer.bottom{margin-top:48px;padding-block:24px 8px;border-top:1.5px solid var(--edge);font-size:13px;color:var(--ink-hint)}
footer.bottom nav{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:8px}
footer.bottom a{color:var(--ink-mid);text-decoration:none}
.sticky-cta{position:fixed;left:0;right:0;bottom:0;padding:10px 16px calc(10px + env(safe-area-inset-bottom,0px));background:rgba(251,246,236,.92);backdrop-filter:blur(8px);border-top:1.5px solid var(--edge);display:flex;justify-content:center}
.sticky-cta .tg-btn{width:100%;max-width:360px}
.sub{font-size:17px;color:var(--ink-soft);margin:0 0 14px}
.sub b{font-weight:800;color:var(--ink)}
.tr{color:var(--ink-mid);font-size:.92em}
.term{color:var(--ink-hint);font-size:13px;font-weight:500;letter-spacing:0;text-transform:none}
.chip{display:inline-block;padding:1px 8px;border:1px solid var(--edge);border-radius:999px;background:var(--cream-deep);font-size:12px;font-weight:600;color:var(--ink-mid);vertical-align:middle;white-space:nowrap}
.jump{display:flex;flex-wrap:nowrap;overflow-x:auto;gap:6px;margin:0 -20px 16px;padding:0 20px 4px;white-space:nowrap;scrollbar-width:none;list-style:none;font-size:13px;font-weight:700}
.jump a{display:block;padding:5px 10px;border:1.5px solid var(--ink);border-radius:999px;background:var(--tile);color:var(--ink);text-decoration:none}
.jump a:hover{background:var(--gold-wash)}
.tenses{display:grid;gap:14px;margin:0 0 8px}
.tense{border:1.5px solid var(--ink);border-radius:14px;background:var(--tile);box-shadow:3px 3px 0 var(--ink);overflow:hidden}
.tense h3,.tense h4{margin:0;padding:9px 12px 8px;font-size:15px;line-height:1.25;font-weight:800;background:var(--cream-deep);border-bottom:1px solid var(--edge)}
.tense h3 .term,.tense h4 .term{display:block;margin-top:1px}
table.forms{min-width:0;font-size:15px}
table.forms td{padding:7px 12px;line-height:1.3}
table.forms td:first-child{color:var(--ink-mid);width:46%}
table.forms .f,table.ref .f{font-weight:700;font-size:1.1em}
table.forms .tr,table.ref .tr{display:block}
table.ref{min-width:0}
table.ref td:first-child{width:44%}
table.wide{min-width:0}
table.wide td,table.wide th{padding:8px 9px}
table.wide td:first-child{width:auto}
table.wide .f{font-size:1em}
table.c4{min-width:500px}
.say{margin:0 0 8px}
.say dt{font-weight:700;margin-top:12px}
.say dd{margin:2px 0 0}
.inline-cta{margin:18px 0 6px;padding:14px 16px;border:1.5px dashed var(--ink-mid);border-radius:14px;font-size:15px}
.inline-cta a{font-weight:800}
details{margin:12px 0;border:1.5px solid var(--edge);border-radius:14px;background:var(--tile)}
details>summary{cursor:pointer;padding:12px 14px;font-weight:800;font-size:15px}
details>.in{padding:0 12px 12px}
details .tenses{margin-top:4px}
.ex{margin:12px 0;padding:10px 14px;background:var(--tile);border:1.5px solid var(--edge);border-radius:14px}
.ex p{margin:0}
.ex .k{font-size:17px;font-weight:700}
.ex .r{margin-top:4px}
.ex .src{font-size:12px;color:var(--ink-hint);margin-top:4px}
.ex .src a{color:var(--ink-hint)}
.sources{font-size:13px;color:var(--ink-hint);margin-top:28px}
.sources a{color:var(--ink-mid)}
.vlist{list-style:none;margin:0 0 14px;padding:0;display:flex;flex-wrap:wrap;gap:6px 8px}
.vlist a{display:inline-block;padding:4px 10px;border:1px solid var(--edge);border-radius:10px;background:var(--tile);text-decoration:none;font-size:14px;color:var(--ink)}
.vlist a:hover{border-color:var(--ink)}
.az{font-size:15px}
.az b{display:inline-block;min-width:1.4em}
@media (min-width:720px){.tenses{grid-template-columns:1fr 1fr}}
@media (min-width:720px){body{padding-bottom:0}.sticky-cta{display:none}h1{font-size:40px}.cards{grid-template-columns:1fr 1fr}}
@media (max-width:640px){.top-nav .hide-sm{display:none}h1{font-size:26px}.sub,.lead{font-size:16px}}
`

const TG_ICON =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.9 4.3c.3-1.2-.9-2.2-2-1.7L2.6 9.5c-1.3.5-1.2 2.3.1 2.7l4.4 1.4 1.7 5.4c.3 1 1.6 1.3 2.3.5l2.5-2.5 4.6 3.4c.9.7 2.2.2 2.4-.9l3.3-14.2ZM9 13.4l8.8-6.7c.2-.1.4.1.2.3l-7.2 6.9-.3 3.9L9 13.4Z"/></svg>'

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function botLink(config, tag) {
  const safe = String(tag || 'site').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64)
  return `https://t.me/${config.botUsername}?start=${safe}`
}

const DEFAULT_NAV = [{ path: '/grammar/', label: 'Грамматика' }]
/** Section hubs for the header and the footer: every page links to every hub. */
function navLinks(config, cls = '') {
  return (config.nav || DEFAULT_NAV).map((n) => `<a${cls ? ` class="${cls}"` : ''} href="${n.path}">${esc(n.label)}</a>`).join('')
}

function tgButton(config, tag, label, extraClass = '') {
  return `<a class="tg-btn ${extraClass}" href="${botLink(config, tag)}" target="_blank" rel="noopener">${TG_ICON}<span>${esc(label)}</span></a>`
}

/**
 * Wraps runs of Georgian script in <span lang="ka"> so the Georgian font stack
 * applies. Operates on text nodes only (never inside tags).
 */
export function markGeorgian(html) {
  return html
    .split(/(<[^>]+>)/)
    .map((part) => (part.startsWith('<') ? part : part.replace(/[Ⴀ-ჿ][Ⴀ-ჿ\s,.!?;:«»„“…-]*[Ⴀ-ჿ]|[Ⴀ-ჿ]/g, (m) => `<span lang="ka">${m}</span>`)))
    .join('')
}

/** Georgian text in the Georgian font stack. `cls` marks verb forms (class "f") for the tests. */
export function ka(text, cls = '') {
  return `<span lang="ka"${cls ? ` class="${cls}"` : ''}>${esc(text)}</span>`
}

export function renderLayout({ config, title, description, path, robots, ogType, jsonLd, body, ctaTag, breadcrumbs, updated }) {
  const url = config.baseUrl + path
  const verification = [
    config.verification?.google ? `<meta name="google-site-verification" content="${esc(config.verification.google)}" />` : '',
    config.verification?.yandex ? `<meta name="yandex-verification" content="${esc(config.verification.yandex)}" />` : ''
  ]
    .filter(Boolean)
    .join('\n    ')
  const ogImage = config.ogImage ? `<meta property="og:image" content="${esc(config.ogImage.startsWith('http') ? config.ogImage : config.baseUrl + config.ogImage)}" />` : ''
  const crumbs = breadcrumbs?.length
    ? `<nav class="crumbs" aria-label="Навигация"><ol>${breadcrumbs
        .map((c, i) => (i === breadcrumbs.length - 1 ? `<li aria-current="page">${esc(c.title)}</li>` : `<li><a href="${c.path}">${esc(c.title)}</a></li>`))
        .join('')}</ol></nav>`
    : ''

  return `<!doctype html>
<html lang="${config.language}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#FBF6EC" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <meta name="robots" content="${robots}" />
    <link rel="canonical" href="${url}" />
    ${verification ? verification + '\n    ' : ''}<meta property="og:type" content="${ogType}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:locale" content="${config.locale}" />
    <meta property="og:site_name" content="${esc(config.siteName)}" />
    ${ogImage ? ogImage + '\n    ' : ''}<meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="${FONTS_HREF}" />
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
    <style>${CSS}</style>
  </head>
  <body>
    <div class="kilim"></div>
    <div class="wrap">
      <header class="top">
        <a class="brand" href="/"><span class="paw" aria-hidden="true">T</span>TraleBot</a>
        <nav class="top-nav" aria-label="Разделы">
          ${navLinks(config, 'hide-sm')}
          ${tgButton(config, ctaTag, 'Открыть в Telegram', 'compact')}
        </nav>
      </header>
      ${crumbs}
      <main>
${body}
      </main>
      <footer class="bottom">
        <nav><a href="/">Главная</a>${navLinks(config)}<a href="/privacy.html">Конфиденциальность</a><a href="/terms.html">Условия</a><a href="https://t.me/${config.botUsername}" rel="noopener">@${config.botUsername}</a></nav>
        <div>© ${new Date().getUTCFullYear()} TraleBot · бот и мини-апп для изучения грузинского языка${updated ? ` · обновлено ${esc(updated)}` : ''}</div>
      </footer>
    </div>
    <div class="sticky-cta">${tgButton(config, ctaTag, 'Открыть в Telegram')}</div>
  </body>
</html>
`
}

export function renderCta(config, tag, { heading, text }) {
  return `<section class="cta">
  <h2>${esc(heading)}</h2>
  <p>${esc(text)}</p>
  ${tgButton(config, tag, 'Открыть в Telegram')}
</section>`
}

export function renderCards(pages) {
  if (!pages.length) return ''
  return `<ul class="cards">${pages
    .map((p) => `<li><a href="${p.path}"><div class="t">${esc(p.title)}</div><div class="d">${esc(p.description)}</div></a></li>`)
    .join('')}</ul>`
}
