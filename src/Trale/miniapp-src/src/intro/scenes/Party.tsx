import React, { useMemo, useState } from 'react'
import GameFrame from '../../alphabet/games/GameFrame'
import { burst, haptic, sound } from '../../alphabet/games/fx'
import { useLater } from '../../verbs/games/useLater'
import { cyr } from '../../verbs/types'
import { JOBS, NAME_LIST, knows, myName, phrase, shuffle, type Word } from '../story'
import { Face, GameEnd, GameIntro, Meter, Person, Pill, Reply, RuleCard, Tip, say, type Look, type Mood } from '../ui'
import type { SceneProps, StepOf } from './types'
import {
  badgeFits, beats, happiness, jobFits, mingle, myJobOptions, planParty, repeatLine, whoAnswer, whoOptions,
  type Beat, type Guest, type Option, type PartyMode
} from './Party.logic'

/**
 * «Вечеринка на крыше» — соседи зовут на крышу, ночь, гирлянды. Гости приходят по одному и знакомятся,
 * у тебя стопка бейджей с грузинскими именами: прилепи каждому свой. Потом гости перемешиваются — помни,
 * кто есть кто. Режимы: имена; знакомство в три реплики; «кто это?» от Нино; профессии по углам крыши.
 */

type Phase = 'intro' | 'arrive' | 'mingle' | 'badge' | 'sort' | 'quiz' | 'myjob' | 'end'

interface Speech { who: number | 'host'; geo?: string | null; ru?: React.ReactNode; note?: string; tone?: 'plain' | 'good' | 'bad' }

const HOST_LOOK: Look = { coat: '#E01A3C', skin: '#F2C9A0', hair: '#2A1F18', long: true }

/** Места на крыше (центр, ноги) в процентах сцены. */
const SLOTS: [number, number][] = [[16, 66], [40, 63], [64, 66], [86, 63], [28, 94], [54, 96], [80, 94]]
/** В режиме профессий низ крыши занят тремя углами — гости стоят выше. */
const SORT_SLOTS: [number, number][] = [[14, 67], [38, 64], [62, 67], [86, 64]]

function G({ g }: { g: string }) {
  return <><b className="font-geo">{g}</b> <span className="text-[12px] text-jewelInk-hint">({cyr(g)})</span></>
}

/** Пиктограммы профессий: книга — студент, крест — врач, доска — учитель. */
export function JobIcon({ job, size = 22 }: { job: Word; size?: number }) {
  const k = JOBS.findIndex(j => j.geo === job.geo)
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#15100A" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
      {k === 0 && <><path d="M3 5.5 Q7.5 4 12 6.5 Q16.5 4 21 5.5 V19 Q16.5 17.5 12 20 Q7.5 17.5 3 19Z" fill="#1B5FB0" /><path d="M12 6.5 V20" /></>}
      {k === 1 && <><rect x="3" y="3" width="18" height="18" rx="4" fill="#FFF" /><path d="M10 6.5h4v3.5h3.5v4H14v3.5h-4V14H6.5v-4H10z" fill="#E01A3C" /></>}
      {k === 2 && <><rect x="2.5" y="4" width="19" height="12.5" rx="1.5" fill="#4E8A5B" /><path d="M6 8.5h7M6 11.5h4.5" stroke="#FFF" /><path d="M8 16.5 L6 21 M16 16.5 L18 21" /></>}
    </svg>
  )
}

/** Гирлянда: провод провисает между столбиками, лампочки мигают по очереди. */
function Garland() {
  const segs: [number, number, number, number, number, number][] = [[0, 8, 25, 34, 50, 12], [50, 12, 75, 34, 100, 8]]
  const bulbs: { x: number; y: number; c: string }[] = []
  const colors = ['#F5B820', '#E01A3C', '#4E8A5B', '#1B5FB0']
  segs.forEach(([x0, y0, cx, cy, x1, y1], s) => {
    for (let i = 1; i < 6; i++) {
      const t = i / 6
      bulbs.push({ x: (1 - t) ** 2 * x0 + 2 * t * (1 - t) * cx + t * t * x1, y: (1 - t) ** 2 * y0 + 2 * t * (1 - t) * cy + t * t * y1, c: colors[(i + s * 5) % 4] })
    }
  })
  return (
    <div className="absolute inset-x-0 top-0 h-[64px] pointer-events-none" aria-hidden>
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 64" preserveAspectRatio="none">
        <path d="M0 8 Q25 34 50 12 Q75 34 100 8" stroke="#15100A" strokeWidth="0.8" fill="none" vectorEffect="non-scaling-stroke" />
      </svg>
      {bulbs.map((b, i) => (
        <span key={i} className="absolute w-[9px] h-[11px] rounded-full border border-jewelInk zn-bob"
          style={{ left: `${b.x}%`, top: `${(b.y / 64) * 100}%`, transform: 'translate(-50%, 0)', background: b.c, boxShadow: `0 0 10px 2px ${b.c}88`, animationDelay: `${(i % 4) * 0.35}s` }} />
      ))}
    </div>
  )
}

function endRule(mode: PartyMode, me: string) {
  if (mode === 'names') return (
    <RuleCard title="Знакомство">
      <G g="მე მქვია" /> + имя — меня зовут… В ответ: <G g={`${phrase('gamarjoba').geo}, ${me}!`} />
    </RuleCard>
  )
  if (mode === 'full') return (
    <RuleCard title="Знакомство в три реплики">
      <G g={phrase('gagimarjos').geo} /> → <G g={`მე მქვია ${me}`} /> → <G g={phrase('sasiamovnoa').geo} /> — приятно познакомиться.
    </RuleCard>
  )
  if (mode === 'who') return (
    <RuleCard title="Кто это?">
      <G g={phrase('vin_aris').geo} /> — отвечай именем. А про своего: <G g={phrase('es_chemi_megobaria').geo} /> — это мой друг.
    </RuleCard>
  )
  return (
    <RuleCard title="Кем ты работаешь">
      <G g="მე ვარ" /> + профессия: {JOBS.map((j, i) => <React.Fragment key={j.geo}>{i ? ', ' : ''}<G g={j.geo} /> — {j.ru}</React.Fragment>)}.
    </RuleCard>
  )
}

const INTRO_TEXT: Record<PartyMode, string> = {
  names: 'Учимся понимать, как человек представился: «მე მქვია …» — «меня зовут …». Гость называет себя — ответь ему и сразу дай бейдж с его именем.',
  full: 'Учимся знакомиться как следует: поздоровайся в ответ, назови себя, скажи «приятно познакомиться» — и дай гостю бейдж с его именем.',
  who: 'Учимся спрашивать и отвечать «кто это?»: на гостях бейджи с именами, твой друг пришёл с тобой. Нино показывает на людей и спрашивает «ვინ არის ეს?».',
  jobs: 'Учимся понимать «მე ვარ …» — «я …»: гость говорит, кем работает, — отправь его в нужный угол крыши.'
}

export default function Party({ lesson, step, fraction, onExit, onDone, rng = Math.random }: SceneProps<StepOf<'party'>>) {
  const mode = step.mode
  const me = useMemo(() => myName(), [])
  const [round, setRound] = useState(0)
  const plan = useMemo(() => planParty(lesson.id, mode, me.geo, rng), [lesson.id, mode, round]) // eslint-disable-line react-hooks/exhaustive-deps
  const later = useLater()
  const byId = (id: number) => plan.guests[id]

  const [phase, setPhase] = useState<Phase>('intro')
  const [w, setW] = useState(0)
  const [a, setA] = useState(0)
  const [b, setB] = useState(0)
  const [beatList, setBeatList] = useState<Beat[]>([])
  const [present, setPresent] = useState<number[]>([])
  const [slots, setSlots] = useState<Record<number, number>>({})
  const [speech, setSpeech] = useState<Speech | null>(null)
  const [badges, setBadges] = useState<Record<number, string>>({})
  const [sorted, setSorted] = useState<Record<number, string>>({})
  const [selG, setSelG] = useState<number | null>(null)
  const [selB, setSelB] = useState<string | null>(null)
  const [wrongs, setWrongs] = useState<Record<string, number>>({})
  const [shakeOpt, setShakeOpt] = useState<string | null>(null)
  const [goodOpt, setGoodOpt] = useState<string | null>(null)
  const [misses, setMisses] = useState(0)
  const [repeats, setRepeats] = useState(0)
  const [firstTry, setFirstTry] = useState(0)
  const [tip, setTip] = useState<React.ReactNode>(null)
  const [moods, setMoods] = useState<Record<number, Mood>>({})
  const [busy, setBusy] = useState(false)
  const [tray, setTray] = useState<string[]>([])
  const [q, setQ] = useState(0)
  const [quizOpts, setQuizOpts] = useState<string[]>([])
  const [jobOpts, setJobOpts] = useState<Option[]>([])
  const [myJob, setMyJob] = useState<string | null>(null)

  const total = mode === 'who' ? plan.questions.length : plan.guests.length
  const happy = happiness(misses, repeats)
  const slotList = mode === 'jobs' ? SORT_SLOTS : SLOTS
  const mood = (id: number, m: Mood, ms = 1200) => { setMoods(x => ({ ...x, [id]: m })); later(() => setMoods(x => ({ ...x, [id]: 'smile' })), ms) }
  const miss = (key: string) => { setMisses(x => x + 1); setWrongs(x => ({ ...x, [key]: (x[key] ?? 0) + 1 })); haptic('bad'); sound.miss() }
  const el = (id: number) => document.querySelector(`[data-testid="party-guest-${id}"]`)

  // ── Приход гостя ──
  const arrive = (wi: number, ai: number, onRoof: number[], places: Record<number, number>) => {
    const id = plan.waves[wi][ai]
    const g = byId(id)
    const used = new Set(onRoof.filter(x => !(mode === 'jobs' && sorted[x])).map(x => places[x]))
    const free = slotList.findIndex((_, k) => !used.has(k))
    const nextRoof = [...onRoof, id]
    const nextPlaces = { ...places, [id]: free < 0 ? 0 : free }
    setPresent(nextRoof); setSlots(nextPlaces)
    const list = beats(g, mode, lesson.id, me.geo, plan.guests.map(x => x.name), rng)
    setW(wi); setA(ai); setB(0); setBeatList(list)
    setSpeech({ who: id, geo: list[0].says, note: list[0].note })
    setPhase('arrive'); setBusy(false)
    sound.pop()
    return { nextRoof, nextPlaces }
  }

  const begin = () => {
    setBadges({}); setSorted({}); setWrongs({}); setMisses(0); setRepeats(0); setFirstTry(0); setMoods({}); setMyJob(null)
    setSelG(null); setSelB(null)
    // Друг пришёл с тобой — он уже на крыше.
    const start = mode === 'who' ? [0] : []
    const places: Record<number, number> = mode === 'who' ? { 0: 0 } : {}
    if (mode === 'who') {
      const f = byId(0)
      setTip(<>С тобой пришёл твой друг — <G g={f.name} />. У него нет бейджа: вы пришли вместе.</>)
    } else setTip(mode === 'jobs' ? 'Слушай, кем работает каждый гость.' : 'Слушай, как зовут гостя, и ответь.')
    arrive(0, 0, start, places)
  }

  const afterWave = (roof: number[], places: Record<number, number>) => {
    const next: Phase = mode === 'who' ? 'quiz' : mode === 'jobs' ? 'sort' : 'badge'
    const movers = roof.filter(id => !(mode === 'jobs' && sorted[id]))
    setSpeech(null); setPhase('mingle'); setBusy(true)
    // Перемешиваются гости только в «кто это?» — там это и есть игра; в остальных все стоят, где пришли.
    if (mode === 'who') {
      setTip('Гости перемешались. Кто есть кто?')
      setSlots(mingle(movers, places, rng))
      sound.surface('whoosh')
    }
    later(() => {
      setBusy(false); setPhase(next)
      if (next === 'badge') {
        const names = roof.filter(id => !badges[id]).map(id => byId(id).name)
        setTray(shuffle([...names, ...(plan.spare && w === plan.waves.length - 1 ? [plan.spare] : [])], rng))
        setTip('Выбери гостя, потом бейдж (или наоборот).')
      } else if (next === 'sort') setTip('Выбери гостя, потом угол: кем он работает?')
      else startQuiz(0)
    }, 1100)
  }

  const nextWaveOrEnd = () => {
    setSelG(null); setSelB(null)
    if (w + 1 < plan.waves.length) {
      setTip('Идут новые гости!')
      later(() => arrive(w + 1, 0, present, slots), 700)
    } else if (mode === 'jobs') {
      setJobOpts(myJobOptions(lesson.id, rng)); setPhase('myjob')
      setSpeech({ who: plan.guests[0].id, geo: knows(lesson.id, 'ra_profesia') ? phrase('ra_profesia').geo : null, note: 'Все смотрят на тебя: а ты кем работаешь?' })
      setTip('Расскажи о себе.')
    } else finish()
  }

  const finish = () => { sound.win(); later(() => setPhase('end'), 900) }

  // ── Реплики при знакомстве ──
  const choose = (o: Option) => {
    if (busy || phase !== 'arrive') return
    const id = plan.waves[w][a]
    const key = `beat-${id}-${b}`
    if (!o.ok) {
      miss(key); setShakeOpt(o.geo); later(() => setShakeOpt(null), 450)
      mood(id, 'huh')
      setTip(o.why ?? 'Не то. Попробуй ещё.')
      return
    }
    haptic('good'); sound.snap(b)
    setGoodOpt(o.geo); setBusy(true)
    const beat = beatList[b]
    if (beat.echo) setSpeech({ who: id, geo: beat.echo, tone: 'good' })
    mood(id, 'wow', 900)
    setTip(null)
    later(() => {
      setGoodOpt(null)
      if (b + 1 < beatList.length) {
        setB(b + 1); setBusy(false)
        setSpeech({ who: id, geo: beatList[b + 1].says, note: beatList[b + 1].note })
      } else afterGuest(id)
    }, beat.echo ? 1100 : 700)
  }

  // Гость представился — сразу, пока его слова звучат, бейдж или угол: игра про то, что услышал, а не про память.
  const afterGuest = (id: number) => {
    const g = byId(id)
    if (mode === 'who') {
      setBadges(x => ({ ...x, [id]: g.name }))
      return nextGuest()
    }
    setSelG(id); setSelB(null); setBusy(false)
    if (mode === 'jobs') {
      setPhase('sort')
      setTip('Гость сказал, кем работает — отправь его в нужный угол.')
      return
    }
    const others = shuffle(NAME_LIST.filter(n => n !== g.name && n !== me.geo), rng).slice(0, 2)
    setTray(shuffle([g.name, ...others], rng))
    setPhase('badge')
    setTip('Гость назвал своё имя — дай ему бейдж.')
  }

  const nextGuest = () => {
    setSelG(null); setSelB(null)
    if (a + 1 < plan.waves[w].length) arrive(w, a + 1, present, slots)
    else if (mode === 'who') afterWave(present, slots)
    else nextWaveOrEnd()
  }

  // ── Бейджи и углы ──
  const waveDone = (badged: Record<number, string>, sortedNow: Record<number, string>) =>
    present.every(id => mode === 'jobs' ? !!sortedNow[id] : !!badged[id])

  const tryBadge = (id: number, name: string) => {
    const g = byId(id)
    const key = `badge-${id}`
    setSelG(null); setSelB(null)
    if (badgeFits(g, name)) {
      const nb = { ...badges, [id]: name }
      setBadges(nb)
      if (!wrongs[key]) setFirstTry(x => x + 1)
      haptic('good'); sound.snap(Object.keys(nb).length)
      burst(el(id), 'small')
      setSpeech({ who: id, geo: `${phrase('madloba').geo}!`, tone: 'good' })
      mood(id, 'wow')
      setTip(null); setBusy(true)
      later(() => { setBusy(false); nextGuest() }, 900)
    } else {
      miss(key); mood(id, 'wow', 1400)
      setSelG(id)
      setSpeech({ who: id, tone: 'bad', ru: <>Я не <G g={name} />!</>, geo: repeatLine(g, mode) })
      setTip('Гость повторил, как его зовут. Найди этот бейдж.')
    }
  }

  const tryJob = (id: number, job: Word) => {
    const g = byId(id)
    const key = `job-${id}`
    setSelG(null)
    if (jobFits(g, job)) {
      const ns = { ...sorted, [id]: job.geo }
      setSorted(ns)
      if (!wrongs[key]) setFirstTry(x => x + 1)
      haptic('good'); sound.snap(Object.keys(ns).length)
      burst(document.querySelector(`[data-testid="party-zone-${JOBS.indexOf(job)}"]`), 'small')
      setSpeech({ who: id, geo: `მე ვარ ${g.job.geo}.`, tone: 'good' })
      setTip(null); setBusy(true)
      later(() => { setBusy(false); nextGuest() }, 900)
    } else {
      miss(key); mood(id, 'wow', 1400)
      setSelG(id)
      setSpeech({ who: id, tone: 'bad', ru: <>Я не <G g={job.geo} />!</>, geo: repeatLine(g, mode) })
      setTip('Гость повторил, кем работает. Найди его угол.')
    }
  }

  // Гость, о котором речь, выбран сам — тот, кто только что представился; нажатие на него ничего не меняет.
  const tapGuest = (_id: number) => {
    if (busy) return
    if (phase === 'badge' || phase === 'sort') haptic('tap')
  }
  const tapBadge = (name: string) => {
    if (busy || selG === null) return
    haptic('tap')
    tryBadge(selG, name)
  }
  const tapZone = (job: Word) => {
    if (busy) return
    if (selG === null) { setTip('Сначала выбери гостя — нажми на него.'); haptic('soft'); return }
    tryJob(selG, job)
  }
  const ask = () => {
    if (selG === null) return
    setSpeech({ who: selG, geo: repeatLine(byId(selG), mode), note: 'Повторяет — но уже не так радостно' })
    sound.pop()
  }

  // ── «Кто это?» ──
  const startQuiz = (k: number) => {
    setQ(k); setQuizOpts(whoOptions(plan.guests, rng)); setBusy(false)
    setSpeech({ who: 'host', geo: phrase('vin_aris').geo, note: 'Нино показывает на гостя' })
    say('vin_aris')
    setTip(k === 0 ? 'Нино показывает на гостя. Кто это? Про своего друга скажи «это мой друг».' : null)
  }
  const answerWho = (opt: string) => {
    if (busy || phase !== 'quiz') return
    const target = byId(plan.questions[q])
    const key = `q-${q}`
    if (opt === whoAnswer(target)) {
      haptic('good'); sound.snap(q); setGoodOpt(opt); setBusy(true)
      if (!wrongs[key]) setFirstTry(x => x + 1)
      mood(target.id, 'wow'); burst(el(target.id), 'small')
      setSpeech(target.friend
        ? { who: target.id, tone: 'good', ru: 'Друг довольно кивает.' }
        : { who: 'host', tone: 'good', geo: `${phrase('gamarjoba').geo}, ${target.name}!` })
      later(() => {
        setGoodOpt(null)
        if (q + 1 < plan.questions.length) startQuiz(q + 1)
        else finish()
      }, 1100)
      return
    }
    miss(key); setShakeOpt(opt); later(() => setShakeOpt(null), 450); mood(target.id, 'wow', 1400)
    if (target.friend) setSpeech({ who: target.id, tone: 'bad', ru: 'Эй, мы же вместе пришли! Я твой друг.' })
    else if (opt === phrase('es_chemi_megobaria').geo) setSpeech({ who: target.id, tone: 'bad', ru: 'Мы только что познакомились — какой я тебе друг?', geo: `${repeatLine(target, mode)}` })
    else setSpeech({ who: target.id, tone: 'bad', ru: <>Ха-ха! Я не <G g={opt} />!</>, geo: (wrongs[key] ?? 0) >= 1 ? repeatLine(target, mode) : null })
  }

  // ── Своя профессия ──
  const chooseJob = (o: Option) => {
    if (myJob) return
    if (!o.ok) {
      miss('myjob'); setShakeOpt(o.geo); later(() => setShakeOpt(null), 450)
      setTip(o.why ?? 'Не то.')
      return
    }
    haptic('good'); setMyJob(o.geo); setGoodOpt(o.geo)
    setSpeech({ who: plan.guests[0].id, tone: 'good', geo: knows(lesson.id, 'sasiamovnoa') ? `${phrase('sasiamovnoa').geo}!` : null, ru: knows(lesson.id, 'sasiamovnoa') ? undefined : 'Гости хлопают!' })
    setTip('Теперь вся крыша знает, кем ты работаешь.')
    later(() => { setGoodOpt(null); finish() }, 1200)
  }

  // ── Экраны ──
  if (phase === 'intro') {
    const chips = mode === 'jobs'
      ? JOBS.map(j => ({ geo: j.geo, ru: j.ru }))
      : mode === 'who'
        ? [{ geo: phrase('vin_aris').geo, ru: 'кто это?' }, { geo: phrase('es_chemi_megobaria').geo, ru: 'это мой друг' }]
        : mode === 'full'
          ? [{ geo: phrase('gagimarjos').geo, ru: 'привет (ответ)' }, { geo: phrase('sasiamovnoa').geo, ru: 'приятно познакомиться' }]
          : [{ geo: 'მე მქვია…', ru: 'меня зовут' }, { geo: `მე მქვია ${me.geo}`, ru: `меня зовут ${me.ru}` }]
    return (
      <GameFrame title="Вечеринка на крыше" eyebrow="соседи зовут в гости" fraction={fraction} onExit={onExit}>
        <div className="flex-1 min-h-0 flex flex-col" data-testid="party-scene">
          <GameIntro title="Вечеринка на крыше" text={INTRO_TEXT[mode]} chips={chips} onStart={begin} mood="happy" hero={mode === 'jobs'} />
        </div>
      </GameFrame>
    )
  }

  if (phase === 'end') {
    const label = mode === 'who' ? 'Верно ответил Нино' : mode === 'jobs' ? 'Гости в своих углах' : 'Бейджи на местах'
    return (
      <GameFrame title="Вечеринка на крыше" eyebrow="вечеринка удалась" fraction={fraction} onExit={onExit}>
        <div className="flex-1 min-h-0 flex flex-col" data-testid="party-scene">
          <GameEnd
            title={firstTry === total ? 'Ты душа вечеринки!' : happy >= 60 ? 'Отличный вечер!' : 'Вечер удался!'}
            text={`${label}: ${firstTry} из ${total} с первого раза. Гости довольны: ${happy}%.`}
            rule={endRule(mode, me.geo)}
            onNext={onDone}
            onAgain={() => { setRound(r => r + 1); setPresent([]); setSlots({}); setSpeech(null); setPhase('intro') }}
          />
        </div>
      </GameFrame>
    )
  }

  const speakerLook = speech ? (speech.who === 'host' ? HOST_LOOK : byId(speech.who).look) : null
  const target = phase === 'quiz' ? plan.questions[q] : null
  const beat = phase === 'arrive' ? beatList[b] : null
  const hintBadge = selG !== null && (wrongs[`badge-${selG}`] ?? 0) >= 2 ? byId(selG).name : null
  const hintZone = selG !== null && (wrongs[`job-${selG}`] ?? 0) >= 2 ? byId(selG).job.geo : null
  const freeOnRoof = present.filter(id => !(mode === 'jobs' && sorted[id]))
  const placed = mode === 'jobs' ? Object.keys(sorted).length : mode === 'who' ? q : Object.keys(badges).length

  return (
    <GameFrame title="Вечеринка на крыше" eyebrow={mode === 'who' ? 'кто есть кто' : mode === 'jobs' ? 'кто кем работает' : 'знакомься'} fraction={fraction} onExit={onExit}>
      <div className="flex-1 min-h-0 flex flex-col gap-2" data-testid="party-scene">
        <div className="shrink-0 flex items-center gap-2">
          <Pill testId="party-placed">{mode === 'jobs' ? 'по углам' : mode === 'who' ? 'ответы' : 'бейджи'}: {placed}/{total}</Pill>
          <span className="text-[11px] font-bold text-jewelInk-hint whitespace-nowrap">гости довольны</span>
          <Meter value={happy / 100} tone={happy < 50 ? 'ruby' : 'sage'} label="Гости довольны" />
        </div>

        <div className="relative flex-1 min-h-[210px] rounded-2xl border-[1.5px] border-jewelInk overflow-hidden" style={{ background: '#1D2747' }} data-testid="party-roof">
          {/* звёзды и гирлянда */}
          {[[8, 6], [30, 14], [57, 5], [78, 18], [93, 9], [45, 26]].map(([x, y], k) => (
            <span key={k} className="absolute w-[3px] h-[3px] rounded-full bg-cream" style={{ left: `${x}%`, top: `${y}%`, opacity: 0.7 }} aria-hidden />
          ))}
          <div className="absolute inset-x-0 bottom-0 top-[38%] border-t-[1.5px] border-jewelInk" style={{ background: 'repeating-linear-gradient(90deg, #6B5238 0 34px, #5E4831 34px 36px)' }} aria-hidden />
          <Garland />

          {mode === 'jobs' && (
            <div className="absolute inset-x-1.5 bottom-1.5 grid grid-cols-3 gap-1.5">
              {JOBS.map((j, k) => (
                <button key={j.geo} data-testid={`party-zone-${k}`} onClick={() => tapZone(j)} disabled={phase !== 'sort'}
                  className={`min-h-[64px] ab-short:min-h-[54px] rounded-xl border-[1.5px] border-jewelInk px-1 py-1 flex flex-col items-center justify-start ${hintZone === j.geo ? 'bg-gold-wash ring-2 ring-gold' : 'bg-cream-tile/90'} ${selG !== null && phase === 'sort' ? 'zn-bob' : ''}`}
                  style={{ boxShadow: '2px 2px 0 #15100A' }}>
                  <span className="flex flex-col items-center gap-0.5 max-w-full"><JobIcon job={j} size={18} /><span className="font-geo font-bold text-[10px] leading-none max-w-full break-all">{j.geo}</span></span>
                  <span className="text-[9px] font-semibold text-jewelInk-hint leading-none mt-0.5">{cyr(j.geo)}</span>
                  <span className="flex -space-x-1.5 mt-0.5">
                    {present.filter(id => sorted[id] === j.geo).map(id => <Face key={id} look={byId(id).look} size={20} />)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {freeOnRoof.map(id => {
            const g: Guest = byId(id)
            const [x, y] = slotList[slots[id] ?? 0] ?? slotList[0]
            const sel = selG === id
            const isTarget = target === id
            const isNew = phase === 'arrive' && plan.waves[w][a] === id
            return (
              <div key={id} className="absolute transition-[left,top] duration-[900ms] ease-in-out motion-reduce:transition-none" style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -100%)' }}>
                <div className={isNew ? 'zn-in-right' : ''}>
                  <button data-testid={`party-guest-${id}`} data-done={badges[id] || sorted[id] ? '1' : '0'} onClick={() => tapGuest(id)}
                    className={`relative min-w-[48px] flex flex-col items-center rounded-xl ${sel ? 'bg-gold/40 ring-2 ring-gold' : ''}`} aria-label="гость">
                    {isTarget && (
                      <svg width="18" height="16" viewBox="0 0 18 16" className="absolute -top-4 zn-bob" aria-hidden><path d="M2 2h14L9 14z" fill="#F5B820" stroke="#15100A" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                    )}
                    <Person look={g.look} mood={moods[id] ?? 'smile'} height={66} className={`ab-short:h-[56px] ${moods[id] === 'huh' ? 'zn-shake' : moods[id] === 'wow' ? 'zn-jump' : ''}`} />
                    {mode === 'who' && g.friend && (
                      <span className="absolute -top-3 right-0 rounded-full border-[1.5px] border-jewelInk bg-gold px-1 text-[9px] font-extrabold leading-tight" data-testid="party-friend-mark">друг</span>
                    )}
                    {badges[id] && (
                      <span className="zn-pop absolute top-[52%] rounded-md border-[1.5px] border-jewelInk bg-cream-tile px-1 font-geo font-bold text-[10px] leading-tight whitespace-nowrap" data-testid={`party-badge-on-${id}`}>{badges[id]}</span>
                    )}
                  </button>
                </div>
              </div>
            )
          })}

          {speech && speakerLook && (
            <div key={`${String(speech.who)}-${speech.geo ?? ''}-${b}-${q}`}
              className={`zn-pop absolute left-2 right-2 top-2 flex items-center gap-2 rounded-2xl border-[1.5px] border-jewelInk px-2 py-1.5 ${speech.tone === 'good' ? 'bg-[#D6E9D9]' : speech.tone === 'bad' ? 'bg-ruby-wash' : 'bg-cream-tile'}`}
              style={{ boxShadow: '2px 2px 0 #15100A' }} data-testid="party-speech">
              <Face look={speakerLook} size={34} />
              <div className="min-w-0 text-left leading-tight">
                {speech.geo && <div className="font-geo font-bold text-[15px]">{speech.geo}</div>}
                {speech.geo && <div className="text-[10px] font-semibold text-jewelInk-hint">{cyr(speech.geo)}</div>}
                {speech.ru && <div className="text-[13px] font-semibold">{speech.ru}</div>}
                {speech.note && <div className="text-[11px] italic text-jewelInk-soft">{speech.note}</div>}
              </div>
            </div>
          )}
        </div>

        <Tip>{tip}</Tip>

        {phase === 'arrive' && beat && (
          <div className={`shrink-0 grid gap-1.5 ${beat.options.length > 3 ? 'grid-cols-2' : 'grid-cols-1'}`} data-testid="party-options">
            {beat.options.map((o, k) => (
              <Reply key={o.geo} compact geo={o.geo} onClick={() => choose(o)} testId={`party-opt-${k}`}
                state={goodOpt === o.geo ? 'good' : shakeOpt === o.geo ? 'bad' : (wrongs[`beat-${plan.waves[w][a]}-${b}`] ?? 0) >= 2 && o.ok ? 'good' : 'idle'} disabled={busy} />
            ))}
          </div>
        )}

        {phase === 'quiz' && (
          <div className="shrink-0 grid grid-cols-2 gap-1.5" data-testid="party-options">
            {quizOpts.map((o, k) => (
              <Reply key={o} compact geo={o} onClick={() => answerWho(o)} testId={`party-opt-${k}`}
                state={goodOpt === o ? 'good' : shakeOpt === o ? 'bad' : (wrongs[`q-${q}`] ?? 0) >= 2 && target !== null && whoAnswer(byId(target)) === o ? 'good' : 'idle'} disabled={busy} />
            ))}
          </div>
        )}

        {phase === 'myjob' && (
          <div className="shrink-0 grid grid-cols-2 gap-1.5" data-testid="party-options">
            {jobOpts.map((o, k) => (
              <Reply key={o.geo} compact geo={o.geo} onClick={() => chooseJob(o)} testId={`party-opt-${k}`}
                state={goodOpt === o.geo ? 'good' : shakeOpt === o.geo ? 'bad' : 'idle'} disabled={!!myJob} />
            ))}
          </div>
        )}

        {(phase === 'badge' || phase === 'sort') && (
          <div className="shrink-0 flex flex-col gap-1.5">
            {phase === 'badge' && (
              <div className="flex flex-wrap justify-center gap-1.5" data-testid="party-tray">
                {tray.filter(n => !Object.values(badges).includes(n) || n === plan.spare).map((n, k) => (
                  <button key={n} data-testid={`party-badge-${k}`} onClick={() => tapBadge(n)}
                    className={`min-h-[44px] min-w-[64px] rounded-xl border-[1.5px] border-jewelInk px-2.5 py-1 ${selB === n ? 'bg-gold -translate-y-1' : hintBadge === n ? 'bg-gold-wash ring-2 ring-gold' : 'bg-cream-tile'} transition-transform`}
                    style={{ boxShadow: '2px 2px 0 #15100A' }}>
                    <span className="block text-[8px] font-extrabold uppercase tracking-wider text-ruby leading-none">меня зовут</span>
                    <span className="block font-geo font-bold text-[15px] leading-tight">{n}</span>
                    <span className="block text-[10px] font-semibold text-jewelInk-hint leading-none">{cyr(n)}</span>
                  </button>
                ))}
              </div>
            )}
            <button data-testid="party-repeat" onClick={ask} disabled={selG === null}
              className="min-h-[44px] rounded-xl border-[1.5px] border-dashed border-jewelInk px-3 text-[13px] font-bold disabled:opacity-40">
              Послушать ещё раз
            </button>
          </div>
        )}

        {phase === 'mingle' && <div className="shrink-0 min-h-[44px] flex items-center justify-center text-[13px] font-bold text-jewelInk-soft" data-testid="party-mingle">гости перемешиваются…</div>}
      </div>
    </GameFrame>
  )
}
