import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import LoaderLetter from '../components/LoaderLetter'
import { fetchVerb } from '../api'
import { CARD_TENSES, KINDS, PERSONS, RARE_TENSES, TENSES, TITLE_TERM, cyr, type TenseKey, type VerbDto, type VerbFormHitDto } from './types'
import { meaningOf, meaningOfHit } from './meaning'
import { Coach, MeaningText, VerbForm } from './parts'
import { OVERLAY, useOverlay } from './ui/overlayStack'
import { hintSeen, markHintSeen } from './ui/hints'
import { useSheetDrag } from './ui/useSheetDrag'
import SessionEntry from './session/SessionEntry'
import FormsTable from './FormsTable'
import FamilyNote from './family/FamilyNote'
import ConfusableNote, { ConfusableIcon } from './ConfusableNote'
import DirectionGlyph from './family/DirectionGlyph'
import { TOWARD_RU } from './family/types'
import WhoWhomSheet from './whoWhom/WhoWhomSheet'
import { hasWhoWhom } from './whoWhom/logic'

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

/** Как значок называет тип глагола: «по образцу» — с образцом рядом. */
const KIND_TRAIT: Record<VerbDto['kind'], string> = { pattern: 'по образцу', feature: 'с особенностью', special: 'особый' }

/** По образцу — две одинаковые карточки; с особенностью — карточка с меткой; особый — зигзаг. */
function KindIcon({ kind }: { kind: VerbDto['kind'] }) {
  const common = { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  if (kind === 'pattern') return <svg {...common}><rect x="2" y="4.5" width="8" height="9" rx="1.5" /><path d="M6 2.5h6.5A1.5 1.5 0 0 1 14 4v7" /></svg>
  if (kind === 'feature') return <svg {...common}><rect x="2" y="3" width="10" height="11" rx="1.5" /><path d="M12.5 1.5v3M11 3h3" /></svg>
  return <svg {...common}><path d="M9.5 1.5 4 9h4l-1.5 5.5L12 7H8l1.5-5.5Z" /></svg>
}

/** Две встречные стрелки: «я → тебя», «ты → меня». */
function WhoWhomIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 5.5h10M9.5 3l2.5 2.5L9.5 8" />
      <path d="M14 10.5H4M6.5 8 4 10.5 6.5 13" />
    </svg>
  )
}

/** Подсказка «нажми „ты“ или „он“» — один раз; отметка хранится на сервере (ui/hints.ts). */
const PERSON_HINT = 'verb_card_person'

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
  const initialRare = !!initialHighlight && RARE_TENSES.includes(initialHighlight.tense as TenseKey)
  const [why, setWhy] = useState(false)
  const [whoWhom, setWhoWhom] = useState(false)
  // Не сбрасывается при переходе по семье: открыл направления — ходишь по ним, панель остаётся.
  const [familyOpen, setFamilyOpen] = useState(false)
  const [confusableOpen, setConfusableOpen] = useState(false)
  const [visible, setVisible] = useState(false)
  const [hint, setHint] = useState(() => !hintSeen(PERSON_HINT))

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
  const panel = useRef<HTMLDivElement>(null)
  const drag = useSheetDrag(panel, close)

  function pickPerson(p: number) {
    setPerson(p)
    if (hint) {
      markHintSeen(PERSON_HINT)
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
        ref={panel}
        data-testid="verb-sheet-panel"
        className="bg-cream rounded-t-2xl border-t-2 border-x-2 border-jewelInk max-h-[92dvh] overflow-y-auto overscroll-contain w-full max-w-[480px] mx-auto"
        style={{
          boxShadow: '0 -4px 0 #15100A',
          transform: visible ? `translateY(${drag.offset}px)` : 'translateY(100%)',
          transition: drag.dragging ? 'none' : visible ? 'transform 300ms ease-out' : 'transform 220ms ease-in'
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

    return (
      <div className="px-5 flex flex-col gap-4" style={{ paddingBottom: 'calc(var(--safe-b) + 20px)' }}>
          <div className="text-center pt-2">
            {entry ? (
              // Сначала то, что человек сохранил: слово, что оно значит, от какого оно глагола.
              <div data-testid="verb-entry">
                <div className="font-geo text-[36px] font-extrabold leading-none">{entry.hit.form}</div>
                <div className="mt-1 text-[13px] text-jewelInk-hint">{cyr(entry.hit.form)}</div>
                <div className="mt-2 text-[20px] font-extrabold text-navy" data-testid="verb-entry-meaning">
                  <MeaningText meaning={{ ...meaningOfHit(entry.hit), note: null }} />
                </div>
                <div className="mt-1 text-[13px] text-jewelInk-mid">
                  глагол <span className="font-geo font-bold text-jewelInk">{verb.title}</span> — {verb.ru}
                </div>
              </div>
            ) : (
              <>
                <div className="font-geo text-[36px] font-extrabold leading-none">{verb.title}</div>
                <div className="mt-1 text-[13px] text-jewelInk-hint">{cyr(verb.title)}</div>
                {/* Пара, как «делать / сделать»: учителя и словари часто называют форму с приставкой —
                    её должно быть видно сразу, а не в пояснении. */}
                {verb.masdarWithPreverb.length > 0 && (
                  <div className="mt-2 text-[13px] text-jewelInk-mid" data-testid="verb-preverb-masdar">
                    с приставкой:{' '}
                    {verb.masdarWithPreverb.map((m, i) => (
                      <React.Fragment key={m}>
                        {i > 0 && ', '}
                        <span className="font-geo text-[17px] font-extrabold text-jewelInk">{m}</span>{' '}
                        <span className="text-jewelInk-hint">[{cyr(m)}]</span>
                      </React.Fragment>
                    ))}
                  </div>
                )}
                <div className="mt-2 text-[20px] font-extrabold text-navy">{verb.ru}</div>
              </>
            )}
            {/* Особенности глагола значками сразу под заголовком: что за глагол, видно до таблицы.
                Каждый значок раскрывает своё — как устроен, или правило «кто кого». */}
            <div className="mt-2.5 flex flex-wrap justify-center gap-1.5" data-testid="verb-traits">
              <button onClick={() => { setWhy(!why); setFamilyOpen(false); setConfusableOpen(false) }} data-testid="verb-why" aria-expanded={why}
                className={`jewel-pressable inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-jewelInk pl-2 pr-3 py-1 text-[12px] font-bold text-jewelInk ${KINDS[verb.kind].chip}`}
                style={{ boxShadow: '2px 2px 0 #15100A' }}>
                <KindIcon kind={verb.kind} />
                <span>{KIND_TRAIT[verb.kind]}{verb.kind === 'pattern' && verb.model && <> <span className="font-geo">{verb.model.title}</span></>}</span>
              </button>
              {verb.family && (
                <button onClick={() => { setFamilyOpen(!familyOpen); setWhy(false); setConfusableOpen(false) }} data-testid="verb-family-badge" aria-expanded={familyOpen}
                  className="jewel-pressable inline-flex items-center gap-1 rounded-full border-[1.5px] border-jewelInk bg-cream-tile pl-0.5 pr-3 py-0 text-[12px] font-bold text-jewelInk"
                  style={{ boxShadow: '2px 2px 0 #15100A' }}>
                  <DirectionGlyph direction={verb.family.role === 'member' ? verb.family.direction : 'none'} toward={verb.family.role === 'member' ? verb.family.toward : 'there'} size={28} />
                  <span>{verb.family.role === 'member' ? (verb.family.directionRu ? `${verb.family.directionRu}, ${TOWARD_RU[verb.family.toward]}` : TOWARD_RU[verb.family.toward]) : 'направления'}</span>
                </button>
              )}
              {verb.confusable && verb.confusable.length > 1 && (
                <button onClick={() => { setConfusableOpen(!confusableOpen); setWhy(false); setFamilyOpen(false) }} data-testid="verb-confusable-badge" aria-expanded={confusableOpen}
                  className="jewel-pressable inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-jewelInk bg-cream-tile pl-2 pr-3 py-1 text-[12px] font-bold text-jewelInk"
                  style={{ boxShadow: '2px 2px 0 #15100A' }}>
                  <ConfusableIcon />
                  не путать
                </button>
              )}
              {hasWhoWhom(verb) && (
                <button onClick={() => setWhoWhom(true)} data-testid="verb-who-whom-badge"
                  className="jewel-pressable inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-jewelInk bg-cream-tile pl-2 pr-3 py-1 text-[12px] font-bold text-navy"
                  style={{ boxShadow: '2px 2px 0 #15100A' }}>
                  <WhoWhomIcon />
                  кто кого
                </button>
              )}
            </div>
          </div>

          {/* Семья с приставками направления — по значку, на месте пояснения. */}
          {familyOpen && <>
            <FamilyNote verb={verb} onOpenVerb={setVerbId} show="member" />
            <FamilyNote verb={verb} onOpenVerb={setVerbId} show="base" />
          </>}
          {confusableOpen && <ConfusableNote verb={verb} onOpenVerb={id => { setConfusableOpen(false); setVerbId(id) }} />}
          {why && (
            <div data-testid="verb-why-panel" className={`text-left rounded-xl border border-jewelInk/40 p-3 ${KINDS[verb.kind].chip}`}>
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
                  <>. Форма с приставкой (<span className="font-geo">{verb.masdarWithPreverb.join(', ')}</span>) — то же действие, от неё обычно строятся будущее и прошедшее</>
                )}.
              </div>
              {/* Учебные термины — только здесь, в свёрнутом пояснении: в таблице и заданиях их нет. */}
              <div className="mt-2 text-[11px] text-jewelInk-hint" data-testid="verb-terms">
                В учебниках это называется так: название действия — {TITLE_TERM};{' '}
                {mainTenses.map(t => `«${TENSES[t].name}» — ${TENSES[t].term}`).join('; ')}.
              </div>
            </div>
          )}

          <SessionEntry verb={verb} onOpenVerb={setVerbId} />

          <FormsTable verb={verb} person={person} onPerson={pickPerson} highlight={highlight} initialRare={initialRare} pulsePerson={hint ? 1 : undefined} />

          {/* В body: шторка-родитель сдвинута transform'ом, внутри неё fixed поехал бы вместе с ней. */}
          {whoWhom && createPortal(<WhoWhomSheet verbId={verb.id} onClose={() => setWhoWhom(false)} />, document.body)}

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
          {verb.supplemented && verb.supplemented.length > 0 && (
            <div data-testid="verb-supplemented" className="text-[11px] text-jewelInk-hint text-center">
              {verb.supplemented.map(t => TENSES[t].name.toLowerCase()).join(', ')} — по грамматике, сверено с корпусами текстов
            </div>
          )}
          {/* Глагол, который составила одна модель и одобрила вторая: одна тихая строка, без предупреждений. */}
          {verb.status === 'generated' && (
            <div data-testid="verb-model-made" className="text-[11px] text-jewelInk-hint text-center">составлено нейросетью</div>
          )}
      </div>
    )
  }
}
