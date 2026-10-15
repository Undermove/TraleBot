import React, { useEffect, useMemo, useRef, useState } from 'react'
import GameFrame from '../../alphabet/games/GameFrame'
import { burst, floater, haptic, sound } from '../../alphabet/games/fx'
import { useLater } from '../../verbs/games/useLater'
import { cyr } from '../../verbs/types'
import { JOBS, phrase, type Country } from '../story'
import { Bubble, Face, GameEnd, GameIntro, Meter, Person, Pill, Reply, RuleCard, Tip, say, type Look, type Mood } from '../ui'
import type { SceneProps, StepOf } from './types'
import {
  SHIFT, WASTE_MS, fieldsOf, judge, mismatch, patience, planShift, queueSize, reply, reward, stars, supervisorLine,
  firstLine, type BorderMode, type Field, type Traveller
} from './Border.logic'

/**
 * «Паспортный контроль» в аэропорту Кутаиси — смена-тайкун. У окошка человек представляется (или только
 * здоровается — тогда его надо расспросить), в руках его паспорт. Всё совпало — штамп, нет — на проверку.
 * Очередь ждёт не вечно: пока думаешь, хвост растёт. За верные решения — лари, за серии — бонус и похвала
 * начальника смены. Десять человек — и смена закончилась.
 */

const SUPERVISOR: Look = { coat: '#1B5FB0', skin: '#E0AC7E', hair: '#2A1F18', age: 'old' }
const QUEUE_LOOKS: Look[] = [
  { coat: '#4E8A5B', skin: '#F2C9A0', hair: '#5A3A22', bag: true },
  { coat: '#7A4E9A', skin: '#C68A5E', hair: '#15100A', long: true },
  { coat: '#D4563B', skin: '#F6D7BC', hair: '#9A6A3A' },
  { coat: '#2F7F86', skin: '#E0AC7E', hair: '#2A1F18', bag: true },
  { coat: '#C68F10', skin: '#F2C9A0', hair: '#B5A68B', long: true },
  { coat: '#3A2B1F', skin: '#C68A5E', hair: '#5A3A22' }
]

const FIELD_RU: Record<Field, string> = { name: 'Имя', country: 'Страна', job: 'Профессия' }

/** Грузинское слово и как оно звучит. */
function G({ g }: { g: string }) {
  return <><b className="font-geo">{g}</b> <span className="text-[12px] text-jewelInk-hint">({cyr(g)})</span></>
}

/** Флаги рисуем сами: Грузия, Испания, Франция. */
export function Flag({ code, size = 22 }: { code: Country['flag']; size?: number }) {
  const h = Math.round(size * 0.68)
  return (
    <svg width={size} height={h} viewBox="0 0 30 20" aria-hidden className="shrink-0 rounded-[2px] border border-jewelInk">
      {code === 'ge' && <>
        <rect width="30" height="20" fill="#FFF" />
        <rect x="12.5" width="5" height="20" fill="#E01A3C" /><rect y="7.5" width="30" height="5" fill="#E01A3C" />
        {[[6, 3.7], [24, 3.7], [6, 16.3], [24, 16.3]].map(([x, y]) => (
          <path key={`${x}${y}`} d={`M${x - 0.6} ${y - 2}h1.2v1.4h1.4v1.2h-1.4v1.4h-1.2v-1.4h-1.4v-1.2h1.4z`} fill="#E01A3C" />
        ))}
      </>}
      {code === 'es' && <><rect width="30" height="20" fill="#C8102E" /><rect y="5" width="30" height="10" fill="#F5B820" /></>}
      {code === 'fr' && <><rect width="10" height="20" fill="#1B5FB0" /><rect x="10" width="10" height="20" fill="#FFF" /><rect x="20" width="10" height="20" fill="#E01A3C" /></>}
    </svg>
  )
}

function StarRow({ n }: { n: number }) {
  return (
    <div className="flex justify-center gap-1" data-testid="border-stars" aria-label={`${n} из 3 звёзд`}>
      {[0, 1, 2].map(k => (
        <svg key={k} width="30" height="30" viewBox="0 0 24 24" aria-hidden className={k < n ? 'zn-pop' : ''} style={{ animationDelay: `${k * 120}ms` }}>
          <path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z" fill={k < n ? '#F5B820' : '#F3EAD6'} stroke="#15100A" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      ))}
    </div>
  )
}

function Passport({ t, mode, stamp, idx }: { t: Traveller; mode: BorderMode; stamp: 'stamp' | 'check' | null; idx: number }) {
  const fields = fieldsOf(mode)
  return (
    <div key={idx} className="zn-pop relative shrink-0 flex gap-3 rounded-2xl border-[1.5px] border-jewelInk bg-[#E9E2F2] px-3 py-2" style={{ boxShadow: '3px 3px 0 #15100A' }} data-testid="border-passport">
      <div className="shrink-0 w-[56px] h-[68px] ab-short:h-[58px] rounded-lg border-[1.5px] border-jewelInk bg-cream-deep overflow-hidden flex justify-center">
        <Person look={t.look} height={124} style={{ marginTop: -2 }} />
      </div>
      <dl className="flex-1 min-w-0 flex flex-col gap-0.5 text-left">
        <div className="text-[10px] font-extrabold tracking-[0.08em] uppercase text-navy">паспорт · цель: {t.purpose}</div>
        {fields.map(f => (
          <div key={f} className="flex items-baseline gap-2 min-w-0">
            <dt className="w-[66px] shrink-0 text-[11px] font-bold text-jewelInk-hint">{FIELD_RU[f]}</dt>
            <dd className="min-w-0 flex items-center gap-1.5 text-[15px] leading-tight truncate" data-testid={`passport-${f}`}>
              {f === 'country' && <Flag code={t.pass.country.flag} size={20} />}
              <G g={f === 'name' ? t.pass.name : f === 'country' ? t.pass.country.base : t.pass.job.geo} />
            </dd>
          </div>
        ))}
      </dl>
      {stamp && (
        <div data-testid="border-stamp-mark"
          className="zn-stamp absolute right-3 top-3 rounded-md border-[3px] px-2 py-0.5 text-[15px] font-extrabold uppercase tracking-[0.06em] bg-cream/70"
          style={{ color: stamp === 'stamp' ? '#4E8A5B' : '#E01A3C', borderColor: stamp === 'stamp' ? '#4E8A5B' : '#E01A3C' }}>
          {stamp === 'stamp' ? 'Пропущен' : 'Проверка'}
        </div>
      )}
    </div>
  )
}

function endRule(mode: BorderMode) {
  const ge = 'საქართველო', es = 'ესპანეთი'
  if (mode === 'names') {
    return (
      <RuleCard title="Как спросить имя">
        <G g={phrase('ra_gkvia').geo} /> — как тебя зовут? В ответ: <G g="მე მქვია" /> + имя.
      </RuleCard>
    )
  }
  return (
    <RuleCard title="-დან значит «из»">
      <G g={ge} /> → <G g={ge + 'დან'} />, <G g={es} /> → <G g={es + 'დან'} />. Спросить: <G g={phrase('saidan').geo} />
      {mode === 'full' && <> А профессия — без окончаний: <G g={`მე ვარ ${JOBS[1].geo}`} /> — я {JOBS[1].ru}.</>}
    </RuleCard>
  )
}

const INTRO_TEXT: Record<BorderMode, string> = {
  names: 'Смена в аэропорту Кутаиси. Путешественник называет имя — сверь его с паспортом. Совпало — штамп, нет — на проверку. Потом люди станут молчаливее: спроси, как их зовут.',
  listen: 'Теперь каждый говорит, как его зовут и откуда он. Сверь имя и страну с паспортом. В паспорте страна без -დან, а человек говорит «из …».',
  ask: 'Сегодня все только здороваются. Спроси имя и откуда человек, сверь с паспортом — и решай. Очередь не ждёт.',
  full: 'Большая смена: кто-то рассказывает всё сам, кого-то надо расспросить. В паспорте теперь и профессия — сверь и её.'
}

export default function Border({ lesson, step, fraction, onExit, onDone, rng = Math.random, now: clock = () => performance.now() }: SceneProps<StepOf<'border'>>) {
  const mode = step.mode
  const [phase, setPhase] = useState<'intro' | 'play' | 'end'>('intro')
  const [round, setRound] = useState(0)
  const plan = useMemo(() => planShift(lesson.id, mode, rng), [lesson.id, mode, round]) // eslint-disable-line react-hooks/exhaustive-deps
  const [n, setN] = useState(0)
  const [right, setRight] = useState(0)
  const [combo, setCombo] = useState(0)
  const [coins, setCoins] = useState(0)
  const [heard, setHeard] = useState<string[]>([])
  const [known, setKnown] = useState<Field[]>([])
  const [decided, setDecided] = useState<null | 'stamp' | 'check' | 'timeout'>(null)
  const [verdict, setVerdict] = useState<boolean | null>(null)
  const [mood, setMood] = useState<Mood>('smile')
  const [tip, setTip] = useState<React.ReactNode>(null)
  const [boss, setBoss] = useState<string | null>(null)
  const [tNow, setTNow] = useState(0)
  const start = useRef(0)
  const penalty = useRef(0)
  const later = useLater()
  const passRef = useRef<HTMLDivElement>(null)
  const coinsRef = useRef<HTMLSpanElement>(null)

  const t: Traveller | undefined = plan[n]
  const fields = fieldsOf(mode)
  const wait = t ? patience(t, mode) : 1
  const spent = decided ? 0 : Math.max(0, Math.min(1, (tNow - start.current + penalty.current) / wait))

  const arrive = (k: number) => {
    const tr = plan[k]
    setN(k)
    setHeard(firstLine(tr))
    setKnown(tr.told)
    setDecided(null); setVerdict(null); setMood('smile')
    start.current = clock(); penalty.current = 0
    setTNow(clock())
    if (k === 0) setTip(mode === 'listen' || mode === 'full'
      ? <>Слушай окончание: <G g="საქართველო" /> + <G g="დან" /> = «из Грузии».</>
      : mode === 'ask' ? 'Человек только поздоровался. Спроси, как его зовут и откуда он.' : 'Человек называет имя. Сверь его с паспортом.')
    else if (tr.told.length < fields.length && plan[k - 1].told.length === fields.length) setTip('Этот только поздоровался. Спроси, чего не хватает, — и решай.')
    else setTip(null)
    sound.pop()
  }

  const begin = () => {
    setRight(0); setCombo(0); setCoins(0); setBoss(null)
    setPhase('play')
    arrive(0)
  }

  // Часы смены: терпение очереди тает, пока решение не принято.
  useEffect(() => {
    if (phase !== 'play') return
    const id = setInterval(() => setTNow(clock()), 150)
    return () => clearInterval(id)
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  const nextTraveller = () => {
    if (n + 1 >= SHIFT) { sound.win(); setPhase('end'); return }
    arrive(n + 1)
  }

  // Не дождался — человека уводит начальник смены, серия сбрасывается.
  useEffect(() => {
    if (phase !== 'play' || decided || !t) return
    if (tNow - start.current + penalty.current >= wait) {
      setDecided('timeout'); setVerdict(false); setCombo(0); setMood('sad')
      setBoss('Не дождался — я сам его проверю. Не зависай!')
      setTip('Очередь не дождалась. Решай быстрее: всё совпало — штамп, что-то не так — на проверку.')
      haptic('bad'); sound.miss()
      later(nextTraveller, 1800)
    }
  }, [tNow]) // eslint-disable-line react-hooks/exhaustive-deps

  const ask = (id: string) => {
    if (!t || decided) return
    const r = reply(t, id)
    if (r.waste) penalty.current += WASTE_MS
    if (r.line) { setHeard(h => [...h, r.line!].slice(-3)); say(id) }
    if (r.field) {
      sound.snap(known.length)
      setKnown(k => k.includes(r.field!) ? k : [...k, r.field!])
      setMood('smile')
      setTip(null)
    } else if (id === 'rogor') {
      sound.miss(); setMood('smile')
      setTip(<>Вежливо, но очередь стоит. <G g={phrase('rogor').geo} /> — «как дела?». Спроси то, что есть в паспорте.</>)
    } else {
      sound.miss(); haptic('bad'); setMood('huh')
      setHeard(h => [...h, '…?'].slice(-3))
      setTip(<><G g={phrase('nakhvamdis').geo} /> — это «до свидания». Человек даже не прошёл!</>)
    }
  }

  const decide = (stamp: boolean) => {
    if (!t || decided) return
    const ok = judge(t, stamp)
    const s = Math.max(0, Math.min(1, (clock() - start.current + penalty.current) / wait))
    setDecided(stamp ? 'stamp' : 'check'); setVerdict(ok)
    const m = mismatch(t)
    const unasked = t.lie && !known.includes(t.lie)
    if (ok) {
      const c = combo + 1
      const got = reward(c, s)
      setRight(r => r + 1); setCombo(c); setCoins(x => x + got)
      setMood('wow'); haptic('good'); sound.snap(Math.min(c, 8))
      burst(passRef.current, c >= 3 ? 'big' : 'small')
      floater(`+${got} ₾`, coinsRef.current, '#4E8A5B')
      setBoss(supervisorLine(c))
      setTip(m
        ? <>Верно. В паспорте <G g={m.pass} />, а человек сказал <G g={m.said} />.</>
        : got > 2 ? `Верно, +${got} ₾${s < 0.5 ? ' — быстро!' : ''}` : 'Верно. Следующий!')
    } else {
      setCombo(0); setMood('huh'); haptic('bad'); sound.miss()
      setBoss(null)
      setTip(m
        ? <>Пропустил не того: в паспорте <G g={m.pass} />, а человек сказал <G g={m.said} />.{unasked ? ' Сначала спроси!' : ''}</>
        : mode === 'names' ? 'Человек сказал правду: имя совпало. Сверь буквы ещё раз.' : 'Человек сказал правду. Сверь ещё раз: имя, потом страну — в паспорте она без -დან.')
    }
    later(nextTraveller, ok ? 1400 : 2800)
  }

  if (phase === 'intro') {
    const chips = [
      { geo: 'მე მქვია…', ru: 'меня зовут' },
      ...(mode !== 'names' ? [{ geo: 'მე ვარ …დან', ru: 'я из' }] : []),
      ...(mode === 'full' ? [{ geo: 'მე ვარ …', ru: 'я (профессия)' }] : []),
      { geo: phrase('ra_gkvia').geo, ru: 'как тебя зовут?' },
      ...(mode === 'ask' || mode === 'full' ? [{ geo: phrase('saidan').geo, ru: 'откуда ты?' }] : [])
    ]
    return (
      <GameFrame title="Паспортный контроль" eyebrow="аэропорт Кутаиси" fraction={fraction} onExit={onExit}>
        <div className="flex-1 min-h-0 flex flex-col" data-testid="border-scene">
          <GameIntro title="Смена на границе" text={INTRO_TEXT[mode]} chips={chips} onStart={begin} />
        </div>
      </GameFrame>
    )
  }

  if (phase === 'end') {
    const st = stars(right)
    return (
      <GameFrame title="Паспортный контроль" eyebrow="смена закончилась" fraction={fraction} onExit={onExit}>
        <div className="flex-1 min-h-0 flex flex-col" data-testid="border-scene">
          <GameEnd
            title={`${right} из ${SHIFT} без ошибки`}
            text={`Заработано ${coins} ₾. ${st === 3 ? 'Тебя переводят на международный терминал.' : st >= 1 ? 'Начальник смены доволен.' : 'Завтра будет ещё одна смена — получится лучше.'}`}
            rule={<div className="flex flex-col gap-2 w-full"><StarRow n={st} />{endRule(mode)}</div>}
            onNext={onDone}
            onAgain={() => { setRound(r => r + 1); setN(0); setPhase('intro') }}
          />
        </div>
      </GameFrame>
    )
  }

  if (!t) return null
  const missing = fields.filter(f => !known.includes(f))
  const asking = !decided && t.asks.length > 0 && missing.length > 0
  const tail = queueSize(SHIFT - n - 1, spent)
  const personClass = decided === 'timeout' ? 'zn-out-right' : verdict === true ? 'zn-jump' : verdict === false ? 'zn-shake' : 'zn-in-right'

  return (
    <GameFrame title="Паспортный контроль" eyebrow={`путешественник ${n + 1} из ${SHIFT}`} fraction={fraction} onExit={onExit}>
      <div className="flex-1 min-h-0 flex flex-col gap-2" data-testid="border-scene">
        <div className="shrink-0 flex items-center gap-2">
          <Pill testId="border-count">{n + 1} / {SHIFT}</Pill>
          <Meter value={1 - spent} tone={spent > 0.7 ? 'ruby' : 'gold'} label="Терпение очереди" />
          {combo >= 2 && <Pill testId="border-combo">×{combo}</Pill>}
          <span ref={coinsRef}><Pill testId="border-coins">{coins} ₾</Pill></span>
        </div>

        <div className="relative shrink-0 h-[148px] ab-short:h-[116px] rounded-2xl border-[1.5px] border-jewelInk overflow-hidden bg-[#DCE8F2]" data-testid="border-hall">
          <div className="absolute inset-x-0 bottom-0 h-[26px] bg-cream-deep border-t-[1.5px] border-jewelInk" />
          {/* окошко */}
          <div className="absolute left-0 bottom-0 w-[54px] h-[92px] ab-short:h-[74px] bg-navy border-r-[1.5px] border-t-[1.5px] border-jewelInk rounded-tr-xl">
            <div className="mx-auto mt-2 w-[34px] h-[22px] rounded bg-[#BFD6EA] border-[1.5px] border-jewelInk" />
            <div className="mt-1 text-center text-[8px] font-extrabold uppercase tracking-wide text-cream">паспорт</div>
          </div>
          {/* очередь — растёт, пока думаешь */}
          <div className="absolute right-2 bottom-[6px] flex items-end -space-x-3" data-testid="border-queue" data-size={tail}>
            {Array.from({ length: tail }, (_, k) => (
              <Person key={k} look={QUEUE_LOOKS[k % QUEUE_LOOKS.length]} mood={spent > 0.6 ? 'sad' : 'smile'} height={62 - k * 3} className="zn-pop" />
            ))}
          </div>
          <div key={n} className={`absolute left-[62px] bottom-[6px] ${personClass}`} data-testid="border-traveller">
            <Person look={t.look} mood={mood} height={92} className="ab-short:h-[74px]" />
          </div>
          <Bubble className="absolute left-[118px] right-2 top-2 !text-left" tone={verdict === true ? 'good' : verdict === false ? 'bad' : 'plain'}>
            <div className="flex flex-col gap-0.5" data-testid="border-bubble">
              {/* В пузыре — две последние реплики, чтобы длинное представление не вылезало из зала. */}
              {heard.slice(-2).map((l, k) => (
                <div key={`${heard.length}-${k}`} className="leading-tight">
                  <span className="font-geo font-bold text-[14px]">{l}</span>
                  {l !== '…?' && <span className="block text-[10px] font-semibold text-jewelInk-hint">{cyr(l)}</span>}
                </div>
              ))}
            </div>
          </Bubble>
          {boss && (
            <div key={boss} className="zn-in-left absolute left-1 bottom-1 right-1 flex items-center gap-1.5 rounded-xl border-[1.5px] border-jewelInk bg-gold-wash px-2 py-1" data-testid="border-boss">
              <Face look={SUPERVISOR} size={26} />
              <span className="text-[12px] font-semibold leading-tight">Начальник смены: {boss}</span>
            </div>
          )}
        </div>

        <div ref={passRef}><Passport t={t} mode={mode} stamp={decided === 'stamp' || decided === 'check' ? decided : null} idx={n} /></div>

        <Tip>{tip ?? (asking && missing.length ? `Пока не знаешь: ${missing.map(f => FIELD_RU[f].toLowerCase()).join(', ')}.` : 'Сверь и решай.')}</Tip>

        <div className="flex-1 min-h-0" />

        {asking && (
          <div className={`grid gap-1.5 ${t.asks.length > 3 ? 'grid-cols-2' : 'grid-cols-3'}`} data-testid="border-asks">
            {t.asks.map(id => (
              <Reply key={id} compact geo={phrase(id).geo} onClick={() => ask(id)} testId={`border-ask-${id}`} />
            ))}
          </div>
        )}
        <div className="shrink-0 grid grid-cols-2 gap-2">
          <button data-testid="border-stamp" disabled={!!decided} onClick={() => { haptic('pop'); decide(true) }}
            className="min-h-[48px] rounded-2xl border-[1.5px] border-jewelInk bg-[#D6E9D9] font-extrabold text-[16px] leading-tight active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-50"
            style={{ boxShadow: '3px 3px 0 #15100A' }}>
            Штамп<span className="block text-[11px] font-semibold text-jewelInk-hint">всё совпадает</span>
          </button>
          <button data-testid="border-check" disabled={!!decided} onClick={() => { haptic('pop'); decide(false) }}
            className="min-h-[48px] rounded-2xl border-[1.5px] border-jewelInk bg-ruby-wash font-extrabold text-[16px] leading-tight active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-50"
            style={{ boxShadow: '3px 3px 0 #15100A' }}>
            На проверку<span className="block text-[11px] font-semibold text-jewelInk-hint">{asking && missing.length ? 'не спрашивая' : 'что-то не так'}</span>
          </button>
        </div>
      </div>
    </GameFrame>
  )
}
