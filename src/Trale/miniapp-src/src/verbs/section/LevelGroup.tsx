import React from 'react'
import LevelBadge from '../session/LevelBadge'
import FamilyCard from '../family/FamilyCard'
import { cyr } from '../types'
import { levelVerbs, packDone, progressOf, type SectionLevelDto, type SectionPackDto, type SectionVerbDto } from './types'

// Уровень раздела: сворачиваемая группа с полоской, внутри — наборы по пять глаголов.
// Ничего не заперто: порядок — рекомендация, любой набор и любой глагол открываются.

const Chevron = ({ open }: { open: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 text-jewelInk-hint" style={{ transform: open ? 'rotate(90deg)' : undefined, transition: 'transform 150ms' }} aria-hidden>
    <path d="M8 5 L16 12 L8 19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const Check = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
    <circle cx="12" cy="12" r="10" fill="#F5B820" stroke="#15100A" strokeWidth="1.8" />
    <path d="M7.500 12.500l3 3 6-6.500" stroke="#15100A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/** Полоска пути. Ширину задаёт доля пути, которая на сервере не убывает. */
export function Bar({ fraction, testId }: { fraction: number; testId?: string }) {
  const percent = Math.round(Math.max(0, Math.min(1, fraction)) * 100)
  return (
    <div className="h-2.5 rounded-full bg-cream-deep border border-jewelInk/30 overflow-hidden">
      <div data-testid={testId} data-percent={percent} className="h-full bg-navy transition-all duration-500 ease-out" style={{ width: `${percent}%` }} />
    </div>
  )
}

/** Пять точек набора: выучен — золотая, начат — синяя, не тронут — пустая. */
function Dots({ verbs }: { verbs: SectionVerbDto[] }) {
  return (
    <span className="inline-flex gap-[3px]" aria-hidden>
      {verbs.map((v, i) => (
        <span key={i} className={`w-2 h-2 rounded-full border border-jewelInk/60 ${v.level === 'learned' ? 'bg-gold' : v.level === 'new' ? 'bg-cream-deep' : 'bg-navy'}`} />
      ))}
    </span>
  )
}

interface Props {
  level: SectionLevelDto
  open: boolean
  onToggle: () => void
  openPack: string | null
  onTogglePack: (packId: string) => void
  onVerb: (verb: SectionVerbDto) => void
  /** Набор, куда ведёт карточка «что делать сейчас», — помечается «ты здесь». */
  currentPack?: string | null
  /** Полоску этого уровня подсвечивает знакомство с разделом. */
  tour?: boolean
  /** Нужны карточке семьи: у неё своя кнопка «играть». */
  hasAccess?: boolean
  onPlay?: (verb: SectionVerbDto | null) => void
}

export default function LevelGroup({ level, open, onToggle, openPack, onTogglePack, onVerb, currentPack, tour, hasAccess = true, onPlay }: Props) {
  const all = levelVerbs(level)
  const progress = progressOf(all)
  return (
    <div className="jewel-tile" data-testid={`verbs-level-${level.id}`} data-open={open}>
      <button onClick={onToggle} className="relative z-[1] w-full text-left px-4 py-3.5 min-h-[64px]" aria-expanded={open} data-tour={tour ? 'level' : undefined}>
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="mn-eyebrow">уровень {level.id}</div>
            <div className="text-[16px] font-extrabold text-jewelInk leading-tight truncate">{level.title}</div>
          </div>
          <div className="shrink-0 text-[12px] font-bold tabular-nums text-jewelInk-mid" data-testid={`verbs-level-${level.id}-count`}>
            <span className="text-navy">{progress.learned}</span> из {progress.total}
          </div>
          <Chevron open={open} />
        </div>
        <div className="mt-2"><Bar fraction={progress.fraction} testId={`verbs-level-${level.id}-bar`} /></div>
      </button>

      {open && (
        <div className="relative z-[1] px-3 pb-3 flex flex-col gap-2">
          {(level.families ?? []).map(family => (
            <FamilyCard
              key={family.id} family={family} hasAccess={hasAccess} current={currentPack === family.id}
              onVerb={onVerb} onPlay={member => onPlay?.(member)}
            />
          ))}
          {level.packs.map(pack => (
            <Pack
              key={pack.id} pack={pack} open={openPack === pack.id} current={currentPack === pack.id}
              onToggle={() => onTogglePack(pack.id)} onVerb={onVerb}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function Pack({ pack, open, current, onToggle, onVerb }: {
  pack: SectionPackDto; open: boolean; current: boolean; onToggle: () => void; onVerb: (verb: SectionVerbDto) => void
}) {
  const done = packDone(pack)
  const learned = pack.verbs.filter(v => v.level === 'learned').length
  return (
    <div className={`rounded-xl border ${current ? 'border-jewelInk bg-gold-wash' : 'border-jewelInk/30 bg-cream'}`} data-testid={`verbs-pack-${pack.id}`} data-done={done}>
      <button onClick={onToggle} className="w-full min-h-[52px] px-3 py-2 flex items-center gap-3 text-left" aria-expanded={open}>
        <span className="flex-1 min-w-0">
          <span className="block text-[14px] font-bold text-jewelInk leading-tight truncate">{pack.title}</span>
          <span className="mt-1 flex items-center gap-2 text-[11px] text-jewelInk-mid">
            <Dots verbs={pack.verbs} />
            {done ? <span className="font-bold text-gold-deep">пройден</span> : current ? <span className="font-bold text-ruby">ты здесь</span> : <span>{learned} из {pack.verbs.length}</span>}
          </span>
        </span>
        {done && <Check />}
        <Chevron open={open} />
      </button>
      {open && (
        <div className="px-2 pb-2 flex flex-col gap-1.5" role="list">
          {pack.verbs.map((verb, i) => <VerbRow key={verb.id ?? i} verb={verb} onOpen={() => onVerb(verb)} />)}
        </div>
      )}
    </div>
  )
}

/** Строка глагола: сначала русское значение, затем грузинское слово с кириллицей. */
export function VerbRow({ verb, onOpen, note, tour }: { verb: SectionVerbDto; onOpen: () => void; note?: React.ReactNode; tour?: boolean }) {
  return (
    <button
      onClick={onOpen} role="listitem" data-testid="verbs-verb-row" data-tour={tour ? 'verb-row' : undefined}
      className="jewel-pressable w-full min-h-[52px] rounded-lg bg-cream-tile border border-jewelInk/40 px-3 py-2 flex items-center gap-3 text-left"
    >
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-bold text-jewelInk leading-tight truncate">{verb.ru}</span>
        {verb.title && (
          <span className="block mt-0.5 leading-tight truncate">
            <span className="font-geo text-[14px] font-bold text-navy">{verb.title}</span>
            <span className="text-[11px] text-jewelInk-hint"> · {cyr(verb.title)}</span>
          </span>
        )}
        {note}
      </span>
      {verb.level !== 'new' && <span className="shrink-0"><LevelBadge level={verb.level} compact /></span>}
    </button>
  )
}
