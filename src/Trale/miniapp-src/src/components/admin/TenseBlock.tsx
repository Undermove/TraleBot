import { useState } from 'react'
import type { VerbTenseRowDto } from '../../api'
import { PERSONS, cyr } from '../../verbs/types'
import { tenseName } from './verbReview'

const button = 'min-h-[48px] px-4 rounded border-[1.5px] border-jewelInk font-sans text-[14px] font-extrabold disabled:opacity-50'
const quiet = 'min-h-[48px] px-3 font-sans text-[14px] font-bold text-navy underline disabled:opacity-50'

interface Props {
  tense: VerbTenseRowDto
  busy: boolean
  onConfirm: () => void
  onEdit: (cells: (string | null)[]) => void
  onRemove: () => void
}

/**
 * Одно время глагола на экране проверки. Проверенное свёрнуто в строку (по нажатию раскрывается),
 * непроверенное раскрыто: шесть форм с транскрипцией, русской фразой и отметкой «есть / нет в текстах»,
 * и что с ним сделать. Правка — тут же, шестью полями.
 */
export default function TenseBlock({ tense: t, busy, onConfirm, onEdit, onRemove }: Props) {
  const [open, setOpen] = useState(t.unverified)
  const [cells, setCells] = useState<string[] | null>(null)
  const [removing, setRemoving] = useState(false)
  const filled = t.cells.filter(c => c).length
  const found = t.inTexts.filter(x => x === true).length
  const known = t.inTexts.some(x => x !== null)
  const shown = open || t.unverified

  return (
    <div
      data-testid={`tense-block-${t.tense}`}
      className={`rounded-lg border-[1.5px] ${t.unverified ? 'border-jewelInk bg-cream-tile' : 'border-jewelInk/20'}`}
    >
      <button
        type="button" disabled={t.unverified} onClick={() => setOpen(!open)}
        className="w-full min-h-[48px] px-3 flex items-center justify-between gap-2 text-left"
      >
        <span className="font-sans text-[14px] font-extrabold text-jewelInk">
          {tenseName(t.tense)}
          {!shown && <span className="ml-2 font-geo font-bold text-jewelInk-mid">{t.cells.find(c => c)}</span>}
        </span>
        <span className={`shrink-0 font-sans text-[12px] ${t.unverified ? 'font-extrabold text-ruby' : 'text-jewelInk-hint'}`}>
          {t.unverified ? 'не проверено' : `проверено${shown ? ' · свернуть' : ''}`}
        </span>
      </button>
      {shown && (
        <div className="px-3 pb-3 flex flex-col gap-1.5">
          {(known || t.completed) && (
            <div className="font-sans text-[12px] text-jewelInk-mid">
              {known ? `в текстах ${found} из ${filled}` : ''}{known && t.completed ? ' · ' : ''}{t.completed ? 'дописано вторым кругом' : ''}
            </div>
          )}
          {t.cells.map((cell, person) => (
            <div key={person} className="flex items-center gap-2">
              <span className="w-8 shrink-0 font-sans text-[12px] text-jewelInk-hint">{PERSONS[person]}</span>
              {cells ? (
                <input
                  aria-label={`${tenseName(t.tense)}, ${PERSONS[person]}`}
                  value={cells[person]}
                  onChange={e => setCells(cells.map((c, i) => (i === person ? e.target.value : c)))}
                  className="min-w-0 flex-1 min-h-[48px] px-2 rounded border-[1.5px] border-jewelInk/40 font-geo text-[17px]"
                />
              ) : (
                <span className="min-w-0 flex-1 py-0.5">
                  <span className="font-geo text-[17px] font-bold text-jewelInk">{cell ?? '—'}</span>
                  {cell && <span className="ml-2 font-sans text-[12px] text-jewelInk-hint">{cyr(cell)}</span>}
                  <span className="block font-sans text-[12px] text-jewelInk-hint">
                    {t.phrases?.[person]}
                    {cell && t.inTexts[person] !== null && (
                      <span className={t.inTexts[person] ? '' : 'text-ruby'}>
                        {t.phrases?.[person] ? ' · ' : ''}{t.inTexts[person] ? 'есть в текстах' : 'нет в текстах'}
                      </span>
                    )}
                  </span>
                </span>
              )}
            </div>
          ))}
          {cells ? (
            <div className="flex flex-wrap gap-2 mt-1">
              <button
                type="button" className={button} disabled={busy}
                onClick={() => { onEdit(cells.map(c => c.trim() || null)); setCells(null) }}
              >Сохранить</button>
              <button type="button" className={quiet} onClick={() => setCells(null)}>Отмена</button>
            </div>
          ) : removing ? (
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="font-sans text-[13px] text-jewelInk-mid">Убрать время из глагола?</span>
              <button type="button" className={`${quiet} text-ruby`} disabled={busy} onClick={() => { onRemove(); setRemoving(false) }}>Убрать</button>
              <button type="button" className={quiet} onClick={() => setRemoving(false)}>Отмена</button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-x-1 mt-1">
              {t.unverified && <button type="button" className={button} disabled={busy} onClick={onConfirm}>Подтвердить</button>}
              <button type="button" className={quiet} disabled={busy} onClick={() => setCells(t.cells.map(c => c ?? ''))}>Исправить</button>
              {t.tense !== 'present' && (
                <button type="button" className={quiet} disabled={busy} onClick={() => setRemoving(true)}>Убрать время</button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
