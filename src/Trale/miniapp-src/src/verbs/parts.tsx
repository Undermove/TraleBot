import React from 'react'
import { KINDS, PERSONS, TENSES, cyr, type VerbFormHitDto, type VerbKind } from './types'

export { Coach } from './ui/GameShell'

/** Форма, разрезанная по корню: приставки синим, корень чёрным, окончание красным. */
function Parts({ form, root }: { form: string; root?: string }) {
  const at = root ? form.indexOf(root) : -1
  if (at < 0) return <>{form}</>
  return (
    <>
      <span className="text-navy">{form.slice(0, at)}</span>
      {root}
      <span className="text-ruby">{form.slice(at + root!.length)}</span>
    </>
  )
}

/** Грузинская форма и кириллическая транскрипция под ней. */
export function VerbForm({ variants, big = false, root }: { variants: string[]; big?: boolean; root?: string }) {
  if (!variants.length) return <span className="text-jewelInk-faint">—</span>
  return (
    <span className="inline-flex flex-col items-end">
      <span className={`font-geo ${big ? 'text-[20px]' : 'text-[16px]'} font-bold text-jewelInk leading-tight`}>
        {variants.map((f, i) => (
          <React.Fragment key={f}>{i > 0 && ', '}<Parts form={f} root={root} /></React.Fragment>
        ))}
      </span>
      <span className="text-[11px] text-jewelInk-hint leading-tight">{variants.map(cyr).join(', ')}</span>
    </span>
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
          <span className="font-geo">{hit.form}</span> — {TENSES[hit.tense].name.toLowerCase()}, «{PERSONS[hit.person]}»
        </span>
        <span className="block text-[12px] text-jewelInk-mid">
          от <span className="font-geo font-bold">{hit.title}</span> — {hit.ru}
        </span>
      </span>
      <span className="shrink-0 text-[12px] font-bold text-navy whitespace-nowrap">все формы →</span>
    </button>
  )
}
