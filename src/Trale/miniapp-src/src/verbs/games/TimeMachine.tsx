import React, { useRef, useState } from 'react'
import Mascot from '../../components/Mascot'
import { PERSONS, TENSES, type VerbDto } from '../types'
import { Coach, GameShell, OptionButton, PULSE, useFirstTime } from '../ui/GameShell'
import { BoneIcon, FlagIcon, iconMarkup } from '../ui/icons'
import { bad, floater, good } from '../ui/juice'
import { shortGloss, type Rng } from './common'
import { PERSON_STEP, STOPS, locate, makeTimeRound, personsFor } from './timeRounds'
import { useLater } from './useLater'

const BONE = iconMarkup(BoneIcon)

interface Said { form: string; ok: boolean; text: string }

/**
 * «Машина времени»: какую форму нажмёшь — туда Бомбора и поедет.
 * Вчера — аорист, сейчас — настоящее, завтра — будущее. Ошибки нет: он просто окажется не там.
 */
export default function TimeMachine({ verb, onExit, rng = Math.random }: { verb: VerbDto; onExit: () => void; rng?: Rng }) {
  const [correct, setCorrect] = useState(0)
  const persons = personsFor(correct)
  const [round, setRound] = useState(() => makeTimeRound(verb, 1, rng))
  const [pos, setPos] = useState(1)
  const [said, setSaid] = useState<Said | null>(null)
  /** Какое лицо только что добавилось — говорим об этом один раунд. */
  const [added, setAdded] = useState<number | null>(null)
  const [first, played] = useFirstTime('verb_time')
  const dog = useRef<HTMLDivElement>(null)
  const later = useLater()

  const target = STOPS[round.stop]
  const who = PERSONS[round.person]
  const when = target.label.toLowerCase()

  function say(form: string) {
    if (said?.ok) return
    const at = locate(verb, form)
    if (!at) return
    const ok = at.stop === round.stop && at.person === round.person
    setPos(at.stop)
    if (!ok) {
      bad()
      const stop = STOPS[at.stop]
      setSaid({
        form, ok,
        text: `${form} — это «${PERSONS[at.person]}», ${stop.label.toLowerCase()} (${TENSES[stop.tense].name.toLowerCase()}).`
          + (at.stop === round.stop ? ` Остановка та, но едет не «${who}».` : '')
      })
      return
    }
    played()
    const n = correct + 1
    const grew = personsFor(n) > persons
    setSaid({ form, ok, text: 'Он на месте!' })
    setCorrect(n)
    later(() => { good(dog.current, n % PERSON_STEP === 0 ? 'big' : 'small', BONE); floater('+1', dog.current) }, 420)
    later(() => {
      setSaid(null)
      setAdded(grew ? personsFor(n) - 1 : null)
      setRound(makeTimeRound(verb, personsFor(n), rng, round))
    }, 1100)
  }

  return (
    <GameShell
      id="verb_time" title="Машина времени" onExit={onExit}
      right={<><span key={correct} className="inline-block j-bump"><BoneIcon /> {correct}</span> · лиц: {persons}</>}
      help={[
        'На дорожке три остановки: вчера, сейчас и завтра. Флажок показывает, куда мне надо попасть.',
        'Сверху написано, кто едет и когда. Нажми грузинскую форму, которая это значит.',
        'Я поеду туда, куда ведёт выбранная форма. Не туда — скажу, что она значила, и можно пробовать ещё.',
        'Сначала едет только «я». Каждые четыре верных ответа добавляется ещё одно лицо.'
      ]}
    >
      <div className="px-5 flex-1 flex flex-col gap-4 justify-center">
        <div className="text-center" data-testid="time-ask" data-stop={round.stop} data-person={round.person}>
          <div className="mn-eyebrow text-navy">Отправь туда, где флажок</div>
          <div className="mt-1 text-[26px] font-extrabold leading-tight">{who} · {when}</div>
          <div className="mt-0.5 text-[13px] text-jewelInk-mid">
            «{verb.ru}» — {TENSES[target.tense].name.toLowerCase()}, как «{shortGloss(target.tense)}»
          </div>
        </div>

        <div className="relative h-[150px]">
          <div className="absolute left-[8%] right-[8%] top-[112px] h-1.5 rounded-full bg-jewelInk" />
          {STOPS.map((s, i) => (
            <div key={s.label} className="absolute top-[96px] -translate-x-1/2 flex flex-col items-center" style={{ left: `${16.66 + i * 33.33}%` }}>
              <div className={`w-8 h-8 rounded-full border-[2px] border-jewelInk ${i === round.stop ? 'bg-gold' : 'bg-cream-tile'}`} />
              <div className="mt-1 text-[12px] font-bold">{s.label}</div>
              {i === round.stop && <div key={correct} className="absolute -top-8 left-[14px] j-pop"><FlagIcon size={28} /></div>}
            </div>
          ))}
          <div
            ref={dog} data-testid="time-mascot" data-stop={pos}
            className="absolute top-0 -translate-x-1/2 transition-all duration-500 ease-out" style={{ left: `${16.66 + pos * 33.33}%` }}
          >
            <div key={said?.form ?? 'idle'} className={said ? (said.ok ? 'j-hop' : 'j-wiggle') : ''}>
              <Mascot mood={said?.ok ? 'cheer' : said ? 'think' : 'happy'} size={96} />
            </div>
          </div>
        </div>

        <div className="min-h-[40px] text-center text-[14px] font-bold" data-testid="time-said">
          {said
            ? <span key={said.form} className={`inline-block j-pop ${said.ok ? 'text-navy' : 'text-jewelInk'}`}>
                {said.ok ? said.text : <><span className="font-geo">{said.form}</span>{said.text.slice(said.form.length)}</>}
              </span>
            : added !== null && <span className="inline-block j-pop text-navy">Теперь ездит ещё и «{PERSONS[added]}».</span>}
        </div>

        {first && !said && <Coach>Едет «{who}», {when}. Для первого раза я подсветил нужную форму — нажми её.</Coach>}
        <div className="grid grid-cols-2 gap-2">
          {round.options.map(o => (
            <OptionButton
              key={o}
              onClick={() => say(o)}
              tone={`${said?.form === o ? (said.ok ? 'bg-navy-wash' : 'bg-gold-wash') : 'bg-cream-tile'} ${first && !said && o === round.answer ? PULSE : ''}`}
            >{o}</OptionButton>
          ))}
        </div>
      </div>
      <div className="h-6" />
    </GameShell>
  )
}
