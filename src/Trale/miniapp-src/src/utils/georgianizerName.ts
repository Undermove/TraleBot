/**
 * georgianizerName.ts — client-side Georgian name transliteration.
 *
 * Two-level logic:
 *  1. Dictionary lookup for ~60 common Russian/English names with
 *     traditional Georgian equivalents (Иван → ივანე, not mechanical char-by-char).
 *  2. Character-by-character fallback for names not in the dictionary.
 *
 * No backend calls — purely client-side.
 */

/** Result of a transliteration: Georgian script + Latin translit hint. */
export interface GeorgianNameResult {
  geo: string
  translit: string
}

// ---------------------------------------------------------------------------
// Level 1 — traditional Georgian name equivalents
// ---------------------------------------------------------------------------

const NAME_DICT: Record<string, GeorgianNameResult> = {
  иван:        { geo: 'ივანე',      translit: 'ivane' },
  мария:       { geo: 'მარია',      translit: 'maria' },
  александр:   { geo: 'ალექსანდრე', translit: 'aleksandre' },
  анна:        { geo: 'ანა',        translit: 'ana' },
  дмитрий:     { geo: 'დიმიტრი',    translit: 'dimitri' },
  михаил:      { geo: 'მიხეილ',     translit: 'mikheil' },
  елена:       { geo: 'ელენე',      translit: 'elene' },
  николай:     { geo: 'ნიკოლაი',    translit: 'nikolai' },
  ольга:       { geo: 'ოლღა',       translit: 'olgha' },
  сергей:      { geo: 'სერგი',      translit: 'sergi' },
  татьяна:     { geo: 'ტატიანა',    translit: 'tatiana' },
  андрей:      { geo: 'ანდრეი',     translit: 'andrei' },
  екатерина:   { geo: 'ეკატერინე',  translit: 'ekaterine' },
  алексей:     { geo: 'ალექსი',     translit: 'aleksi' },
  наталья:     { geo: 'ნატალია',    translit: 'natalia' },
  владимир:    { geo: 'ვლადიმირ',   translit: 'vladimir' },
  юлия:        { geo: 'იულია',      translit: 'iulia' },
  виктор:      { geo: 'ვიქტორ',     translit: 'viktor' },
  светлана:    { geo: 'სვეტლანა',   translit: 'svetlana' },
  павел:       { geo: 'პავლე',      translit: 'pavle' },
  нина:        { geo: 'ნინო',       translit: 'nino' },
  георгий:     { geo: 'გიორგი',     translit: 'giorgi' },
  максим:      { geo: 'მაქსიმ',     translit: 'maksim' },
  антон:       { geo: 'ანტონ',      translit: 'anton' },
  кирилл:      { geo: 'კირილე',     translit: 'kirile' },
  оксана:      { geo: 'ოქსანა',     translit: 'oksana' },
  игорь:       { geo: 'იგორ',       translit: 'igor' },
  ирина:       { geo: 'ირინა',      translit: 'irina' },
  алина:       { geo: 'ალინა',      translit: 'alina' },
  илья:        { geo: 'ილია',       translit: 'ilia' },
  тимур:       { geo: 'თიმური',     translit: 'timuri' },
  артём:       { geo: 'არტემ',      translit: 'artem' },
  артем:       { geo: 'არტემ',      translit: 'artem' },
  даниил:      { geo: 'დანიელ',     translit: 'daniel' },
  денис:       { geo: 'დენი',       translit: 'deni' },
  роман:       { geo: 'რომანი',     translit: 'romani' },
  семён:       { geo: 'სიმონ',      translit: 'simon' },
  семен:       { geo: 'სიმონ',      translit: 'simon' },
  надежда:     { geo: 'ნადეჟდა',    translit: 'nadezhda' },
  надя:        { geo: 'ნადია',      translit: 'nadia' },
  ксения:      { geo: 'ქსენია',     translit: 'ksenia' },
  вера:        { geo: 'ვერა',       translit: 'vera' },
  тамара:      { geo: 'თამარა',     translit: 'tamara' },
  евгений:     { geo: 'ევგენი',     translit: 'evgeni' },
  евгения:     { geo: 'ევგენია',    translit: 'evgenia' },
  станислав:   { geo: 'სტანისლავ',  translit: 'stanislav' },
  валерия:     { geo: 'ვალერია',    translit: 'valeria' },
  полина:      { geo: 'პოლინა',     translit: 'polina' },
  карина:      { geo: 'კარინა',     translit: 'karina' },
  кристина:    { geo: 'ქრისტინე',   translit: 'kristine' },
  маша:        { geo: 'მაშა',       translit: 'masha' },
  саша:        { geo: 'საშა',       translit: 'sasha' },
  коля:        { geo: 'კოლია',      translit: 'kolia' },
  // Common English/Latin names
  alexander:   { geo: 'ალექსანდრე', translit: 'aleksandre' },
  maria:       { geo: 'მარია',      translit: 'maria' },
  sofia:       { geo: 'სოფია',      translit: 'sophia' },
  sophie:      { geo: 'სოფია',      translit: 'sophia' },
  anna:        { geo: 'ანა',        translit: 'ana' },
  ivan:        { geo: 'ივანე',      translit: 'ivane' },
  george:      { geo: 'გიორგი',     translit: 'giorgi' },
  elena:       { geo: 'ელენე',      translit: 'elene' },
  natalia:     { geo: 'ნატალია',    translit: 'natalia' },
  natalya:     { geo: 'ნატალია',    translit: 'natalia' },
  evgeny:      { geo: 'ევგენი',     translit: 'evgeni' },
  evgenia:     { geo: 'ევგენია',    translit: 'evgenia' },
  artem:       { geo: 'არტემ',      translit: 'artem' },
  tamara:      { geo: 'თამარა',     translit: 'tamara' },
  nina:        { geo: 'ნინო',       translit: 'nino' },
  vera:        { geo: 'ვერა',       translit: 'vera' },
  irina:       { geo: 'ირინა',      translit: 'irina' },
  alina:       { geo: 'ალინა',      translit: 'alina' },
}

// ---------------------------------------------------------------------------
// Level 2 — character-by-character fallback maps
// ---------------------------------------------------------------------------

/** Cyrillic → Georgian */
const CYRILLIC_MAP: Record<string, string> = {
  а: 'ა', б: 'ბ', в: 'ვ', г: 'გ', д: 'დ', е: 'ე', ё: 'ო', ж: 'ჟ',
  з: 'ზ', и: 'ი', й: 'ი', к: 'კ', л: 'ლ', м: 'მ', н: 'ნ', о: 'ო',
  п: 'პ', р: 'რ', с: 'ს', т: 'ტ', у: 'უ', ф: 'ფ', х: 'ხ', ц: 'ც',
  ч: 'ჩ', ш: 'შ', щ: 'შ', ъ: '',  ы: 'ი', ь: '',  э: 'ე', ю: 'იუ', я: 'ია',
}

/** Latin → Georgian */
const LATIN_MAP: Record<string, string> = {
  a: 'ა', b: 'ბ', c: 'კ', d: 'დ', e: 'ე', f: 'ფ', g: 'გ', h: 'ხ',
  i: 'ი', j: 'ჯ', k: 'კ', l: 'ლ', m: 'მ', n: 'ნ', o: 'ო', p: 'პ',
  q: 'ქ', r: 'რ', s: 'ს', t: 'ტ', u: 'უ', v: 'ვ', w: 'ვ', x: 'ქს',
  y: 'ი', z: 'ზ',
}

// Georgian Unicode block: U+10A0–U+10FF (Mkhedruli: U+10D0–U+10FF)
const GEORGIAN_RE = /[\u10A0-\u10FF]/

/** Returns true if the string is already in Georgian script. */
function isAlreadyGeorgian(name: string): boolean {
  return GEORGIAN_RE.test(name)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Transliterate a user's first name into Georgian script.
 *
 * @param name - raw first_name from Telegram (any script)
 * @returns `{ geo, translit }` or `null` if name is empty/untranslatable
 */
export function transliterateToGeorgian(name: string): GeorgianNameResult | null {
  if (!name || name.trim().length === 0) return null

  const trimmed = name.trim()

  // Already Georgian — pass through, no translit hint needed
  if (isAlreadyGeorgian(trimmed)) {
    return { geo: trimmed, translit: trimmed }
  }

  const key = trimmed.toLowerCase()

  // Level 1 — dictionary lookup
  if (NAME_DICT[key]) return NAME_DICT[key]

  // Level 2 — character-by-character fallback
  let geo = ''
  for (const ch of key) {
    if (CYRILLIC_MAP[ch] !== undefined) {
      geo += CYRILLIC_MAP[ch]
    } else if (LATIN_MAP[ch] !== undefined) {
      geo += LATIN_MAP[ch]
    } else if (ch === ' ' || ch === '-') {
      geo += ch
    }
    // Unknown chars are dropped silently
  }

  if (!geo) return null

  return { geo, translit: trimmed }
}

/**
 * Adaptive font size for the Georgian name display:
 * shorter names → bigger, very long → smaller.
 */
export function clampNameFontSize(geo: string): string {
  if (geo.length <= 6) return '36px'
  if (geo.length <= 9) return '28px'
  return '22px'
}

/**
 * Letter-spacing class: long names need tighter spacing to fit on 375px.
 */
export function nameLetterSpacingClass(geo: string): string {
  return geo.length <= 8 ? 'tracking-widest' : 'tracking-normal'
}
