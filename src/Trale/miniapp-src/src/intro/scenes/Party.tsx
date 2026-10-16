import React, { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Passerby, { type Face as PFace } from './walk/Passerby'
import GameFrame from '../../alphabet/games/GameFrame'
import { burst, haptic, sound } from '../../alphabet/games/fx'
import { useLater } from '../../verbs/games/useLater'
import { cyr } from '../../verbs/types'
import { JOBS, NAME_LIST, firstMet, knows, myName, phrase, shuffle, type Word } from '../story'
import { Face, GameEnd, GameIntro, Meter, NewWord, Pill, Reply, RuleCard, Tip, say, type Look, type Mood } from '../ui'
import { speak, speakUrl } from '../voice'
import { TreatIcon, drinksAudio, offerAudio, pleaseAudio, wantAudio, type Treat } from './party/Treats'
import type { SceneProps, StepOf } from './types'
import {
  badgeFits, beats, errandBeats, happiness, jobFits, mingle, myJobOptions, partyTwist, planParty, repeatLine, welcomeBeat, whoAnswer, whoOptions,
  type Beat, type Guest, type Option, type PartyMode
} from './Party.logic'

/**
 * «Вечеринка на крыше» — соседи зовут на крышу, ночь, гирлянды. Гости приходят по одному и знакомятся,
 * у тебя стопка бейджей с грузинскими именами: прилепи каждому свой. Потом гости перемешиваются — помни,
 * кто есть кто. Режимы: имена; знакомство в три реплики; «кто это?» от Нино; профессии по углам крыши.
 */

type Phase = 'intro' | 'welcome' | 'arrive' | 'errand' | 'mingle' | 'badge' | 'sort' | 'quiz' | 'myjob' | 'end'

interface Speech { who: number | 'host'; geo?: string | null; ru?: React.ReactNode; note?: string; tone?: 'plain' | 'good' | 'bad' }

const HOST_LOOK: Look = { coat: '#E01A3C', skin: '#F2C9A0', hair: '#2A1F18', long: true }

/** Места на крыше (центр, ноги) в процентах сцены: задний ряд у парапета, передний — ближе к тебе. */
const SLOTS: [number, number][] = [[18, 80], [42, 77], [64, 80], [86, 77], [28, 98], [54, 99], [80, 98]]
/** В режиме профессий низ крыши занят тремя углами — гости стоят выше. */
const SORT_SLOTS: [number, number][] = [[16, 76], [39, 73], [62, 76], [85, 73]]

/** Чем дальше гость (выше на крыше), тем он меньше. */
const depthScale = (y: number) => 1 + Math.max(0, Math.min(1, (y - 74) / 26)) * 0.32

const FACE_OF: Record<Mood, PFace> = { smile: 'smile', sad: 'calm', huh: 'huh', wow: 'wow' }
const whoOf = (look: Look) => ({ ru: '', kind: (look.long ? 'woman' : 'man') as 'woman' | 'man', coat: look.coat, skin: look.skin, hair: look.hair, extra: (look.bag ? 'bag' : 'none') as 'bag' | 'none', voice: (look.long ? 'f' : 'm') as 'f' | 'm' })

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
  const twist = useMemo(() => partyTwist(lesson.id, mode, rng), [lesson.id, mode, round]) // eslint-disable-line react-hooks/exhaustive-deps
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
  // Угощения: кто сейчас просит или угощает, что у гостей в руках, с какими словами уже познакомили.
  const [errWho, setErrWho] = useState<number | 'host'>('host')
  const [held, setHeld] = useState<Record<number, Treat>>({})
  const [doneErr, setDoneErr] = useState<number[]>([])
  const [fresh, setFresh] = useState<string | null>(null)
  const shown = React.useRef<string[]>([])

  const total = mode === 'who' ? plan.questions.length : plan.guests.length
  const happy = happiness(misses, repeats)
  const slotList = mode === 'jobs' ? SORT_SLOTS : SLOTS
  const mood = (id: number, m: Mood, ms = 1200) => { setMoods(x => ({ ...x, [id]: m })); later(() => setMoods(x => ({ ...x, [id]: 'smile' })), ms) }
  const miss = (key: string) => { setMisses(x => x + 1); setWrongs(x => ({ ...x, [key]: (x[key] ?? 0) + 1 })); haptic('bad'); sound.miss() }
  const el = (id: number) => document.querySelector(`[data-testid="party-guest-${id}"]`)
  const voiceOf = (who: number | 'host'): 'f' | 'm' => (who === 'host' || byId(who).look.long ? 'f' : 'm')

  // Реплика угощения: показать, сказать голосом гостя, познакомить с новым словом сцены.
  const showBeat = (who: number | 'host', beat: Beat) => {
    setSpeech({ who, geo: beat.says, note: beat.note })
    if (beat.audio) void speakUrl(beat.audio, beat.says ?? '')
    if (beat.word && firstMet(lesson.id, beat.word) && !shown.current.includes(beat.word)) {
      setFresh(beat.word); shown.current = [...shown.current, beat.word]
    } else setFresh(null)
  }
  const withAudio = (who: number | 'host', list: Beat[], e?: { kind: 'serve' | 'offer'; treat: Treat }): Beat[] => list.map((bt, k) => ({
    ...bt,
    audio: who === 'host' ? drinksAudio('f') : e?.kind === 'serve' ? wantAudio(e.treat, voiceOf(who)) : k === 0 && e ? offerAudio(e.treat, voiceOf(who)) : undefined
  }))

  const startErrand = (who: number | 'host', list: Beat[]) => {
    setErrWho(who); setB(0); setBeatList(list); setBusy(false)
    setPhase(who === 'host' ? 'welcome' : 'errand')
    if (who !== 'host' && list[0].options.some(o => o.treat === undefined)) setHeld(h => ({ ...h, [who]: (twist.errands[who] as { treat: Treat }).treat }))
    setTip(who === 'host' ? 'Что будешь пить? Скажи и добавь «пожалуйста».' : list[0].options[0].treat ? 'Гость просит напиток. Что он хочет?' : 'Тебя угощают!')
    showBeat(who, list[0])
    sound.pop()
  }

  /** Гость познакомился и получил бейдж (или угол) — если у него есть просьба или угощение, сначала оно. */
  const guestDone = (id: number) => {
    const e = twist.errands[id]
    if (e && !doneErr.includes(id)) {
      setDoneErr(d => [...d, id])
      later(() => startErrand(id, withAudio(id, errandBeats(e, rng), e)), 500)
      return
    }
    nextGuest()
  }

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
    setSelG(null); setSelB(null); setHeld({}); setDoneErr([]); shown.current = []; setFresh(null)
    if (twist.welcome) { startErrand('host', withAudio('host', [welcomeBeat(rng)])); return }
    arriveFirst()
  }

  const arriveFirst = () => {
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
    if (busy || (phase !== 'arrive' && phase !== 'errand' && phase !== 'welcome')) return
    if (phase !== 'arrive') return chooseErrand(o)
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

  const chooseErrand = (o: Option) => {
    const who = errWho
    const key = `err-${String(who)}-${b}`
    if (!o.ok) {
      miss(key); setShakeOpt(o.geo); later(() => setShakeOpt(null), 450)
      if (who !== 'host') mood(who, 'huh')
      setTip(o.why ?? 'Не то. Попробуй ещё.')
      return
    }
    haptic('good'); sound.snap(b); setGoodOpt(o.geo); setBusy(true); setTip(null); setFresh(null)
    // Твой ответ — твоим голосом; подал чашку — гость держит её.
    if (o.treat && who !== 'host') { setHeld(h => ({ ...h, [who]: o.treat! })); burst(el(who), 'small') }
    else if (o.geo === phrase('gemrielia').geo) void speak('gemrielia', 'hero')
    else if (o.geo.endsWith(phrase('gtkhovt').geo)) {
      const t = (['chai', 'qava', 'tskali', 'ki'] as const).find(x => o.geo.startsWith(phrase(x).geo))
      if (t) void speakUrl(pleaseAudio(t), o.geo)
    }
    const beat = beatList[b]
    if (who !== 'host') mood(who, 'wow', 900)
    else later(() => setSpeech({ who, tone: 'good', ru: 'Нино протягивает тебе чашку. Проходи!' }), 600)
    later(() => {
      if (beat.echo) { setSpeech({ who, geo: beat.echo, tone: 'good' }); void speak(beat.echo.startsWith(phrase('madloba').geo) ? 'madloba' : 'gtkhovt', voiceOf(who)) }
    }, 700)
    later(() => {
      setGoodOpt(null)
      if (b + 1 < beatList.length) { setB(b + 1); setBusy(false); showBeat(who, beatList[b + 1]) }
      else if (who === 'host') arriveFirst()
      else nextGuest()
    }, beat.echo ? 1900 : 1300)
  }

  // Гость представился — сразу, пока его слова звучат, бейдж или угол: игра про то, что услышал, а не про память.
  const afterGuest = (id: number) => {
    const g = byId(id)
    if (mode === 'who') {
      setBadges(x => ({ ...x, [id]: g.name }))
      return guestDone(id)
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
      later(() => { setBusy(false); guestDone(id) }, 900)
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
      later(() => { setBusy(false); guestDone(id) }, 900)
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
          <GameIntro title="Вечеринка на крыше" text={`${INTRO_TEXT[mode]} ${twist.intro}`} chips={chips} onStart={begin} mood="happy" hero={mode === 'jobs'} />
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
            onAgain={() => { setRound(r => r + 1); setPresent([]); setSlots({}); setSpeech(null); setHeld({}); setPhase('intro') }}
          />
        </div>
      </GameFrame>
    )
  }

  const speakerLook = speech ? (speech.who === 'host' ? HOST_LOOK : byId(speech.who).look) : null
  const target = phase === 'quiz' ? plan.questions[q] : null
  const beat = phase === 'arrive' || phase === 'errand' || phase === 'welcome' ? beatList[b] : null
  const errKey = `err-${String(errWho)}-${b}`
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

        <div className="relative flex-1 min-h-[260px] rounded-2xl border-[1.5px] border-jewelInk overflow-hidden" style={{ background: '#1D2747', boxShadow: '3px 3px 0 #15100A' }} data-testid="party-roof">
          <RoofBackdrop />
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
                    <div className={moods[id] === 'huh' ? 'zn-shake' : moods[id] === 'wow' ? 'zn-jump' : ''}>
                      <svg width={84 * depthScale(y)} height={134 * depthScale(y)} viewBox="-50 -190 100 196" className="overflow-visible" aria-hidden>
                        <Passerby who={whoOf(g.look)} phase={0} stride={0} face={FACE_OF[moods[id] ?? 'smile']}
                          talking={!!speech && speech.who === id && !!speech.geo && speech.tone !== 'bad'} wave={isNew && b === 0} />
                      </svg>
                    </div>
                    {mode === 'who' && g.friend && (
                      <span className="absolute -top-3 right-0 rounded-full border-[1.5px] border-jewelInk bg-gold px-1 text-[9px] font-extrabold leading-tight" data-testid="party-friend-mark">друг</span>
                    )}
                    <AnimatePresence>
                      {held[id] && (
                        <motion.span key={held[id]} className="absolute right-[-6px] top-[38%]" data-testid={`party-held-${id}`}
                          initial={{ scale: 0, y: 30, rotate: -30 }} animate={{ scale: 1, y: 0, rotate: 0 }} exit={{ scale: 0 }}
                          transition={{ type: 'spring', stiffness: 380, damping: 15 }}>
                          <TreatIcon t={held[id]} size={26} />
                        </motion.span>
                      )}
                    </AnimatePresence>
                    <AnimatePresence>
                      {badges[id] && (
                        <motion.span key={badges[id]} data-testid={`party-badge-on-${id}`}
                          className="absolute top-[46%] rounded-md border-[1.5px] border-jewelInk bg-cream-tile px-1.5 font-geo font-extrabold text-[11px] leading-tight whitespace-nowrap overflow-hidden"
                          style={{ boxShadow: '1px 2px 0 #15100A' }}
                          initial={{ scale: 2.2, rotate: -18, y: -40, opacity: 0 }} animate={{ scale: 1, rotate: -3, y: 0, opacity: 1 }}
                          transition={{ type: 'spring', stiffness: 420, damping: 14 }}>
                          <span className="block h-[3px] -mx-1.5 bg-ruby" />{badges[id]}
                        </motion.span>
                      )}
                    </AnimatePresence>
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

          {fresh && (
            <div className="absolute left-2 bottom-2 z-30" key={fresh}>
              <NewWord word={phrase(fresh)} />
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

        {(phase === 'errand' || phase === 'welcome') && beat && (
          beat.options[0]?.treat ? (
            <div className="shrink-0 grid grid-cols-3 gap-1.5" data-testid="party-options">
              {beat.options.map((o, k) => (
                <motion.button key={o.geo} data-testid={`party-opt-${k}`} disabled={busy} onClick={() => { haptic('tap'); choose(o) }}
                  className="min-h-[78px] rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile flex flex-col items-center justify-center gap-0.5"
                  style={{ boxShadow: '2px 2px 0 #15100A' }}
                  animate={{ x: shakeOpt === o.geo ? [0, -7, 7, -5, 5, 0] : 0, backgroundColor: goodOpt === o.geo ? '#D6E9D9' : (wrongs[errKey] ?? 0) >= 2 && o.ok ? '#FBEFC6' : '#FDFAEF', y: goodOpt === o.geo ? -6 : 0 }}
                  whileTap={busy ? undefined : { scale: 0.94 }} transition={{ type: 'spring', stiffness: 420, damping: 22 }}>
                  <TreatIcon t={o.treat!} size={36} />
                  <span className="font-geo font-bold text-[14px] leading-none">{o.geo}</span>
                  <span className="text-[10px] font-semibold text-jewelInk-hint leading-none">{firstMet(lesson.id, o.treat!) ? phrase(o.treat!).ru : cyr(o.geo)}</span>
                </motion.button>
              ))}
            </div>
          ) : (
            <div className={`shrink-0 grid gap-1.5 ${beat.options.length > 3 ? 'grid-cols-2' : 'grid-cols-1'}`} data-testid="party-options">
              {beat.options.map((o, k) => (
                <Reply key={o.geo} compact geo={o.geo} onClick={() => choose(o)} testId={`party-opt-${k}`}
                  hint={o.ru && beat.word && firstMet(lesson.id, beat.word) ? `${cyr(o.geo)} — ${o.ru}` : undefined}
                  state={goodOpt === o.geo ? 'good' : shakeOpt === o.geo ? 'bad' : (wrongs[errKey] ?? 0) >= 2 && o.ok ? 'good' : 'idle'} disabled={busy} />
              ))}
            </div>
          )
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

/** Ночная крыша в Батуми: небо, луна и море, силуэт города с Алфавитной башней и колесом обозрения, парапет, черепица. */
function RoofBackdrop() {
  const INK = '#15100A'
  const windows: [number, number][] = [[12, 98], [20, 104], [44, 92], [52, 100], [70, 106], [118, 96], [126, 104], [150, 100], [196, 94], [204, 102], [262, 98], [300, 92], [308, 100], [336, 104]]
  return (
    <svg viewBox="0 0 360 300" preserveAspectRatio="xMidYMax slice" width="100%" height="100%" className="absolute inset-0" aria-hidden>
      <defs>
        <linearGradient id="pr-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#141B3A" /><stop offset="0.7" stopColor="#3B2F66" /><stop offset="1" stopColor="#8C5A86" /></linearGradient>
        <linearGradient id="pr-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2B3D6E" /><stop offset="1" stopColor="#1A2547" /></linearGradient>
        <linearGradient id="pr-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9C5A3C" /><stop offset="1" stopColor="#C2704A" /></linearGradient>
        <radialGradient id="pr-moon"><stop offset="0.5" stopColor="#FFF4D6" /><stop offset="1" stopColor="#FFF4D6" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="360" height="300" fill="url(#pr-sky)" />
      {[[30, 20], [80, 40], [120, 14], [170, 30], [220, 18], [250, 48], [300, 26], [340, 44], [150, 60], [60, 70]].map(([x, y], k) => (
        <circle key={k} cx={x} cy={y} r={k % 3 ? 1 : 1.6} fill="#FFF8EA" className="zn-bob" style={{ animationDelay: `${k * 0.3}s` }} />
      ))}
      <circle cx="290" cy="56" r="26" fill="url(#pr-moon)" />
      <circle cx="290" cy="56" r="13" fill="#FFF4D6" stroke={INK} strokeWidth="1.2" />
      <circle cx="285" cy="52" r="2.4" fill="#E8DCB8" /><circle cx="294" cy="60" r="1.8" fill="#E8DCB8" />

      {/* Море и лунная дорожка. */}
      <rect y="118" width="360" height="30" fill="url(#pr-sea)" />
      {[0, 1, 2, 3, 4].map(k => <ellipse key={k} cx={290 + (k % 2 ? 4 : -3)} cy={122 + k * 5} rx={10 - k} ry="1.2" fill="#FFF4D6" opacity={0.7 - k * 0.1} />)}

      {/* Город: дома с окнами, Алфавитная башня, колесо обозрения. */}
      <g fill="#241B3F" stroke={INK} strokeWidth="1">
        <rect x="0" y="88" width="34" height="34" /><rect x="36" y="80" width="28" height="42" /><rect x="64" y="96" width="22" height="26" />
        <rect x="108" y="86" width="30" height="36" /><rect x="140" y="92" width="24" height="30" />
        <rect x="186" y="84" width="30" height="38" /><rect x="252" y="90" width="26" height="32" /><rect x="292" y="82" width="30" height="40" /><rect x="324" y="94" width="36" height="28" />
      </g>
      {windows.map(([x, y], k) => <rect key={k} x={x} y={y} width="4" height="5" fill="#FFD36B" opacity={0.85} />)}
      {/* Алфавитная башня: тонкий столб, спираль и шар наверху. */}
      <g stroke={INK} strokeWidth="1">
        <rect x="96" y="40" width="4" height="82" fill="#3A2F5A" />
        {Array.from({ length: 8 }, (_, k) => <path key={k} d={`M92 ${118 - k * 10} q6 -6 12 0`} fill="none" stroke="#C9B8E8" strokeWidth="1.4" />)}
        <circle cx="98" cy="38" r="5" fill="#FFD36B" />
      </g>
      {/* Колесо обозрения на набережной. */}
      <g stroke="#C9B8E8" strokeWidth="1.2" fill="none">
        <circle cx="232" cy="92" r="22" />
        {Array.from({ length: 8 }, (_, k) => { const a = (k * Math.PI) / 4; return <path key={k} d={`M232 92 L${232 + Math.cos(a) * 22} ${92 + Math.sin(a) * 22}`} /> })}
        <path d="M224 122 L232 92 L240 122" stroke={INK} strokeWidth="1.6" />
        {Array.from({ length: 8 }, (_, k) => { const a = (k * Math.PI) / 4; return <circle key={k} cx={232 + Math.cos(a) * 22} cy={92 + Math.sin(a) * 22} r="2" fill={['#E01A3C', '#F5B820', '#4E8A5B', '#1B5FB0'][k % 4]} stroke="none" /> })}
      </g>

      {/* Парапет крыши. */}
      <rect y="146" width="360" height="22" fill="#D9C2A0" stroke={INK} strokeWidth="1.6" />
      <rect y="142" width="360" height="6" fill="#B5793F" stroke={INK} strokeWidth="1.4" />
      {Array.from({ length: 12 }, (_, k) => <path key={k} d={`M${k * 32 + 14} 148 v20`} stroke={INK} strokeWidth="0.8" opacity="0.25" />)}

      {/* Черепичный пол в перспективе. */}
      <path d="M0 168 H360 V300 H0 Z" fill="url(#pr-floor)" stroke={INK} strokeWidth="1.2" />
      {Array.from({ length: 13 }, (_, k) => { const x = k * 30; return <path key={k} d={`M${180 + (x - 180) * 0.55} 168 L${180 + (x - 180) * 1.6} 300`} stroke={INK} strokeWidth="0.8" opacity="0.3" /> })}
      {[184, 204, 230, 262].map(y => <path key={y} d={`M0 ${y} H360`} stroke={INK} strokeWidth="0.8" opacity="0.3" />)}

      {/* Стол с лимонадом и хачапури, лимонное дерево в кадке. */}
      <g>
        <ellipse cx="30" cy="196" rx="26" ry="6" fill="#15100A" opacity="0.2" />
        <rect x="8" y="176" width="44" height="6" rx="2" fill="#FDFAEF" stroke={INK} strokeWidth="1.4" />
        <path d="M14 182 v14 M46 182 v14" stroke={INK} strokeWidth="1.6" />
        <rect x="14" y="164" width="8" height="12" rx="2" fill="#F5E27A" stroke={INK} strokeWidth="1.2" />
        <ellipse cx="38" cy="174" rx="10" ry="4" fill="#F5B820" stroke={INK} strokeWidth="1.2" />
        <ellipse cx="38" cy="173" rx="4" ry="1.8" fill="#FFF4B8" />
      </g>
      <g>
        <rect x="330" y="176" width="22" height="20" rx="3" fill="#C2553A" stroke={INK} strokeWidth="1.4" />
        <path d="M341 176 v-16" stroke="#7A4E2D" strokeWidth="2.4" />
        <circle cx="341" cy="152" r="14" fill="#4E8A5B" stroke={INK} strokeWidth="1.4" />
        {[[334, 148], [346, 154], [340, 160]].map(([x, y], k) => <circle key={k} cx={x} cy={y} r="2.4" fill="#F5E27A" stroke={INK} strokeWidth="0.8" />)}
      </g>
    </svg>
  )
}
