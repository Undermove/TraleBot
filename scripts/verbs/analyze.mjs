// Тип глагола считается по самим формам из источника, без знаний «из головы»:
//  pattern — все шесть форм карточки от одного корня и собираются по одной из двух схем;
//  feature — корень тот же, но схема ломается (вставная гласная, смена суффикса, два варианта);
//  special — в разных временах разные корни.

const CARD = ['present', 'aorist', 'imperfect', 'optative', 'conditional', 'future']
// Ручные поправки там, где счёт по буквам ошибается: корень один, но меняется сильно (პოულ- / პოვ-).
const SAME_ROOT = new Set(['პოულობს'])

function lcs(a, b) {
  let best = ''
  for (let i = 0; i < a.length; i++)
    for (let j = i + 1; j <= a.length; j++) {
      const s = a.slice(i, j)
      if (s.length > best.length && b.includes(s)) best = s
    }
  return best
}

const skeleton = s => s.replace(/[აეიოუ]/g, '')
const related = (a, b) => lcs(a, b).length >= 3 || lcs(skeleton(a), skeleton(b)).length >= 2

export function analyze(verb) {
  const form = (t, person) => verb.tenses[t]?.[person]?.[0] ?? ''
  const tenses = CARD.filter(t => form(t, 0))
  const present2 = form('present', 1) || form('present', 0)

  // Оптатив сверяем с аористом, условное — с будущим: внутри пары основа общая,
  // а сравнивать их с настоящим напрямую мешают короткие корни (იღებ → აიღო).
  const second = t => form(t, 1) || form(t, 0)
  const pair = { optative: 'aorist', conditional: 'future' }
  const isOdd = t => {
    const via = pair[t]
    if (via && second(via) && related(second(via), second(t))) return isOdd(via)
    return !related(present2, second(t))
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
  const scheme = p1 && f1.endsWith(p1) ? 'preverb' : p1.startsWith('ვ') && f1.startsWith('ვი') ? 'medial' : null
  const preverb = scheme === 'preverb' ? f1.slice(0, f1.length - p1.length) : ''
  const base = { scheme, root, oddTenses }

  const hasVariants = tenses.some(t => (verb.tenses[t]?.[0]?.length ?? 0) > 1)
  const skeletonRoot = sample.map(skeleton).reduce((r, f) => lcs(r, f))
  const vowelShift = skeletonRoot.length > skeleton(root).length

  if (hasVariants) return { ...base, kind: 'feature', reason: 'У некоторых форм два равноправных варианта.' }
  if (vowelShift) return { ...base, kind: 'feature', reason: 'В части форм внутри корня появляется или выпадает гласная.' }
  if (!scheme) return { ...base, kind: 'feature', reason: 'Будущее и прошедшее строятся не от формы настоящего.' }
  return {
    ...base,
    kind: 'pattern',
    reason: scheme === 'preverb'
      ? (preverb ? `Будущее и аорист = приставка ${preverb}- + основа настоящего.` : 'Будущее совпадает с настоящим, приставки нет.')
      : 'Будущее и аорист получают ი- после показателя лица, приставки нет.'
  }
}
