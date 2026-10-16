import { CITIES, COUNTRIES, HERO, JOBS, NAMES, met, phrase, pick, shuffle, type City, type Country, type GeoName, type Rng, type Word } from '../story'

// Разговоры «Знакомства» как данные: реплики собеседника и варианты ответа. Общие для чата с Нино,
// такси и супры. Весь грузинский — фразы из story.json или словарик по разрешённым шаблонам
// (მე მქვია <имя>, მე ვარ <откуда>, მე ვარ <профессия>, ვცხოვრობ <где>, <привет>, <имя>!).

/** Грузинская строка с переводом и списком фраз story.json, на которых она держится. */
export interface Line { geo: string; ru: string; ids: string[] }

/** Что пишет/говорит собеседник: реплика, ремарка по-русски или фото. */
export type Say =
  | ({ kind: 'her' } & Line)
  | { kind: 'note'; text: string }
  | { kind: 'photo'; caption: string; seed: number }

/** Вариант ответа. good — разговор идёт дальше; иначе собеседник смешно реагирует (miss) и можно выбрать ещё раз. */
export interface Opt extends Line {
  good: boolean
  /** Сколько тепла даёт (промах — 0 или −1). */
  w: number
  /** Реакция на промах, по-русски. */
  miss?: string
  /** Что собеседник ответит на этот ответ, прежде чем идти дальше. */
  then?: Say[]
}

export interface Exchange { her: Say[]; opts: Opt[] }

// ── Конструкторы реплик ───────────────────────────────────────────────────────────────────────────

export const P = (id: string): Line => { const p = phrase(id); return { geo: p.geo, ru: p.ru, ids: [id] } }
const strip = (s: string) => s.replace(/[.!?…]+$/, '')

export const her = (l: Line): Say => ({ kind: 'her', ...l })
export const note = (text: string): Say => ({ kind: 'note', text })
export const ok = (l: Line, w = 1, then?: Say[]): Opt => ({ ...l, good: true, w, then })
export const no = (l: Line, miss: string, w = 0): Opt => ({ ...l, good: false, w, miss })

/** «Меня зовут …» — шаблон მე მქვია <имя>. */
export const iAmCalled = (me: GeoName): Line => ({ geo: `${phrase('me_mkvia').geo.replace('…', '')} ${me.geo}`.replace(/\s+/g, ' '), ru: `Меня зовут ${me.ru}`, ids: ['me_mkvia'] })
/** «<Привет>, <имя>!» */
export const hello = (name: string, ruName: string): Line => ({ geo: `${strip(phrase('gamarjoba').geo)}, ${name}!`, ru: `Привет, ${ruName}!`, ids: ['gamarjoba'] })
/** «Я из …» — მე ვარ <страна-დან>. Фразы с Грузией и Испанией есть целиком, Франция — по шаблону. */
export const iAmFrom = (c: Country): Line => ({ geo: `მე ვარ ${c.from}`, ru: `Я ${c.ruFrom}`, ids: [c.flag === 'ge' ? 'sakartvelodan' : c.flag === 'es' ? 'espanetidan' : 'safrangetidan'] })
/** Смешная ошибка: без -დან — «я Испания». */
export const iAmCountry = (c: Country): Line => ({ geo: `მე ვარ ${c.base}`, ru: `«Я ${c.ru}»`, ids: [c.flag === 'ge' ? 'sakartvelodan' : 'espanetidan'] })
/** «Живу в …» — ვცხოვრობ <город-ში>. */
export const iLiveIn = (c: City): Line => ({ geo: `ვცხოვრობ ${c.in}`, ru: `Живу в ${c.ru}`, ids: ['batumshi'] })
/** Смешная ошибка: без -ში — «живу Батуми». */
export const iLiveCity = (c: City): Line => ({ geo: `ვცხოვრობ ${c.base}`, ru: `«Живу ${c.ru}»`, ids: ['batumshi'] })
/** «Я — <профессия>». */
export const iAmJob = (j: Word): Line => ({ geo: `მე ვარ ${j.geo}`, ru: `Я ${j.ru}`, ids: [j.geo === JOBS[0].geo ? 'studenti' : j.geo === JOBS[1].geo ? 'eqimi' : 'mascavlebeli'] })
/** «Он/она — <профессия>». */
export const heIsJob = (j: Word): Line => ({ geo: `ის არის ${j.geo}`, ru: `Он/она ${j.ru}`, ids: ['mascavlebeli'] })
/** Просто имя (ответ на «кто это?»). */
export const justName = (geo: string): Line => ({ geo: `${geo}.`, ru: `${NAMES[geo]}.`, ids: ['vin_aris'] })
/** «-ში» как вопрос таксиста: «В Кутаиси?» */
export const toCity = (c: City): Line => ({ geo: `${c.in}?`, ru: `В ${c.ru}?`, ids: ['kutaisshi'] })
/** Отдельное «а ты?» — слово შენ из «კარგად, შენ?». */
export const andYou = (): Line => ({ geo: 'შენ?', ru: 'А ты?', ids: ['kargad_shen'] })

export const BATUMI = CITIES.find(c => c.ru === 'Батуми') ?? CITIES[0]
export const TBILISI = CITIES.find(c => c.ru === 'Тбилиси') ?? CITIES[0]
export const ABROAD = COUNTRIES.filter(c => c.flag !== 'ge')
export const GEORGIA = COUNTRIES.find(c => c.flag === 'ge') ?? COUNTRIES[0]

const NINO = 'ნინო'

/** Оставить только то, что человек к этому уроку уже встречал (фразы и слова сцен). Обмен без верного ответа выпадает. */
export function onlyKnown(list: Exchange[], lessonId: number): Exchange[] {
  const known = (l: { ids: string[] }) => l.ids.every(id => met(lessonId, id))
  const clean = (s: Say[]) => s.filter(x => x.kind !== 'her' || known(x))
  return list
    .map(e => ({ her: clean(e.her), opts: e.opts.filter(known).map(o => (o.then ? { ...o, then: clean(o.then) } : o)) }))
    .filter(e => e.opts.some(o => o.good) && e.her.length > 0)
}

const mix = (e: Exchange, rng: Rng): Exchange => ({ ...e, opts: shuffle(e.opts, rng) })

// ── Чат с Нино ───────────────────────────────────────────────────────────────────────────────────

export type ChatScript = 'act2' | 'act3' | 'act4' | 'act6'

/**
 * «Как дела?» — общий для всех актов обмен; на «а ты?» Нино отвечает. В поздних актах она отвечает
 * по-разному (ძალიან კარგად), а у тебя есть «очень хорошо» вместо простого «хорошо, спасибо».
 */
function howAreYou(me: GeoName, wrong: Opt, warm = false): Exchange {
  return {
    her: [her(P('rogor'))],
    opts: [
      ok(P('kargad_shen'), 2, [her(P(warm ? 'dzalian_kargad' : 'kargad_madloba'))]),
      warm ? ok(P('dzalian_kargad'), 1, [her(P('mets_kargad'))]) : ok(P('kargad_madloba'), 1),
      wrong
    ]
  }
}

// Слова сцен первых уроков (кафе во дворе, море, хачапури) — чтобы разговоры с Нино были про жизнь, а не
// одни и те же вопросы. Реплики собраны из слов story.json.
const coffeeOrTea = (): Line => ({ geo: 'ყავა? ჩაი?', ru: 'Кофе? Чай?', ids: ['qava', 'chai'] })
const please = (id: 'qava' | 'chai'): Line => ({ geo: `${phrase(id).geo}, ${phrase('gtkhovt').geo}.`, ru: `${phrase(id).ru[0].toUpperCase() + phrase(id).ru.slice(1)}, пожалуйста.`, ids: [id, 'gtkhovt'] })
const seaQ = (): Line => ({ geo: `${phrase('zghva').geo}?`, ru: 'На море?', ids: ['zghva'] })

const bye = (): Exchange => ({
  her: [her(P('nakhvamdis'))],
  opts: [ok(P('nakhvamdis'), 1), no(P('gamarjoba'), 'Нино: «Мы же уже поздоровались!» Сейчас она прощается.')]
})

export function chatScript(script: ChatScript, me: GeoName, rng: Rng = Math.random): Exchange[] {
  const country = pick(ABROAD, rng)
  const photoSeed = Math.floor(rng() * 1000)
  const friend = pick(Object.keys(NAMES).filter(n => n !== NINO && n !== me.geo), rng)
  let list: Exchange[]
  switch (script) {
    case 'act2': list = [
      { her: [her(P('dila'))], opts: [
        ok(P('dila'), 1), ok(P('gamarjoba'), 1),
        no(P('saghamo'), 'Нино: «Вечер? У меня ещё кофе не остыл». Сейчас утро.')
      ] },
      { her: [her(P('me_mkvia_nino'))], opts: [
        ok(iAmCalled(me), 2),
        no(P('ra_gkvia'), 'Нино смеётся: «Я же только что сказала — Нино! А тебя?»'),
        no(P('nakhvamdis'), 'Нино: «Уже прощаешься? Мы только начали!»', -1)
      ] },
      { her: [her(P('sasiamovnoa'))], opts: [
        ok(P('sasiamovnoa'), 2), ok(P('madloba'), 1),
        no(P('ara'), 'Нино в шоке: «Не приятно?!» Ответь ей тем же словом.', -1)
      ] },
      howAreYou(me, no(iAmCalled(me), 'Нино: «Как тебя зовут, я уже знаю. Как дела?»')),
      { her: [note('Нино варит кофе во дворе и зовёт тебя'), her(coffeeOrTea())], opts: [
        ok(please('qava'), 2), ok(please('chai'), 2),
        no(P('pasporti'), 'Нино смеётся: «Паспорт? Это двор, а не граница!» Выбери кофе или чай.')
      ] },
      { her: [{ kind: 'photo', caption: `Нино прислала фото со двора: ты и твой друг ${NAMES[friend]}`, seed: photoSeed }, her(P('vin_aris'))], opts: [
        ok(P('es_chemi_megobaria'), 2), ok(justName(friend), 1),
        no(iAmCalled(me), 'Нино: «Тебя я уже знаю! А кто рядом с тобой?»')
      ] },
      bye()
    ]; break
    case 'act3': list = [
      { her: [her(hello(me.geo, me.ru))], opts: [
        ok(P('gagimarjos'), 2), ok(hello(NINO, 'Нино'), 1),
        no(P('ra_gkvia'), 'Нино: «Мы же вчера познакомились! Я Нино».')
      ] },
      howAreYou(me, no(P('ara'), 'Нино растерялась: «Нет» — не ответ на «как дела».')),
      { her: [her(P('saidan'))], opts: [
        ...ABROAD.map(c => ok(iAmFrom(c), 2, [her(P('mogcons'))])),
        no(iAmCountry(country), `Нино: «Ты целая ${country.ru}?» Не хватает -დან — «из».`)
      ] },
      { her: [note('Нино спросила, нравится ли тебе Грузия')], opts: [
        ok(P('ki'), 2),
        no(P('madloba'), 'Нино: «За что спасибо? Я спросила, нравится ли тебе Грузия».'),
        no(P('ara'), 'Нино: «Ты здесь три дня, дай Грузии шанс!»', -1)
      ] },
      { her: [note('Нино зовёт завтра искупаться'), her(seaQ())], opts: [
        ok(P('ki'), 2, [her(P('dzalian_kargad'))]),
        no(P('gamicheret'), 'Нино: «Остановить? Мы же не в маршрутке!» Она зовёт на море — ответь «да».'),
        no(P('ara'), 'Нино: «Вода тёплая, соглашайся!»', -1)
      ] },
      { her: [note('Спроси Нино, откуда она')], opts: [
        ok(P('saidan'), 1, [her(P('sakartvelodan'))]),
        no(P('ra_gkvia'), 'Нино: «Как меня зовут, ты знаешь. Спроси, откуда я».'),
        no(P('vin_aris'), 'Нино: «Кто это? Это я, Нино!»')
      ] },
      bye()
    ]; break
    case 'act4': {
      // Ты — студент (HERO): так сказано на карточке «Ты». Нино отвечает своей профессией.
      const job = HERO.job
      const other = pick(JOBS.filter(j => j !== job), rng)
      list = [
        { her: [her(P('saghamo'))], opts: [
          ok(P('saghamo'), 1), ok(P('gamarjoba'), 1),
          no(P('dila'), 'Нино: «Утро? Уже луна над морем!» Сейчас вечер.')
        ] },
        howAreYou(me, no(P('ki'), 'Нино: «Да — что? Я спросила, как дела».'), true),
        { her: [{ kind: 'photo', caption: 'Нино прислала фото: хачапури в кафе на вокзале', seed: photoSeed + 7 }, her(P('khachapuri'))], opts: [
          ok(P('gemrielia'), 2), ok(P('ki'), 1),
          no(P('bodishi'), 'Нино: «За что извиняешься? Я хвастаюсь хачапури!»')
        ] },
        { her: [note('Нино пишет из поезда: она учится в столице'), her(P('tbilisshi')), her(andYou())], opts: [
          ok(P('batumshi'), 2),
          no(iLiveCity(BATUMI), 'Нино: «Живу Батуми?» Не хватает -ში — «в». И ი в конце уходит.'),
          no(iAmFrom(pick(ABROAD, rng)), 'Нино: «Откуда ты, я помню. Я спросила, где ты живёшь».')
        ] },
        { her: [her(P('ra_profesia'))], opts: [
          ok(iAmJob(job), 2, [her(iAmJob(other))]),
          no(P('vmushaob'), 'Нино: «Работаешь — молодец. А кем?»'),
          no(iAmJob(other), `Нино: «${other.ru[0].toUpperCase() + other.ru.slice(1)}? Ты же писал, что приехал учиться!»`)
        ] },
        { her: [note('Нино прислала фото моря'), her(P('mogcons'))], opts: [
          ok(P('lamazia'), 2), ok(P('ki'), 1),
          no(P('ara'), 'Нино: «Ты посмотри на это море ещё раз!»', -1)
        ] },
        bye()
      ]
      break
    }
    case 'act6': {
      const stranger = pick(Object.keys(NAMES).filter(n => n !== NINO && n !== me.geo), rng)
      list = [
        { her: [her(hello(me.geo, me.ru))], opts: [
          ok(P('gagimarjos'), 2), ok(hello(NINO, 'Нино'), 1),
          no(P('ra_gkvia'), 'Нино: «Ты что, забыл? Я Нино, твоя соседка!»')
        ] },
        howAreYou(me, no(iAmJob(JOBS[0]), 'Нино: «Кем работаешь, я помню. Как дела?»'), true),
        { her: [note('Нино спрашивает, что ты принесёшь в субботу к столу')], opts: [
          ok(P('ghvino'), 2, [her(P('dzalian_kargad'))]), ok(P('khachapuri'), 2, [her(P('dzalian_kargad'))]),
          no(P('gasaghebi'), 'Нино: «Ключ? Дверь будет открыта!» Принеси что-нибудь к столу.')
        ] },
        { her: [her(P('myavs_dzma_da')), her(andYou())], opts: [
          ok(P('myavs_da'), 2), ok(P('myavs_dzma_da'), 2),
          no(P('makvs_manqana'), 'Нино: «Машина — не родня!» Про людей говорят მყავს (мкавс).')
        ] },
        { her: [her(P('mogcons'))], opts: [
          ok(P('miyvars_sakartvelo'), 2), ok(P('ki'), 1),
          no(P('myavs_dzaghli'), 'Нино: «Собака — это мило, но я про Грузию».')
        ] },
        { her: [{ kind: 'photo', caption: 'Нино прислала старое фото с бабушкиной свадьбы', seed: photoSeed }, her(P('vin_aris'))], opts: [
          ok(P('ar_vici'), 2, [note('Нино: «Правильно, откуда тебе знать. Это мой дедушка!»')]),
          no(P('es_chemi_megobaria'), 'Нино: «Твой друг? Ты его ни разу не видел!» Не знаешь — так и скажи.'),
          no(justName(stranger), `Нино: «Нет, не ${NAMES[stranger]}». Ты его не знаешь — так и скажи.`)
        ] },
        bye()
      ]
      break
    }
  }
  return list.map(e => mix(e, rng))
}

export const SCRIPT_LESSON: Record<ChatScript, number> = { act2: 12, act3: 17, act4: 23, act6: 31 }

export const MAX_WARMTH = 5

/** Тепло после ответа: от 0 до 5. */
export const warmAfter = (warmth: number, o: Opt) => Math.max(0, Math.min(MAX_WARMTH, warmth + o.w))

export type Ending = 'warm' | 'ok' | 'cold'
export const ending = (warmth: number): Ending => (warmth >= 4 ? 'warm' : warmth >= 2 ? 'ok' : 'cold')

export const ENDINGS: Record<ChatScript, Record<Ending, string>> = {
  act2: {
    warm: 'Нино добавила тебя в чат подъезда и прислала стикер с котом.',
    ok: 'Нино: «Увидимся во дворе!»',
    cold: 'Нино вежливо прощается. В следующий раз будет теплее.'
  },
  act3: {
    warm: 'Нино зовёт тебя завтра на кофе во двор.',
    ok: 'Нино: «Рада, что ты наш сосед!»',
    cold: 'Нино вежливо прощается. В следующий раз будет теплее.'
  },
  act4: {
    warm: 'Нино: «Вернусь — покажу тебе свой Батуми!»',
    ok: 'Нино: «Пиши, если что-то нужно».',
    cold: 'Нино вежливо прощается. В следующий раз будет теплее.'
  },
  act6: {
    warm: 'Нино зовёт тебя в субботу на супру к её бабушке!',
    ok: 'Нино: «Заходи как-нибудь на кофе».',
    cold: 'Нино вежливо прощается. В следующий раз будет теплее.'
  }
}

/** Что ложится в копилку: сказанные верные ответы, без повторов. */
export function bankAdd(bank: Line[], o: Opt): Line[] {
  return bank.some(b => b.geo === o.geo) ? bank : [...bank, { geo: o.geo, ru: o.ru, ids: o.ids }]
}
