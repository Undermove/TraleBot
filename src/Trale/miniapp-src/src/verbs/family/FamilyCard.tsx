import React, { useState } from 'react'
import Button from '../../components/Button'
import ProBadge from '../../components/ProBadge'
import { hintSeen, markHintSeen } from '../ui/hints'
import { CloseIcon } from '../ui/icons'
import DirectionGlyph, { SpeakerDot } from './DirectionGlyph'
import { FAMILY_CARD_HINT, SCHEME, STATE_RU, familyAction, memberAt, pillState, towardProgress, type PillState } from './cardLogic'
import { TOWARD_RU, placeLabel, type Direction, type SectionFamilyDto, type SectionFamilyMemberDto, type Toward } from './types'

// Карточка семьи в уровне раздела: один глагол с приставками направления — вместо наборов по пять
// глаголов. Направления стоят схемой (вверх — сверху, внутрь — слева…), у каждого две кнопки:
// «туда» и «сюда». Нажал — открылась карточка этого глагола. Играть — одна кнопка на всю семью.

const PILL: Record<PillState, string> = {
  new: 'bg-cream-deep text-jewelInk-mid',
  started: 'bg-navy text-cream',
  learned: 'bg-gold text-jewelInk'
}

const NAME: Record<Direction, string> = { up: 'вверх', down: 'вниз', in: 'внутрь', out: 'наружу', across: 'через', none: '' }

interface Props {
  family: SectionFamilyDto
  hasAccess: boolean
  /** Сюда ведёт карточка «что делать сейчас». */
  current?: boolean
  onVerb: (member: SectionFamilyMemberDto) => void
  onPlay: (member: SectionFamilyMemberDto | null) => void
}

export default function FamilyCard({ family, hasAccess, current, onVerb, onPlay }: Props) {
  const [hint, setHint] = useState(() => hasAccess && !hintSeen(FAMILY_CARD_HINT))
  const dismiss = () => { if (hint) { markHintSeen(FAMILY_CARD_HINT); setHint(false) } }
  const progress = towardProgress(family)
  const action = familyAction(family)

  function pill(direction: Direction, toward: Toward) {
    const member = memberAt(family, direction, toward)
    if (!member) return <span className="flex-1" />
    const state = pillState(member)
    return (
      <button
        data-testid={`family-pill-${direction}-${toward}`} data-state={state}
        aria-label={`${member.ru}: ${placeLabel(member)} — ${STATE_RU[state]}`}
        onClick={() => { dismiss(); onVerb(member) }}
        className={`jewel-pressable flex-1 min-w-0 min-h-[44px] rounded-lg border border-jewelInk/60 text-[11px] font-bold leading-none ${PILL[state]}`}
      >
        {TOWARD_RU[toward]}
      </button>
    )
  }

  function cell(direction: Direction | null, key: number) {
    if (!direction || !family.members.some(m => m.direction === direction)) return <div key={key} />
    const center = direction === 'none'
    return (
      <div key={key} className={`rounded-xl px-1 pt-1 pb-1 ${center ? 'bg-cream-tile border border-jewelInk/40' : ''}`} data-testid={`family-direction-${direction}`}>
        <div className="flex items-center justify-center gap-1 h-8">
          <DirectionGlyph direction={direction} toward="there" size={26} />
          <span className="text-[12px] font-extrabold text-jewelInk leading-none truncate">{center ? family.baseName : NAME[direction]}</span>
        </div>
        <div className="mt-0.5 flex gap-1">{pill(direction, 'there')}{pill(direction, 'here')}</div>
      </div>
    )
  }

  return (
    <div
      className={`rounded-xl border ${current ? 'border-jewelInk bg-gold-wash' : 'border-jewelInk/30 bg-cream'} px-2.5 py-3`}
      data-testid={`verbs-${family.id}`} data-current={!!current}
    >
      <div className="px-1 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[14px] font-bold text-jewelInk leading-tight">{family.title}</div>
          <div className="mt-0.5 text-[11px] text-jewelInk-mid leading-snug">
            Один глагол — «{family.baseName}». Приставка говорит, куда.
          </div>
        </div>
        {current && <span className="shrink-0 text-[11px] font-bold text-ruby">ты здесь</span>}
      </div>

      {hint && (
        <div className="mt-2 flex items-center gap-1 rounded-lg bg-gold-wash border border-jewelInk/40 pl-3 text-[12px] text-jewelInk" data-testid="family-hint">
          <span className="flex-1 py-2">Это не отдельные глаголы, а один — «{family.baseName}» с разными приставками. Выучишь «{family.baseName}» — на каждое направление хватит двух минут.</span>
          <button aria-label="Понятно" className="shrink-0 w-11 h-11 flex items-center justify-center" onClick={dismiss}><CloseIcon size={14} /></button>
        </div>
      )}

      <div className="mt-2 grid grid-cols-3 gap-1" data-testid="family-scheme">
        {SCHEME.flat().map((direction, i) => cell(direction, i))}
      </div>

      <div className="mt-2 px-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-jewelInk-mid">
        <span data-testid="family-progress" className="font-bold tabular-nums">
          туда: <span className="text-navy">{progress.there.learned}</span> из {progress.there.total} · сюда: <span className="text-navy">{progress.here.learned}</span> из {progress.here.total}
        </span>
        <span><SpeakerDot /> — это ты: «сюда» — к тебе</span>
      </div>

      <div className="mt-2.5">
        <Button variant={action.quiet ? 'ghost' : 'primary'} onClick={() => { dismiss(); onPlay(action.member) }}>
          <span className="inline-flex items-center gap-2" data-testid="family-play">
            {action.label}
            {!hasAccess && <ProBadge />}
          </span>
        </Button>
      </div>
    </div>
  )
}
