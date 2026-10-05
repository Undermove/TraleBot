import React, { useEffect, useState } from 'react'
import LoaderLetter from '../components/LoaderLetter'
import { fetchVerb } from '../api'
import { CARD_TENSES, KINDS, PERSONS, RARE_TENSES, TENSES, TITLE_TERM, cyr, type TenseKey, type VerbDto, type VerbFormHitDto } from './types'
import { meaningOf, meaningOfHit } from './meaning'
import { Coach, KindChip, MeaningText, VerbForm } from './parts'
import { OVERLAY, useOverlay } from './ui/overlayStack'
import SessionEntry from './session/SessionEntry'

interface Props {
  verbId: string
  /** Форма, с которой пришли: карточка откроется на её лице и подсветит строку. */
  highlight?: { tense: string; person: number }
  onClose: () => void
  /**
   * Пришли из словаря, с записи, которая сама — форма этого глагола: вид начинается с сохранённого
   * слова, а действия со словом (в квиз, удалить) стоят внизу, тихо.
   */
  entry?: VerbEntry
}

export interface VerbEntry {
  hit: VerbFormHitDto
  /** Что человек сохранил как перевод. */
  russian: string
  selected: boolean
  onToggleSelect: () => void
  /** Удалить запись из словаря; вид после этого закрывается. */
  onDelete: () => Promise<void>
}

const HINT_KEY = 'verb_card_person_hint_seen'

/**
 * Карточка глагола шторкой поверх любого экрана: словаря, урока, квиза.
 * Не растёт в высоту: лицо переключается в шапке таблицы, редкие времена и пояснение
 * про тип глагола свёрнуты.
 */
export default function VerbSheet({ verbId: initialVerbId, highlight: initialHighlight, onClose, entry: initialEntry }: Props) {
  const [verbId, setVerbId] = useState(initialVerbId)
  // Подсветка относится только к глаголу, с которого пришли; у глагола-образца её нет.
  const highlight = verbId === initialVerbId ? initialHighlight : undefined
  const entry = verbId === initialVerbId ? initialEntry : undefined
  const [deleting, setDeleting] = useState<'no' | 'ask' | 'busy' | 'failed'>('no')
  const [verb, setVerb] = useState<VerbDto | null>(null)
  const [failed, setFailed] = useState(false)
  const [person, setPerson] = useState(initialHighlight?.person ?? 0)
  const [rare, setRare] = useState(!!initialHighlight && RARE_TENSES.includes(initialHighlight.tense as TenseKey))
  const [why, setWhy] = useState(false)
  const [visible, setVisible] = useState(false)
  const [hint, setHint] = useState(() => {
    try { return !localStorage.getItem(HINT_KEY) } catch { return false }
  })

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  useEffect(() => {
    setVerb(null); setFailed(false); setWhy(false)
    fetchVerb(verbId).then(setVerb).catch(() => setFailed(true))
  }, [verbId])

  function close() {
    setVisible(false)
    setTimeout(onClose, 220)
  }

  useOverlay(close, OVERLAY.sheet)

  function pickPerson(p: number) {
    setPerson(p)
    if (hint) {
      try { localStorage.setItem(HINT_KEY, '1') } catch {}
      setHint(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col justify-end"
      data-testid="verb-sheet"
      onClick={e => { if (e.target === e.currentTarget) close() }}
      style={{ background: `rgba(21,16,10,${visible ? '0.4' : '0'})`, transition: 'background 200ms ease' }}
    >
      <div
        className="bg-cream rounded-t-2xl border-t-2 border-x-2 border-jewelInk max-h-[92dvh] overflow-y-auto w-full max-w-[480px] mx-auto"
        style={{
          boxShadow: '0 -4px 0 #15100A',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: visible ? 'transform 300ms ease-out' : 'transform 220ms ease-in'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-8 h-1 bg-jewelInk/20 rounded-full mx-auto mt-3 mb-3" />
        {failed && <div className="px-6 py-12 text-center text-[14px] text-jewelInk-mid">Не получилось загрузить глагол.</div>}
        {!failed && !verb && <div className="flex items-center justify-center py-16"><LoaderLetter size={96} /></div>}
        {/* Вызов, а не <Body />: иначе при каждой перерисовке шторки тело монтируется заново и открытая игра сбрасывается. */}
        {verb && Body()}
      </div>
    </div>
  )

  function Body() {
    if (!verb) return null
    // У неполных глаголов («хотеть», «знать») части времён нет вовсе: такие строки не рисуем прочерками.
    const has = (t: TenseKey) => !!verb.tenses[t]?.some(variants => variants.length)
    const mainTenses = CARD_TENSES.filter(has)
    const rareTenses = RARE_TENSES.filter(has)

    const rows = (tenses: TenseKey[]) =>
      tenses.map(t => {
        const odd = verb.oddTenses.includes(t)
        const hit = highlight?.tense === t && highlight.person === person
        return (
          <div
            key={t}
            data-testid={`verb-tense-${t}`}
            className={`flex items-center justify-between gap-3 px-4 py-2.5 border-t border-cream-edge ${hit ? 'bg-gold-wash' : odd ? 'bg-ruby-wash/60' : ''}`}
          >
            {/* Слева — что форма значит по-русски («я пишу»); название времени простыми словами — мелко под ней. */}
            <span className="min-w-0">
              {verb.meanings?.[t] ? (
                <>
                  <span className="block text-[14px] font-bold text-jewelInk"><MeaningText meaning={{ ...meaningOf(verb, t, person), note: null }} /></span>
                  <span className="block text-[11px] text-jewelInk-hint">{TENSES[t].name}</span>
                </>
              ) : (
                <span className="block text-[13px] font-bold text-jewelInk">{TENSES[t].name}</span>
              )}
            </span>
            <VerbForm variants={verb.tenses[t]?.[person] ?? []} big root={verb.root} />
          </div>
        )
      })
    return (
      <div className="px-5 flex flex-col gap-4" style={{ paddingBottom: 'calc(var(--safe-b) + 20px)' }}>
          <div className="text-center pt-2">
            {entry ? (
              // Сначала то, что человек сохранил: слово, что оно значит, от какого оно глагола.
              <div data-testid="verb-entry">
                <div className="mn-eyebrow text-navy">в твоём словаре · глагол</div>
                <div className="mt-1 font-geo text-[36px] font-extrabold leading-none">{entry.hit.form}</div>
                <div className="mt-1 text-[14px] text-jewelInk-hint">{cyr(entry.hit.form)}</div>
                <div className="mt-2 text-[20px] font-extrabold text-navy" data-testid="verb-entry-meaning">
                  <MeaningText meaning={meaningOfHit(entry.hit)} />
                </div>
                {entry.russian && entry.russian.trim().toLowerCase() !== meaningOfHit(entry.hit).text.toLowerCase() && (
                  <div className="text-[12px] text-jewelInk-hint" data-testid="verb-entry-saved">у тебя записано: {entry.russian}</div>
                )}
                <div className="mt-1 text-[13px] text-jewelInk-mid">
                  это слово глагола <span className="font-geo font-bold text-jewelInk">{verb.title}</span> — {verb.ru}
                </div>
              </div>
            ) : (
              <>
                <div className="mn-eyebrow text-navy">ზმნა · глагол</div>
                <div className="mt-1 font-geo text-[36px] font-extrabold leading-none">{verb.title}</div>
                <div className="mt-1 text-[14px] text-jewelInk-hint">{cyr(verb.title)} · {verb.ru}</div>
              </>
            )}
            <button onClick={() => setWhy(!why)} className="mt-2 inline-flex items-center gap-1.5">
              <KindChip kind={verb.kind} />
              <span className="text-[12px] text-navy underline">{why ? 'скрыть' : 'что это значит?'}</span>
            </button>
            {verb.status === 'generated' && (
              <div data-testid="verb-unverified" className="mt-2 mx-auto max-w-[300px] rounded-lg border border-jewelInk/40 bg-gold-wash px-3 py-1.5 text-[12px] text-jewelInk-soft">
                Не проверено: в Викисловаре таблицы этого глагола нет, формы составила нейросеть. Могут быть ошибки.
              </div>
            )}
          </div>

          {why && (
            <div className={`rounded-xl border border-jewelInk/40 p-3 ${KINDS[verb.kind].chip}`}>
              <div className="text-[13px] text-jewelInk-soft">{verb.reason}</div>
              {verb.kind !== 'special' && verb.root && (
                <div className="mt-1 text-[12px] text-jewelInk-mid">
                  Корень <span className="font-geo font-bold">{verb.root}</span> — чёрным,{' '}
                  <span className="text-navy font-bold">приставки</span> и{' '}
                  <span className="text-ruby font-bold">окончания</span> цветом.
                </div>
              )}
              {verb.kind === 'special' && (
                <div className="mt-1 text-[12px] text-jewelInk-mid">Розовые строки — там, где корень не тот, что в настоящем.</div>
              )}
              {verb.model && (
                <button
                  onClick={() => setVerbId(verb.model!.id)}
                  className="mt-1 text-[12px] text-navy underline"
                >
                  {verb.kind === 'pattern' ? 'Спрягается как' : 'Сравни с образцом:'}{' '}
                  <span className="font-geo font-bold">{verb.model.title}</span> ({verb.model.ru})
                </button>
              )}
              <div className="mt-2 text-[12px] text-jewelInk-mid">
                <span className="font-geo font-bold">{verb.title}</span> — название действия, как «чтение» или «ходьба».
                В грузинском оно вместо начальной формы глагола
                {verb.masdarWithPreverb.length > 0 && (
                  <>. С приставкой: <span className="font-geo">{verb.masdarWithPreverb.join(', ')}</span></>
                )}.
              </div>
              {/* Учебные термины — только здесь, в свёрнутом пояснении: в таблице и заданиях их нет. */}
              <div className="mt-2 text-[11px] text-jewelInk-hint" data-testid="verb-terms">
                В учебниках это называется так: название действия — {TITLE_TERM};{' '}
                {mainTenses.map(t => `«${TENSES[t].name}» — ${TENSES[t].term}`).join('; ')}.
              </div>
            </div>
          )}

          <SessionEntry verb={verb} />

          {hint && <Coach>Это главные формы. Нажми «ты» или «он» — таблица покажет те же времена для другого лица.</Coach>}

          <div
            className="rounded-xl bg-cream-tile border-[1.5px] border-jewelInk overflow-hidden"
            style={{ boxShadow: '3px 3px 0 #15100A' }}
          >
            <div className="p-1.5 bg-navy flex gap-1">
              {PERSONS.map((p, i) => (
                <button
                  key={p}
                  data-testid={`verb-person-${i}`}
                  onClick={() => pickPerson(i)}
                  className={`flex-1 h-8 rounded-md text-[12px] font-bold ${person === i ? 'bg-cream text-jewelInk' : 'text-cream/80'} ${hint && i === 1 ? 'ring-4 ring-gold animate-pulse' : ''}`}
                >
                  {p}
                </button>
              ))}
            </div>
            {rows(mainTenses)}
            {mainTenses.length < CARD_TENSES.length && (
              <div data-testid="verb-partial" className="px-4 py-2 border-t border-cream-edge text-[11px] text-jewelInk-hint">
                У этого глагола не все времена: {CARD_TENSES.filter(t => !has(t)).map(t => TENSES[t].name.toLowerCase()).join(', ')} — таких форм в базе нет.
              </div>
            )}
            {rareTenses.length > 0 && (
              <button
                onClick={() => setRare(!rare)}
                data-testid="verb-rare-toggle"
                className="w-full flex items-center justify-between px-4 py-2.5 border-t border-cream-edge text-left bg-cream-deep/60"
              >
                <span>
                  <span className="block text-[12px] font-bold text-jewelInk-mid">Редкие формы · {rareTenses.length}</span>
                  {!rare && <span className="block text-[11px] text-jewelInk-hint">понадобятся позже, сейчас можно не открывать</span>}
                </span>
                <span className="text-jewelInk-hint text-[18px]">{rare ? '−' : '+'}</span>
              </button>
            )}
            {rare && rows(rareTenses)}
          </div>

          {entry && (
            <div className="flex flex-col items-center gap-1 text-[13px]" data-testid="verb-entry-actions">
              {deleting === 'no' || deleting === 'failed' ? (
                <div className="flex items-center gap-5">
                  <button className="min-h-[44px] text-navy underline" onClick={() => { entry.onToggleSelect(); close() }}>
                    {entry.selected ? 'Убрать из квиза' : 'Добавить в квиз'}
                  </button>
                  <button className="min-h-[44px] text-jewelInk-mid underline" onClick={() => setDeleting('ask')}>Удалить из словаря</button>
                </div>
              ) : (
                <div className="flex items-center gap-5">
                  <span className="text-jewelInk-mid">Удалить «{entry.hit.form}»?</span>
                  <button
                    className="min-h-[44px] font-bold text-ruby underline" disabled={deleting === 'busy'}
                    onClick={() => { setDeleting('busy'); entry.onDelete().then(close).catch(() => setDeleting('failed')) }}
                  >Удалить</button>
                  <button className="min-h-[44px] text-navy underline" onClick={() => setDeleting('no')}>Отмена</button>
                </div>
              )}
              {deleting === 'failed' && <div className="text-[12px] text-ruby">Не удалось удалить. Попробуй ещё раз.</div>}
              <div className="text-[11px] text-jewelInk-hint text-center">Прогресс по глаголу при удалении слова не пропадёт.</div>
            </div>
          )}

          {verb.source && (
            <a href={verb.source} target="_blank" rel="noreferrer" className="text-[12px] text-navy underline text-center">
              Источник форм: Викисловарь (CC BY-SA)
            </a>
          )}
      </div>
    )
  }
}
