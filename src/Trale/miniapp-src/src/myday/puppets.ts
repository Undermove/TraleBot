// @ts-nocheck
// Куклы для мультиков «Моего дня»: Бомбора целиком (голова — та же, что в Mascot.tsx, плюс туловище, лапы, хвост)
// и его друг — серый полосатый кот в синем ошейнике (как в иллюстрациях историй). Части — отдельными группами,
// их двигает CSS (myday.css, .pb-*): ходьба, взмах, потягушки, сон, прыжок.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Mascot from '../components/Mascot'

const INK = '#2A1F18', FUR = '#E6AE78', FUR_DARK = '#C98B4A', CREAM = '#FDF6EA', CORAL = '#E01A3C'
const line = `stroke="${INK}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"`

// Голова из Mascot (те же глаза и рот по настроению), но без широкого шарфа-нагрудника и тени: у Бомборы целиком
// шарф свой — узкая лента на шее, как в иллюстрациях историй
const HEAD = {}
const head = mood => HEAD[mood] ??= renderToStaticMarkup(createElement(Mascot, { mood, size: 200 }))
  .replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
  .replace(/<ellipse cx="100" cy="188"[^>]*>/, '')
  .replace(/<g><path d="M38 138[\s\S]*?<\/g>/, '')

/** Бомбора целиком, как в иллюстрациях историй: туловище — продолжение головы (растёт из-под неё), плечи шириной
 *  с шарф, к бёдрам сужается; длинные ноги с пальчиками, шарф лентой закрывает шею и плечи, узелок — на груди.
 *  Без швов: обводка туловища — под ногами, мех туловища — поверх их верхушек, так ноги растут из тела; плечо
 *  накрыто «заплаткой» меха. Руки — мультяшные «макаронины» из трёх звеньев без локтя: изгиб делится между
 *  звеньями и выходит плавной дугой. Двигает куклу bomboraRig. viewBox 200×300. */
const BODY = 'M46 152 Q48 176 60 196 Q66 214 68 228 Q76 240 100 240 Q124 240 132 228 Q134 214 140 196 Q152 176 154 152Z'
const seg = (x1, y1, x2, y2, w) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${w ? FUR : INK}" stroke-width="${w ? 18 : 25}" stroke-linecap="round"/>`
// каждое звено: обводка → следующее звено целиком → мех; так мех звена накрывает обводку следующего на сгибе
const arm = (side, [p0, p1, p2, p3], fingers) => `<g class="pb-arm pb-arm${side}" style="transform-origin:${p0[0]}px ${p0[1]}px">
      ${seg(...p0, ...p1)}<g class="pb-mid${side}" style="transform-origin:${p1[0]}px ${p1[1]}px">
        ${seg(...p1, ...p2)}<g class="pb-fore${side}" style="transform-origin:${p2[0]}px ${p2[1]}px">
          ${seg(...p2, ...p3)}<circle cx="${p3[0]}" cy="${p3[1] + 2}" r="14" fill="${INK}"/>
          ${seg(...p2, ...p3, 1)}<circle cx="${p3[0]}" cy="${p3[1] + 2}" r="10.5" fill="${FUR}"/>
          <path d="${fingers}" ${line} stroke-width="2"/>
        </g>${seg(...p1, ...p2, 1)}
      </g>${seg(...p0, ...p1, 1)}
    </g>`
export const bomboraHead = mood => head(mood)
export function bomboraBody(mood = 'happy') {
  return `<svg class="pb" viewBox="0 0 200 300" aria-hidden="true">
    <ellipse cx="100" cy="294" rx="44" ry="5" fill="${INK}" opacity=".1"/>
    <g class="pb-all">
    <path class="pb-tail" d="M130 226 q24 2 26 -22" fill="none" ${line} stroke-width="9"/>
    <path class="pb-tail" d="M130 226 q24 2 26 -22" fill="none" stroke="${FUR}" stroke-width="3" stroke-linecap="round"/>
    <path class="pb-body" d="${BODY}" fill="${INK}" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>
    <g class="pb-leg pb-legl"><path d="M72 214 L71 276 q-8 2 -8 9 q0 7 9 7 h20 q5 0 5 -6 L96 214z" fill="${FUR}" ${line}/>
      <path d="M77 292 v-6M85 292 v-6" ${line} stroke-width="2.5"/></g>
    <g class="pb-leg pb-legr"><path d="M128 214 L129 276 q8 2 8 9 q0 7 -9 7 h-20 q-5 0 -5 -6 L104 214z" fill="${FUR}" ${line}/>
      <path d="M123 292 v-6M115 292 v-6" ${line} stroke-width="2.5"/></g>
    <path class="pb-body" d="${BODY}" fill="${FUR}"/>
    ${arm('l', [[56, 166], [51, 183], [47, 200], [45, 216]], 'M37 222 l2 5M45 225 v5')}
    ${arm('r', [[144, 166], [149, 183], [153, 200], [155, 216]], 'M163 222 l-2 5M155 225 v5')}
    <circle cx="56" cy="166" r="13" fill="${FUR}"/><circle cx="144" cy="166" r="13" fill="${FUR}"/>
    <g class="pb-head"><g class="pb-tilt"><g class="pb-headart">${head(mood)}</g>
      <g class="pb-scarf">
        <path d="M46 146 Q100 184 154 146 L156 162 Q100 202 44 162Z" fill="${CORAL}" ${line}/>
        <path class="pb-scarft" d="M78 174 q-12 18 -10 40 l15 -3 q-1 -18 5 -33z" fill="${CORAL}" ${line} stroke-width="3"/>
        <path class="pb-scarft" d="M86 176 q-2 20 8 36 l12 -7 q-8 -12 -6 -28z" fill="${CORAL}" ${line} stroke-width="3"/>
        <path d="M74 168 q10 -6 18 2 q-2 10 -10 10 q-8 0 -8 -12z" fill="${CORAL}" ${line} stroke-width="3"/>
      </g>
    </g></g>
    </g>
  </svg>`
}

/* Анимация куклы — Web Animations из текущего положения в новое: поза не «прыгает», даже если сменилась
 * посреди шага или взмаха. Углы — по часовой; левую руку наружу — плюс, правую — минус. Для руки задаются
 * подъём (aL/aR) и изгиб (bL/bR): изгиб поровну делится на два нижних звена — получается дуга, а не локоть. */
const rot = d => `rotate(${d}deg)`
const POSE = {
  rest: { aL: 4, bL: -10, aR: -4, bR: 10, lL: 'none', lR: 'none', hd: rot(0), all: 'none' },
  point: { aL: 6, bL: -12, aR: -84, bR: -8, hd: rot(-5) },
  wave: { aL: 6, bL: -12, aR: -122, bR: -40, hd: rot(5) },
  stretch: { aL: 120, bL: 40, aR: -120, bR: -40, hd: rot(-8), all: 'scale(1, 1.04)' },
  sleep: { aL: 14, bL: -70, aR: -14, bR: 70, hd: 'rotate(13deg) translateY(4px)' },
  jump: { aL: 124, bL: 24, aR: -124, bR: -24, hd: rot(-4) },
}
// петли: взмах лапкой (гнётся вся рука) и шаг (ноги поднимаются, корпус покачивается, руки чуть запаздывают)
const LOOP = {
  wave: { bR: [[-64, -12], 340] },
  // лицом к зрителю шаг — это подъём ноги и покачивание корпусом, а не «ножницы» в стороны
  walk: { lL: [['translateY(0)', 'translateY(-9px) rotate(-3deg)'], 460], lR: [['translateY(-9px) rotate(3deg)', 'translateY(0)'], 460],
    aL: [[-4, 16], 460, 60], aR: [[-16, 4], 460, 60], bL: [[-4, -24], 460, 110], bR: [[24, 4], 460, 110],
    all: [['rotate(-3deg)', 'rotate(3deg)'], 460] },
}
const SPRING = 'cubic-bezier(.34, 1.45, .55, 1)', SOFT = 'cubic-bezier(.45, 0, .3, 1)'

export function bomboraRig(svg) {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches
  const q = c => [svg.querySelector(c)]
  // изгиб руки — два звена, каждому половина угла
  const el = { aL: q('.pb-arml'), bL: [svg.querySelector('.pb-midl'), svg.querySelector('.pb-forel')], aR: q('.pb-armr'),
    bR: [svg.querySelector('.pb-midr'), svg.querySelector('.pb-forer')], lL: q('.pb-legl'), lR: q('.pb-legr'), hd: q('.pb-tilt'), all: q('.pb-all') }
  const anim = {}, val = {}
  const tf = (k, v) => typeof v === 'number' ? rot(k[0] === 'b' ? v / 2 : v) : v
  const from = (e, i, k) => { if (!anim[k]) return val[k] ?? 'rotate(0deg)'; const t = getComputedStyle(e).transform; return t === 'none' ? 'rotate(0deg)' : t }
  const stop = k => { anim[k]?.forEach(a => a.cancel()); anim[k] = null }
  const go = (k, v, ms, ease) => {
    const f = el[k].map((e, i) => from(e, i, k)); stop(k); val[k] = tf(k, v)
    anim[k] = el[k].map((e, i) => e.animate([{ transform: f[i] }, { transform: val[k] }], { duration: still ? 0 : ms, easing: ease, fill: 'forwards' }))
  }
  const loop = (k, [kf, ms, delay = 0]) => {
    const f = el[k].map((e, i) => from(e, i, k)); stop(k)
    const [k0, k1] = kf.map(v => tf(k, v))
    // сначала мягко в начало петли, потом туда-сюда
    const lead = el[k].map((e, i) => e.animate([{ transform: f[i] }, { transform: k0 }], { duration: 160 + delay, easing: SOFT, fill: 'forwards' }))
    anim[k] = lead
    lead[0].onfinish = () => { if (anim[k] !== lead) return; stop(k)
      anim[k] = el[k].map(e => e.animate([{ transform: k0 }, { transform: k1 }], { duration: ms, easing: 'ease-in-out', iterations: Infinity, direction: 'alternate' })) }
  }
  let base = 'rest', walking = false
  const apply = (ms, ease) => {
    const p = { ...POSE.rest, ...POSE[base] }
    for (const k in el) if (!(walking && LOOP.walk[k])) go(k, p[k], ms, ease)
    if (!still && base === 'wave' && !walking) loop('bR', LOOP.wave.bR)
    if (!still && walking) for (const k in LOOP.walk) loop(k, LOOP.walk[k])
  }
  return {
    pose(p = 'rest') {
      base = POSE[p] ? p : 'rest'
      if (base === 'jump' && !still) {
        // присел → взлетел (руки вверх) → приземлился с пружинкой
        go('all', 'translateY(6px) scale(1.06, .9)', 140, SOFT)
        setTimeout(() => { if (base !== 'jump') return; apply(260, 'cubic-bezier(.2, .8, .3, 1)'); go('all', 'translateY(-34px) scale(.96, 1.06)', 260, 'cubic-bezier(.2, .8, .3, 1)') }, 140)
        setTimeout(() => base === 'jump' && go('all', 'translateY(0) scale(1.07, .92)', 220, 'cubic-bezier(.6, 0, .9, .5)'), 420)
        setTimeout(() => base === 'jump' && go('all', 'none', 320, SPRING), 640)
        return
      }
      apply(base === 'sleep' ? 1100 : base === 'stretch' ? 800 : 420, base === 'sleep' ? SOFT : SPRING)
    },
    walk(on) { walking = on; apply(on ? 200 : 320, SOFT) },
  }
}

/** Кот-друг: серый, полосатый, синий ошейник. Сидит; хвост виляет, моргает. viewBox 160×200. */
export function catBody(mood = 'happy') {
  const GREY = '#9AA0A6', GREY_D = '#6E747B', NAVY = '#1B5FB0', PINK = '#F2A7B0'
  const eyes = mood === 'sleep'
    ? `<path d="M58 78 q6 5 12 0M90 78 q6 5 12 0" fill="none" ${line} stroke-width="3"/>`
    : `<g class="ct-eyes"><ellipse cx="64" cy="78" rx="5" ry="6.5" fill="${INK}"/><ellipse cx="96" cy="78" rx="5" ry="6.5" fill="${INK}"/><circle cx="62.5" cy="75.5" r="1.6" fill="#fff"/><circle cx="94.5" cy="75.5" r="1.6" fill="#fff"/></g>`
  const mouth = mood === 'cheer'
    ? `<path d="M72 94 q8 10 16 0z" fill="${CORAL}" ${line} stroke-width="2.5"/>`
    : `<path d="M74 93 q6 5 6 0 q0 5 6 0" fill="none" ${line} stroke-width="2.5"/>`
  return `<svg class="ct" viewBox="0 0 160 200" aria-hidden="true">
    <ellipse cx="80" cy="192" rx="44" ry="5" fill="${INK}" opacity=".1"/>
    <path class="ct-tail" d="M112 176 q34 4 32 -30 q-2 -18 -14 -22" fill="none" ${line} stroke-width="11"/>
    <path class="ct-tail" d="M112 176 q34 4 32 -30 q-2 -18 -14 -22" fill="none" stroke="${GREY}" stroke-width="5" stroke-linecap="round"/>
    <path d="M42 150 Q40 112 80 110 Q120 112 118 150 Q122 188 80 188 Q38 188 42 150Z" fill="${GREY}" ${line}/>
    <path d="M60 128 q8 4 4 12M98 128 q-8 4 -4 12" fill="none" stroke="${GREY_D}" stroke-width="3" stroke-linecap="round"/>
    <path d="M58 188 q0 -16 10 -16 q10 0 10 16M82 188 q0 -16 10 -16 q10 0 10 16" fill="${GREY}" ${line} stroke-width="3"/>
    <g class="ct-head">
      <path d="M38 64 L42 22 L70 46 Z" fill="${GREY}" ${line}/><path d="M122 64 L118 22 L90 46 Z" fill="${GREY}" ${line}/>
      <path d="M46 52 L48 32 L62 46Z M114 52 L112 32 L98 46Z" fill="${PINK}"/>
      <ellipse cx="80" cy="80" rx="46" ry="40" fill="${GREY}" ${line}/>
      <path d="M80 42 v10M68 44 l3 9M92 44 l-3 9" stroke="${GREY_D}" stroke-width="3" stroke-linecap="round"/>
      ${eyes}
      <path d="M76 86 h8 l-4 4z" fill="${PINK}" ${line} stroke-width="2"/>
      ${mouth}
      <path d="M40 86 h18M42 94 l16 -3M120 86 h-18M118 94 l-16 -3" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>
    </g>
    <path d="M50 114 Q80 128 110 114" fill="none" stroke="${NAVY}" stroke-width="8" stroke-linecap="round"/>
    <circle cx="80" cy="124" r="5" fill="#F5B820" ${line} stroke-width="2"/>
  </svg>`
}
