import React, { useMemo, useState } from 'react'
import GameFrame from '../../alphabet/games/GameFrame'
import { haptic, sound } from '../../alphabet/games/fx'
import { useLater } from '../../verbs/games/useLater'
import { cyr } from '../../verbs/types'
import Mascot from '../../components/Mascot'
import { myName, shuffle, type RuleId } from '../story'
import { Bubble, GameEnd, RuleCard, Tip } from '../ui'
import type { SceneProps, StepOf } from './types'

/**
 * «Находка правила». Правило не объявляют — его замечают: два примера рубашкой вверх, человек открывает
 * оба, потом Бомбора спрашивает «что заметил?» из трёх вариантов. Верный ответ открывает карточку правила,
 * она уходит в коллекцию; промах — подсказка, и можно выбрать ещё раз. Все примеры — из story.json.
 */

interface Example { geo: string; ru: string; mark?: string }
interface Rule {
  title: string
  examples: Example[]
  question: string
  options: { text: string; right?: boolean; why?: string }[]
  card: React.ReactNode
}

const G = ({ children }: { children: string }) => <b className="font-geo">{children}</b>

function rule(id: RuleId): Rule {
  const me = myName()
  switch (id) {
    case 'time': return {
      title: 'Утро и вечер',
      examples: [{ geo: 'დილა მშვიდობისა', ru: 'доброе утро', mark: 'დილა' }, { geo: 'საღამო მშვიდობისა', ru: 'добрый вечер', mark: 'საღამო' }],
      question: 'Какое слово говорит, утро сейчас или вечер?',
      options: [
        { text: 'Первое: დილა и საღამო', right: true },
        { text: 'Второе: მშვიდობისა', why: 'Второе слово в обеих фразах одинаковое. Значит, время суток в первом.' },
        { text: 'Оба слова сразу', why: 'Сравни фразы: второе слово не меняется.' }
      ],
      card: <><G>დილა</G> — утро, <G>საღამო</G> — вечер. Вторая половина <G>მშვიდობისა</G> одна и та же. А <G>გამარჯობა</G> годится в любое время.</>
    }
    case 'echo': return {
      title: 'Спросить в ответ',
      examples: [{ geo: 'როგორ ხარ?', ru: 'как дела?' }, { geo: 'კარგად, შენ?', ru: 'хорошо, а ты?', mark: 'შენ?' }],
      question: 'Что делает შენ? в ответе?',
      options: [
        { text: 'Возвращает вопрос: «а ты?»', right: true },
        { text: 'Значит «спасибо»', why: 'Спасибо — это მადლობა. А შენ — «ты».' },
        { text: 'Значит «до свидания»', why: 'До свидания — ნახვამდის. А შენ — «ты».' }
      ],
      card: <><G>შენ</G> — «ты». <G>კარგად, შენ?</G> — «хорошо, а ты?». Так вежливо ответить и сразу спросить в ответ.</>
    }
    case 'name': return {
      title: 'Имя по-грузински',
      examples: [{ geo: 'კარლოსი', ru: 'Карлос', mark: 'ი' }, { geo: 'ნინო', ru: 'Нино' }],
      question: 'Почему у Карлоса в конце ი, а у Нино нет?',
      options: [
        { text: 'Карлос кончается на согласную', right: true },
        { text: 'Так пишут все мужские имена', why: 'Дело не в роде: გიორგი тоже на ი, а ლუკა — нет. Смотри на последнюю букву.' },
        { text: 'ი значит «меня зовут»', why: '«Меня зовут» — это მე მქვია. Смотри на последнюю букву имени.' }
      ],
      card: <>Иностранное имя на согласную грузины договаривают гласной <G>ი</G>: Карлос → <G>კარლოსი</G>. {me.added ? <>Твоё тоже: <G>{me.base}</G> → <G>{me.geo}</G>.</> : <>Твоё имя кончается на гласную, его так и говорят: <G>{me.geo}</G>.</>}</>
    }
    case 'from': return {
      title: 'Откуда',
      examples: [{ geo: 'ესპანეთიდან', ru: 'из Испании', mark: 'დან' }, { geo: 'საქართველოდან', ru: 'из Грузии', mark: 'დან' }],
      question: 'Что значит -დან в конце?',
      options: [
        { text: '«из»', right: true },
        { text: '«в»', why: 'მე ვარ ესპანეთიდან — «я из Испании», а не «в Испании».' },
        { text: '«и»', why: '«и» — это отдельное слово და. А -დან прилипает к стране.' }
      ],
      card: <><G>-დან</G> — «из». Прилипает к концу слова, слово остаётся целым: <G>ესპანეთი</G> → <G>ესპანეთიდან</G>, <G>საქართველო</G> → <G>საქართველოდან</G>.</>
    }
    case 'in': return {
      title: 'Где',
      examples: [{ geo: 'ბათუმში', ru: 'в Батуми', mark: 'ში' }, { geo: 'თბილისში', ru: 'в Тбилиси', mark: 'ში' }],
      question: 'Город — ბათუმი, а «в Батуми» — ბათუმში. Куда делась ი?',
      options: [
        { text: 'Ушла, вместо неё прилип ში', right: true },
        { text: 'Спряталась внутри слова', why: 'Посмотри: из ბათუმი уходит последняя ი, и прилипает ში.' },
        { text: 'Её и не было', why: 'Было: ბათუმი, თბილისი. Перед ში она уходит.' }
      ],
      card: <><G>-ში</G> — «в». Если слово кончается на <G>ი</G>, она уходит: <G>ბათუმი</G> → <G>ბათუმში</G>, <G>თბილისი</G> → <G>თბილისში</G>.</>
    }
    case 'da': return {
      title: 'და и და',
      examples: [{ geo: 'მე მყავს და', ru: 'у меня есть сестра', mark: 'და' }, { geo: 'ერთი ძმა და ერთი და', ru: 'один брат и одна сестра', mark: 'და' }],
      question: 'Во второй фразе два და. Что значит первое?',
      options: [
        { text: '«и»', right: true },
        { text: '«сестра»', why: '«Один брат … одна сестра»: между ними нужно «и». Сестра — второе და.' },
        { text: '«брат»', why: 'Брат — ძმა. А და между словами — «и».' }
      ],
      card: <><G>და</G> — это и «сестра», и «и». Какое из двух, понятно по месту: между словами — «и», после «одна» — сестра.</>
    }
    case 'have': return {
      title: 'Два «у меня есть»',
      examples: [{ geo: 'მე მყავს ძმა', ru: 'у меня есть брат', mark: 'მყავს' }, { geo: 'მე მაქვს მანქანა', ru: 'у меня есть машина', mark: 'მაქვს' }],
      question: 'Почему «у меня есть» в фразах разное?',
      options: [
        { text: 'Брат живой, машина — вещь', right: true },
        { text: 'Брат мужского рода, машина — женского', why: 'Рода в грузинском нет. Смотри: живое или вещь.' },
        { text: 'Брат один, а машин много', why: 'И брат, и машина по одному. Дело в том, живое ли это.' }
      ],
      card: <><G>მყავს</G> — у меня есть кто-то живой: брат, сестра, собака. <G>მაქვს</G> — что-то: машина, книга, дом.</>
    }
  }
}

function Marked({ geo, mark }: Example) {
  if (!mark) return <>{geo}</>
  const at = geo.lastIndexOf(mark)
  if (at < 0) return <>{geo}</>
  return <>{geo.slice(0, at)}<span className="text-ruby underline decoration-2 underline-offset-4">{mark}</span>{geo.slice(at + mark.length)}</>
}

export default function RuleScene({ step, fraction, onExit, onDone, rng = Math.random }: SceneProps<StepOf<'rule'>>) {
  const r = useMemo(() => rule(step.rule), [step.rule])
  const options = useMemo(() => shuffle(r.options, rng), [r]) // eslint-disable-line react-hooks/exhaustive-deps
  const [open, setOpen] = useState<number[]>([])
  const [wrong, setWrong] = useState<number[]>([])
  const [tip, setTip] = useState<string>('')
  const [found, setFound] = useState(false)
  const later = useLater()

  if (found) {
    return (
      <GameFrame title="Правило найдено" eyebrow="находка правила" fraction={fraction} onExit={onExit}>
        <GameEnd title="Ты сам это заметил" text="Правило легло в коллекцию — его можно открыть в уроке через «подробнее»." rule={<RuleCard title={r.title}>{r.card}</RuleCard>} onNext={onDone} />
      </GameFrame>
    )
  }

  const flip = (k: number) => {
    if (open.includes(k)) return
    haptic('pop'); sound.snap(k * 2)
    setOpen([...open, k])
  }
  const choose = (k: number) => {
    const o = options[k]
    if (o.right) {
      haptic('good'); sound.win()
      later(() => setFound(true), 350)
    } else {
      haptic('bad'); sound.miss()
      setWrong([...wrong, k])
      setTip(o.why ?? '')
    }
  }
  const ready = open.length === r.examples.length

  return (
    <GameFrame title={r.title} eyebrow="находка правила" fraction={fraction} onExit={onExit}>
      <div className="flex-1 min-h-0 flex flex-col gap-3" data-testid="rule-scene">
        <div className="flex items-end gap-2">
          <Mascot mood="think" size={64} />
          <Bubble className="mb-5"><span className="text-[13px]">{ready ? r.question : 'Открой оба примера и сравни'}</span></Bubble>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {r.examples.map((e, k) => (
            <button key={k} onClick={() => flip(k)} data-testid={`example-${k}`}
              className={`min-h-[92px] rounded-2xl border-[1.5px] border-jewelInk px-2 py-3 ${open.includes(k) ? 'bg-cream-tile zn-pop' : 'bg-navy text-cream'}`} style={{ boxShadow: '3px 3px 0 #15100A' }}>
              {open.includes(k) ? (
                <>
                  <div className="font-geo font-extrabold text-[18px] leading-tight"><Marked {...e} /></div>
                  <div className="text-[11px] font-semibold text-jewelInk-hint">{cyr(e.geo)}</div>
                  <div className="mt-1 text-[13px] font-bold text-navy">{e.ru}</div>
                </>
              ) : <div className="text-[15px] font-extrabold">пример {k + 1}</div>}
            </button>
          ))}
        </div>
        {ready && (
          <div className="flex flex-col gap-2 zn-pop" data-testid="rule-options">
            {options.map((o, k) => (
              <button key={k} disabled={wrong.includes(k)} onClick={() => choose(k)} data-testid={o.right ? 'rule-right' : `rule-wrong-${k}`}
                className={`min-h-[44px] rounded-xl border-[1.5px] border-jewelInk px-3 py-2 text-left text-[14px] font-bold ${wrong.includes(k) ? 'bg-ruby-wash opacity-60' : 'bg-cream-tile'}`} style={{ boxShadow: '2px 2px 0 #15100A' }}>
                {o.text}
              </button>
            ))}
          </div>
        )}
        <div className="flex-1" />
        {tip && <Tip>{tip}</Tip>}
      </div>
    </GameFrame>
  )
}
