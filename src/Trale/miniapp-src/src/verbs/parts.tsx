import React from 'react'
import { KINDS, cyr, type VerbFormHitDto, type VerbKind } from './types'
import { meaningOfHit, type Meaning } from './meaning'
import { prefixOf } from './family/types'

export { Coach } from './ui/GameShell'

/**
 * Форма, разрезанная по корню: приставки синим, корень чёрным, окончание красным.
 * У глагола из семьи (prefixes) корня для подсветки нет — синим выделяется приставка направления.
 */
function Parts({ form, root, prefixes }: { form: string; root?: string; prefixes?: readonly string[] }) {
  const at = root ? form.indexOf(root) : -1
  if (at < 0) {
    const prefix = prefixes?.length ? prefixOf(form, prefixes) : ''
    return prefix ? <><span className="text-navy" data-testid="form-prefix">{prefix}</span>{form.slice(prefix.length)}</> : <>{form}</>
  }
  return (
    <>
      <span className="text-navy">{form.slice(0, at)}</span>
      {root}
      <span className="text-ruby">{form.slice(at + root!.length)}</span>
    </>
  )
}

/** Грузинская форма и кириллическая транскрипция под ней. */
export function VerbForm({ variants, big = false, root, prefixes }: { variants: string[]; big?: boolean; root?: string; prefixes?: readonly string[] }) {
  if (!variants.length) return <span className="text-jewelInk-faint">—</span>
  return (
    <span className="inline-flex flex-col items-end">
      <span className={`font-geo ${big ? 'text-[20px]' : 'text-[16px]'} font-bold text-jewelInk leading-tight`}>
        {variants.map((f, i) => (
          <React.Fragment key={f}>{i > 0 && ', '}<Parts form={f} root={root} prefixes={prefixes} /></React.Fragment>
        ))}
      </span>
      <span className="text-[11px] text-jewelInk-hint leading-tight">{variants.map(cyr).join(', ')}</span>
    </span>
  )
}

/**
 * Значение формы простыми словами: «я хочу». Пометка рядом — только когда без неё две формы
 * читались бы одинаково («я писал(а)»: один раз или долго).
 */
export function MeaningText({ meaning }: { meaning: Meaning }) {
  return (
    <>
      {meaning.text}
      {meaning.note && (
        <span
          data-testid="meaning-note"
          className="ml-1.5 inline-block align-middle rounded-full border border-jewelInk/40 bg-gold-wash px-2 py-[1px] text-[11px] font-bold leading-snug text-jewelInk-mid whitespace-nowrap"
        >
          {meaning.note}
        </span>
      )}
    </>
  )
}

export function KindChip({ kind }: { kind: VerbKind }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md border border-jewelInk/50 text-[10px] font-bold uppercase tracking-wider ${KINDS[kind].chip}`}>
      {KINDS[kind].label}
    </span>
  )
}

/**
 * Строка «это глагол» под словом из словаря или под переводом: какая это форма
 * и кнопка, открывающая карточку глагола.
 */
export function VerbHint({ hit, onOpen }: { hit: VerbFormHitDto; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      data-testid="verb-hint"
      className="jewel-pressable w-full text-left rounded-xl bg-navy-wash border-[1.5px] border-jewelInk px-3.5 py-3 flex items-center gap-3"
      style={{ boxShadow: '2px 2px 0 #15100A' }}
    >
      <span className="flex-1 min-w-0">
        <span className="block mn-eyebrow text-navy">ზმნა · глагол</span>
        <span className="block mt-0.5 text-[14px] font-bold text-jewelInk">
          <span className="font-geo">{hit.form}</span> — <MeaningText meaning={meaningOfHit(hit)} />
        </span>
        <span className="block text-[12px] text-jewelInk-mid">
          от <span className="font-geo font-bold">{hit.title}</span> — {hit.ru}
        </span>
      </span>
      <span className="shrink-0 text-[12px] font-bold text-navy whitespace-nowrap">все формы →</span>
    </button>
  )
}
