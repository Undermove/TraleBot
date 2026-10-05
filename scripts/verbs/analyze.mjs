// Тип глагола считается по самим формам из источника, без знаний «из головы»:
//  pattern — все шесть форм карточки от одного корня и собираются по одной из двух схем;
//  feature — корень тот же, но схема ломается (вставная гласная, смена суффикса, два варианта);
//  special — в разных временах разные корни, либо глагол-перевёртыш, либо в источнике только
//            часть времён (тогда про схему сказать нечего).
// Эвристика настроена на первых 23 глаголах и перепроверена глазами на всём каталоге (~180);
// где счёт по буквам ошибается — ручные поправки ниже (SAME_ROOT).

const CARD = ['present', 'aorist', 'imperfect', 'optative', 'conditional', 'future']

// Ручные поправки: корень один, но счёт по буквам его не видит.
//   პოულობს — корень меняется сильно (პოულ- / პოვ-);
//   დებს    — корень из одной буквы, совпадение короче порога.
const SAME_ROOT = new Set(['პოულობს', 'დებს'])

function lcs(a, b) {
  let best = ''
  for (let i = 0; i < a.length; i++)
    for (let j = i + 1; j <= a.length; j++) {
      const s = a.slice(i, j)
      if (s.length > best.length && b.includes(s)) best = s
    }
  return best
}

const commonPrefix = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return a.slice(0, i) }
const skeleton = s => s.replace(/[აეიოუ]/g, '')

const related = (a, b) => lcs(a, b).length >= 3 || lcs(skeleton(a), skeleton(b)).length >= 2

// Общая приставка — не довод в пользу общего корня: у გამოდიხარ и გამოხვალ совпадает только преверб.
// Преверб, который стоит во всех формах карточки, находится как их общее начало и перед сравнением
// корней отбрасывается — но лишь когда после него у каждой формы остаётся что сравнивать (≥ 3 букв):
// у აჩვენებ / აჩვენე общее начало — это и есть корень, его трогать нельзя.
function sharedPreverb(forms) {
  const p = forms.reduce((x, f) => commonPrefix(x, f))
  return forms.length > 1 && p && forms.every(f => f.length - p.length >= 3) ? p.length : 0
}

// Перевёртыш (инверсия): лицо показывает приставка მ- / გ- / გვ-, как «мне / тебе / нам»,
// а остальная форма у «я» и «ты» одинаковая. Определяется по ряду настоящего времени.
function inverted(present) {
  const [p1, p2, , p4] = present.map(c => c[0] ?? '')
  return p1.startsWith('მ') && p2.startsWith('გ') && p4.startsWith('გვ') && p1.slice(1) === p2.slice(1)
}

export function analyze(verb, { partial = false } = {}) {
  const form = (t, person) => verb.tenses[t]?.[person]?.[0] ?? ''
  const tenses = CARD.filter(t => form(t, 0))

  if (verb.tenses.present && inverted(verb.tenses.present))
    return {
      kind: 'special', scheme: null, root: '', oddTenses: [],
      reason: 'Перевёртыш: кто действует, показывает начало формы («мне», «тебе», «нам»), а не окончание.' + (partial ? ' В источнике есть только часть времён.' : '')
    }
  if (partial)
    return { kind: 'special', scheme: null, root: '', oddTenses: [], reason: 'В источнике есть только часть времён — учить формы целиком.' }

  // Оптатив сверяем с аористом, условное — с будущим: внутри пары основа общая,
  // а сравнивать их с настоящим напрямую мешают короткие корни (იღებ → აიღო).
  const cut = sharedPreverb(tenses.map(t => form(t, 1) || form(t, 0)))
  const second = t => (form(t, 1) || form(t, 0)).slice(cut)
  // Сразу после преверба формы начинаются одинаково (მო|დიხარ, მო|დიოდი) — корень общий, даже если
  // он слишком короткий для счёта по буквам.
  const sameStart = (a, b) => cut > 0 && commonPrefix(a, b).length >= 2
  const pair = { optative: 'aorist', conditional: 'future' }
  const isOdd = t => {
    const via = pair[t]
    if (via && second(via) && related(second(via), second(t))) return isOdd(via)
    return !sameStart(second('present'), second(t)) && !related(second('present'), second(t))
  }
  const sameRoot = SAME_ROOT.has(verb.lemma)
  const oddTenses = sameRoot ? [] : tenses.filter(t => t !== 'present' && isOdd(t))

  // Корень ищем по 1-му и 2-му лицу сразу, чтобы в него не попал показатель лица ვ-.
  const sample = tenses.flatMap(t => [form(t, 0), form(t, 1)]).filter(Boolean)
  const root = sample.reduce((r, f) => lcs(r, f), sample[0] ?? '')

  if (oddTenses.length)
    return { kind: 'special', scheme: null, root: '', oddTenses, reason: 'В разных временах разные корни — учить целиком.' }

  const p1 = form('present', 0)
  const f1 = form('future', 0)
  const a1 = form('aorist', 0)
  // Схема «без приставки»: будущее = ვი + основа + ებ (ვთამაშობ → ვითამაშებ). Основа — общее начало
  // настоящего (без ვ-) и будущего (без ვი-); если после неё в будущем не -ებ, это уже не схема
  // (ვყიდულობ → ვიყიდი). У глаголов, где -ებ есть уже в настоящем, оно входит в общее начало.
  const medialStem = p1.startsWith('ვ') && f1.startsWith('ვი') ? commonPrefix(p1.slice(1), f1.slice(2)) : ''
  const scheme = p1 && f1 === p1 ? 'same' : p1 && f1.endsWith(p1) ? 'preverb'
    : medialStem.length >= 2 && (f1.slice(2) === medialStem + 'ებ' || (f1.slice(2) === medialStem && medialStem.endsWith('ებ'))) ? 'medial'
    : null
  const preverb = scheme === 'preverb' ? f1.slice(0, f1.length - p1.length) : ''
  const base = { scheme, root, oddTenses }

  const hasVariants = tenses.some(t => (verb.tenses[t]?.[0]?.length ?? 0) > 1)
  const skeletonRoot = sample.map(skeleton).reduce((r, f) => lcs(r, f))
  const vowelShift = skeletonRoot.length > skeleton(root).length
  // Аорист «по образцу» — та же основа, что в будущем, только вместо тематического суффикса
  // (до трёх букв: -ებ, -ავ, -ი, -ები…) одна буква окончания. Если отличается больше — основа меняется
  // (დავანგრევ → დავანგრიე, გამოვცემ → გამოვეცი).
  const stem = commonPrefix(f1, a1)
  const aoristShift = Boolean(f1 && a1) && (a1.length - stem.length > 1 || f1.length - stem.length > 3)

  if (hasVariants) return { ...base, kind: 'feature', reason: 'У некоторых форм два равноправных варианта.' }
  if (vowelShift) return { ...base, kind: 'feature', reason: 'В части форм внутри корня появляется или выпадает гласная.' }
  if (!scheme) return { ...base, kind: 'feature', reason: 'Будущее и прошедшее строятся не от формы настоящего.' }
  if (aoristShift) return { ...base, kind: 'feature', reason: 'В аористе меняется основа, а не только окончание.' }
  return {
    ...base,
    kind: 'pattern',
    reason: scheme === 'preverb' ? `Будущее и аорист = приставка ${preverb}- + основа настоящего.`
      : scheme === 'same' ? 'Будущее совпадает с настоящим, приставки нет.'
      : 'Будущее и аорист получают ი- после показателя лица, приставки нет.'
  }
}
