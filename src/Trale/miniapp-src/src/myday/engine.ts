// @ts-nocheck — движок перенесён из прототипа «Мой день» (v2): рисует DOM сам, внутри корня .md (myday.css).
// Тридцать уроков по 3–4 шага: утро, день, вечер, еда, дом, выходные, «как часто», про Нино; урок 15 — рассказ про утро, 30 — финал. Каждый урок, кроме первого, начинается с разминки на том, что уже было,
// новое даётся маленькой порцией, а в конце смешивается со старым — сложность растёт ступеньками.
// Перед шагом — его название крупно, первый ход новой механики показывает «рука», объяснения приходят
// подсказками по одной у нужного элемента.
// Всё перетаскивается пальцем, тап — тоже ход. Записи — public/audio/myday/<id>.m4a (ElevenLabs «Alice»,
// eleven_v4, ka). Вибрация и выключатель звука — общие с играми алфавита (alphabet/games/fx).
import { haptic, isMuted, playClip } from '../alphabet/games/fx'
import { ICON, EAR, BACK } from './icons'
import { bomboraBody, bomboraHead, bomboraRig, catBody } from './puppets'

export const MY_DAY_LESSONS = 30

// ───────── Общее: транскрипция, звук, вибрация ─────────
// Транскрипция — та же таблица, что cyr() в мини-аппе (verbs/types.ts)
const CYR = { ა: 'а', ბ: 'б', გ: 'г', დ: 'д', ე: 'э', ვ: 'в', ზ: 'з', თ: 'т', ი: 'и', კ: 'к’', ლ: 'л', მ: 'м', ნ: 'н', ო: 'о', პ: 'п’', ჟ: 'ж', რ: 'р', ს: 'с', ტ: 'т’', უ: 'у', ფ: 'п', ქ: 'к', ღ: 'гх', ყ: 'къ', შ: 'ш', ჩ: 'ч', ც: 'ц', ძ: 'дз', წ: 'ц’', ჭ: 'ч’', ხ: 'х', ჯ: 'дж', ჰ: 'х' }
const cyr = s => [...s].map(c => CYR[c] ?? c).join('')
const $ = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild }
const shuffle = a => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(x => x[1])
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false } }

// Записи: WebAudio — без задержки на касание; контекст будим первым касанием, до того играет <audio>
let ac = null
const buffers = {}, raw = {}
const clipUrl = id => `/audio/myday/${id}.m4a`
function fetchClip(id) {
  if (!raw[id]) raw[id] = fetch(clipUrl(id)).then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => null)
  return raw[id]
}
async function decode(id) {
  if (buffers[id] || !ac) return
  const ab = await fetchClip(id)
  if (!ab || buffers[id]) return
  try { buffers[id] = await ac.decodeAudioData(ab.slice(0)) } catch {}
}
async function unlock() {
  if (ac) { if (ac.state === 'suspended') ac.resume().catch(() => {}); return }
  const C = window.AudioContext || window.webkitAudioContext; if (!C) return
  ac = new C(); try { await ac.resume() } catch {}
  Object.keys(raw).forEach(decode)
}
function say(id) {
  if (isMuted() || !id) return
  if (ac && ac.state === 'running' && buffers[id]) {
    const s = ac.createBufferSource(); s.buffer = buffers[id]; s.connect(ac.destination); s.start()
  } else { void playClip(clipUrl(id)); decode(id) }
}
function tone(freq, dur, type = 'sine', gain = 0.1, slide) {
  if (isMuted() || !ac || ac.state !== 'running') return
  const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain()
  o.type = type; o.frequency.setValueAtTime(freq, t)
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur)
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.02)
}
// Щелчок стрелки по часам — «выбор» в Telegram, самая лёгкая отдача
function selection() {
  try { const h = window.Telegram?.WebApp?.HapticFeedback; if (h) h.selectionChanged(); else navigator.vibrate?.(4) } catch {}
}
const fx = {
  pick: () => { tone(620, 0.05, 'triangle', 0.07); haptic('tap') },
  drop: () => { tone(200, 0.12, 'sine', 0.2, 90); haptic('snap') },
  tick: () => { tone(1100, 0.025, 'square', 0.025); selection() },
  ok: () => { tone(784, 0.1, 'triangle', 0.1); setTimeout(() => tone(1047, 0.16, 'triangle', 0.1), 80); haptic('good') },
  bad: () => { tone(170, 0.18, 'square', 0.05, 120); haptic('bad') },
  level: () => { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.12, 'triangle', 0.09), i * 90)); haptic('pop') },
  win: () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.1), i * 110)); haptic('good') },
}
// Искры из точки: попал — вокруг цели разлетается эмаль
const SPARK = ['#F5B820', '#E01A3C', '#1B5FB0', '#3E8E41']
function burst(target, n = 14) {
  if (reduced() || !target?.isConnected) return
  const r = target.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i'); p.className = 'spark'
    const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 70
    p.style.left = x + 'px'; p.style.top = y + 'px'; p.style.background = SPARK[i % SPARK.length]
    p.style.setProperty('--dx', Math.cos(a) * d + 'px'); p.style.setProperty('--dy', Math.sin(a) * d + 'px')
    main.append(p); setTimeout(() => p.remove(), 700)
  }
}
// Конфетти в конце урока: падает сверху
function confetti() {
  if (reduced()) return
  for (let i = 0; i < 36; i++) {
    const p = document.createElement('i'); p.className = 'confetti'
    p.style.left = Math.random() * 100 + 'vw'; p.style.background = SPARK[i % SPARK.length]
    p.style.animationDelay = Math.random() * 0.5 + 's'; p.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg')
    p.style.setProperty('--drift', (Math.random() * 80 - 40) + 'px')
    main.append(p); setTimeout(() => p.remove(), 2600)
  }
}

let main = null
let exitFn = () => {}, doneFn = () => {}

// Таймеры живут, пока открыта игра: при выходе всё гасится разом
let epoch = 0
const later = (fn, ms) => { const e = epoch; setTimeout(() => e === epoch && main && fn(), reduced() ? Math.min(ms, 400) : ms) }
const intervals = []
const every = (fn, ms) => { const id = setInterval(fn, ms); intervals.push(id); return id }
function reset() { epoch++; intervals.splice(0).forEach(clearInterval); untip(); unghost() }

// Подсказка-пузырь у элемента: одна за раз
let tipEl = null
function tip(target, html, place = 'above') {
  untip()
  const host = main?.querySelector('.game')
  if (!host || !target?.isConnected) return
  tipEl = $(`<div class="tip ${place}" role="status">${html}</div>`)
  host.append(tipEl)
  const pos = () => {
    if (!tipEl || !target.isConnected) return
    const h = host.getBoundingClientRect(), r = target.getBoundingClientRect(), w = tipEl.offsetWidth
    let left = r.left - h.left + r.width / 2 - w / 2
    left = Math.max(0, Math.min(left, h.width - w))
    tipEl.style.left = left + 'px'
    tipEl.style.setProperty('--ax', Math.max(14, Math.min(w - 14, r.left - h.left + r.width / 2 - left)) + 'px')
    tipEl.style.top = (place === 'above' ? r.top - h.top - tipEl.offsetHeight - 12 : r.bottom - h.top + 12) + 'px'
  }
  pos(); tipEl._pos = pos
}
function untip() { tipEl?.remove(); tipEl = null }
const onResize = () => tipEl?._pos()

// Рука показывает первый ход: тап или перетаскивание
let ghostEl = null
function ghost(from, to) {
  unghost()
  const host = main?.querySelector('.game')
  if (!host || !from?.isConnected) return
  const h = host.getBoundingClientRect()
  const c = el => { const r = el.getBoundingClientRect(); return [r.left - h.left + r.width / 2, r.top - h.top + r.height / 2] }
  const [x1, y1] = c(from), [x2, y2] = to ? c(to) : [x1, y1]
  ghostEl = $(`<div class="hg ${to ? 'drag' : 'tap'}"></div>`)
  Object.entries({ '--x1': x1, '--y1': y1, '--x2': x2, '--y2': y2 }).forEach(([k, v]) => ghostEl.style.setProperty(k, v + 'px'))
  host.append(ghostEl)
}
function unghost() { ghostEl?.remove(); ghostEl = null }

// Перетаскивание пальцем; короткий тап — тоже ход (для тех, кто не догадается тащить)
function draggable(el, { targets, drop, tap }) {
  let sx, sy, moved = false, id = null, lastOver = null
  el.classList.add('drag-src')
  const hit = e => targets().find(x => { const r = x.getBoundingClientRect(); return e.clientX >= r.left - 12 && e.clientX <= r.right + 12 && e.clientY >= r.top - 12 && e.clientY <= r.bottom + 12 })
  el.addEventListener('pointerdown', e => {
    if (el.classList.contains('used') || el.disabled) return
    id = e.pointerId; try { el.setPointerCapture(id) } catch {}
    sx = e.clientX; sy = e.clientY; moved = false; lastOver = null; el.classList.add('lift'); el.style.transition = ''; fx.pick(); unghost()
  })
  el.addEventListener('pointermove', e => {
    if (e.pointerId !== id) return
    const dx = e.clientX - sx, dy = e.clientY - sy
    if (Math.hypot(dx, dy) > 6) moved = true
    el.style.transform = `translate(${dx}px, ${dy}px) scale(1.08) rotate(${dx / 40}deg)`
    const t = hit(e); targets().forEach(x => x.classList.toggle('over', x === t))
    // над целью — лёгкий «щелчок» под пальцем
    if (t && t !== lastOver) selection()
    lastOver = t
  })
  const end = e => {
    if (e.pointerId !== id) return
    id = null; el.classList.remove('lift')
    const t = moved ? hit(e) : null
    targets().forEach(x => x.classList.remove('over'))
    el.style.transition = 'transform .28s cubic-bezier(.3, 1.5, .5, 1)'; el.style.transform = ''
    if (!moved) return tap?.()
    if (t) drop(t)
  }
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end)
}
const shake = el => { el.classList.remove('bounce'); void el.offsetWidth; el.classList.add('bounce'); later(() => el.classList.remove('bounce'), 400) }

const ACT = {
  wake: { ka: 'ვიღვიძებ', ru: 'просыпаюсь', she: 'იღვიძებს', sru: 'просыпается' }, dress: { ka: 'ვიცვამ', ru: 'одеваюсь', she: 'იცვამს', sru: 'одевается' },
  coffee: { ka: 'ყავას ვსვამ', ru: 'пью кофе', she: 'ყავას სვამს', sru: 'пьёт кофе' }, tea: { ka: 'ჩაის ვსვამ', ru: 'пью чай', she: 'ჩაის სვამს', sru: 'пьёт чай' },
  breakfast: { ka: 'ვსაუზმობ', ru: 'завтракаю', she: 'საუზმობს', sru: 'завтракает' }, towork: { ka: 'სამსახურში მივდივარ', ru: 'иду на работу', she: 'სამსახურში მიდის', sru: 'идёт на работу' },
  work: { ka: 'ვმუშაობ', ru: 'работаю', she: 'მუშაობს', sru: 'работает' }, lunch: { ka: 'ვსადილობ', ru: 'обедаю', she: 'სადილობს', sru: 'обедает' },
  home: { ka: 'სახლში ვბრუნდები', ru: 'возвращаюсь домой', she: 'სახლში ბრუნდება', sru: 'возвращается домой' },
  read: { ka: 'წიგნს ვკითხულობ', ru: 'читаю книгу', she: 'წიგნს კითხულობს', sru: 'читает книгу' }, rest: { ka: 'ვისვენებ', ru: 'отдыхаю', she: 'ისვენებს', sru: 'отдыхает' },
  sleep: { ka: 'ვიძინებ', ru: 'засыпаю', she: 'იძინებს', sru: 'засыпает' },
  // вторая половина модуля: еда, дом, для себя, куда иду
  water: { ka: 'წყალს ვსვამ', ru: 'пью воду', she: 'წყალს სვამს', sru: 'пьёт воду' }, khach: { ka: 'ხაჭაპურს ვჭამ', ru: 'ем хачапури', she: 'ხაჭაპურს ჭამს', sru: 'ест хачапури' },
  fruit: { ka: 'ხილს ვჭამ', ru: 'ем фрукты', she: 'ხილს ჭამს', sru: 'ест фрукты' }, cook: { ka: 'ვახშამს ვამზადებ', ru: 'готовлю ужин', she: 'ვახშამს ამზადებს', sru: 'готовит ужин' },
  dishes: { ka: 'ჭურჭელს ვრეცხავ', ru: 'мою посуду', she: 'ჭურჭელს რეცხავს', sru: 'моет посуду' }, call: { ka: 'დედას ვურეკავ', ru: 'звоню маме', she: 'დედას ურეკავს', sru: 'звонит маме' },
  walk: { ka: 'ვსეირნობ', ru: 'гуляю', she: 'სეირნობს', sru: 'гуляет' }, sport: { ka: 'ვვარჯიშობ', ru: 'тренируюсь', she: 'ვარჯიშობს', sru: 'тренируется' },
  study: { ka: 'ქართულს ვსწავლობ', ru: 'учу грузинский', she: 'ქართულს სწავლობს', sru: 'учит грузинский' },
  shop: { ka: 'მაღაზიაში მივდივარ', ru: 'иду в магазин', she: 'მაღაზიაში მიდის', sru: 'идёт в магазин' }, tosea: { ka: 'ზღვაზე მივდივარ', ru: 'иду на море', she: 'ზღვაზე მიდის', sru: 'идёт на море' },
}
// Слова «когда» и «как часто»: картинки и записи как у дел, но без «я / она»
const TIME = { sat: { ka: 'შაბათს', ru: 'в субботу' }, sun: { ka: 'კვირას', ru: 'в воскресенье' },
  daily: { ka: 'ყოველ დღე', ru: 'каждый день' }, often: { ka: 'ხშირად', ru: 'часто' }, some: { ka: 'ზოგჯერ', ru: 'иногда' } }
const WORD = { ...ACT, ...TIME }
const MORNING = ['wake', 'dress', 'coffee', 'tea', 'breakfast', 'towork'], DAY = ['work', 'lunch', 'home'], EVENING = ['read', 'rest', 'sleep']
const FOOD = ['water', 'khach', 'fruit'], HOUSE = ['cook', 'dishes', 'call'], SELF = ['walk', 'sport', 'study'], GO = ['shop', 'tosea'], WEEK = ['sat', 'sun'], FREQ = ['daily', 'often', 'some']

// Колода: каждый вариант выпадает по разу, прежде чем повториться, и только что виденное не идёт первым —
// без этого случайный выбор подсовывал одно и то же задание несколько раз подряд
const recent = []
function deck(pool) {
  let bag = []
  return () => {
    if (!bag.length) {
      bag = shuffle(pool)
      if (bag.length > 2) bag.sort((a, b) => recent.includes(a) - recent.includes(b))
    }
    const x = bag.shift(); recent.unshift(x); recent.length = Math.min(recent.length, Math.max(1, Math.floor(pool.length / 2)))
    return x
  }
}
// Часы: число перед საათზე теряет -ი (ხუთი → ხუთ); რვა и ცხრა без -ი, им терять нечего
const HOURS = { 1: ['ერთი', 'ერთ'], 2: ['ორი', 'ორ'], 3: ['სამი', 'სამ'], 4: ['ოთხი', 'ოთხ'], 5: ['ხუთი', 'ხუთ'], 6: ['ექვსი', 'ექვს'], 7: ['შვიდი', 'შვიდ'], 8: ['რვა', 'რვა'], 9: ['ცხრა', 'ცხრა'], 10: ['ათი', 'ათ'], 11: ['თერთმეტი', 'თერთმეტ'], 12: ['თორმეტი', 'თორმეტ'] }
const hourKa = h => `${HOURS[h][1]} საათზე`

/* ───────── каркас игры: шаги одна за другой ───────── */
function runGame({ title, sub, levels, end }) {
  reset()
  const g = $(`<div class="game"><div class="top"><button class="back" aria-label="К модулю">${BACK}</button><div class="ttl"><span class="eyebrow">${sub}</span><b>${title}</b></div></div>
    <div class="steps">${levels.map(() => '<i></i>').join('')}</div><div class="stage"></div></div>`)
  g.querySelector('.back').onclick = () => { fx.pick(); exitFn() }
  main.replaceChildren(g); window.scrollTo?.(0, 0)
  const stage = g.querySelector('.stage'), dots = [...g.querySelectorAll('.steps i')]
  let k = 0
  function go() {
    untip(); unghost()
    dots.forEach((d, i) => d.className = (i < k ? 'done' : i === k ? 'now' : '') + (levels[i].review ? ' rev' : ''))
    if (k >= levels.length) { stage.replaceChildren(); return end(stage) }
    const L = levels[k]
    // Перед шагом — его название крупно, одной строкой: так текст приходит порциями
    // Разминка помечена отдельно: «это ты уже делал» — чтобы новое не пугало
    stage.replaceChildren($(L.review
      ? `<div class="lvl rev"><span>Разминка · уже знаешь</span><b>${L.name}</b></div>`
      : `<div class="lvl"><span>Шаг ${k + 1} из ${levels.length}</span><b>${L.name}</b></div>`))
    later(() => { stage.replaceChildren(); window.scrollTo?.(0, 0); L.run(stage, () => { k++; fx.level(); later(go, 500) }) }, k === 0 ? 900 : 1200)
  }
  go()
}
// Итог урока: что выучил (можно послушать), «Ещё раз» и «Дальше» — к короткой проверке
function endCard(stage, { big, text, items, again, bank }) {
  const c = $(`<div class="card end"><span class="eyebrow">${big}</span><p class="soft">${text}</p>
    ${items ? `<div class="rrows">${items.map(([a, ka, ru, ic]) => `<button class="rrow" data-a="${a}"><span class="ic">${ICON[ic] ?? ''}</span><span class="ka" lang="ka">${ka}</span><span class="tr">${ru}</span></button>`).join('')}</div>` : ''}
    ${bank ? bankEl(bank) : ''}
    <div class="cta-row"><button class="cta ghost again">Ещё раз</button><button class="cta nx" id="level-next">Дальше</button></div></div>`)
  c.querySelectorAll('.rrow').forEach(r => r.onclick = () => { fx.pick(); say(r.dataset.a) })
  c.querySelector('.again').onclick = () => { fx.pick(); again() }
  c.querySelector('.nx').onclick = () => { fx.pick(); doneFn() }
  stage.append(c); fx.win(); confetti()
  if (bank) countUp(c.querySelector('.bank b'), bank)
  // кнопки всегда на экране: не влезает — карточка ужимается по экрану, список фраз листается внутри
  c.fit = () => { c.style.maxHeight = ''; const r = c.getBoundingClientRect(), room = innerHeight - r.top - 12; if (r.height > room) c.style.maxHeight = `${Math.max(240, room)}px` }
  return c
}
// Копилка: сколько слов и фраз уже знаешь — число дотикивает до нового значения
const bankEl = ([was, now]) => `<div class="bank"><span>Слов и фраз в копилке</span><b>${was}</b>${now > was ? `<i>+${now - was}</i>` : ''}</div>`
function countUp(el, [was, now]) {
  if (!el || now <= was) return
  let v = was
  const step = () => { if (!el.isConnected) return; v++; el.textContent = v; fx.tick(); if (v < now) later(step, Math.max(40, 500 / (now - was))) }
  later(step, 700)
}

/* ───────── Утро: послушай, потом перетащи картинку в облачко ───────── */
function learnRow(stage, keys, done, firstTip) {
  const row = $(`<div class="learn">${keys.map(k => `<button class="lcard" data-k="${k}"><span class="ic">${ICON[k]}</span><span class="ka" lang="ka">${WORD[k].ka}</span><span class="tr">${cyr(WORD[k].ka)}</span><span class="ru"></span></button>`).join('')}</div>`)
  stage.append(row)
  const cards = [...row.children], heard = new Set()
  const point = () => { const n = cards.find(c => !heard.has(c.dataset.k)); if (n) { ghost(n); tip(n, heard.size ? 'И эту' : firstTip, 'below') } }
  cards.forEach(c => c.onclick = () => {
    say(c.dataset.k); fx.pick(); c.classList.remove('heard'); void c.offsetWidth; c.classList.add('heard'); c.querySelector('.ru').textContent = WORD[c.dataset.k].ru
    heard.add(c.dataset.k); untip(); unghost()
    if (heard.size === cards.length) later(done, 1100); else later(point, 700)
  })
  later(point, 300)
}
const roundLbl = (lbl, r, rounds) => lbl ? lbl() : `Раунд ${r + 1} из ${rounds}`
function bubbleRounds(stage, { pool, n, rounds, listen, hint = true, intro, lbl }, done) {
  let r = 0, first = true
  const next = deck(pool)
  function round() {
    stage.replaceChildren()
    const cur = next()
    const opts = shuffle([cur, ...shuffle(pool.filter(k => k !== cur)).slice(0, n - 1)])
    const b = $(`<div class="bubble"><div class="say">${listen ? '<span class="hidden-txt">Слушай…</span>' : `<b lang="ka">${WORD[cur].ka}</b><span class="tr">${cyr(WORD[cur].ka)}</span>`}</div>
      <button class="ear loud" aria-label="Послушать">${EAR}</button><div class="slotpic">?</div></div>`)
    const tiles = $(`<div class="tiles" style="--n:${Math.min(n, 2)}">${opts.map(k => `<button class="tile" data-k="${k}" aria-label="${WORD[k].ru}">${ICON[k]}</button>`).join('')}</div>`)
    stage.append($(`<div class="round">${roundLbl(lbl, r, rounds)}</div>`), b, tiles)
    b.querySelector('.ear').onclick = () => say(cur)
    later(() => say(cur), 250)
    const put = t => {
      const k = t.dataset.k
      if (k === cur) {
        fx.drop(); fx.ok(); untip(); t.classList.add('used'); b.classList.add('got')
        b.querySelector('.slotpic').innerHTML = ICON[k]; burst(b.querySelector('.slotpic'))
        if (listen) b.querySelector('.say').innerHTML = `<b lang="ka">${WORD[cur].ka}</b><span class="tr">${WORD[cur].ru}</span>`
        r++; later(r < rounds ? round : done, 1000)
      } else {
        fx.bad(); b.classList.remove('miss'); void b.offsetWidth; b.classList.add('miss'); shake(t)
        // звук сам не повторяем — динамик рядом, если надо
        tip(t, listen ? `Это «${WORD[k].ru}». Нажми на динамик — послушать ещё` : `Это «${WORD[k].ru}»`, 'above')
      }
    }
    tiles.querySelectorAll('.tile').forEach(t => draggable(t, { targets: () => [b], drop: () => put(t), tap: () => put(t) }))
    if (first && hint) later(() => { const right = tiles.querySelector(`[data-k="${cur}"]`); ghost(right, b.querySelector('.slotpic')); tip(b, 'Перетащи нужную картинку в облачко', 'above') }, 700)
    else if (first && intro) later(() => tip(b, intro, 'above'), 700)
    first = false
  }
  round()
}

/* ───────── Подпиши: Грузинские подписи к картинкам — читаем, а не слушаем ───────── */
function labelLevel(stage, keys, done) {
  const grid = $(`<div class="lgrid" style="--c:${keys.length === 3 ? 3 : 2}">${keys.map(k => `<div class="lpic" data-k="${k}"><span class="ic">${ICON[k]}</span><span class="lab"></span></div>`).join('')}</div>`)
  const tray = $(`<div class="tray">${shuffle(keys).map(k => `<button class="chip" data-k="${k}"><b lang="ka">${WORD[k].ka}</b><span class="tr">${cyr(WORD[k].ka)}</span></button>`).join('')}</div>`)
  stage.append($(`<p class="round">Прочитай и подпиши картинки</p>`), grid, tray)
  const pics = [...grid.children]; let left = keys.length, sel = null
  const put = (c, pic) => {
    if (pic.dataset.k === c.dataset.k) {
      fx.drop(); fx.ok(); untip(); unghost(); c.classList.add('used'); c.classList.remove('sel'); sel = null
      pic.classList.add('done'); pic.querySelector('.lab').innerHTML = `<b lang="ka">${WORD[c.dataset.k].ka}</b>`; burst(pic, 10); say(c.dataset.k)
      if (--left === 0) later(done, 1200)
    } else { fx.bad(); shake(c); tip(pic, `Здесь «${WORD[pic.dataset.k].ru}», а подпись — «${WORD[c.dataset.k].ru}»`, 'above') }
  }
  // тап по подписи выбирает её, тап по картинке — кладёт
  tray.querySelectorAll('.chip').forEach(c => draggable(c, { targets: () => pics.filter(p => !p.classList.contains('done')), drop: t => put(c, t),
    tap: () => { tray.querySelectorAll('.chip').forEach(x => x.classList.remove('sel')); sel = c; c.classList.add('sel'); untip() } }))
  pics.forEach(p => p.onclick = () => { if (sel && !p.classList.contains('done')) put(sel, p) })
  later(() => { const c = tray.firstElementChild; ghost(c, grid.querySelector(`[data-k="${c.dataset.k}"]`)); tip(grid, 'Перетащи подпись к своей картинке', 'above') }, 500)
}

/* ───────── Пары: открывай по две карточки, картинка + слово ───────── */
function pairsLevel(stage, keys, done) {
  const cards = shuffle(keys.flatMap(k => [{ k, t: 'pic' }, { k, t: 'word' }]))
  const grid = $(`<div class="pairs" style="--c:${cards.length > 6 ? 4 : 3}">${cards.map(c => `<button class="pcard" data-k="${c.k}" data-t="${c.t}"><span class="pback">?</span><span class="pface">${c.t === 'pic' ? ICON[c.k] : `<b lang="ka">${WORD[c.k].ka}</b><span class="tr">${cyr(WORD[c.k].ka)}</span>`}</span></button>`).join('')}</div>`)
  stage.append($(`<p class="round">Найди пары: картинка и слово</p>`), grid)
  let open = [], left = keys.length, busy = false
  grid.querySelectorAll('.pcard').forEach(c => c.onclick = () => {
    if (busy || c.classList.contains('up')) return
    untip(); c.classList.add('up'); fx.pick(); open.push(c)
    if (open.length < 2) return
    const [a, b] = open; open = []
    if (a.dataset.k === b.dataset.k) {
      busy = true
      later(() => { a.classList.add('got'); b.classList.add('got'); fx.ok(); burst(b, 10); say(a.dataset.k); busy = false; if (--left === 0) later(done, 1100) }, 300)
    } else { busy = true; later(() => { haptic('soft'); a.classList.remove('up'); b.classList.remove('up'); busy = false }, 1000) }
  })
  later(() => tip(grid, 'Открывай по две. Совпали — пара твоя', 'above'), 400)
}

/* ───────── Поймай: картинки всплывают, лови ту, что слышишь ───────── */
// В длинной версии (speed) каждая поимка ускоряет всплытие, а серия без промахов горит огоньком
function catchLevel(stage, { pool, rounds, n = 3, speed = false }, done) {
  const next = deck(pool); let r = 0, cur, first = true, streak = 0, best = 0
  const lbl = $(`<div class="round"></div>`)
  const card = $(`<div class="say-card"><div class="say"><span class="hidden-txt">Лови то, что слышишь</span></div><button class="ear loud" aria-label="Послушать">${EAR}</button></div>`)
  const ar = $(`<div class="arena"></div>`)
  stage.append(lbl, card, ar)
  card.querySelector('.ear').onclick = () => say(cur)
  const count = () => { lbl.innerHTML = `Поймано ${r} из ${rounds}${streak >= 2 ? ` <span class="streak">серия ×${streak}</span>` : ''}` }
  function round(again) {
    ar.replaceChildren(); count()
    if (!again) cur = next()
    card.querySelector('.say').innerHTML = '<span class="hidden-txt">Лови то, что слышишь</span>'
    const lanes = shuffle([...Array(n).keys()]); let over = false
    const dur = speed ? Math.max(3.6, 6.2 - r * 0.35) : 6.2
    ;[cur, ...shuffle(pool.filter(k => k !== cur)).slice(0, n - 1)].forEach((k, i) => {
      // правильная картинка всплывает не первой и не последней по времени — угадывать по порядку не выйдет
      const delay = ([0.5, 0, 1.1, 0.25][i]) * dur / 6.2
      const f = $(`<button class="floater" data-k="${k}" style="--x:${lanes[i] * (100 / n) + 1}%;width:${100 / n - 2}%;--d:${dur}s;--w:${delay}s" aria-label="${WORD[k].ru}">${ICON[k]}</button>`)
      ar.append(f)
      f.onpointerdown = () => {
        if (over || f.classList.contains('miss')) return
        if (k === cur) {
          over = true; fx.ok(); f.classList.add('caught'); r++; streak++; best = Math.max(best, streak); untip()
          burst(f, streak >= 3 ? 24 : 14); if (streak >= 3) haptic('pop')
          count()
          card.querySelector('.say').innerHTML = `<b lang="ka">${WORD[cur].ka}</b><span class="tr">${WORD[cur].ru}</span>`
          later(() => r < rounds ? round() : done(), 1100)
        } else { fx.bad(); streak = 0; count(); f.classList.add('miss'); tip(card, `Это «${WORD[k].ru}»`, 'below') }
      }
      if (k === cur) f.addEventListener('animationend', e => {
        if (e.animationName !== 'md-float' || over) return
        over = true; streak = 0; fx.bad(); tip(card, 'Улетело! Ещё раз', 'below'); later(() => { untip(); round(true) }, 1000)
      })
    })
    later(() => say(cur), 300)
    if (first) { first = false; later(() => tip(card, speed ? 'С каждой поимкой быстрее. Не промахнись — растёт серия' : 'Слушай и нажми на картинку, пока не улетела', 'below'), 600) }
  }
  round()
}

/* ───────── По порядку: Нино рассказывает своё утро, раскладываем картинки по шагам ───────── */
function orderLevel(stage, { keys, listen, she }, done) {
  // she — рассказ не от Нино, а про неё: те же дела, только «она» (იღვიძებს вместо ვიღვიძებ)
  const ka = k => she ? WORD[k].she : WORD[k].ka
  const chat = $(`<div class="chat"><div class="chat-top"><div class="ava" lang="ka">ნ</div><div class="who">${she ? 'Про Нино<small>что она делает за день</small>' : `Нино<small>${listen ? 'рассказывает голосом' : 'пишет, что делает утром'}</small>`}</div></div></div>`)
  const msg = $(`<div class="msg her olist">${listen ? `<span class="hidden-txt">Слушай, что за чем</span><button class="ear loud" aria-label="Послушать">${EAR}</button>`
    : keys.map((k, i) => `<span class="oi"><i>${i + 1}</i><b lang="ka">${i === 0 && she ? 'ნინო ' : ''}${ka(k)}</b></span>`).join('')}</div>`)
  chat.append(msg)
  const line = $(`<div class="oline" style="--n:${keys.length}">${keys.map((k, i) => `<div class="oslot"><span class="n">${i + 1}</span></div>`).join('')}</div>`)
  const tray = $(`<div class="tiles" style="--n:${keys.length > 4 ? 3 : keys.length}">${shuffle(keys).map(k => `<button class="tile" data-k="${k}" aria-label="${WORD[k].ru}">${ICON[k]}</button>`).join('')}</div>`)
  stage.append(chat, line, tray)
  const slots = [...line.children]; let at = 0
  const playAll = () => keys.forEach((k, i) => later(() => say(k), i * 1600))
  if (listen) { msg.querySelector('.ear').onclick = playAll; later(playAll, 400) }
  const put = t => {
    const k = t.dataset.k
    if (k === keys[at]) {
      fx.drop(); fx.ok(); untip(); unghost(); t.classList.add('used')
      slots[at].classList.add('full'); slots[at].innerHTML = `<span class="n">${at + 1}</span>${ICON[k]}<b lang="ka">${ka(k)}</b>`; burst(slots[at], 10)
      msg.querySelectorAll('.oi')[at]?.classList.add('done')
      if (!listen && !she) say(k)
      if (++at === keys.length) later(done, 1300)
    } else {
      fx.bad(); shake(t)
      tip(t, listen ? `Не то. Под №${at + 1} — послушай ещё` : `Это «${she ? WORD[k].sru : WORD[k].ru}». Под №${at + 1} — <b lang="ka">${ka(keys[at])}</b>`, 'above')
      if (listen) say(keys[at])
    }
  }
  tray.querySelectorAll('.tile').forEach(t => draggable(t, { targets: () => [line], drop: () => put(t), tap: () => put(t) }))
  later(() => at === 0 && tip(line, listen ? 'Разложи картинки в том порядке, как она говорит' : she ? 'Что Нино делает за чем? Разложи по порядку' : 'Разложи картинки по её порядку: сначала №1', 'below'), listen ? 900 : 500)
}

/* ───────── Часы: число теряет -ი, потом стрелка ───────── */
/* ───────── Мультик с Бомборой: короткая сценка, в которой ученик сам двигает сюжет ───────── */
// Серия — сценарий из шагов (async run(a)): Бомбора прыгает по сцене, говорит, засыпает; на шагах drag/tap
// сюжет ждёт ученика. Внизу — субтитр: грузинское слово, которое прямо в кадре меняется (ზე прилипает, ი отпадает).
function episode(stage, ep, done) {
  stage.replaceChildren(); untip(); unghost()
  const reel = $(`<div class="reel ${ep.scene ?? ''}"><div class="win"><i class="sun"></i><i class="moon"></i></div><div class="night"></div><div class="zzz" hidden><i>z</i><i>z</i><i>z</i></div>
    ${ep.props.map(p => `<div class="prop p-${p.id}${p.off ? ' off' : ''}" style="left:${p.x}%;bottom:${p.y}%;width:${p.w}px">${ICON[p.ic]}${p.label ? `<span class="plabel" lang="ka">${p.label}</span>` : ''}</div>`).join('')}
    ${ep.cat ? `<div class="kitty" style="left:${ep.cat.x}%;bottom:${ep.cat.y ?? 4}%"><div class="bub" hidden></div><div class="face">${catBody()}</div></div>` : ''}
    <div class="pup" style="left:-35%;bottom:3%"><div class="bub" hidden></div><div class="face">${bomboraBody()}</div></div></div>`)
  const sub = $(`<div class="sub"><button class="tword" lang="ka" disabled></button><p class="tru"></p>
    <div class="ttiles"><button class="ttile" lang="ka"></button></div><p class="tnote" hidden></p></div>`)
  // подсказка хода — строкой под сценой, чтобы не закрывать кадр
  const cue = $(`<p class="cue" hidden></p>`)
  stage.append($(`<p class="round">Мультик · ${ep.title}</p>`), reel, cue, sub)
  const ask = html => { cue.innerHTML = html; cue.hidden = false }, unask = () => { cue.hidden = true }
  const pup = reel.querySelector('.pup'), face = pup.querySelector('.face'), bub = pup.querySelector('.bub')
  const kitty = reel.querySelector('.kitty'), rig = bomboraRig(face.querySelector('svg'))
  const word = sub.querySelector('.tword'), tru = sub.querySelector('.tru'), tiles = sub.querySelector('.ttiles'), tile = tiles.firstElementChild, note = sub.querySelector('.tnote')
  const P = id => id === 'pup' ? pup : id === 'cat' ? kitty : reel.querySelector(`.p-${id}`)
  // слово в субтитре готово: кусочек — цветом, звучит, вспыхивает
  const settle = (html, to, toRu, toA) => { word.innerHTML = html; word.classList.add('got'); tru.textContent = `${cyr(to)} — ${toRu}`; say(toA); fx.ok(); burst(word, 10) }
  // ход ученика по самому слову: нажать букву или слово
  const onWord = (hint, target) => new Promise(r => {
    word.disabled = false; word.classList.add('ask'); ask(hint); ghost(target ?? word)
    word.onclick = () => { word.onclick = null; word.disabled = true; word.classList.remove('ask'); unask(); unghost(); fx.pick(); r() }
  })
  const wait = ms => new Promise(r => later(r, ms))
  const a = {
    wait,
    // настроение меняет только мордочку — руки и ноги не сбрасываются посреди движения
    mood: m => { face.querySelector('.pb-headart').innerHTML = bomboraHead(m) },
    // поза: wave, point, stretch, sleep, jump или покой (движения — bomboraRig в puppets.ts)
    pose: p => rig.pose(p),
    // Бомбора идёт в точку сцены (в процентах)
    move: async (x, y = 3) => { rig.walk(true); pup.style.left = `${x}%`; pup.style.bottom = `${y}%`; fx.pick(); await wait(900); rig.walk(false) },
    cat: (mood, pose) => { if (!kitty) return; kitty.querySelector('.face').innerHTML = catBody(mood); kitty.className = `kitty ${pose ?? ''}` },
    catSay: (ka, audio) => { const b = kitty?.querySelector('.bub'); if (!b) return; b.innerHTML = ka; b.hidden = false; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); if (audio) say(audio) },
    catHush: () => { const b = kitty?.querySelector('.bub'); if (b) b.hidden = true },
    say: (ka, audio) => { bub.innerHTML = `<b lang="ka">${ka}</b>`; bub.hidden = false; bub.classList.remove('pop'); void bub.offsetWidth; bub.classList.add('pop'); if (audio) say(audio) },
    hush: () => { bub.hidden = true },
    word: (ka, ru, audio, drop) => {
      word.classList.remove('got'); word.innerHTML = [...ka].map((c, i, all) => `<b class="${drop && i === all.length - 1 ? 'drop' : ''}">${c}</b>`).join('')
      tru.textContent = `${cyr(ka)} — ${ru}`; if (audio) say(audio)
    },
    // кусочек сам прилетает к слову (если ученик уже сделал ход в кадре) — или его прилепляет ученик
    morph: async ({ add, to, toRu, toA, drag }) => {
      tile.textContent = add; tiles.classList.remove('gone'); tiles.classList.add('on')
      if (drag) await new Promise(r => {
        let ok = false; const go = () => { if (!ok) { ok = true; unask(); unghost(); r() } }
        draggable(tile, { targets: () => [word], drop: go, tap: go })
        ask(drag); ghost(tile, word)
      })
      else { await wait(500); tile.classList.add('fly') ; await wait(450) }
      tiles.classList.add('gone'); tile.classList.remove('fly'); fx.drop(); haptic('pop')
      const last = word.querySelector('.drop')
      if (last) { last.classList.add('glow'); await wait(450); last.classList.add('off'); haptic('soft'); await wait(600) }
      settle(`${to.slice(0, -add.length)}<i>${add}</i>`, to, toRu, toA); await wait(1300)
    },
    // ученик нажимает букву ch — над ней появляется «я»
    mark: async (ch, hint, ru) => {
      const v = [...word.querySelectorAll('b')].find(b => b.textContent === ch); v.classList.add('glow')
      await onWord(hint, v); v.classList.remove('glow'); v.classList.add('me'); haptic('pop'); if (ru) tru.textContent = `${cyr(word.textContent)} — ${ru}`; await wait(800)
    },
    // ученик смахивает первую букву; потом, если надо, прилепляет кусочек на конец
    cut: async ({ hint, add, to, toRu, toA }) => {
      const v = word.querySelector('b'); v.classList.add('cut', 'glow')
      await onWord(hint, v); v.classList.add('off'); haptic('soft'); await wait(650)
      if (add) await a.morph({ add, to, toRu, toA, drag: `А на конце — <b lang="ka">${add}</b>: прилепи к слову` })
      else { settle(to, to, toRu, toA); await wait(1300) }
    },
    // слово меняется целиком
    swap: async ({ hint, to, toRu, toA }) => { await onWord(hint); word.classList.add('flip'); await wait(350); settle(to, to, toRu, toA); await wait(1300) },
    note: html => { note.innerHTML = html; note.hidden = false },
    unnote: () => { note.hidden = true },
    tap: (id, hint) => new Promise(r => { const el = P(id); el.classList.add('live'); ask(hint); ghost(el); el.onclick = () => { el.onclick = null; el.classList.remove('live'); unask(); unghost(); fx.pick(); r() } }),
    drag: (id, to, hint) => new Promise(r => {
      const el = P(id); let ok = false; el.classList.add('live')
      const go = () => { if (ok) return; ok = true; el.classList.remove('live'); unask(); unghost(); r() }
      el.dataset.to = to; draggable(el, { targets: () => [P(to)], drop: go, tap: go }); ask(hint); ghost(el, P(to))
    }),
    // предмет съели, выпили или спрятали — и показали снова
    gone: id => P(id).classList.add('off'), show: id => P(id).classList.remove('off'),
    // Бомбора сразу на месте (без похода) и Бомбора зашёл внутрь (в дом, в магазин)
    at: (x, y = 3) => { pup.style.transition = 'none'; pup.style.left = `${x}%`; pup.style.bottom = `${y}%`; void pup.offsetWidth; pup.style.transition = '' },
    away: on => pup.classList.toggle('away', on),
    catMove: x => { if (kitty) kitty.style.left = `${x}%` },
    place: (id, x, y) => { const el = P(id); el.style.transition = 'left .35s ease, bottom .35s cubic-bezier(.3, 1.6, .5, 1)'; el.style.left = `${x}%`; el.style.bottom = `${y}%` },
    fx: (id, cls) => P(id).classList.add(cls),
    night: on => { reel.classList.toggle('dark', on); reel.querySelector('.zzz').hidden = !on },
  }
  ep.run(a).then(() => {
    const nx = $(`<button class="cta">Понятно</button>`); nx.onclick = () => { fx.pick(); done() }
    sub.append(nx); nx.scrollIntoView?.({ behavior: reduced() ? 'auto' : 'smooth', block: 'nearest' })
  })
}
// Серия 1 (урок 5): ზე — «на» (книга на столе) и «в … часов» (будильник). Формы: მაგიდაზე — Lessons (წიგნი მაგიდაზე დევს),
// საათი/საათზე — en.wiktionary.org, შვიდ საათზე ვიღვიძებ — фраза модуля s4
const EP_ZE = { title: 'Бомбора и будильник', cat: { x: 88 }, props: [
  { id: 'table', ic: 'table', x: 60, y: 4, w: 120 },
  { id: 'book', ic: 'read', x: 44, y: 4, w: 44 },
  { id: 'clock', ic: 'clock7', x: 74, y: 30, w: 40 },
], run: async a => {
  a.word('მაგიდა', 'стол', null); await a.move(4); a.pose('point'); a.say('მაგიდა', 'r_magida'); a.cat('happy', 'tilt'); await a.wait(1500)
  await a.drag('book', 'table', 'Помоги Бомборе — положи книгу на стол')
  a.place('book', 50, 33); a.hush(); a.mood('cheer'); a.pose('jump'); a.cat('cheer', 'hop'); await a.wait(500)
  await a.morph({ add: 'ზე', to: 'მაგიდაზე', toRu: 'на столе', toA: 'r_magidaze' })
  a.note('<b lang="ka">ზე</b> — это «на»: книга на столе, будильник — тоже на столе.'); a.pose('wave'); await a.wait(2400)
  a.unnote(); a.pose(); a.night(true); a.cat('sleep', 'curl'); await a.move(22); a.mood('sleep'); a.pose('sleep')
  a.word('საათი', 'часы, час', 'r_saati', true); await a.wait(1600)
  await a.tap('clock', 'Будильник! Нажми — разбуди Бомбору')
  a.fx('clock', 'ring'); fx.win(); a.night(false); a.cat('happy', 'jump'); a.mood('happy'); a.pose('stretch')
  await a.morph({ add: 'ზე', to: 'საათზე', toRu: 'в … часов', toA: 'r_saatze' })
  a.mood('cheer'); a.pose('wave'); a.say('შვიდ საათზე ვიღვიძებ!', 's4'); a.cat('cheer', 'tilt')
  a.note('<b lang="ka">ზე</b> — ещё и про время. <b lang="ka">შვიდ საათზე</b> — в семь часов. Буква <b lang="ka">ი</b> отпала — и у числа тоже, дальше увидишь.')
  await a.wait(2600)
} }

// Серии про остальные правила (формы — из уроков модуля
// и «Знакомства», შაბათი — en.wiktionary.org). Бомбора и кот; ученик сам двигает сюжет.
// Урок 1: ვ — это «я»
const EP_ME = { title: 'Бомбора просыпается', cat: { x: 88 }, props: [
  { id: 'table', ic: 'table', x: 62, y: 4, w: 110 }, { id: 'cup', ic: 'coffee', x: 62, y: 34, w: 40 },
], run: async a => {
  a.at(14); a.night(true); a.mood('sleep'); a.pose('sleep'); a.cat('sleep', 'curl'); await a.wait(1000)
  await a.tap('pup', 'Утро! Нажми на Бомбору — разбуди его')
  a.night(false); a.mood('happy'); a.pose('stretch'); a.cat('happy', 'tilt')
  a.word('ვიღვიძებ', 'просыпаюсь', null); a.say('ვიღვიძებ!', 'wake'); await a.wait(1500)
  await a.mark('ვ', 'Видишь <b lang="ka">ვ</b> в начале? Нажми', 'я просыпаюсь')
  a.hush(); a.pose(); a.note('<b lang="ka">ვ</b> в начале — это «я»: я просыпаюсь.'); await a.wait(2200); a.unnote()
  a.mood('hungry'); await a.drag('cup', 'pup', 'Бомбора хочет кофе — дай ему чашку')
  a.gone('cup'); a.mood('cheer'); a.pose('jump'); a.cat('cheer', 'hop'); a.word('ვსვამ', 'пью', null); a.say('ვსვამ!', 'r_vsvam'); await a.wait(1400)
  await a.mark('ვ', 'И тут <b lang="ka">ვ</b> — нажми', 'я пью')
  a.hush(); a.note('И тут <b lang="ka">ვ</b>: я пью.'); await a.wait(1800); a.unnote()
  a.mood('happy'); a.pose('wave'); a.word('მივდივარ', 'иду', null); a.say('მივდივარ!', 'r_mivdivar'); await a.wait(1400)
  await a.mark('ვ', 'Найди <b lang="ka">ვ</b> — она спряталась внутри', 'я иду')
  a.hush(); a.pose(); a.note('Тут <b lang="ka">ვ</b> внутри, но это тоже «я»: я иду.'); await a.move(112); await a.wait(1800)
} }
// Урок 7: то, что пьёшь, получает -ს
const EP_DRINK = { title: 'Завтрак с котом', cat: { x: 88 }, props: [
  { id: 'table', ic: 'table', x: 58, y: 4, w: 120 }, { id: 'coffee', ic: 'coffee', x: 50, y: 34, w: 40 }, { id: 'tea', ic: 'tea', x: 67, y: 34, w: 40 },
], run: async a => {
  a.word('ყავა', 'кофе', 'r_qava'); await a.move(8); a.mood('hungry'); a.pose('point'); a.say('ყავა!'); await a.wait(1300)
  await a.drag('coffee', 'pup', 'Дай Бомборе кофе')
  a.gone('coffee'); a.hush(); a.mood('cheer'); a.pose('jump')
  await a.morph({ add: 'ს', to: 'ყავას', toRu: 'кофе (пью)', toA: 'r_qavas' })
  a.pose(); a.say('ყავას ვსვამ', 'coffee'); a.note('Пьёшь кофе — <b lang="ka">ყავას ვსვამ</b>. К кофе прилепилась <b lang="ka">ს</b>.'); await a.wait(2600); a.unnote(); a.hush(); a.mood('happy')
  a.word('ჩაი', 'чай', 'r_chai'); a.cat('happy', 'tilt'); a.catSay('ჩაი?'); await a.wait(1300)
  await a.drag('tea', 'cat', 'А кот любит чай — дай ему чашку')
  a.gone('tea'); a.catHush(); a.cat('cheer', 'hop')
  await a.morph({ add: 'ს', to: 'ჩაის', toRu: 'чай (пью)', toA: 'r_chais', drag: 'Прилепи <b lang="ka">ს</b> к слову' })
  a.catSay('ჩაის ვსვამ', 'tea'); a.pose('wave'); a.note('<b lang="ka">ჩაის ვსვამ</b> — пью чай. Тут <b lang="ka">ი</b> остаётся.'); await a.wait(2800)
} }
// Урок 16: то, что ешь, тоже получает -ს
const EP_EAT = { title: 'Хачапури', cat: { x: 88 }, props: [
  { id: 'table', ic: 'table', x: 58, y: 4, w: 120 }, { id: 'khach', ic: 'khach', x: 58, y: 34, w: 50 },
], run: async a => {
  a.word('ხაჭაპური', 'хачапури', 'r_khachapuri', true); await a.move(8); a.mood('hungry'); a.pose('point'); a.say('ხაჭაპური!'); a.cat('happy', 'tilt'); await a.wait(1400)
  await a.drag('khach', 'pup', 'Бомбора проголодался — дай ему хачапури')
  a.gone('khach'); a.hush(); a.mood('chewing'); a.pose('jump'); a.cat('cheer', 'hop')
  await a.morph({ add: 'ს', to: 'ხაჭაპურს', toRu: 'хачапури (ем)', toA: 'r_khachapurs' })
  a.mood('sated'); a.pose('wave'); a.say('ხაჭაპურს ვჭამ!', 'khach')
  a.note('Ешь хачапури — <b lang="ka">ხაჭაპურს ვჭამ</b>. Как с кофе: <b lang="ka">ყავას ვსვამ</b>. Только <b lang="ka">ი</b> отпала.'); await a.wait(3000)
} }
// Урок 21: ში — «в», ზე — «на»
const EP_SHI = { title: 'Куда идёт Бомбора', scene: 'street', props: [
  { id: 'shop', ic: 'shop', x: 22, y: 26, w: 70 }, { id: 'sea', ic: 'sea', x: 54, y: 26, w: 70 }, { id: 'home', ic: 'home', x: 85, y: 26, w: 70 },
], run: async a => {
  a.word('მაღაზია', 'магазин', 'r_maghazia'); await a.move(2)
  await a.tap('shop', 'Бомбора идёт за продуктами — нажми на магазин')
  await a.move(8); a.away(true); await a.morph({ add: 'ში', to: 'მაღაზიაში', toRu: 'в магазин', toA: 'r_maghaziashi' })
  a.note('<b lang="ka">ში</b> — «в»: в магазин, внутрь.'); await a.wait(2200); a.unnote(); a.away(false); a.mood('cheer'); await a.wait(500)
  a.word('ზღვა', 'море', 'r_zghva'); await a.wait(900)
  await a.tap('sea', 'А теперь — на море! Нажми')
  await a.move(40); a.pose('jump'); await a.morph({ add: 'ზე', to: 'ზღვაზე', toRu: 'на море', toA: 'r_zghvaze' })
  a.pose('wave'); a.note('А на море — «на»: <b lang="ka">ზღვაზე</b>, как <b lang="ka">მაგიდაზე</b>.'); await a.wait(2400); a.unnote(); a.pose(); a.mood('happy')
  a.night(true); a.word('სახლი', 'дом', 'r_sakhli', true); await a.wait(1000)
  await a.tap('home', 'Вечер. Нажми на дом — пора домой')
  await a.move(71); a.away(true); await a.morph({ add: 'ში', to: 'სახლში', toRu: 'домой, дома', toA: 'r_sakhlshi' })
  a.note('<b lang="ka">ში</b> — «в»: в дом, домой. <b lang="ka">ი</b> отпала, как у <b lang="ka">საათზე</b>.'); await a.wait(2800)
} }
// Урок 22: день + ს — «в этот день»
const EP_DAYS = { title: 'Выходные', scene: 'street', props: [
  { id: 'sat', ic: 'sat', x: 40, y: 50, w: 54, label: 'შაბათი' }, { id: 'sun', ic: 'sun', x: 72, y: 50, w: 54, label: 'კვირა' }, { id: 'sea', ic: 'sea', x: 76, y: 8, w: 74, off: true },
], run: async a => {
  a.word('შაბათი', 'суббота', 'r_shabati', true); await a.move(4)
  await a.tap('sat', 'Какой сегодня день? Нажми на субботу')
  await a.morph({ add: 'ს', to: 'შაბათს', toRu: 'в субботу', toA: 'r_shabats' })
  a.show('sea'); a.mood('cheer'); await a.move(46); a.pose('jump'); a.say('შაბათს ზღვაზე მივდივარ!', 's10')
  a.note('<b lang="ka">შაბათს</b> — в субботу. <b lang="ka">ი</b> отпала, прилепилась <b lang="ka">ს</b>.'); await a.wait(3200); a.hush(); a.unnote(); a.gone('sea'); a.pose(); a.mood('happy')
  await a.move(16); a.word('კვირა', 'воскресенье', 'r_kvira'); await a.wait(900)
  await a.tap('sun', 'А на следующий день? Нажми на воскресенье')
  await a.morph({ add: 'ს', to: 'კვირას', toRu: 'в воскресенье', toA: 'r_kviras' })
  a.mood('sleep'); a.pose('sleep'); a.say('კვირას ვისვენებ', 's11')
  a.note('<b lang="ka">კვირას</b> — в воскресенье. Встаёт на место «когда», как <b lang="ka">დილით</b>.'); await a.wait(3200)
} }
// Урок 24: про другого — ვ уходит, на конце ს (про кота так же, как про Нино)
const EP_SHE = { title: 'Что делает кот', cat: { x: 86 }, props: [
  { id: 'table', ic: 'table', x: 56, y: 4, w: 120 }, { id: 'cup1', ic: 'coffee', x: 48, y: 34, w: 40 }, { id: 'cup2', ic: 'coffee', x: 65, y: 34, w: 40 },
], run: async a => {
  a.word('ვსვამ', 'я пью', null); await a.move(8)
  await a.drag('cup1', 'pup', 'Дай Бомборе кофе')
  a.gone('cup1'); a.mood('cheer'); a.say('ყავას ვსვამ', 'coffee'); await a.wait(1600); a.hush(); a.mood('happy')
  a.cat('happy', 'tilt'); await a.drag('cup2', 'cat', 'А теперь — коту')
  a.gone('cup2'); a.cat('cheer', 'hop'); a.pose('point')
  await a.cut({ hint: '<b lang="ka">ვ</b> — это «я». А теперь про кота — смахни', add: 'ს', to: 'სვამს', toRu: 'он пьёт', toA: 'r_svams' })
  a.note('Про кота — <b lang="ka">სვამს</b>: он пьёт. Про Нино так же: <b lang="ka">ყავას სვამს</b> — она пьёт кофе.'); await a.wait(2800); a.unnote(); a.pose()
  a.word('მივდივარ', 'я иду', null); a.say('მივდივარ!', 'r_mivdivar'); a.pose('wave'); a.catMove(112); await a.wait(1400); a.hush(); a.pose('point')
  await a.swap({ hint: 'Кот тоже ушёл. А это слово меняется целиком — нажми', to: 'მიდის', toRu: 'он идёт', toA: 'r_midis' })
  a.pose(); a.note('<b lang="ka">მიდის</b> — идёт (он, она). Это слово просто запомни. И так со всеми: <b lang="ka">ვმუშაობ</b> → <b lang="ka">მუშაობს</b>.'); await a.wait(3000)
} }
// Урок 25: «ты» — без ვ
const EP_YOU = { title: 'Кот спрашивает', cat: { x: 86 }, props: [
  { id: 'table', ic: 'table', x: 56, y: 4, w: 120 }, { id: 'khach', ic: 'khach', x: 56, y: 34, w: 50 },
], run: async a => {
  a.word('ვჭამ', 'я ем', null); await a.move(8); a.mood('hungry')
  await a.drag('khach', 'pup', 'Дай Бомборе хачапури')
  a.gone('khach'); a.mood('chewing'); a.say('ვჭამ!', 'r_vcham'); await a.wait(1400); a.hush()
  a.mood('think'); a.cat('happy', 'tilt'); a.catSay('დილით რას ჭამ?', 'a1'); await a.wait(1800)
  await a.cut({ hint: 'Кот спрашивает Бомбору — «ты». Смахни <b lang="ka">ვ</b>', to: 'ჭამ', toRu: 'ты ешь', toA: 'r_cham' })
  a.note('<b lang="ka">რას ჭამ?</b> — что ешь? Про «ты» — без <b lang="ka">ვ</b>.'); await a.wait(2000); a.catHush()
  a.mood('sated'); a.say('ხაჭაპურს ვჭამ!', 'khach'); a.note('А Бомбора отвечает про себя — снова с <b lang="ka">ვ</b>: <b lang="ka">ვჭამ</b>.'); await a.wait(2600); a.hush(); a.unnote(); a.mood('happy')
  a.word('ვსეირნობ', 'я гуляю', null); a.catSay('ხშირად სეირნობ?', 'a3'); await a.wait(1800)
  await a.cut({ hint: 'Опять «ты» — смахни <b lang="ka">ვ</b>', to: 'სეირნობ', toRu: 'ты гуляешь', toA: 'r_seirnob' })
  a.catHush(); a.mood('cheer'); a.pose('wave'); a.say('ვსეირნობ!', 'r_vseirnob')
  a.note('<b lang="ka">ხშირად სეირნობ?</b> — часто гуляешь? Ответ — про себя: <b lang="ka">ვსეირნობ</b>.'); await a.wait(1600); a.hush(); a.pose(); await a.move(112); await a.wait(1600)
} }


function mergeLevel(stage, done) {
  const nums = [5, 7, 8]
  const target = $(`<div class="merge"><span class="n" lang="ka"></span><span class="sa" lang="ka">საათზე</span></div>`)
  const row = $(`<div class="numtiles">${nums.map(n => `<button class="ntile" data-n="${n}"><b lang="ka">${HOURS[n][0]}</b><span class="d">${n}</span></button>`).join('')}</div>`)
  stage.append($(`<p class="round">საათზე — «в … часов»</p>`), target, $(`<div style="height:24px"></div>`), row)
  let got = 0
  const put = t => {
    const n = +t.dataset.n, [full, short] = HOURS[n]
    t.classList.add('used'); untip(); fx.drop()
    target.classList.remove('cut', 'got')
    target.querySelector('.n').innerHTML = [...full].map((c, i) => `<b class="${i === full.length - 1 && full !== short ? 'i' : ''}">${c}</b>`).join('')
    void target.offsetWidth
    target.classList.add('cut', 'got'); say('h' + n)
    later(() => {
      fx.ok(); if (full !== short) haptic('soft')
      tip(target, full !== short ? `-ი упало: <b lang="ka">${short} საათზე</b> — в ${n}` : `<b lang="ka">რვა</b> кончается на -ა: терять нечего`, 'below')
    }, 800)
    if (++got === nums.length) later(() => {
      untip()
      const rc = $(`<div class="rulecard"><b>Правило</b><span>Перед <b lang="ka">საათზე</b> число теряет -ი: <b lang="ka">ხუთი → ხუთ</b>. Если -ი нет, ничего не меняется.</span><button class="cta">Понятно</button></div>`)
      rc.querySelector('.cta').onclick = () => { fx.pick(); done() }; stage.append(rc)
    }, 2600)
    else later(() => { untip(); const nx = row.querySelector('.ntile:not(.used)'); ghost(nx, target) }, 2600)
  }
  row.querySelectorAll('.ntile').forEach(t => draggable(t, { targets: () => [target], drop: () => put(t), tap: () => put(t) }))
  later(() => { ghost(row.firstElementChild, target); tip(target, 'Перетащи число к слову «часов»', 'above') }, 400)
}
function dialEl() {
  return $(`<div class="dialwrap"><div class="dial snap" style="--hand:0deg">${Array.from({ length: 12 }, (_, i) => `<span class="hn" data-h="${i + 1}" style="--a:${(i + 1) * 30}deg">${i + 1}</span>`).join('')}<i class="hand"></i><i class="pin"></i></div></div>`)
}
function handRounds(stage, { rounds, listen, hint = true, intro, lbl }, done) {
  let r = 0, first = true
  const nextH = deck([1, 2, 3, 4, 5, 6, 7, 9, 10, 11])
  function round() {
    stage.replaceChildren()
    const cur = nextH()
    const card = $(`<div class="say-card"><div class="say">${listen ? '<span class="hidden-txt">Слушай и ставь стрелку</span>' : `<b lang="ka">${hourKa(cur)}</b><span class="tr">${cyr(hourKa(cur))}</span>`}</div><button class="ear loud" aria-label="Послушать">${EAR}</button></div>`)
    const wrap = dialEl(), dial = wrap.firstElementChild
    stage.append($(`<div class="round">${roundLbl(lbl, r, rounds)}</div>`), card, wrap)
    card.querySelector('.ear').onclick = () => say('h' + cur)
    later(() => say('h' + cur), 250)
    let ang = 0, last = 0, drag = false, locked = false
    const at = e => { const b = dial.getBoundingClientRect(); const a = Math.atan2(e.clientX - (b.left + b.width / 2), -(e.clientY - (b.top + b.height / 2))) * 180 / Math.PI; return (a + 360) % 360 }
    const hourOf = a => Math.round(a / 30) % 12 || 12
    const mark = h => dial.querySelectorAll('.hn').forEach(x => x.classList.toggle('hit', +x.dataset.h === h))
    dial.onpointerdown = e => { if (locked) return; drag = true; unghost(); untip(); try { dial.setPointerCapture(e.pointerId) } catch {} dial.classList.remove('snap'); ang = at(e); dial.style.setProperty('--hand', ang + 'deg'); fx.pick() }
    dial.onpointermove = e => {
      if (!drag) return; ang = at(e); dial.style.setProperty('--hand', ang + 'deg')
      const h = hourOf(ang); if (h !== last) { last = h; fx.tick(); mark(h) }
    }
    dial.onpointerup = dial.onpointercancel = () => {
      if (!drag) return; drag = false
      const h = hourOf(ang); dial.classList.add('snap'); dial.style.setProperty('--hand', h * 30 + 'deg')
      if (h === cur) {
        locked = true; fx.drop(); fx.ok(); dial.classList.add('ok'); mark(0)
        const hn = dial.querySelector(`.hn[data-h="${h}"]`); hn.classList.add('good'); burst(hn, 10)
        if (listen) card.querySelector('.say').innerHTML = `<b lang="ka">${hourKa(cur)}</b><span class="tr">в ${cur}</span>`
        r++; later(r < rounds ? round : done, 1200)
      } else {
        fx.bad(); dial.classList.remove('no'); void dial.offsetWidth; dial.classList.add('no')
        tip(card, `Стрелка на ${h}, это <b lang="ka">${hourKa(h)}</b>`, 'below')
      }
    }
    if (first && hint) later(() => { ghost(dial.querySelector('.hn[data-h="12"]'), dial.querySelector(`.hn[data-h="${cur}"]`)); tip(card, 'Потяни стрелку на нужный час', 'below') }, 700)
    else if (first && intro) later(() => tip(card, intro, 'below'), 700)
    first = false
  }
  round()
}
function sayRounds(stage, { rounds, lbl }, done) {
  let r = 0
  const nextH = deck([1, 2, 3, 4, 5, 6, 7, 10, 11, 12])
  function round() {
    stage.replaceChildren()
    const cur = nextH(), [full] = HOURS[cur]
    const wrap = dialEl(), dial = wrap.firstElementChild
    dial.style.setProperty('--hand', cur * 30 + 'deg')
    const right = hourKa(cur), trap = `${full} საათზე`
    const ch = $(`<div class="choices2">${shuffle([right, trap]).map(o => `<button class="ptile" data-o="${o}"><b lang="ka">${o}</b><span class="tr">${cyr(o)}</span></button>`).join('')}</div>`)
    stage.append($(`<div class="round">${roundLbl(lbl, r, rounds)} · посмотри на часы и выбери фразу</div>`), wrap, ch)
    let over = false
    const put = t => {
      if (over) return
      if (t.dataset.o === right) { over = true; fx.drop(); fx.ok(); t.classList.add('right'); dial.classList.add('ok'); burst(dial, 12); say('h' + cur); untip(); r++; later(r < rounds ? round : done, 1100) }
      else { fx.bad(); shake(t); tip(t, 'Число не потеряло -ი', 'above') }
    }
    ch.querySelectorAll('.ptile').forEach(t => draggable(t, { targets: () => [dial], drop: () => put(t), tap: () => put(t) }))
  }
  round()
}

/* ───────── Нино пишет: плитки в клетки, фраза растёт ───────── */
const NINO = [
  { pics: ['coffee'], slots: ['what'], need: ['ყავას'], fixed: 'ვსვამ', tiles: [['ყავას', 'what'], ['ყავა', 'what']], audio: 'coffee', ru: 'пью кофе',
    bad: { 'ყავა': 'Кофе, который пьёшь, получает -ს: <b lang="ka">ყავას</b>' }, after: 'Кофе, который пьёшь — <b lang="ka">ყავას</b>, с -ს' },
  { pics: ['tea'], slots: ['what', 'do'], need: ['ჩაის', 'ვსვამ'], tiles: [['ჩაის', 'what'], ['ჩაი', 'what'], ['ვსვამ', 'do'], ['სვამს', 'do']], audio: 'tea', ru: 'пью чай',
    bad: { 'ჩაი': 'Чай, который пьёшь, — с -ს: <b lang="ka">ჩაის</b>', 'სვამს': 'Это «он пьёт». Про себя — с ვ-: <b lang="ka">ვსვამ</b>' }, intro: 'Теперь две клетки: что и что делаю' },
  { pics: ['morning', 'coffee'], slots: ['when', 'what', 'do'], need: ['დილით', 'ყავას', 'ვსვამ'], tiles: [['დილით', 'when'], ['საღამოს', 'when'], ['ყავას', 'what'], ['ვსვამ', 'do'], ['სვამს', 'do']], audio: 's1', ru: 'утром пью кофе',
    bad: { 'საღამოს': 'Это «вечером». На картинке солнце встаёт', 'სვამს': 'Это «он пьёт». Про себя — <b lang="ka">ვსვამ</b>' }, intro: 'Новая клетка спереди — когда' },
  { pics: ['clock8', 'towork'], slots: ['when', 'what', 'do'], need: ['რვა საათზე', 'სამსახურში', 'მივდივარ'], tiles: [['რვა საათზე', 'when'], ['ხუთ საათზე', 'when'], ['სამსახურში', 'what'], ['სახლში', 'what'], ['მივდივარ', 'do'], ['მიდის', 'do']], audio: 's2', ru: 'в восемь иду на работу',
    bad: { 'ხუთ საათზე': 'Это «в пять». На часах восемь', 'სახლში': 'Это «домой». Маршрутка везёт на работу', 'მიდის': 'Это «он идёт». Про себя — <b lang="ka">მივდივარ</b>' } },
  { pics: ['evening', 'film'], slots: ['when', 'what', 'do'], plain: true, need: ['საღამოს', 'ფილმს', 'ვუყურებ'], tiles: [['საღამოს', 'when'], ['დილით', 'when'], ['ფილმს', 'what'], ['ფილმი', 'what'], ['ვუყურებ', 'do'], ['უყურებს', 'do']], audio: 's3', ru: 'вечером смотрю фильм',
    bad: { 'დილით': 'Это «утром». На картинке луна', 'ფილმი': 'Фильм, который смотришь, — с -ს: <b lang="ka">ფილმს</b>', 'უყურებს': 'Это «он смотрит». Про себя — <b lang="ka">ვუყურებ</b>' }, intro: 'Без подсказок цветом — сам' },
]
// Переписка растёт с каждым ответом. Чат берёт только ту высоту, что осталась под клетками и плитками,
// прокручивается внутри и сам доезжает до нового сообщения: задание целиком на одном экране
let fitNow = null
addEventListener('resize', () => fitNow?.())
function liveChat(chat) {
  chat.classList.add('live')
  const fit = () => {
    if (!chat.isConnected) return
    chat.style.maxHeight = 'none'
    const over = document.documentElement.scrollHeight - innerHeight
    chat.style.maxHeight = over > 0 ? Math.max(96, chat.offsetHeight - over) + 'px' : ''
    chat.scrollTop = chat.scrollHeight
  }
  if (!chat._obs) {
    chat._obs = new MutationObserver(() => { fit(); chat.scrollTo({ top: chat.scrollHeight, behavior: reduced() ? 'auto' : 'smooth' }) })
    chat._obs.observe(chat, { childList: true })
  }
  // клетки и плитки под чатом тоже меняют высоту (слово встало в клетку, плитки спрятались)
  chat._ro?.disconnect(); chat._ro = new ResizeObserver(() => fit())
  ;[...chat.parentElement.children].forEach(e => e !== chat && chat._ro.observe(e))
  fitNow = fit; fit(); later(fit, 60)
  return fit
}
const CAP = { when: 'когда', what: 'что / куда', do: 'делаю', freq: 'как часто', where: 'куда / где' }
function ninoStep(s, chat) {
  return (stage, done) => {
    const box = $(`<div class="ninobox"></div>`)
    stage.append(chat, box)
    if (s.ask) { chat.append($(`<div class="msg her"><b lang="ka">${s.ask[0]}</b><span class="tr">${cyr(s.ask[0])} — ${s.ask[1]}</span></div>`)); haptic('soft'); if (s.ask[2]) say(s.ask[2]) }
    // ответ подсказывают картинки, а где картинкой не скажешь — словами по-русски
    const pics = $(`<div class="msg her pics">${(s.pics ?? []).map(p => ICON[p]).join('')}${s.cue ? `<span class="cue">${s.cue}</span>` : ''}<span class="tr">${s.cue && !s.pics ? 'ответь' : 'ответь по картинке'}</span></div>`)
    chat.append(pics)
    const slots = s.slots.map((kind, n) => $(`<div class="slot ${s.plain ? 'plain' : kind}" data-n="${n}"><span class="cap">${CAP[kind]}</span><b lang="ka"></b></div>`))
    const row = $(`<div class="slots"></div>`); row.append(...slots)
    if (s.fixed) row.append($(`<div class="slot do full"><span class="cap">делаю</span><b lang="ka">${s.fixed}</b></div>`))
    const tray = $(`<div class="tray">${shuffle(s.tiles).map(([w, kind]) => `<button class="chip ${s.plain ? '' : kind}" data-w="${w}" data-kind="${kind}"><b lang="ka">${w}</b><span class="tr">${cyr(w)}</span></button>`).join('')}</div>`)
    box.append(row, tray)
    liveChat(chat)
    const filled = []
    const place = (c, slot) => {
      const w = c.dataset.w
      const n = slot ? +slot.dataset.n : s.slots.findIndex((k, j) => k === c.dataset.kind && !filled[j])
      if (n < 0 || filled[n]) { fx.bad(); shake(c); return }
      if (w !== s.need[n]) {
        fx.bad(); shake(c)
        const elsewhere = s.need.indexOf(w)
        tip(c, elsewhere >= 0 ? `Это слово в другую клетку — «${CAP[s.slots[elsewhere]]}»` : s.bad[w], 'above')
        return
      }
      fx.drop(); fx.ok(); untip(); unghost(); filled[n] = w; c.classList.add('used')
      slots[n].classList.add('full'); slots[n].querySelector('b').textContent = w; burst(slots[n], 10)
      if (filled.filter(Boolean).length === s.slots.length) later(send, 350)
    }
    tray.querySelectorAll('.chip').forEach(c => draggable(c, { targets: () => slots.filter((x, j) => !filled[j]), drop: t => place(c, t), tap: () => place(c) }))
    function send() {
      chat.append($(`<div class="msg me"><b lang="ka">${[...s.need, ...(s.fixed ? [s.fixed] : [])].join(' ')}.</b><span class="tr">${s.ru}</span></div>`))
      tone(880, 0.06, 'sine', 0.06); say(s.audio); box.remove()
      if (s.after) {
        later(() => tip(chat.lastElementChild, s.after, 'below'), 300)
        later(() => { untip(); chat.append($(`<div class="msg her"><b lang="ka">მე ჩაის ვსვამ.</b><span class="tr">${cyr('მე ჩაის ვსვამ')} — а я пью чай</span></div>`)); haptic('soft'); say('tea') }, 2600)
        later(done, 4200)
      } else later(done, 1500)
    }
    // Первый шаг ведём за руку: три подсказки по очереди, потом рука
    if (s.after) {
      say('q')
      later(() => tip(chat.querySelector('.msg'), 'Нино спрашивает, что ты делаешь утром', 'below'), 300)
      later(() => tip(pics, 'Ответ — на картинке', 'below'), 2300)
      later(() => { untip(); ghost(tray.querySelector('[data-w="ყავას"]'), slots[0]); tip(slots[0], 'Перетащи слово в пустую клетку', 'above') }, 4300)
    } else if (s.intro) later(() => tip(slots[0], s.intro, 'above'), 400)
  }
}

/* ───────── Люблю — не люблю: смахни карточку ───────── */
const LIKE = {
  coffee: { ka: 'ყავა', ru: 'кофе', verb: 'ვსვამ', doRu: 'пью кофе' },
  tea: { ka: 'ჩაი', ru: 'чай', verb: 'ვსვამ', doRu: 'пью чай' },
  music: { ka: 'მუსიკა', ru: 'музыку', verb: 'ვუსმენ', doRu: 'слушаю музыку' },
  wine: { ka: 'ღვინო', ru: 'вино', verb: 'ვსვამ', doRu: 'пью вино' },
  sea: { ka: 'ზღვა', ru: 'море' },
  mount: { ka: 'მთა', ru: 'горы' },
}
let likeMix = 0
// Карточка: фраза с дыркой; влево — слово как есть, вправо — с -ს
function swipeRounds(stage, { kinds, fuse, hint = true, intro, lbl }, done) {
  let r = 0, first = true
  const total = kinds.length
  const nextDo = deck(Object.keys(LIKE).filter(x => LIKE[x].verb)), nextAny = deck(Object.keys(LIKE))
  function round() {
    stage.replaceChildren()
    const kind = kinds[r]
    const k = kind === 'do' ? nextDo() : nextAny(), L = LIKE[k]
    const withS = L.ka + 'ს'
    const right = kind === 'do' ? 'r' : 'l'
    const frame = kind === 'do' ? `<span class="gap"></span> ${L.verb}` : `${kind === 'n' ? 'არ ' : ''}მიყვარს <span class="gap"></span>`
    const ru = kind === 'do' ? L.doRu : `${kind === 'n' ? 'не ' : ''}люблю ${L.ru}`
    const audio = kind === 'do' ? k : `${kind === 'n' ? 'n' : 'l'}_${k}`
    const fz = fuse ? $(`<div class="fuse"><i></i></div>`) : null
    const sw = $(`<div class="swipe"><div class="zone l"><span class="cap">как есть</span><b lang="ka">${L.ka}</b></div><div class="zone r"><span class="cap">с -ს</span><b lang="ka">${withS}</b></div>
      <div class="scard"><span class="it">${ICON[k]}</span><div class="frame" lang="ka">${frame}</div><div class="ru">${ru}</div></div></div>`)
    stage.append($(`<div class="round">${lbl ? lbl() : `Карточка ${r + 1} из ${total}`}</div>`), ...(fz ? [fz] : []), sw)
    const card = sw.querySelector('.scard'), zl = sw.querySelector('.zone.l'), zr = sw.querySelector('.zone.r')
    let sx, dx = 0, id = null, over = false, timer, side0 = ''
    const decide = side => {
      if (over) return; over = true; clearInterval(timer); untip(); unghost()
      const ok = side === right, z = side === 'l' ? zl : zr
      card.querySelector('.gap').textContent = side === 'l' ? L.ka : withS
      card.classList.add(side === 'l' ? 'fly-l' : 'fly-r')
      z.classList.add(ok ? 'good' : 'bad')
      if (ok) { fx.ok(); burst(z, 10); say(audio); r++; later(r < total ? round : done, 1000) }
      else {
        fx.bad(); if (kind !== 'do') likeMix++
        later(() => {
          card.classList.remove('fly-l', 'fly-r'); card.classList.add('back'); card.style.transform = ''; z.classList.remove('bad'); over = false
          card.querySelector('.gap').textContent = ''
          tip(card, kind === 'do' ? `Когда ${L.doRu.split(' ')[0]} — с -ს: <b lang="ka">${withS} ${L.verb}</b>` : `После მიყვარს — как есть: <b lang="ka">მიყვარს ${L.ka}</b>`, 'above')
          if (fuse) startFuse()
        }, 450)
      }
    }
    card.onpointerdown = e => { if (over) return; id = e.pointerId; sx = e.clientX; side0 = ''; card.classList.remove('back'); try { card.setPointerCapture(id) } catch {} fx.pick(); unghost() }
    card.onpointermove = e => {
      if (e.pointerId !== id) return; dx = e.clientX - sx
      card.style.transform = `translateX(${dx}px) rotate(${dx / 14}deg)`
      const side = dx < -40 ? 'l' : dx > 40 ? 'r' : ''
      // слово подставляется в дырку, пока тянешь: щелчок на каждой смене
      if (side !== side0) { side0 = side; if (side) selection() }
      card.querySelector('.gap').textContent = side === 'l' ? L.ka : side === 'r' ? withS : ''
      zl.classList.toggle('hot', dx < -60); zr.classList.toggle('hot', dx > 60)
    }
    card.onpointerup = card.onpointercancel = e => {
      if (e.pointerId !== id) return; id = null; zl.classList.remove('hot'); zr.classList.remove('hot')
      if (dx < -70) decide('l'); else if (dx > 70) decide('r')
      else { card.classList.add('back'); card.style.transform = ''; card.querySelector('.gap').textContent = '' }
      dx = 0
    }
    zl.onclick = () => decide('l'); zr.onclick = () => decide('r')
    function startFuse() {
      let left = 1; fz.classList.remove('low')
      timer = every(() => {
        left -= 0.02; fz.firstElementChild.style.transform = `scaleX(${Math.max(left, 0)})`
        if (left < 0.3 && !fz.classList.contains('low')) { fz.classList.add('low'); haptic('soft') }
        if (left <= 0) { clearInterval(timer); if (!over) { tip(card, 'Не успел — ещё раз', 'above'); fx.bad(); startFuse() } }
      }, 100)
    }
    if (fuse) startFuse()
    if (first && hint) later(() => { ghost(card, right === 'l' ? zl : zr); tip(card, right === 'r' ? 'Пьёшь — значит с -ს. Смахни карточку вправо' : 'Любишь — слово как есть. Смахни влево', 'above') }, 600)
    else if (first && intro) later(() => tip(card, intro, 'above'), 600)
    first = false
  }
  round()
}
// Находка: смахнуть -ს с ყავას, когда перед ним встаёт მიყვარს
function dropS(stage, done) {
  const wrap = $(`<div class="sdrop"><span lang="ka" class="pre">მიყვარს</span><span lang="ka">ყავა</span><span class="s" lang="ka">ს</span><span class="bin"></span></div>`)
  const cap = $(`<p class="soft center">${cyr('ყავას ვსვამ')} — пью кофе</p>`)
  stage.append(cap, wrap)
  const s = wrap.querySelector('.s')
  later(() => { wrap.querySelector('.pre').classList.add('on'); haptic('pop'); cap.textContent = 'А если кофе любишь?'; tip(s, 'После მიყვარს эта -ს не нужна. Стряхни её вниз', 'above'); ghost(s, wrap.querySelector('.bin')) }, 900)
  let sy, sx, id = null, gone = false
  s.onpointerdown = e => { id = e.pointerId; sx = e.clientX; sy = e.clientY; try { s.setPointerCapture(id) } catch {} fx.pick(); unghost() }
  s.onpointermove = e => { if (e.pointerId !== id) return; s.style.transform = `translate(${e.clientX - sx}px, ${e.clientY - sy}px)` }
  const drop = () => {
    if (gone) return; gone = true; untip(); s.classList.add('fall'); fx.drop(); fx.ok(); say('l_coffee')
    later(() => { s.remove(); wrap.querySelector('.bin').remove(); cap.innerHTML = `<b lang="ka">მიყვარს ყავა</b> — ${cyr('მიყვარს ყავა')} — люблю кофе`; burst(cap, 12) }, 700)
    later(done, 2400)
  }
  s.onpointerup = s.onpointercancel = e => {
    if (e.pointerId !== id) return; id = null
    s.style.transform = ''; drop()
  }
}

/* ───────── Разложи: карточка уходит влево или вправо (ем / пью, про меня / про Нино) ───────── */
function sortRounds(stage, { cards, zones, fuse, hint = true, intro, lbl }, done) {
  let r = 0, first = true
  function round() {
    stage.replaceChildren()
    const c = cards[r]
    const fz = fuse ? $(`<div class="fuse"><i></i></div>`) : null
    const sw = $(`<div class="swipe"><div class="zone l"><span class="cap">${zones.l.cap}</span><b lang="ka">${zones.l.ka}</b></div><div class="zone r"><span class="cap">${zones.r.cap}</span><b lang="ka">${zones.r.ka}</b></div>
      <div class="scard"><span class="it">${ICON[c.ic] ?? ''}</span><div class="frame" lang="ka">${c.frame}</div><div class="ru">${c.ru ?? ''}</div></div></div>`)
    stage.append($(`<div class="round">${lbl ? lbl() : `Карточка ${r + 1} из ${cards.length}`}</div>`), ...(fz ? [fz] : []), sw)
    const card = sw.querySelector('.scard'), zl = sw.querySelector('.zone.l'), zr = sw.querySelector('.zone.r'), gap = card.querySelector('.gap')
    let sx, dx = 0, id = null, over = false, timer, side0 = ''
    const show = side => { if (gap) gap.textContent = side ? zones[side].ka : '' }
    const decide = side => {
      if (over) return; over = true; clearInterval(timer); untip(); unghost()
      const ok = side === c.side, z = side === 'l' ? zl : zr
      show(side); card.classList.add(side === 'l' ? 'fly-l' : 'fly-r'); z.classList.add(ok ? 'good' : 'bad')
      if (ok) { fx.ok(); burst(z, 10); say(c.audio); r++; later(r < cards.length ? round : done, 1000) }
      else later(() => {
        fx.bad(); card.classList.remove('fly-l', 'fly-r'); card.classList.add('back'); card.style.transform = ''; z.classList.remove('bad'); over = false; show('')
        tip(card, c.why, 'above'); if (fuse) startFuse()
      }, 450)
    }
    card.onpointerdown = e => { if (over) return; id = e.pointerId; sx = e.clientX; side0 = ''; card.classList.remove('back'); try { card.setPointerCapture(id) } catch {} fx.pick(); unghost() }
    card.onpointermove = e => {
      if (e.pointerId !== id) return; dx = e.clientX - sx
      card.style.transform = `translateX(${dx}px) rotate(${dx / 14}deg)`
      const side = dx < -40 ? 'l' : dx > 40 ? 'r' : ''
      if (side !== side0) { side0 = side; if (side) selection() }
      show(side); zl.classList.toggle('hot', dx < -60); zr.classList.toggle('hot', dx > 60)
    }
    card.onpointerup = card.onpointercancel = e => {
      if (e.pointerId !== id) return; id = null; zl.classList.remove('hot'); zr.classList.remove('hot')
      if (dx < -70) decide('l'); else if (dx > 70) decide('r')
      else { card.classList.add('back'); card.style.transform = ''; show('') }
      dx = 0
    }
    zl.onclick = () => decide('l'); zr.onclick = () => decide('r')
    function startFuse() {
      let left = 1; fz.classList.remove('low')
      timer = every(() => {
        left -= 0.025; fz.firstElementChild.style.transform = `scaleX(${Math.max(left, 0)})`
        if (left < 0.3 && !fz.classList.contains('low')) { fz.classList.add('low'); haptic('soft') }
        if (left <= 0) { clearInterval(timer); if (!over) { tip(card, 'Не успел — ещё раз', 'above'); fx.bad(); startFuse() } }
      }, 100)
    }
    if (fuse) startFuse()
    if (first && hint) later(() => { ghost(card, c.side === 'l' ? zl : zr); tip(card, intro ?? 'Смахни карточку в нужную сторону', 'above') }, 600)
    else if (first && intro) later(() => tip(card, intro, 'above'), 600)
    first = false
  }
  round()
}
// Ем или пью: то, что ешь и пьёшь, одинаково с -ს — различает только действие
const EATS = [
  { ic: 'water', obj: 'წყალს', ru: 'вода', side: 'r' }, { ic: 'khach', obj: 'ხაჭაპურს', ru: 'хачапури', side: 'l' }, { ic: 'fruit', obj: 'ხილს', ru: 'фрукты', side: 'l' },
  { ic: 'coffee', obj: 'ყავას', ru: 'кофе', side: 'r' }, { ic: 'tea', obj: 'ჩაის', ru: 'чай', side: 'r' }, { ic: 'wine', obj: 'ღვინოს', ru: 'вино', side: 'r' },
]
const EAT_ZONES = { l: { cap: 'ем', ka: 'ვჭამ' }, r: { cap: 'пью', ka: 'ვსვამ' } }
const eatCards = n => { const d = deck(EATS); return Array.from({ length: n }, () => { const e = d(); return { ic: e.ic, frame: `${e.obj} <span class="gap"></span>`, ru: e.ru, side: e.side, audio: e.ic,
  why: e.side === 'l' ? `${e.ru[0].toUpperCase() + e.ru.slice(1)} едят — <b lang="ka">${e.obj} ვჭამ</b>` : `${e.ru[0].toUpperCase() + e.ru.slice(1)} пьют — <b lang="ka">${e.obj} ვსვამ</b>` } }) }
// Про меня или про Нино: одно и то же дело в двух формах
const ME_ZONES = { l: { cap: 'про меня', ka: 'მე' }, r: { cap: 'про Нино', ka: 'ის' } }
const meCards = (pool, n) => { const d = deck(pool); return Array.from({ length: n }, () => {
  const k = d(), me = Math.random() < 0.5, A = WORD[k]
  return { ic: k, frame: me ? A.ka : A.she, side: me ? 'l' : 'r', audio: me ? k : '',
    why: me ? `<b lang="ka">${A.ka}</b> — «я ${A.ru}». Про Нино было бы <b lang="ka">${A.she}</b>` : `<b lang="ka">${A.she}</b> — «она ${A.sru}». Про себя — <b lang="ka">${A.ka}</b>` } }) }

/* ───────── Правда или нет: Нино прислала фото из своего дня и подписала. Всё верно? ───────── */
function truthRounds(stage, { pool, rounds, lbl }, done) {
  let r = 0, first = true
  const next = deck(pool)
  function round() {
    stage.replaceChildren()
    const k = next(), truth = Math.random() < 0.5
    const k2 = truth ? k : shuffle(pool.filter(x => x !== k))[0]
    const card = $(`<div class="tcard"><div class="photo">${ICON[k]}</div><div class="cap"><b lang="ka">ნინო ${WORD[k2].she}.</b><span class="tr">${cyr('ნინო ' + WORD[k2].she)}</span></div></div>`)
    const row = $(`<div class="cta-row"><button class="cta ghost no">Нет</button><button class="cta yes">Правда</button></div>`)
    stage.append($(`<div class="round">${lbl ? lbl() : `Фото ${r + 1} из ${rounds}`} · подпись верная?</div>`), card, row)
    let over = false
    const answer = yes => {
      if (over) return
      if (yes === truth) {
        over = true; fx.ok(); burst(card, 12); untip(); card.classList.add('ok')
        card.querySelector('.cap').insertAdjacentHTML('beforeend', truth ? `<span class="ru">Да: Нино ${WORD[k].sru}</span>` : `<span class="ru">На фото: <b lang="ka">ნინო ${WORD[k].she}</b> — ${WORD[k].sru}</span>`)
        r++; later(r < rounds ? round : done, truth ? 1300 : 2300)
      } else { fx.bad(); shake(card); tip(row, truth ? `Верно подписано: <b lang="ka">${WORD[k].she}</b> — ${WORD[k].sru}` : `В подписи — «${WORD[k2].sru}», а на фото другое`, 'below') }
    }
    row.querySelector('.no').onclick = () => { fx.pick(); answer(false) }
    row.querySelector('.yes').onclick = () => { fx.pick(); answer(true) }
    if (first) later(() => tip(row, 'Нино прислала фото и подписала. Подпись правдивая?', 'below'), 500)
    first = false
  }
  round()
}

/* ───────── Уроки: разминка на старом → маленькая порция нового → смесь ───────── */
// Шаги-кирпичики для смесей: один раунд любой механики, счёт раундов общий на весь шаг
function mix(parts) {
  return (stage, done) => {
    let i = 0
    const lbl = () => `Раунд ${i + 1} из ${parts.length}`
    const next = () => i < parts.length ? parts[i](stage, lbl, () => { i++; next() }) : done()
    next()
  }
}
const B = o => (s, lbl, d) => bubbleRounds(s, { n: 4, pool: MORNING, ...o, rounds: 1, hint: false, lbl }, d)
const H = o => (s, lbl, d) => handRounds(s, { ...o, rounds: 1, hint: false, lbl }, d)
const S = () => (s, lbl, d) => sayRounds(s, { rounds: 1, lbl }, d)
const W = kind => (s, lbl, d) => swipeRounds(s, { kinds: [kind], hint: false, lbl }, d)
const T = pool => (s, lbl, d) => truthRounds(s, { pool, rounds: 1, lbl }, d)
const R = (make, zones) => (s, lbl, d) => sortRounds(s, { cards: make(), zones, hint: false, lbl }, d)
const N = (step, chat) => (s, lbl, d) => { s.replaceChildren($(`<div class="round">${lbl()}</div>`)); ninoStep(step, chat)(s, d) }
const solo = step => ({ ...step, after: undefined, intro: undefined })
const plain = step => ({ ...solo(step), plain: true })
const ninoChat = () => $(`<div class="chat"><div class="chat-top"><div class="ava" lang="ka">ნ</div><div class="who">Нино<small>соседка из «Знакомства»</small></div></div>
  <div class="msg her"><b lang="ka">რას აკეთებ დილით?</b><span class="tr">${cyr('რას აკეთებ დილით?')} — что делаешь утром?</span></div></div>`)

const DAY12 = [...MORNING, ...DAY, ...EVENING], ALL = Object.keys(ACT), FIRST3 = ['wake', 'coffee', 'towork'], NEXT3 = ['dress', 'breakfast', 'tea']
// Фразы, собранные из того, что уже было в прошлых уроках: часы + утро, утро + чай, вечер + музыка
const COFFEE2 = { pics: ['coffee'], slots: ['what', 'do'], need: ['ყავას', 'ვსვამ'], tiles: [['ყავას', 'what'], ['ყავა', 'what'], ['ვსვამ', 'do'], ['სვამს', 'do']], audio: 'coffee', ru: 'пью кофе',
  bad: { 'ყავა': 'Кофе, который пьёшь, — с -ს: <b lang="ka">ყავას</b>', 'სვამს': 'Это «он пьёт». Про себя — с ვ-: <b lang="ka">ვსვამ</b>' } }
const WAKE7 = { pics: ['clock7', 'wake'], slots: ['when', 'do'], need: ['შვიდ საათზე', 'ვიღვიძებ'], tiles: [['შვიდ საათზე', 'when'], ['შვიდი საათზე', 'when'], ['ვიღვიძებ', 'do'], ['იღვიძებს', 'do']], audio: 's4', ru: 'в семь просыпаюсь',
  bad: { 'შვიდი საათზე': 'Перед საათზე число теряет -ი: <b lang="ka">შვიდ საათზე</b>', 'იღვიძებს': 'Это «он просыпается». Про себя — <b lang="ka">ვიღვიძებ</b>' }, intro: 'Часы и утро — оба уже знаешь' }
const TEA3 = { pics: ['morning', 'tea'], slots: ['when', 'what', 'do'], need: ['დილით', 'ჩაის', 'ვსვამ'], tiles: [['დილით', 'when'], ['საღამოს', 'when'], ['ჩაის', 'what'], ['ჩაი', 'what'], ['ვსვამ', 'do'], ['სვამს', 'do']], audio: 's5', ru: 'утром пью чай',
  bad: { 'საღამოს': 'Это «вечером». На картинке солнце встаёт', 'ჩაი': 'Чай, который пьёшь, — с -ს: <b lang="ka">ჩაის</b>', 'სვამს': 'Это «он пьёт». Про себя — <b lang="ka">ვსვამ</b>' } }
const BREAKFAST2 = { pics: ['morning', 'breakfast'], slots: ['when', 'do'], need: ['დილით', 'ვსაუზმობ'], tiles: [['დილით', 'when'], ['საღამოს', 'when'], ['ვსაუზმობ', 'do'], ['საუზმობს', 'do']], audio: 's6', ru: 'утром завтракаю',
  bad: { 'საღამოს': 'Это «вечером». На картинке солнце встаёт', 'საუზმობს': 'Это «он завтракает». Про себя — <b lang="ka">ვსაუზმობ</b>' } }
const MUSIC3 = { pics: ['evening', 'music'], slots: ['when', 'what', 'do'], plain: true, ask: ['საღამოს?', 'а вечером?'], need: ['საღამოს', 'მუსიკას', 'ვუსმენ'], tiles: [['საღამოს', 'when'], ['დილით', 'when'], ['მუსიკას', 'what'], ['მუსიკა', 'what'], ['ვუსმენ', 'do'], ['უსმენს', 'do']], audio: 's7', ru: 'вечером слушаю музыку',
  bad: { 'დილით': 'Это «утром». На картинке луна', 'მუსიკა': 'Музыку, которую слушаешь, — с -ს: <b lang="ka">მუსიკას</b>', 'უსმენს': 'Это «он слушает». Про себя — <b lang="ka">ვუსმენ</b>' }, intro: 'Музыка из «люблю» — теперь её слушаешь' }
const FILM3 = { ...NINO[4], ask: ['საღამოს?', 'а вечером?'] }
// Вторая половина: еда, дом, «куда», выходные и «как часто» — те же три клетки, новые слова
const he = (w, me, ru) => `Это «${ru}». Про себя — <b lang="ka">${me}</b>`
const EAT_KH = { pics: ['morning', 'khach'], slots: ['when', 'what', 'do'], need: ['დილით', 'ხაჭაპურს', 'ვჭამ'], tiles: [['დილით', 'when'], ['საღამოს', 'when'], ['ხაჭაპურს', 'what'], ['ხაჭაპური', 'what'], ['ვჭამ', 'do'], ['ვსვამ', 'do']], audio: 's8', ru: 'утром ем хачапури',
  bad: { 'საღამოს': 'Это «вечером». На картинке солнце встаёт', 'ხაჭაპური': 'Хачапури, который ешь, — с -ს: <b lang="ka">ხაჭაპურს</b>', 'ვსვამ': 'Это «пью». Хачапури едят — <b lang="ka">ვჭამ</b>' }, intro: 'Новое действие: ვჭამ — ем' }
const WATER3 = { pics: ['morning', 'water'], slots: ['when', 'what', 'do'], need: ['დილით', 'წყალს', 'ვსვამ'], tiles: [['დილით', 'when'], ['საღამოს', 'when'], ['წყალს', 'what'], ['წყალი', 'what'], ['ვსვამ', 'do'], ['ვჭამ', 'do']], audio: 's17', ru: 'утром пью воду',
  bad: { 'საღამოს': 'Это «вечером». На картинке солнце встаёт', 'წყალი': 'Воду, которую пьёшь, — с -ს: <b lang="ka">წყალს</b>', 'ვჭამ': 'Это «ем». Воду пьют — <b lang="ka">ვსვამ</b>' } }
const COOK3 = { pics: ['evening', 'cook'], slots: ['when', 'what', 'do'], need: ['საღამოს', 'ვახშამს', 'ვამზადებ'], tiles: [['საღამოს', 'when'], ['დილით', 'when'], ['ვახშამს', 'what'], ['ვახშამი', 'what'], ['ვამზადებ', 'do'], ['ამზადებს', 'do']], audio: 's9', ru: 'вечером готовлю ужин',
  bad: { 'დილით': 'Это «утром». На картинке луна', 'ვახშამი': 'Ужин, который готовишь, — с -ს: <b lang="ka">ვახშამს</b>', 'ამზადებს': he('', 'ვამზადებ', 'он готовит') } }
const CALL3 = { pics: ['evening', 'call'], slots: ['when', 'what', 'do'], need: ['საღამოს', 'დედას', 'ვურეკავ'], tiles: [['საღამოს', 'when'], ['დილით', 'when'], ['დედას', 'what'], ['დედა', 'what'], ['ვურეკავ', 'do'], ['ურეკავს', 'do']], audio: 's18', ru: 'вечером звоню маме',
  bad: { 'დილით': 'Это «утром». На картинке луна', 'დედა': 'Кому звонишь — с -ს: <b lang="ka">დედას</b>', 'ურეკავს': he('', 'ვურეკავ', 'он звонит') } }
const SHOP_E = { pics: ['evening', 'shop'], slots: ['when', 'where', 'do'], need: ['საღამოს', 'მაღაზიაში', 'მივდივარ'], tiles: [['საღამოს', 'when'], ['დილით', 'when'], ['მაღაზიაში', 'where'], ['ზღვაზე', 'where'], ['მივდივარ', 'do'], ['მიდის', 'do']], audio: 's15', ru: 'вечером иду в магазин',
  bad: { 'დილით': 'Это «утром». На картинке луна', 'ზღვაზე': 'Это «на море». На картинке сумка из магазина', 'მიდის': he('', 'მივდივარ', 'он идёт') }, intro: 'Куда — в средней клетке' }
const HOME6 = { pics: ['clock6', 'home'], slots: ['when', 'where', 'do'], need: ['ექვს საათზე', 'სახლში', 'ვბრუნდები'], tiles: [['ექვს საათზე', 'when'], ['ექვსი საათზე', 'when'], ['სახლში', 'where'], ['სამსახურში', 'where'], ['ვბრუნდები', 'do'], ['ბრუნდება', 'do']], audio: 's16', ru: 'в шесть возвращаюсь домой',
  bad: { 'ექვსი საათზე': 'Перед საათზე число теряет -ი: <b lang="ka">ექვს საათზე</b>', 'სამსახურში': 'Это «на работу». На картинке дом', 'ბრუნდება': he('', 'ვბრუნდები', 'он возвращается') } }
const SEA_SAT = { pics: ['sat', 'tosea'], slots: ['when', 'where', 'do'], need: ['შაბათს', 'ზღვაზე', 'მივდივარ'], tiles: [['შაბათს', 'when'], ['კვირას', 'when'], ['ზღვაზე', 'where'], ['სახლში', 'where'], ['მივდივარ', 'do'], ['მიდის', 'do']], audio: 's10', ru: 'в субботу иду на море',
  bad: { 'კვირას': 'Это «в воскресенье». В календаре — суббота, предпоследний день', 'სახლში': 'Это «домой». На картинке море', 'მიდის': he('', 'მივდივარ', 'он идёт') }, intro: 'Суббота — на месте «когда»' }
const REST_SUN = { pics: ['sun', 'rest'], slots: ['when', 'do'], need: ['კვირას', 'ვისვენებ'], tiles: [['კვირას', 'when'], ['შაბათს', 'when'], ['ვისვენებ', 'do'], ['ისვენებს', 'do'], ['ვიძინებ', 'do']], audio: 's11', ru: 'в воскресенье отдыхаю',
  bad: { 'შაბათს': 'Это «в субботу». В календаре — воскресенье, последний день', 'ისვენებს': he('', 'ვისვენებ', 'он отдыхает'), 'ვიძინებ': 'Это «засыпаю». На картинке диван — отдыхаю' } }
const STUDY_D = { pics: ['daily', 'study'], slots: ['freq', 'what', 'do'], need: ['ყოველ დღე', 'ქართულს', 'ვსწავლობ'], tiles: [['ყოველ დღე', 'freq'], ['ზოგჯერ', 'freq'], ['ქართულს', 'what'], ['ქართული', 'what'], ['ვსწავლობ', 'do'], ['სწავლობს', 'do']], audio: 's12', ru: 'каждый день учу грузинский',
  bad: { 'ზოგჯერ': 'Это «иногда». В календаре отмечены все дни', 'ქართული': 'Язык, который учишь, — с -ს: <b lang="ka">ქართულს</b>', 'სწავლობს': he('', 'ვსწავლობ', 'он учит') }, intro: 'Как часто — тоже спереди' }
const WINE_S = { pics: ['some', 'wine'], slots: ['freq', 'what', 'do'], need: ['ზოგჯერ', 'ღვინოს', 'ვსვამ'], tiles: [['ზოგჯერ', 'freq'], ['ყოველ დღე', 'freq'], ['ღვინოს', 'what'], ['ღვინო', 'what'], ['ვსვამ', 'do'], ['ვჭამ', 'do']], audio: 's13', ru: 'иногда пью вино',
  bad: { 'ყოველ დღე': 'Это «каждый день». В календаре одна галочка', 'ღვინო': 'Вино, которое пьёшь, — с -ს: <b lang="ka">ღვინოს</b>', 'ვჭამ': 'Это «ем». Вино пьют — <b lang="ka">ვსვამ</b>' } }
const WALK_O = { pics: ['often', 'walk'], slots: ['freq', 'where', 'do'], need: ['ხშირად', 'პარკში', 'ვსეირნობ'], tiles: [['ხშირად', 'freq'], ['ზოგჯერ', 'freq'], ['პარკში', 'where'], ['სამსახურში', 'where'], ['ვსეირნობ', 'do'], ['სეირნობს', 'do']], audio: 's14', ru: 'часто гуляю в парке',
  bad: { 'ზოგჯერ': 'Это «иногда». В календаре много галочек — часто', 'სამსახურში': 'Это «на работе». На картинке дерево — в парке, <b lang="ka">პარკში</b>', 'სეირნობს': he('', 'ვსეირნობ', 'он гуляет') } }
const FRUIT_O = { pics: ['often', 'fruit'], slots: ['freq', 'what', 'do'], plain: true, need: ['ხშირად', 'ხილს', 'ვჭამ'], tiles: [['ხშირად', 'freq'], ['ზოგჯერ', 'freq'], ['ხილს', 'what'], ['ხილი', 'what'], ['ვჭამ', 'do'], ['ვსვამ', 'do'], ['ჭამს', 'do']], audio: 's19', ru: 'часто ем фрукты',
  bad: { 'ზოგჯერ': 'Это «иногда». В календаре много галочек — часто', 'ხილი': 'Фрукты, которые ешь, — с -ს: <b lang="ka">ხილს</b>', 'ვსვამ': 'Это «пью». Фрукты едят — <b lang="ka">ვჭამ</b>', 'ჭამს': he('', 'ვჭამ', 'он ест') } }
// Нино спрашивает по-грузински — «ты»: ჭამ, მიდიხარ, სეირნობ, ბრუნდები
const ask = (step, a) => ({ ...plain(step), ask: a })
const plural = n => n % 10 === 1 && n % 100 !== 11 ? 'раз' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'раза' : 'раз'
const actItems = keys => keys.map(k => [k, WORD[k].ka, WORD[k].ru, k])

// Урок — функция: игра собирается заново на каждый «Ещё раз» (свежий чат Нино, новые случайные раунды).
// Механики чередуются: в одном уроке не бывает двух шагов одной игры подряд на одних и тех же словах.
const LESSONS = [
  () => ({ title: 'Утро', sub: 'три первых дела', levels: [
    { name: 'Послушай три дела', run: (s, d) => learnRow(s, FIRST3, d, 'Нажми — услышишь') },
    { name: 'Мультик: ვ', run: (s, d) => episode(s, EP_ME, d) },
    { name: 'Перетащи картинку в облачко', run: (s, d) => bubbleRounds(s, { pool: FIRST3, n: 2, rounds: 3 }, d) },
    { name: 'Подпиши картинки', run: (s, d) => labelLevel(s, FIRST3, d) },
  ], end: { big: 'три дела есть', text: 'ვ — это «я»: ვიღვიძებ, ვსვამ, მივდივარ.', items: actItems(FIRST3) } }),

  () => ({ title: 'Ещё три дела', sub: 'одеваюсь, завтракаю, чай', levels: [
    { review: true, name: 'Найди пары', run: (s, d) => pairsLevel(s, FIRST3, d) },
    { name: 'Три новых дела', run: (s, d) => learnRow(s, NEXT3, d, 'Новые — послушай') },
    { name: 'Новые в облачко', run: (s, d) => bubbleRounds(s, { pool: NEXT3, n: 3, rounds: 3, hint: false }, d) },
    { name: 'Подпиши: старые и новые', run: (s, d) => labelLevel(s, ['wake', 'dress', 'tea', 'towork'], d) },
  ], end: { big: 'утро собрано', text: 'Шесть утренних дел. Нажми, чтобы послушать ещё раз.', items: actItems(MORNING) } }),

  () => ({ title: 'На слух', sub: 'те же дела без текста', levels: [
    { review: true, name: 'Подпиши картинки', run: (s, d) => labelLevel(s, ['coffee', 'breakfast', 'dress', 'towork'], d) },
    { name: 'Только на слух', run: (s, d) => bubbleRounds(s, { pool: MORNING, n: 3, rounds: 3, listen: true, hint: false, intro: 'Текста нет — слушай. Нажми на динамик, если надо ещё' }, d) },
    { name: 'Поймай, что слышишь', run: (s, d) => catchLevel(s, { pool: MORNING, rounds: 5 }, d) },
  ], end: { big: 'слышишь утро', text: 'Теперь эти слова узнаёшь без подписи — как в жизни.', items: actItems(MORNING) } }),

  () => ({ title: 'Утро по порядку', sub: 'что за чем', levels: [
    { review: true, name: 'Найди пары', run: (s, d) => pairsLevel(s, shuffle(MORNING).slice(0, 4), d) },
    { name: 'Утро Нино', run: (s, d) => orderLevel(s, { keys: ['wake', 'dress', 'coffee', 'towork'] }, d) },
    { name: 'Другое утро — на слух', run: (s, d) => orderLevel(s, { keys: ['wake', 'tea', 'breakfast', 'towork'], listen: true }, d) },
    { name: 'Поймай', run: (s, d) => catchLevel(s, { pool: MORNING, rounds: 4 }, d) },
  ], end: { big: 'утро по шагам', text: 'Ты разложил чужое утро на слух. Дальше — во сколько.', items: actItems(['wake', 'dress', 'breakfast', 'towork']) } }),

  () => ({ title: 'Часы', sub: 'в котором часу', levels: [
    { review: true, name: 'Утро на слух', run: (s, d) => bubbleRounds(s, { pool: MORNING, n: 4, rounds: 2, listen: true, hint: false }, d) },
    { name: 'Мультик: ზე', run: (s, d) => episode(s, EP_ZE, d) },
    { name: 'Куда делось -ი', run: mergeLevel },
    { name: 'Поставь стрелку', run: (s, d) => handRounds(s, { rounds: 3 }, d) },
  ], end: { big: 'часы освоены', text: 'Число перед საათზე теряет -ი: ხუთი → ხუთ. Если -ი нет, ничего не меняется.', items: [5, 7, 8, 11].map(h => ['h' + h, hourKa(h), `в ${h}`, 'clock8']) } }),

  () => ({ title: 'Часы на слух', sub: 'стрелка по голосу', levels: [
    { review: true, name: 'Поставь стрелку', run: (s, d) => handRounds(s, { rounds: 2, hint: false }, d) },
    { name: 'Только на слух', run: (s, d) => handRounds(s, { rounds: 3, listen: true, hint: false, intro: 'Текста нет — слушай и ставь стрелку' }, d) },
    { name: 'Выбери фразу по часам', run: (s, d) => sayRounds(s, { rounds: 3 }, d) },
    { name: 'Утро и часы вперемешку', run: mix([B({ listen: true }), H({ listen: true }), S(), B({ listen: true })]) },
  ], end: { big: 'время на слух', text: 'Часы и утренние дела — уже на слух. Дальше соберём из них фразы.', items: [6, 9, 11].map(h => ['h' + h, hourKa(h), `в ${h}`, 'clock8']) } }),

  () => { const chat = ninoChat(); return { title: 'Нино пишет', sub: 'первая фраза', levels: [
    { review: true, name: 'Утро и часы', run: mix([B({}), H({}), B({ listen: true })]) },
    { name: 'Одно слово', run: ninoStep(NINO[0], chat) },
    { name: 'Мультик: -ს', run: (s, d) => episode(s, EP_DRINK, d) },
    { name: 'Два слова', run: ninoStep(NINO[1], chat) },
    { name: 'Ещё раз сам', run: ninoStep(solo(COFFEE2), chat) },
  ], end: { big: 'первые фразы', text: 'То, что пьёшь, получает -ს: ყავას, ჩაის. А «я» — с ვ-: ვსვამ.', chat,
    items: [['coffee', 'ყავას ვსვამ', 'пью кофе', 'coffee'], ['tea', 'ჩაის ვსვამ', 'пью чай', 'tea']] } } },

  () => { const chat = ninoChat(); return { title: 'Когда · что · делаю', sub: 'фраза растёт', levels: [
    { review: true, name: 'Пью чай', run: ninoStep(solo(NINO[1]), chat) },
    { name: 'Новая клетка — когда', run: ninoStep(NINO[2], chat) },
    { name: 'Утром — чай', run: ninoStep(TEA3, chat) },
    { name: 'Часы + утро', run: ninoStep(WAKE7, chat) },
  ], end: { big: 'фраза выросла', text: 'Когда · что · делаю. И часы из прошлых уроков встали на место «когда».', chat,
    items: [['s1', 'დილით ყავას ვსვამ', 'утром пью кофе', 'morning'], ['s5', 'დილით ჩაის ვსვამ', 'утром пью чай', 'tea'], ['s4', 'შვიდ საათზე ვიღვიძებ', 'в семь просыпаюсь', 'wake']] } } },

  () => ({ title: 'День', sub: 'работаю, обедаю, домой', levels: [
    { review: true, name: 'Утро — поймай', run: (s, d) => catchLevel(s, { pool: MORNING, rounds: 3 }, d) },
    { name: 'Три дела днём', run: (s, d) => learnRow(s, DAY, d, 'Новые — послушай') },
    { name: 'Найди пары', run: (s, d) => pairsLevel(s, [...DAY, 'towork'], d) },
    { name: 'День Нино по порядку', run: (s, d) => orderLevel(s, { keys: ['wake', 'towork', 'work', 'lunch', 'home'] }, d) },
  ], end: { big: 'день собран', text: 'Утро и день — уже девять дел. Нажми, чтобы послушать.', items: actItems(DAY) } }),

  () => ({ title: 'Вечер', sub: 'читаю, отдыхаю, засыпаю', levels: [
    { review: true, name: 'Подпиши день', run: (s, d) => labelLevel(s, [...DAY, 'coffee'], d) },
    { name: 'Три дела вечером', run: (s, d) => learnRow(s, EVENING, d, 'Новые — послушай') },
    { name: 'Вечер в облачко', run: (s, d) => bubbleRounds(s, { pool: [...EVENING, 'home'], n: 3, rounds: 4, hint: false }, d) },
    { name: 'Вечер Нино — на слух', run: (s, d) => orderLevel(s, { keys: ['home', 'rest', 'read', 'sleep'], listen: true }, d) },
  ], end: { big: 'весь день', text: 'От ვიღვიძებ до ვიძინებ — двенадцать дел о своём дне.', items: actItems(EVENING) } }),

  () => { const chat = ninoChat(); return { title: 'Время и место', sub: 'во сколько и куда', levels: [
    { review: true, name: 'Часы, день и фраза', run: mix([S(), B({ pool: [...DAY, ...EVENING], listen: true }), N(solo(WAKE7), chat)]) },
    { name: 'В восемь — на работу', run: ninoStep(NINO[3], chat) },
    { name: 'Утром завтракаю', run: ninoStep(BREAKFAST2, chat) },
    { name: 'Вечер — без подсказок цветом', run: ninoStep(FILM3, chat) },
  ], end: { big: 'день в фразах', text: 'Утро, работа и вечер — каждая фраза из трёх кусочков, которые ты уже знаешь.', chat,
    items: [['s2', 'რვა საათზე სამსახურში მივდივარ', 'в восемь иду на работу', 'towork'], ['s6', 'დილით ვსაუზმობ', 'утром завтракаю', 'breakfast'], ['s3', 'საღამოს ფილმს ვუყურებ', 'вечером смотрю фильм', 'film']] } } },

  () => { const chat = ninoChat(); return { title: 'Пью — люблю', sub: 'главная ловушка', levels: [
    { review: true, name: 'Пью кофе', run: ninoStep(solo(COFFEE2), chat) },
    { name: 'Пью — с -ს', run: (s, d) => swipeRounds(s, { kinds: ['do', 'do', 'do'] }, d) },
    { name: 'А когда люблю…', run: dropS },
    { name: 'Люблю — как есть', run: (s, d) => swipeRounds(s, { kinds: ['y', 'y', 'do'], hint: false }, d) },
  ], end: { big: 'разошлись', text: 'Пью кофе — ყავას ვსვამ, люблю кофе — მიყვარს ყავა.',
    items: [['coffee', 'ყავას ვსვამ', 'пью кофе', 'coffee'], ['l_coffee', 'მიყვარს ყავა', 'люблю кофе', 'coffee'], ['l_sea', 'მიყვარს ზღვა', 'люблю море', 'sea']] } } },

  () => { const chat = ninoChat(); return { title: 'Не люблю', sub: 'и вечер с музыкой', levels: [
    { review: true, name: 'Пью или люблю', run: mix([W('do'), W('y'), W('do')]) },
    { name: 'Не люблю', run: (s, d) => swipeRounds(s, { kinds: ['n', 'n', 'y'], hint: false, intro: 'არ — «не». Слово всё равно как есть' }, d) },
    { name: 'Вперемешку', run: (s, d) => swipeRounds(s, { kinds: shuffle(['do', 'y', 'do', 'n', 'y', 'do']), hint: false }, d) },
    { name: 'Вечер с музыкой', run: ninoStep(MUSIC3, chat) },
  ], end: () => ({ big: likeMix ? `-ს путал ${likeMix} ${plural(likeMix)}` : 'ни одной путаницы',
    text: likeMix ? 'Это главная ловушка — ещё встретится. Пью, смотрю, слушаю — с -ს; люблю — как есть.' : 'Пью, слушаю — с -ს; люблю и не люблю — как есть.',
    items: [['n_tea', 'არ მიყვარს ჩაი', 'не люблю чай', 'tea'], ['l_music', 'მიყვარს მუსიკა', 'люблю музыку', 'music'], ['s7', 'საღამოს მუსიკას ვუსმენ', 'вечером слушаю музыку', 'evening']] }) } },

  () => { const chat = ninoChat(); return { title: 'Быстрый круг', sub: 'всё, что уже знаешь', levels: [
    { review: true, name: 'Весь день — поймай', run: (s, d) => catchLevel(s, { pool: DAY12, rounds: 5 }, d) },
    { review: true, name: 'Фразы для Нино', run: mix([N(plain(WAKE7), chat), N(plain(TEA3), chat), N(plain(NINO[3]), chat)]) },
    { name: 'Люблю или пью — на скорость', run: (s, d) => swipeRounds(s, { kinds: shuffle(['do', 'y', 'n', 'do', 'y', 'do']), fuse: true, hint: false, intro: 'Успей, пока горит фитиль' }, d) },
  ], end: { big: 'всё на месте', text: 'Ты прошёл весь день без подсказок. Последний урок — расскажешь Нино сам.', chat,
    items: [['s4', 'შვიდ საათზე ვიღვიძებ', 'в семь просыпаюсь', 'wake'], ['s1', 'დილით ყავას ვსვამ', 'утром пью кофе', 'coffee'], ['l_coffee', 'მიყვარს ყავა', 'люблю кофе', 'coffee']] } } },
]
// Уроки 16–29: новое идёт порциями по 2–3 слова, каждая разминка — на прошлом, раз в несколько уроков — большой круг
const NEW9 = [...FOOD, ...HOUSE, ...SELF]
const LESSONS2 = [
  () => { const chat = ninoChat(); return { title: 'Еда', sub: 'ем и пью', levels: [
    { review: true, name: 'Весь день — поймай', run: (s, d) => catchLevel(s, { pool: DAY12, rounds: 5 }, d) },
    { name: 'Новое: ვჭამ — ем', run: (s, d) => learnRow(s, FOOD, d, 'Новые — послушай') },
    { name: 'Мультик: хачапури', run: (s, d) => episode(s, EP_EAT, d) },
    { name: 'Еда в облачко', run: (s, d) => bubbleRounds(s, { pool: [...FOOD, 'coffee', 'tea'], n: 3, rounds: 4, hint: false }, d) },
    { name: 'Утром — хачапури', run: ninoStep(EAT_KH, chat) },
  ], end: { big: 'ем и пью', text: 'ვჭამ — ем, ვსვამ — пью. То, что ешь, тоже получает -ს: ხაჭაპურს.', chat, items: actItems(FOOD) } } },

  () => { const chat = ninoChat(); return { title: 'Ем или пью', sub: 'не перепутай', levels: [
    { review: true, name: 'Найди пары', run: (s, d) => pairsLevel(s, [...FOOD, 'tea'], d) },
    { name: 'Ешь или пьёшь?', run: (s, d) => sortRounds(s, { cards: eatCards(6), zones: EAT_ZONES, intro: 'Хачапури едят — влево. Воду пьют — вправо' }, d) },
    { name: 'Утром — вода', run: ninoStep(WATER3, chat) },
    { name: 'Подпиши картинки', run: (s, d) => labelLevel(s, [...FOOD, 'coffee'], d) },
  ], end: { big: 'не путаешь', text: 'Хачапури и фрукты — ვჭამ. Вода, кофе, вино — ვსვამ.', chat,
    items: [['s17', 'დილით წყალს ვსვამ', 'утром пью воду', 'water'], ['s8', 'დილით ხაჭაპურს ვჭამ', 'утром ем хачапури', 'khach'], ['wine', 'ღვინოს ვსვამ', 'пью вино', 'wine']] } } },

  () => ({ title: 'Дома вечером', sub: 'ужин, посуда, мама', levels: [
    { review: true, name: 'Подпиши картинки', run: (s, d) => labelLevel(s, [...FOOD, 'read'], d) },
    { name: 'Три дела дома', run: (s, d) => learnRow(s, HOUSE, d, 'Новые — послушай') },
    { name: 'Вечер на слух', run: (s, d) => bubbleRounds(s, { pool: [...HOUSE, ...EVENING], n: 3, rounds: 4, listen: true, hint: false, intro: 'Новые вперемешку со старым вечером. Слушай' }, d) },
    { name: 'Вечер Нино по порядку', run: (s, d) => orderLevel(s, { keys: ['home', 'cook', 'dishes', 'call', 'sleep'] }, d) },
  ], end: { big: 'вечер дома', text: 'Ужин — ვახშამს, посуда — ჭურჭელს, маме — დედას: у всех -ს.', items: actItems(HOUSE) } }),

  () => ({ title: 'Для себя', sub: 'гуляю, спорт, грузинский', levels: [
    { review: true, name: 'Вечер на слух — по порядку', run: (s, d) => orderLevel(s, { keys: ['home', 'cook', 'dishes', 'rest'], listen: true }, d) },
    { name: 'Три дела для себя', run: (s, d) => learnRow(s, SELF, d, 'Новые — послушай') },
    { name: 'Найди пары', run: (s, d) => pairsLevel(s, [...SELF, 'call'], d) },
    { name: 'Поймай', run: (s, d) => catchLevel(s, { pool: NEW9, rounds: 6 }, d) },
  ], end: { big: 'для себя', text: 'ქართულს ვსწავლობ — учу грузинский. Это ты делаешь прямо сейчас.', items: actItems(SELF) } }),

  () => { const chat = ninoChat(); return { title: 'Большой круг', sub: 'двадцать одно дело', levels: [
    { review: true, name: 'Всё подряд — с ускорением', run: (s, d) => catchLevel(s, { pool: [...DAY12, ...NEW9], rounds: 8, n: 4, speed: true }, d) },
    { review: true, name: 'Новые — найди пары', run: (s, d) => pairsLevel(s, shuffle(NEW9).slice(0, 4), d) },
    { review: true, name: 'Три фразы для Нино', run: mix([N(plain(EAT_KH), chat), N(plain(COOK3), chat), N(plain(NINO[3]), chat)]) },
  ], end: { big: 'полпути позади', text: 'Утро, день, вечер, еда и дом — всё на слух и в фразах.', chat,
    items: [['s8', 'დილით ხაჭაპურს ვჭამ', 'утром ем хачапури', 'khach'], ['s9', 'საღამოს ვახშამს ვამზადებ', 'вечером готовлю ужин', 'cook']] } } },

  () => { const chat = ninoChat(); return { title: 'Куда иду', sub: 'магазин, море', levels: [
    { review: true, name: 'На слух', run: (s, d) => bubbleRounds(s, { pool: [...DAY12, ...NEW9], n: 4, rounds: 3, listen: true, hint: false }, d) },
    { name: 'Два новых места', run: (s, d) => learnRow(s, GO, d, 'Новые — послушай') },
    { name: 'Мультик: ში и ზე', run: (s, d) => episode(s, EP_SHI, d) },
    { name: 'Вечером — в магазин', run: ninoStep(SHOP_E, chat) },
    { name: 'В шесть — домой', run: ninoStep(HOME6, chat) },
  ], end: { big: 'знаешь куда', text: 'В магазин — მაღაზიაში, на море — ზღვაზე, домой — სახლში.', chat,
    items: [['s15', 'საღამოს მაღაზიაში მივდივარ', 'вечером иду в магазин', 'shop'], ['s16', 'ექვს საათზე სახლში ვბრუნდები', 'в шесть возвращаюсь домой', 'home']] } } },

  () => { const chat = ninoChat(); return { title: 'Выходные', sub: 'суббота и воскресенье', levels: [
    { review: true, name: 'Найди пары', run: (s, d) => pairsLevel(s, [...GO, 'walk', 'rest'], d) },
    { name: 'Суббота, воскресенье', run: (s, d) => learnRow(s, WEEK, d, 'Новые — послушай') },
    { name: 'Мультик: выходные', run: (s, d) => episode(s, EP_DAYS, d) },
    { name: 'В субботу — на море', run: ninoStep(SEA_SAT, chat) },
    { name: 'В воскресенье отдыхаю', run: ninoStep(REST_SUN, chat) },
  ], end: { big: 'выходные', text: 'შაბათს и კვირას встают на место «когда» — как დილით и საღამოს.', chat,
    items: [['s10', 'შაბათს ზღვაზე მივდივარ', 'в субботу иду на море', 'tosea'], ['s11', 'კვირას ვისვენებ', 'в воскресенье отдыхаю', 'rest']] } } },

  () => { const chat = ninoChat(); return { title: 'Как часто', sub: 'каждый день, часто, иногда', levels: [
    { review: true, name: 'Слух, часы и фраза', run: mix([B({ pool: ALL, listen: true }), H({ listen: true }), N(plain(REST_SUN), chat)]) },
    { name: 'Как часто', run: (s, d) => learnRow(s, FREQ, d, 'Новые — послушай') },
    { name: 'Каждый день', run: ninoStep(STUDY_D, chat) },
    { name: 'Иногда и часто', run: mix([N(WINE_S, chat), N(WALK_O, chat)]) },
  ], end: { big: 'как часто', text: 'ყოველ დღე, ხშირად, ზოგჯერ — тоже в первой клетке.', chat,
    items: [['s12', 'ყოველ დღე ქართულს ვსწავლობ', 'каждый день учу грузинский', 'study'], ['s13', 'ზოგჯერ ღვინოს ვსვამ', 'иногда пью вино', 'wine'], ['s14', 'ხშირად პარკში ვსეირნობ', 'часто гуляю в парке', 'walk']] } } },

  () => ({ title: 'Про Нино', sub: 'она, а не я', levels: [
    { review: true, name: 'Поймай', run: (s, d) => catchLevel(s, { pool: NEW9, rounds: 5 }, d) },
    { name: 'Мультик: про кота', run: (s, d) => episode(s, EP_SHE, d) },
    { name: 'День Нино по порядку', run: (s, d) => orderLevel(s, { keys: ['wake', 'coffee', 'towork', 'work', 'home'], she: true }, d) },
    { name: 'Правда или нет', run: (s, d) => truthRounds(s, { pool: [...MORNING, ...DAY, ...FOOD], rounds: 5 }, d) },
    { name: 'Про меня или про Нино', run: (s, d) => sortRounds(s, { cards: meCards(ALL, 6), zones: ME_ZONES, intro: 'С ვ- — про меня. Без него — про Нино' }, d) },
  ], end: { big: 'я и она', text: 'Про себя — ვსვამ, про Нино — სვამს. Я иду — მივდივარ, она идёт — მიდის.',
    items: [['coffee', 'ყავას ვსვამ', 'я пью кофе', 'coffee'], ['', 'ყავას სვამს', 'она пьёт кофе', 'coffee'], ['', 'სამსახურში მიდის', 'она идёт на работу', 'towork']] } }),

  () => { const chat = ninoChat(); return { title: 'Нино спрашивает', sub: 'вопросы по-грузински', levels: [
    { review: true, name: 'Правда или нет', run: (s, d) => truthRounds(s, { pool: ALL, rounds: 4 }, d) },
    { name: 'Мультик: «ты»', run: (s, d) => episode(s, EP_YOU, d) },
    { name: 'Что ешь утром?', run: ninoStep(ask(EAT_KH, ['დილით რას ჭამ?', 'что ешь утром?', 'a1']), chat) },
    { name: 'Куда в субботу?', run: ninoStep(ask(SEA_SAT, ['შაბათს სად მიდიხარ?', 'куда идёшь в субботу?', 'a2']), chat) },
    { name: 'Ещё два вопроса', run: mix([N(ask(WALK_O, ['ხშირად სეირნობ?', 'часто гуляешь?', 'a3']), chat), N(ask(HOME6, ['რომელ საათზე ბრუნდები სახლში?', 'во сколько возвращаешься домой?', 'a4']), chat)]) },
  ], end: { big: 'понимаешь вопросы', text: 'Нино говорит «ты»: ჭამ, მიდიხარ — без ვ-. Ты отвечаешь «я»: ვჭამ, მივდივარ.', chat,
    items: [['a1', 'დილით რას ჭამ?', 'что ешь утром?', 'khach'], ['a2', 'შაბათს სად მიდიხარ?', 'куда идёшь в субботу?', 'sat'], ['a4', 'რომელ საათზე ბრუნდები სახლში?', 'во сколько домой?', 'clock6']] } } },

  () => ({ title: 'На скорость', sub: 'всё, что знаешь', levels: [
    { review: true, name: 'Подпиши картинки', run: (s, d) => labelLevel(s, shuffle(ALL).slice(0, 4), d) },
    { name: 'Поймай всё — с ускорением', run: (s, d) => catchLevel(s, { pool: ALL, rounds: 10, n: 4, speed: true }, d) },
    { name: 'Ем или пью — пока горит', run: (s, d) => sortRounds(s, { cards: eatCards(6), zones: EAT_ZONES, fuse: true, hint: false, intro: 'Успей, пока горит фитиль' }, d) },
    { name: 'Люблю или пью — пока горит', run: (s, d) => swipeRounds(s, { kinds: shuffle(['do', 'y', 'n', 'do', 'y', 'do']), fuse: true, hint: false }, d) },
  ], end: { big: 'быстро и без ошибок', text: 'Слова узнаёшь быстрее, чем успеваешь подумать. Так и должно быть.' } }),

  () => ({ title: 'Длинный рассказ', sub: 'шесть дел подряд', levels: [
    { review: true, name: 'Пары: когда и как часто', run: (s, d) => pairsLevel(s, [...WEEK, 'daily', 'some'], d) },
    { name: 'Утро Нино — на слух', run: (s, d) => orderLevel(s, { keys: ['wake', 'water', 'khach', 'towork', 'shop', 'cook'], listen: true }, d) },
    { name: 'День Нино — читаем', run: (s, d) => orderLevel(s, { keys: ['wake', 'sport', 'breakfast', 'study', 'walk', 'sleep'], she: true }, d) },
    { name: 'Правда или нет', run: (s, d) => truthRounds(s, { pool: ALL, rounds: 5 }, d) },
  ], end: { big: 'длинный рассказ', text: 'Шесть дел подряд на слух и чужой день по-грузински — без подсказок.' } }),

  () => { const chat = ninoChat(); return { title: 'Мой день целиком', sub: 'девять фраз подряд', levels: [
    { review: true, name: 'Разминка', run: mix([B({ pool: ALL, listen: true }), S(), W('n')]) },
    { name: 'Утро', run: mix([N(plain(WAKE7), chat), N(plain(EAT_KH), chat), N(plain(NINO[3]), chat)]) },
    { name: 'Вечер', run: mix([N(plain(HOME6), chat), N(plain(COOK3), chat), N(plain(CALL3), chat)]) },
    { name: 'Выходные', run: mix([N(plain(SEA_SAT), chat), N(plain(REST_SUN), chat), N(plain(STUDY_D), chat)]) },
  ], end: { big: 'весь день', text: 'Девять фраз подряд — это уже рассказ о себе. Прокрути переписку и посмотри.', chat } } },

  () => { const chat = ninoChat(); return { title: 'Генеральная репетиция', sub: 'всё вперемешку', levels: [
    { review: true, name: 'Слушай', run: mix([B({ pool: ALL, listen: true }), H({ listen: true }), B({ pool: ALL, listen: true })]) },
    { review: true, name: 'Читай', run: mix([T(ALL), R(() => meCards(ALL, 1), ME_ZONES), R(() => eatCards(1), EAT_ZONES), W('y')]) },
    { review: true, name: 'Лови', run: (s, d) => catchLevel(s, { pool: ALL, rounds: 8, n: 4, speed: true }, d) },
    { review: true, name: 'Говори', run: mix([N(plain(WINE_S), chat), N(plain(FRUIT_O), chat), N(plain(SHOP_E), chat)]) },
  ], end: { big: 'готов к финалу', text: 'Дальше Нино спросит про весь твой день — по-грузински и вразнобой.', chat } } },
]

// Порядок модуля: 14 уроков, рассказ про утро, ещё 14 уроков, финал
const PLAN = [...LESSONS, 'essay', ...LESSONS2, 'final']
// Сколько слов и фраз прибавляет каждый урок — для копилки на итоговом экране
const ADDS = [3, 3, 0, 0, 12, 0, 0, 2, 3, 3, 1, 4, 2, 0, 0, 4, 1, 3, 3, 0, 2, 2, 3, 12, 5, 0, 0, 0, 0, 0]
const bankAt = k => { const was = ADDS.slice(0, k).reduce((a, b) => a + b, 0); return [was, was + ADDS[k]] }
function lesson(k) {
  likeMix = 0
  const L = PLAN[k]()
  runGame({
    title: L.title, sub: `Урок ${k + 1} · ${L.sub}`, levels: L.levels,
    end: stage => {
      const e = typeof L.end === 'function' ? L.end() : L.end
      if (e.chat) stage.append(e.chat)
      const card = endCard(stage, { ...e, bank: bankAt(k), again: () => lesson(k) })
      // на совсем низком экране итог важнее переписки: если кнопки ушли за край даже со свёрнутым чатом — прячем его
      const settle = () => {
        card.style.maxHeight = ''
        if (e.chat && card.getBoundingClientRect().bottom > innerHeight) e.chat.hidden = true
        const chatFit = e.chat && !e.chat.hidden ? fitNow : null
        fitNow = () => { chatFit?.(); card.fit() }; card.fit()
        // итог с кнопками — в кадр, листать вниз самому не нужно
        card.scrollIntoView?.({ behavior: reduced() ? 'auto' : 'smooth', block: 'end' })
      }
      if (e.chat) liveChat(e.chat)
      card.fit(); later(settle, 600)
    },
  })
}

/* ───────── Урок 15. Моё утро: Нино задаёт вопросы по одному ───────── */
const QS = [
  { q: 'Во сколько ты просыпаешься?', words: [hourKa(6), hourKa(7), hourKa(8), 'შვიდი საათზე', 'ვიღვიძებ', 'იღვიძებს'] },
  { q: 'Что пьёшь утром?', words: ['დილით', 'ყავას', 'ყავა', 'ჩაის', 'ვსვამ', 'სვამს'] },
  { q: 'Когда идёшь на работу?', words: [hourKa(8), hourKa(9), 'ექვსი საათზე', 'სამსახურში', 'მივდივარ', 'მიდის'] },
  { q: 'А вечером?', words: ['საღამოს', 'ფილმს', 'წიგნს', 'მუსიკას', 'ფილმი', 'ვუყურებ', 'ვკითხულობ', 'ვუსმენ', 'უყურებს'] },
]
// Урок 30. Финал: Нино спрашивает про весь день по-грузински и вразнобой; перевод — только по нажатию,
// слова в лотке перемешаны и с ловушками (без -ს, «он» вместо «я», лишнее -ი у часа)
const FQ = [
  { ka: 'რომელ საათზე იღვიძებ?', q: 'во сколько просыпаешься?', audio: 'f1', words: [hourKa(6), hourKa(7), hourKa(8), 'შვიდი საათზე', 'ვიღვიძებ', 'იღვიძებს', 'ვიძინებ'] },
  { ka: 'დილით რას სვამ?', q: 'что пьёшь утром?', audio: 'f2', words: ['დილით', 'საღამოს', 'ყავას', 'ყავა', 'ჩაის', 'წყალს', 'ვსვამ', 'სვამს', 'ვჭამ'] },
  { ka: 'საუზმეზე რას ჭამ?', q: 'что ешь на завтрак?', audio: 'f3', words: ['დილით', 'ხაჭაპურს', 'ხაჭაპური', 'ხილს', 'ვჭამ', 'ჭამს', 'ვსვამ'] },
  { ka: 'რომელ საათზე მიდიხარ სამსახურში?', q: 'во сколько идёшь на работу?', audio: 'f4', words: [hourKa(8), hourKa(9), hourKa(10), 'ათი საათზე', 'სამსახურში', 'სახლში', 'მივდივარ', 'მიდის'] },
  { ka: 'საღამოს რას აკეთებ?', q: 'что делаешь вечером?', audio: 'f5', words: ['საღამოს', 'ვახშამს', 'ვახშამი', 'ფილმს', 'წიგნს', 'ვამზადებ', 'ვუყურებ', 'ვკითხულობ', 'უყურებს'] },
  { ka: 'შაბათს სად მიდიხარ?', q: 'куда идёшь в субботу?', audio: 'f6', words: ['შაბათს', 'კვირას', 'ზღვაზე', 'მაღაზიაში', 'პარკში', 'მივდივარ', 'მიდის', 'ვსეირნობ'] },
  { ka: 'ხშირად ვარჯიშობ?', q: 'часто тренируешься?', audio: 'f7', words: ['ხშირად', 'ზოგჯერ', 'ყოველ დღე', 'ვვარჯიშობ', 'ვარჯიშობს', 'არ'] },
  { ka: 'რა გიყვარს?', q: 'что любишь?', audio: 'f8', words: ['მიყვარს', 'არ', 'ზღვა', 'ზღვას', 'მთა', 'ყავა', 'მუსიკა', 'ღვინო'] },
]
const essayGame = () => talkGame({ title: 'Моё утро', sub: 'Урок 15 · умею', who: 'расскажи про своё утро', qs: QS, again: essayGame, bank: bankAt(14) })
const finalGame = () => talkGame({ title: 'Мой день', sub: 'Урок 30 · финал', who: 'спрашивает обо всём', qs: shuffle(FQ), ka: true, again: finalGame, bank: bankAt(29), final: true })
function talkGame({ title, sub, who, qs, ka, again, bank, final }) {
  const chat = $(`<div class="chat"><div class="chat-top"><div class="ava" lang="ka">ნ</div><div class="who">Нино<small>${who}</small></div></div></div>`)
  const answers = []
  runGame({
    title, sub,
    levels: qs.map((q, i) => ({ name: ka ? `Вопрос ${i + 1} из ${qs.length}` : q.q, run: (stage, done) => {
      stage.append(chat)
      // в финале вопрос звучит и написан по-грузински; перевод — по нажатию, если не понял
      const m = ka ? $(`<div class="msg her"><b lang="ka">${q.ka}</b><span class="tr">${cyr(q.ka)}</span><button class="peek">перевести</button></div>`) : $(`<div class="msg her"><b class="ru-q">${q.q}</b></div>`)
      if (ka) { m.querySelector('.peek').onclick = e => { fx.pick(); e.currentTarget.outerHTML = `<span class="tr">— ${q.q}</span>` }; say(q.audio) }
      chat.append(m); haptic('soft')
      const ans = $(`<div class="answer"><span class="ph">Собери ответ из слов или напиши сам</span></div>`)
      const tray = $(`<div class="tray">${(ka ? shuffle(q.words) : q.words).map(w => `<button class="chip" data-w="${w}"><b lang="ka">${w}</b><span class="tr">${cyr(w)}</span></button>`).join('')}</div>`)
      const ta = $(`<textarea lang="ka" hidden aria-label="Ответ" placeholder="შვიდ საათზე ვიღვიძებ"></textarea>`)
      const row = $(`<div class="qrow"><button class="cta ghost type">Написать самому</button><button class="cta send" disabled>Отправить</button></div>`)
      stage.append(ans, tray, ta, row)
      const fit = liveChat(chat)
      const words = []
      const draw = () => {
        ans.innerHTML = words.length ? words.map((w, j) => `<span class="w" data-j="${j}" lang="ka">${w}</span>`).join('') : '<span class="ph">Собери ответ из слов или напиши сам</span>'
        ans.querySelectorAll('.w').forEach(x => x.onclick = () => { words.splice(+x.dataset.j, 1); fx.pick(); draw() })
        row.querySelector('.send').disabled = !words.length
      }
      tray.querySelectorAll('.chip').forEach(c => draggable(c, { targets: () => [ans], drop: () => { words.push(c.dataset.w); fx.drop(); draw() }, tap: () => { words.push(c.dataset.w); draw() } }))
      row.querySelector('.type').onclick = () => { fx.pick(); ta.hidden = false; ans.hidden = true; tray.hidden = true; fit(); ta.focus(); ta.oninput = () => row.querySelector('.send').disabled = !ta.value.trim() }
      const send = text => { answers[i] = text; chat.append($(`<div class="msg me"><b lang="ka">${text}.</b></div>`)); tone(880, 0.06, 'sine', 0.06); haptic('pop'); done() }
      row.querySelector('.send').onclick = () => send(ta.hidden ? words.join(' ') : ta.value.trim().replace(/[.!?]+$/, ''))
      if (i === 0) later(() => { ghost(tray.firstElementChild, ans); tip(ka ? m : ans, ka ? 'Слова перемешаны, есть ловушки. Не понял вопрос — нажми «перевести»' : 'Тапни или перетащи слова сюда. Ошибок не бойся — разбор будет в конце', ka ? 'below' : 'above') }, ka ? 1400 : 500)
    } })),
    end: stage => talkReview(stage, answers, chat, { again, bank, final }),
  })
}
function talkReview(stage, answers, chat, { again, bank, final }) {
  untip(); unghost(); fitNow = null; chat._ro?.disconnect(); chat._obs?.disconnect()
  // переписка остаётся окошком сверху, под ней — разбор по одной фразе
  stage.replaceChildren(chat)
  chat.classList.add('live'); chat.style.maxHeight = '26dvh'; chat.scrollTop = chat.scrollHeight
  const typing = $(`<div class="msg her typing"><i></i><i></i><i></i></div>`); chat.append(typing)
  const cards = review(answers.join('. '))
  later(() => { typing.remove(); stage.append(cards[0]); haptic('pop') }, 1200)
  // Разбор приходит по одному предложению — не стеной текста
  cards.slice(1).forEach((c, i) => later(() => { stage.append(c); fx.pick(); if (c.classList.contains('fix')) haptic('soft'); c.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' }) }, 1900 + i * 900))
  later(() => {
    const good = cards.slice(1).filter(c => c.classList.contains('ok')).length
    // В финале — итог модуля: сколько всего знаешь и сколько ответов Нино без ошибок
    const fin = final ? $(`<div class="card end diploma"><span class="eyebrow">модуль «Мой день» пройден</span>
      <p class="soft">Ты ответил Нино на ${answers.length} вопросов по-грузински, ${good} — без единой ошибки.</p>${bankEl(bank)}</div>`) : bank ? $(bankEl(bank)) : null
    const row = $(`<div class="cta-row pin"><button class="cta ghost again">Ещё раз</button><button class="cta nx" id="level-next">Дальше</button></div>`)
    row.querySelector('.again').onclick = () => { fx.pick(); again() }
    row.querySelector('.nx').onclick = () => { fx.pick(); doneFn() }
    if (fin) stage.append(fin)
    stage.append(row); fx.win(); confetti(); if (final) later(confetti, 900)
    fin?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
    if (bank) countUp(stage.querySelector('.bank b'), final ? [0, bank[1]] : bank)
  }, 2000 + cards.length * 900)
}

// Разбор правилами: ловит три ошибки этого модуля (часы, -ს у вещи, «он» вместо «я»).
const THING = { 'ყავა': 'ყავას', 'ჩაი': 'ჩაის', 'წიგნი': 'წიგნს', 'ფილმი': 'ფილმს', 'მუსიკა': 'მუსიკას', 'წყალი': 'წყალს', 'ხაჭაპური': 'ხაჭაპურს', 'ხილი': 'ხილს', 'ვახშამი': 'ვახშამს', 'ღვინო': 'ღვინოს', 'ქართული': 'ქართულს', 'დედა': 'დედას' }
const THING_RU = { 'ყავას': 'кофе', 'ჩაის': 'чай', 'წიგნს': 'книгу', 'ფილმს': 'фильм', 'მუსიკას': 'музыку', 'სამსახურში': 'на работу', 'სახლში': 'домой',
  'წყალს': 'воду', 'ხაჭაპურს': 'хачапури', 'ხილს': 'фрукты', 'ვახშამს': 'ужин', 'ღვინოს': 'вино', 'ქართულს': 'грузинский', 'დედას': 'маме', 'მაღაზიაში': 'в магазин', 'ზღვაზე': 'на море', 'პარკში': 'в парке',
  'ყავა': 'кофе', 'ჩაი': 'чай', 'მუსიკა': 'музыку', 'ღვინო': 'вино', 'ზღვა': 'море', 'მთა': 'горы' }
const VERB = { 'ვიღვიძებ': 'просыпаюсь', 'ვიცვამ': 'одеваюсь', 'ვსვამ': 'пью', 'ვსაუზმობ': 'завтракаю', 'მივდივარ': 'иду', 'ვმუშაობ': 'работаю', 'ვსადილობ': 'обедаю', 'ვბრუნდები': 'возвращаюсь', 'ვკითხულობ': 'читаю', 'ვუყურებ': 'смотрю', 'ვუსმენ': 'слушаю', 'ვისვენებ': 'отдыхаю', 'ვიძინებ': 'засыпаю',
  'ვჭამ': 'ем', 'ვამზადებ': 'готовлю', 'ვრეცხავ': 'мою', 'ვურეკავ': 'звоню', 'ვსეირნობ': 'гуляю', 'ვვარჯიშობ': 'тренируюсь', 'ვსწავლობ': 'учу', 'მიყვარს': 'люблю' }
const HE = { 'სვამს': 'ვსვამ', 'კითხულობს': 'ვკითხულობ', 'უყურებს': 'ვუყურებ', 'უსმენს': 'ვუსმენ', 'იღვიძებს': 'ვიღვიძებ', 'იცვამს': 'ვიცვამ', 'მიდის': 'მივდივარ', 'მუშაობს': 'ვმუშაობ', 'იძინებს': 'ვიძინებ', 'საუზმობს': 'ვსაუზმობ', 'ისვენებს': 'ვისვენებ',
  'ჭამს': 'ვჭამ', 'ამზადებს': 'ვამზადებ', 'რეცხავს': 'ვრეცხავ', 'ურეკავს': 'ვურეკავ', 'სეირნობს': 'ვსეირნობ', 'ვარჯიშობს': 'ვვარჯიშობ', 'სწავლობს': 'ვსწავლობ', 'ბრუნდება': 'ვბრუნდები' }
const WHEN_RU = { 'დილით': 'утром', 'საღამოს': 'вечером', 'შაბათს': 'в субботу', 'კვირას': 'в воскресенье', 'ყოველ': 'каждый', 'დღე': 'день', 'ხშირად': 'часто', 'ზოგჯერ': 'иногда', 'არ': 'не' }
const TOPIC_LESSON = { 'часы': '«Часы»', '-ს у вещи': '«Когда · что · делаю»', 'я-форма': '«Нино пишет»', 'люблю': '«Пью — люблю»', 'ем-пью': '«Ем или пью»' }
function review(text) {
  const sentences = text.split(/[.!?\n]+/).map(s => s.trim()).filter(Boolean)
  if (!sentences.length) return [$(`<div class="coach">Ответов нет — вернись и собери хотя бы одну фразу.</div>`)]
  const cards = []; const topics = new Set(); let good = 0
  for (const s of sentences) {
    const words = s.split(/\s+/)
    const fixes = []; const out = []; const ru = []
    for (let k = 0; k < words.length; k++) {
      const w = words[k], nextW = words[k + 1]
      const num = Object.entries(HOURS).find(([, [full, short]]) => w === full && full !== short)
      if (num && nextW === 'საათზე') { out.push(`<s>${w}</s> <ins>${num[1][1]}</ins>`); fixes.push(`Перед «часом» число теряет -ი: ${num[1][0]} → <b lang="ka">${num[1][1]} საათზე</b>.`); topics.add('часы'); ru.push(`в ${num[0]}`); k++; out.push('საათზე'); continue }
      const hr = Object.entries(HOURS).find(([, [, short]]) => w === short && nextW === 'საათზე')
      if (hr) { out.push(w, 'საათზე'); ru.push(`в ${hr[0]}`); k++; continue }
      if (THING[w] && words.slice(k + 1).some(x => VERB[x] || HE[x])) { out.push(`<s>${w}</s> <ins>${THING[w]}</ins>`); fixes.push(`То, что пьёшь или смотришь, получает -ს: ${w} → <b lang="ka">${THING[w]}</b>.`); topics.add('-ს у вещи'); ru.push(THING_RU[THING[w]]); continue }
      // после მიყვარს — как есть: «люблю кофе» — მიყვარს ყავა, не ყავას
      const bare = Object.entries(THING).find(([, withS]) => withS === w)?.[0] ?? { 'ზღვას': 'ზღვა', 'მთას': 'მთა' }[w]
      if (bare && words.slice(0, k).includes('მიყვარს')) { out.push(`<s>${w}</s> <ins>${bare}</ins>`); fixes.push(`После მიყვარს слово как есть: <b lang="ka">მიყვარს ${bare}</b>.`); topics.add('люблю'); ru.push(THING_RU[bare]); continue }
      // ешь — ვჭამ, пьёшь — ვსვამ
      const EAT = ['ხაჭაპურს', 'ხილს'], DRINK = ['წყალს', 'ყავას', 'ჩაის', 'ღვინოს']
      if ((w === 'ვსვამ' && words.some(x => EAT.includes(x))) || (w === 'ვჭამ' && words.some(x => DRINK.includes(x)))) { const r2 = w === 'ვსვამ' ? 'ვჭამ' : 'ვსვამ'; out.push(`<s>${w}</s> <ins>${r2}</ins>`); fixes.push(r2 === 'ვჭამ' ? 'Еду едят: <b lang="ka">ვჭამ</b>.' : 'Напитки пьют: <b lang="ka">ვსვამ</b>.'); topics.add('ем-пью'); ru.push(VERB[r2]); continue }
      if (HE[w]) { out.push(`<s>${w}</s> <ins>${HE[w]}</ins>`); fixes.push(`<b lang="ka">${w}</b> — это «он/она». Про себя: <b lang="ka">${HE[w]}</b>.`); topics.add('я-форма'); ru.push(VERB[HE[w]]); continue }
      out.push(w); ru.push(WHEN_RU[w] ?? THING_RU[w] ?? VERB[w] ?? '…')
    }
    const hasVerb = words.some(x => VERB[x] || HE[x])
    const kind = fixes.length ? 'fix' : hasVerb ? 'ok' : 'unk'
    if (kind === 'ok') good++
    cards.push($(`<div class="rv ${kind}"><div class="src" lang="ka">${out.join(' ')}.</div><div class="ru">${ru.join(' ')}</div>
      <div class="note">${kind === 'ok' ? 'Всё верно.' : kind === 'unk' ? 'Не нашёл, что ты делаешь. Добавь действие: ვსვამ, მივდივარ…' : fixes.join('<br>')}</div></div>`))
  }
  cards.unshift($(`<div class="coach"><b>Разбор</b><span>${good} из ${sentences.length} без ошибок.${topics.size ? ` Стоит повторить: ${[...topics].map(t => TOPIC_LESSON[t]).join(', ')}.` : ' Ты рассказал про своё утро по-грузински.'}</span></div>`))
  return cards
}

const GAMES = PLAN.map((p, k) => p === 'essay' ? essayGame : p === 'final' ? finalGame : () => lesson(k))
// Клипы качаем заранее, все сразу (их ~100 по 10 КБ): разминки тянут звук из любых прошлых уроков
const CLIPS = [...Object.keys(WORD), 'q', ...Array.from({ length: 19 }, (_, i) => 's' + (i + 1)), ...Array.from({ length: 5 }, (_, i) => 'a' + (i + 1)), ...Array.from({ length: 8 }, (_, i) => 'f' + (i + 1)),
  ...Array.from({ length: 12 }, (_, i) => 'h' + (i + 1)), ...Object.keys(LIKE).flatMap(k => ['l_' + k, 'n_' + k]),
  // слова мультиков
  'r_chai', 'r_chais', 'r_cham', 'r_khachapuri', 'r_khachapurs', 'r_kvira', 'r_kviras', 'r_maghazia', 'r_maghaziashi', 'r_magida', 'r_magidaze', 'r_midis', 'r_mivdivar', 'r_mushaobs', 'r_qava', 'r_qavas', 'r_saati', 'r_saatze', 'r_sakhli', 'r_sakhlshi', 'r_seirnob', 'r_shabati', 'r_shabats', 'r_svams', 'r_vcham', 'r_vmushaob', 'r_vseirnob', 'r_vsvam', 'r_zghva', 'r_zghvaze']

/** Урок k (0..29) — его игра внутри host. Возвращает функцию, которая всё убирает. */
export function mountMyDay(host, k, { onExit, onDone }) {
  main = document.createElement('div'); main.className = 'md-main'
  host.appendChild(main)
  exitFn = onExit; doneFn = onDone
  const onDown = () => { void unlock() }
  host.addEventListener('pointerdown', onDown, { capture: true })
  window.addEventListener('resize', onResize)
  CLIPS.forEach(fetchClip)
  if (ac) Object.keys(raw).forEach(decode)
  GAMES[k]()
  return () => {
    reset()
    host.removeEventListener('pointerdown', onDown, { capture: true })
    window.removeEventListener('resize', onResize)
    main.remove(); main = null
  }
}
