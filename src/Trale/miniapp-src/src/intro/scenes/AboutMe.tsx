import React, { useEffect, useMemo, useState } from 'react'
import GameFrame from '../../alphabet/games/GameFrame'
import { burst, haptic, sound } from '../../alphabet/games/fx'
import { useLater } from '../../verbs/games/useLater'
import { cyr } from '../../verbs/types'
import Mascot from '../../components/Mascot'
import Button from '../../components/Button'
import { myName } from '../story'
import { GameEnd, GameIntro, Pill, RuleCard, Tip, say } from '../ui'
import type { SceneProps, StepOf } from './types'
import { Transformed } from './Magnets'
import type { Item } from './Magnets.logic'
import {
  choose, complete, emptyCard, filled, magnet, needsMagnet, optionsFor, saveStory, storyLines,
  type Card, type Line, type Mag, type Slot
} from './AboutMe.logic'

/**
 * «Обо мне» — урок 32. Мастерим карточку-анкету из пяти строк: имя уже вписано, откуда, где живёшь, кем
 * работаешь, что любишь. В «откуда» и «где» сначала ставишь слово, потом цепляешь магнит -დან или -ში.
 * Потом «Твой рассказ»: Бомбора читает его по строчке, и карточку можно положить в копилку.
 */

const G = ({ children }: { children: string }) => <b className="font-geo">{children}</b>
const READ_MS = 1800

type Phase = 'intro' | 'build' | 'story' | 'end'

const LABEL: Record<Slot, string> = { country: 'Откуда ты?', city: 'Где живёшь?', job: 'Кто ты?', love: 'Что любишь?' }
const PAPER: React.CSSProperties = {
  boxShadow: '3px 3px 0 #15100A',
  backgroundImage: 'repeating-linear-gradient(180deg, transparent 0 33px, rgba(27,95,176,.13) 33px 34px)'
}

export default function AboutMe({ fraction, onExit, onDone }: SceneProps<StepOf<'aboutme'>>) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [card, setCard] = useState<Card>(emptyCard)
  const me = useMemo(() => myName(), [])
  const lines = useMemo(() => storyLines(card, me), [card, me])

  return (
    <GameFrame title={phase === 'story' ? 'Твой рассказ' : 'Обо мне'} eyebrow="расскажи о себе" fraction={fraction} onExit={onExit}>
      <div className="flex-1 min-h-0 flex flex-col" data-testid="aboutme-scene">
        {phase === 'intro' && (
          <GameIntro
            title="Карточка о себе"
            text="Соберём из выученного рассказ о тебе: как зовут, откуда ты, где живёшь, кем работаешь и что любишь. Страну и город ещё надо примагнитить."
            chips={[{ geo: '-დან', ru: 'из' }, { geo: '-ში', ru: 'в' }]}
            onStart={() => setPhase('build')}
          />
        )}
        {phase === 'build' && <Build card={card} setCard={setCard} myGeo={me.geo} onReady={() => setPhase('story')} />}
        {phase === 'story' && <Story lines={lines} onNext={() => setPhase('end')} onRebuild={() => { setCard(emptyCard()); setPhase('build') }} />}
        {phase === 'end' && (
          <GameEnd
            title="Рассказ в копилке"
            text="Пять предложений о себе по-грузински. Теперь ты можешь представиться кому угодно во дворе."
            rule={<RuleCard title="Два магнита"><G>-დან</G> — «из», слово целиком: <G>ესპანეთი</G> → <G>ესპანეთიდან</G>.<br /><G>-ში</G> — «в», последняя <G>ი</G> уходит: <G>ბათუმი</G> → <G>ბათუმში</G>.</RuleCard>}
            onNext={onDone}
            onAgain={() => { setCard(emptyCard()); setPhase('build') }}
          />
        )}
      </div>
    </GameFrame>
  )
}

// ── Карточка ──────────────────────────────────────────────────────────────────────────────────────

function SlotButton({ slot, card, onClick }: { slot: Slot; card: Card; onClick: () => void }) {
  const active = card.active === slot
  let text = '', state: 'empty' | 'needs' | 'filled' = 'empty', item: Item | null = null
  if (slot === 'country' && card.country) {
    if (card.countryOk) { state = 'filled'; item = { key: card.country.base, ru: card.country.ru, base: card.country.base, result: card.country.from, tool: 'დან', order: '' } }
    else { state = 'needs'; text = card.country.base }
  } else if (slot === 'city' && card.city) {
    if (card.cityOk) { state = 'filled'; item = { key: card.city.base, ru: card.city.ru, base: card.city.base, result: card.city.in, tool: 'ში', order: '' } }
    else { state = 'needs'; text = card.city.base }
  } else if (slot === 'job' && card.job) { state = 'filled'; text = card.job.geo }
  else if (slot === 'love' && card.love) { state = 'filled'; text = card.love.geo }
  const cls = state === 'filled' ? 'border-solid border-jewelInk bg-gold-wash' : state === 'needs' ? 'border-solid border-ruby bg-ruby-wash' : 'border-dashed border-jewelInk-faint text-jewelInk-faint'
  return (
    <button type="button" data-testid={`slot-${slot}`} data-state={state} onClick={() => { haptic('tap'); onClick() }}
      className={`min-h-[36px] min-w-[84px] rounded-[10px] border-[1.5px] px-2 font-geo font-bold text-[16px] ${cls} ${active ? 'outline outline-[3px] outline-navy outline-offset-1' : ''}`}>
      {item ? <Transformed key={item.result} item={item} size={16} /> : text || '…'}
    </button>
  )
}

function Build({ card, setCard, myGeo, onReady }: { card: Card; setCard: (c: Card) => void; myGeo: string; onReady: () => void }) {
  const [tip, setTip] = useState('Нажми на слот и выбери слово снизу.')
  const [shake, setShake] = useState(false)
  const later = useLater()
  const pickSlot = (s: Slot) => setCard({ ...card, active: s })
  const done = complete(card)

  const onPick = (slot: Slot, value: Parameters<typeof choose>[2], geo: string) => {
    sound.pop(filled(card))
    const n = choose(card, slot, value)
    setCard(n)
    if (slot === 'country') setTip(`«Я ${geo}»? Не хватает окончания. Какой магнит?`)
    else if (slot === 'city') setTip(`«Живу ${geo}»? Не хватает окончания. Какой магнит?`)
    else setTip(complete(n) ? 'Карточка готова! Прочитаем?' : '')
  }
  const onMagnet = (m: Mag, el: HTMLElement) => {
    const r = magnet(card, m)
    setTip(r.tip)
    if (r.ok) {
      haptic('snap'); sound.snap(filled(r.card)); burst(el, 'small')
      setCard(r.card)
    } else {
      haptic('bad'); sound.miss(); setShake(true); later(() => setShake(false), 400)
    }
  }

  const line = (head: string, slot: Slot | null) => (
    <div className="flex flex-wrap items-center gap-1.5 font-geo font-bold text-[17px] min-h-[34px]">
      <span>{head}</span>
      {slot ? <SlotButton slot={slot} card={card} onClick={() => pickSlot(slot)} /> : <span className="rounded-[10px] border-[1.5px] border-jewelInk bg-gold-wash px-2 py-0.5 text-[16px]">{myGeo}</span>}
      <span>.</span>
    </div>
  )

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2.5" data-testid="aboutme-build">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-bold text-jewelInk-soft">Анкета нового соседа</span>
        <div className="flex-1" />
        <Pill testId="aboutme-filled">{filled(card)} / 5</Pill>
      </div>
      <div className={`relative rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile px-3 py-2 -rotate-[0.6deg] ${shake ? 'zn-shake' : ''}`} style={PAPER} data-testid="aboutme-card">
        {line('მე მქვია', null)}
        {line('მე ვარ', 'country')}
        {line('ვცხოვრობ', 'city')}
        {line('მე ვარ', 'job')}
        {line('მიყვარს', 'love')}
      </div>

      {card.active && (
        <div className="flex flex-col gap-1.5">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-navy">{LABEL[card.active]}</div>
          <div className="flex flex-wrap gap-1.5" data-testid="aboutme-options">
            {optionsFor(card.active).map(o => (
              <button key={o.geo} type="button" data-testid={`opt-${o.geo}`} onClick={() => onPick(card.active!, o.value, o.geo)}
                className="min-h-[44px] rounded-xl border-[1.5px] border-jewelInk bg-cream-tile px-2.5 py-1 leading-tight" style={{ boxShadow: '2px 2px 0 #15100A' }}>
                <span className="block font-geo font-bold text-[15px]">{o.geo}</span>
                <span className="block text-[10px] font-semibold text-jewelInk-hint">{o.ru}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {needsMagnet(card) && (
        <div className="flex justify-center gap-3 zn-pop">
          {(['დან', 'ში'] as Mag[]).map(m => (
            <button key={m} type="button" data-testid={`magnet-${m}`} onClick={e => onMagnet(m, e.currentTarget)}
              className="min-h-[52px] min-w-[92px] rounded-2xl border-[1.5px] border-jewelInk bg-navy-wash px-4 py-1" style={{ boxShadow: '3px 3px 0 #15100A' }}>
              <span className="block font-geo font-extrabold text-[21px] leading-none">-{m}</span>
              <span className="block text-[11px] font-semibold text-jewelInk-soft">{m === 'ში' ? 'в' : 'из'}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-0" />
      {tip && <Tip>{tip}</Tip>}
      {done && <div className="zn-pop"><Button onClick={() => { haptic('pop'); onReady() }}>Готово, прочитать рассказ</Button></div>}
    </div>
  )
}

// ── Рассказ ───────────────────────────────────────────────────────────────────────────────────────

function Story({ lines, onNext, onRebuild }: { lines: Line[]; onNext: () => void; onRebuild: () => void }) {
  const [reading, setReading] = useState(-1)
  const [run, setRun] = useState(0)
  const [saved, setSaved] = useState(false)
  const later = useLater()

  useEffect(() => {
    let stop = false
    lines.forEach((l, k) => later(() => {
      if (stop) return
      setReading(k)
      if (l.phrase) say(l.phrase)
      else sound.tick(k)
    }, 400 + k * READ_MS))
    later(() => { if (!stop) setReading(-1) }, 400 + lines.length * READ_MS)
    return () => { stop = true }
  }, [run]) // eslint-disable-line react-hooks/exhaustive-deps

  const keep = (el: HTMLElement) => {
    saveStory(lines)
    setSaved(true)
    haptic('good'); sound.win(); burst(el, 'big')
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2.5" data-testid="aboutme-story">
      <div className="flex items-end gap-2">
        <div className="ab-short:hidden"><Mascot mood={reading >= 0 ? 'cheer' : 'happy'} size={52} /></div>
        <span className="mb-1 text-[13px] text-jewelInk-soft">{reading >= 0 ? 'Бомбора читает твой рассказ…' : 'Вот что ты о себе рассказал.'}</span>
      </div>
      <div className="relative min-h-0 overflow-hidden rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile px-3 py-2" style={{ boxShadow: '3px 3px 0 #15100A' }} data-testid="story-card">
        {lines.map((l, k) => (
          <div key={k} data-testid="story-line" data-reading={reading === k ? 'yes' : 'no'}
            className={`rounded-lg px-2 py-0.5 ab-short:py-0 transition-colors ${reading === k ? 'bg-gold-wash' : ''}`}>
            <div className="font-geo font-bold text-[17px] ab-short:text-[15px] leading-tight">{l.geo}</div>
            <div className="text-[11px] font-semibold text-jewelInk-hint leading-tight">{cyr(l.geo)}</div>
            <div className="text-[12px] font-bold text-navy leading-tight">{l.ru}</div>
          </div>
        ))}
        {saved && (
          <div className="zn-stamp absolute right-3 bottom-3 rounded-lg border-[3px] border-ruby px-2 py-0.5 text-[16px] font-extrabold uppercase tracking-[0.1em] text-ruby bg-cream-tile/80" data-testid="story-stamp">
            готово
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0" />
      <div className="flex gap-2">
        <div className="flex-1"><Button variant="ghost" onClick={() => setRun(r => r + 1)}>Послушать</Button></div>
        <div className="flex-1"><Button variant="ghost" onClick={onRebuild}>Заново</Button></div>
      </div>
      {saved
        ? <Button onClick={onNext}>Дальше</Button>
        : <SaveButton onClick={keep} />}
    </div>
  )
}

function SaveButton({ onClick }: { onClick: (el: HTMLElement) => void }) {
  return (
    <button type="button" data-testid="story-save" onClick={e => onClick(e.currentTarget)}
      className="jewel-btn bg-ruby text-cream w-full"><span className="relative z-[1]">В копилку</span></button>
  )
}
