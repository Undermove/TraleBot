import React, { useEffect, useState } from 'react'
import { api } from '../../api'
import type { VerbFormHitDto } from '../types'
import { VerbRow } from './LevelGroup'
import type { SectionMyVerbDto } from './types'

// «Мои глаголы»: то, что человек перевёл или сохранил сам — в боте или в словаре, — и глаголы, с
// которыми он уже играл. Глагол, который стоит ещё и в уровне, здесь не дублируется как отдельная
// сущность: это тот же глагол, с тем же прогрессом, просто ещё один путь к нему.

/** Сколько строк видно сразу; остальные — за «Показать все». */
const SHOWN = 3

type AddState =
  | { kind: 'idle' }
  | { kind: 'busy'; verbLookup: boolean }
  | { kind: 'note'; text: string }

interface Props {
  verbs: SectionMyVerbDto[]
  examples: string[]
  hasAccess: boolean
  /** Знакомство с разделом подсвечивает первую строку и поле с примерами. */
  tourRow?: boolean
  tourAdd?: boolean
  onOpen: (verb: SectionMyVerbDto) => void
  /** Нет доступа: вместо действия — экран оплаты. */
  onNeedAccess: () => void
  /** Перевод нашёл глагол — раздел перечитывает данные и решает, праздновать ли. */
  onAdded: (hit: VerbFormHitDto) => void
}

export default function MyVerbs({ verbs, examples, hasAccess, tourRow, tourAdd, onOpen, onNeedAccess, onAdded }: Props) {
  const empty = verbs.length === 0
  const [all, setAll] = useState(false)
  const [adding, setAdding] = useState(false)
  const [word, setWord] = useState('')
  const [state, setState] = useState<AddState>({ kind: 'idle' })
  const showAdd = empty || adding || !!tourAdd
  useEffect(() => { if (tourAdd) setAdding(true) }, [tourAdd])

  async function add(text: string) {
    const value = text.trim()
    if (!value || state.kind === 'busy') return
    if (!hasAccess) { onNeedAccess(); return }
    setState({ kind: 'busy', verbLookup: false })
    try {
      const r = await api.translateWord(value, verbLookup => setState({ kind: 'busy', verbLookup }))
      if ((r.status === 'success' || r.status === 'exists') && r.verb) {
        setWord('')
        setState({ kind: 'idle' })
        onAdded(r.verb)
      } else if (r.status === 'success' || r.status === 'exists') {
        setState({ kind: 'note', text: `«${value}» — похоже, не глагол. Слово сохранил в словаре.` })
      } else if (r.status === 'not_a_word') {
        setState({ kind: 'note', text: 'Не понял это слово. Напиши глагол по-русски: «петь», «ждать».' })
      } else if (r.status === 'timeout') {
        setState({ kind: 'note', text: 'Ищу дольше обычного. Загляни чуть позже — глагол появится здесь сам.' })
      } else {
        setState({ kind: 'note', text: 'Не получилось перевести. Попробуй ещё раз.' })
      }
    } catch {
      setState({ kind: 'note', text: 'Не получилось перевести. Попробуй ещё раз.' })
    }
  }

  const shown = all ? verbs : verbs.slice(0, SHOWN)
  return (
    <section data-testid="verbs-mine">
      <div className="flex items-center gap-3 px-1 pb-2">
        <div className="mn-eyebrow">мои глаголы</div>
        <div className="flex-1 h-px bg-jewelInk/15" />
        {!empty && <div className="text-[11px] font-semibold text-jewelInk-mid tabular-nums">{verbs.length}</div>}
      </div>

      {empty && (
        <div className="px-1 pb-2 text-[13px] text-jewelInk-mid" data-testid="verbs-mine-empty">
          Здесь появятся глаголы, которые ты переведёшь сам — в боте или в словаре.
        </div>
      )}

      {!empty && (
        <div className="flex flex-col gap-1.5" role="list">
          {shown.map((verb, i) => (
            <VerbRow
              key={verb.id ?? i} verb={{ ...verb, due: 0 }} onOpen={() => onOpen(verb)} tour={tourRow && i === 0}
              note={(verb.generated || verb.levelId) && (
                <span className="block mt-0.5 text-[10px] text-jewelInk-hint leading-tight">
                  {verb.levelId ? `уровень ${verb.levelId}` : null}
                  {verb.generated && <span data-testid="verbs-mine-generated">собран автоматически</span>}
                </span>
              )}
            />
          ))}
          {verbs.length > SHOWN && !all && (
            <button onClick={() => setAll(true)} className="min-h-[44px] text-[13px] text-navy underline" data-testid="verbs-mine-all">
              Показать все {verbs.length}
            </button>
          )}
        </div>
      )}

      {!showAdd && (
        <button onClick={() => setAdding(true)} className="mt-1 min-h-[44px] w-full text-[13px] font-bold text-navy" data-testid="verbs-mine-add-open">
          + Добавить свой глагол
        </button>
      )}

      {showAdd && (
        <div className={`${empty ? '' : 'mt-2'} rounded-xl`} data-tour="mine-add" data-testid="verbs-mine-add">
          <form className="flex gap-2" onSubmit={e => { e.preventDefault(); void add(word) }}>
            <input
              value={word} onChange={e => setWord(e.target.value)} disabled={state.kind === 'busy'}
              placeholder="Введи любой глагол по-русски" aria-label="Введи любой глагол по-русски" maxLength={40}
              className="flex-1 min-w-0 min-h-[48px] px-3 rounded-xl bg-cream-tile border-[1.5px] border-jewelInk text-[15px] text-jewelInk placeholder:text-jewelInk-hint"
            />
            <button
              type="submit" disabled={state.kind === 'busy' || !word.trim()} aria-label="Перевести"
              className="shrink-0 w-12 min-h-[48px] rounded-xl bg-navy border-[1.5px] border-jewelInk flex items-center justify-center disabled:opacity-50"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M5 12h13M12 6l6 6-6 6" stroke="#FDFAEF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </form>
          {examples.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-[12px] text-jewelInk-hint">например:</span>
              {examples.map(example => (
                <button
                  key={example} onClick={() => void add(example)} disabled={state.kind === 'busy'} data-testid="verbs-example"
                  className="min-h-[36px] px-3 rounded-full bg-gold-wash border border-jewelInk/50 text-[13px] font-bold text-jewelInk disabled:opacity-50"
                >
                  {example}
                </button>
              ))}
            </div>
          )}
          {state.kind === 'busy' && (
            <div className="mt-2 text-[12px] text-jewelInk-mid" role="status" data-testid="verbs-mine-busy">
              {state.verbLookup ? 'Ищу этот глагол, это может занять до минуты…' : 'Перевожу…'}
            </div>
          )}
          {state.kind === 'note' && <div className="mt-2 text-[12px] text-jewelInk-mid" role="status" data-testid="verbs-mine-note">{state.text}</div>}
        </div>
      )}
    </section>
  )
}
