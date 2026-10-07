import { useState } from 'react'
import {
  adminVerbs, ApiError, type MissingTenseDto, type ModelMadeVerbDto, type RegenerateVerbDto, type UnverifiedTenseDto
} from '../../api'
import { PERSONS, TENSES, cyr, type TenseKey } from '../../verbs/types'

// Глаголы, которые составила нейросеть: сколько из шести основных времён у каждого есть, сколько из них
// проверено и почему остальных нет. Непроверенное время ученики видят в карточке с пометкой, а в играх
// его нет, пока владелец не подтвердит его, не исправит руками или не уберёт. Бедную запись можно
// пересобрать: сервер заменит её, только если новая одобрена и не беднее прежней; прогресс учеников остаётся.
// Список грузится по нажатию: экран не тяжелеет.

const button = 'min-h-[44px] px-3 rounded border-[1.5px] border-jewelInk font-sans text-[13px] font-extrabold disabled:opacity-50'
const quiet = 'min-h-[44px] px-2 font-sans text-[13px] font-bold text-navy underline disabled:opacity-50'
const small = 'font-sans text-[12px] text-jewelInk-mid'

const KEPT: Record<string, string> = {
  'fewer-tenses': 'новая запись вышла беднее',
  'not-approved': 'проверяющая модель не одобрила новую запись',
  'another-verb': 'модель составила другой глагол',
  'not-a-verb': 'модель не взялась за этот глагол',
  failed: 'модель не ответила'
}

const WHY: Record<MissingTenseDto['why'], string> = {
  'verb-lacks-it': 'у глагола его нет',
  'not-sure': 'модель не уверена',
  'removed-by-owner': 'убрано вручную'
}

const tenseName = (tense: string) => TENSES[tense as TenseKey]?.name ?? tense

function why(m: MissingTenseDto): string {
  return `${tenseName(m.tense)} — ${WHY[m.why] ?? m.why}${m.reviewerDisagrees ? ', проверяющая считает, что есть' : ''}`
}

function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 429) return 'дневной лимит составления глаголов исчерпан'
    if (e.status === 409) return 'этот глагол менять нельзя'
    if (e.status === 400) return 'в каждой клетке — одно слово грузинскими буквами'
    return `ошибка ${e.status}`
  }
  // Запрос идёт до пары минут, связь может оборваться раньше; сервер работу не бросает.
  return 'связь оборвалась, пересборка продолжается — обнови список через минуту'
}

function resultText(r: RegenerateVerbDto): string {
  return r.outcome === 'replaced'
    ? `готово: было ${r.mainTensesBefore} из 6, стало ${r.mainTensesAfter} из 6` +
      (r.changedForms?.length ? `; изменилось форм: ${r.changedForms.length}` : '')
    : `оставлена прежняя запись: ${KEPT[r.reason ?? ''] ?? 'новая не подошла'}`
}

interface TenseProps {
  tense: UnverifiedTenseDto
  busy: boolean
  /** Выполнить действие над временем и сказать, что вышло. */
  act: (run: () => Promise<{ progressReset: number }>, done: string) => void
  lemma: string
}

/** Одно непроверенное время: шесть форм с транскрипцией и отметкой «есть в текстах», и что с ним сделать. */
function TenseReview({ tense: t, busy, act, lemma }: TenseProps) {
  const [cells, setCells] = useState<string[] | null>(null)
  const [removing, setRemoving] = useState(false)
  const found = t.inTexts.filter(x => x === true).length
  const known = t.inTexts.some(x => x !== null)

  return (
    <div data-testid={`tense-review-${t.tense}`} className="rounded border border-jewelInk/25 px-3 py-2 flex flex-col gap-1.5">
      <div className="font-sans text-[13px] font-extrabold text-jewelInk">
        {tenseName(t.tense)}
        <span className="font-normal text-jewelInk-mid">
          {known ? ` · в текстах ${found} из ${t.cells.filter(c => c).length}` : ''}
          {t.completed ? ' · дописано вторым кругом' : ''}
          {t.removedBefore ? ' · раньше убиралось вручную' : ''}
        </span>
      </div>
      {t.cells.map((cell, person) => (
        <div key={person} className="flex items-center gap-2">
          <span className="w-8 shrink-0 font-sans text-[12px] text-jewelInk-hint">{PERSONS[person]}</span>
          {cells ? (
            <input
              aria-label={`${tenseName(t.tense)}, ${PERSONS[person]}`}
              value={cells[person]}
              onChange={e => setCells(cells.map((c, i) => (i === person ? e.target.value : c)))}
              className="min-w-0 flex-1 min-h-[44px] px-2 rounded border-[1.5px] border-jewelInk/40 font-geo text-[16px]"
            />
          ) : (
            <span className="min-w-0 flex-1">
              <span className="font-geo text-[16px] font-bold text-jewelInk">{cell ?? '—'}</span>
              {cell && <span className="ml-2 font-sans text-[12px] text-jewelInk-hint">{cyr(cell)}</span>}
              {/* Вторая строка: что форма значит и нашлась ли она в настоящих текстах. */}
              <span className="block font-sans text-[11px] text-jewelInk-hint">
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
        <div className="flex flex-wrap gap-2">
          <button
            type="button" className={button} disabled={busy}
            onClick={() => act(
              () => adminVerbs.editTense(lemma, t.tense, cells.map(c => c.trim() || null)),
              `${tenseName(t.tense)}: исправлено и проверено`
            )}
          >Сохранить</button>
          <button type="button" className={quiet} onClick={() => setCells(null)}>Отмена</button>
        </div>
      ) : removing ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className={small}>Убрать время из глагола?</span>
          <button
            type="button" className={`${quiet} text-ruby`} disabled={busy}
            onClick={() => act(() => adminVerbs.removeTense(lemma, t.tense), `${tenseName(t.tense)}: убрано`)}
          >Убрать</button>
          <button type="button" className={quiet} onClick={() => setRemoving(false)}>Отмена</button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-x-2">
          <button
            type="button" className={button} disabled={busy}
            onClick={() => act(() => adminVerbs.confirmTense(lemma, t.tense), `${tenseName(t.tense)}: подтверждено, теперь есть в играх`)}
          >Подтвердить</button>
          <button type="button" className={quiet} disabled={busy} onClick={() => setCells(t.cells.map(c => c ?? ''))}>Исправить</button>
          <button type="button" className={quiet} disabled={busy} onClick={() => setRemoving(true)}>Убрать время</button>
        </div>
      )}
    </div>
  )
}

export default function ModelVerbsPanel() {
  const [verbs, setVerbs] = useState<ModelMadeVerbDto[] | null>(null)
  const [onlyUnverified, setOnlyUnverified] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  async function load(unverified = onlyUnverified) {
    setError(null)
    try {
      const { verbs } = await adminVerbs.modelMade(unverified)
      // Сверху те, у кого меньше всего проверенных времён: с ними и надо что-то делать.
      setVerbs([...verbs].sort((a, b) => a.verifiedMainTenses - b.verifiedMainTenses))
    } catch {
      setError('не получилось загрузить')
    }
  }

  async function run(lemma: string, pending: string, action: () => Promise<string>) {
    setBusy(lemma)
    setNotes(n => ({ ...n, [lemma]: pending }))
    let note: string
    try { note = await action() } catch (e) { note = errorText(e) }
    await load()
    setNotes(n => ({ ...n, [lemma]: note }))
    setBusy(null)
  }

  const regenerate = (lemma: string) =>
    run(lemma, 'пересобираю, это до пары минут…', async () => resultText(await adminVerbs.regenerate(lemma)))

  const review = (lemma: string) => (action: () => Promise<{ progressReset: number }>, done: string) =>
    run(lemma, 'сохраняю…', async () => {
      const { progressReset } = await action()
      return done + (progressReset ? `; у учеников сброшен прогресс по изменённым формам: ${progressReset}` : '')
    })

  return (
    <div className="mb-5">
      <div className="mn-eyebrow mb-2">Глаголы от нейросети</div>
      <div className="jewel-tile px-4 py-4">
        <div className="relative z-[1] flex flex-col gap-3">
          {verbs === null ? (
            <button type="button" className={button} onClick={() => load()}>Показать список</button>
          ) : (
            <label className="flex items-center gap-2 min-h-[44px] font-sans text-[13px] text-jewelInk">
              <input
                type="checkbox" checked={onlyUnverified}
                onChange={e => { setOnlyUnverified(e.target.checked); load(e.target.checked) }}
              />
              есть непроверенные времена
            </label>
          )}
          {error && <div className={small}>{error}</div>}
          {verbs?.length === 0 && <div className={small}>{onlyUnverified ? 'Непроверенных времён нет.' : 'Пока ни одного.'}</div>}
          {verbs?.map(v => (
            <div key={v.lemma} data-testid={`model-verb-${v.lemma}`} className="flex flex-col gap-1 border-b border-jewelInk/15 pb-3 last:border-0 last:pb-0">
              <div className="font-sans text-[14px] font-bold text-jewelInk">«{v.lemma}» — {v.translation}</div>
              <div className={`font-sans text-[12px] font-extrabold tabular-nums ${v.verifiedMainTenses < 6 ? 'text-ruby' : 'text-jewelInk-mid'}`}>
                {v.mainTenses} из 6 времён, проверено {v.verifiedMainTenses}
              </div>
              {v.missingTenses.map(m => (
                <div key={m.tense} className={small}>нет: {why(m)}{m.note ? ` («${m.note}»)` : ''}</div>
              ))}
              {v.learners > 0 && <div className={small}>учат: {v.learners}</div>}
              {notes[v.lemma] && <div className="font-sans text-[12px] text-jewelInk">{notes[v.lemma]}</div>}
              <div className="flex flex-wrap gap-x-2">
                {v.unverifiedTenses.length > 0 && (
                  <button type="button" className={button} onClick={() => setOpen(open === v.lemma ? null : v.lemma)}>
                    {open === v.lemma ? 'Свернуть' : `Проверить времена · ${v.unverifiedTenses.length}`}
                  </button>
                )}
                <button type="button" className={v.unverifiedTenses.length > 0 ? quiet : button} disabled={busy !== null} onClick={() => regenerate(v.lemma)}>
                  Пересобрать
                </button>
              </div>
              {open === v.lemma && v.unverifiedTenses.length > 0 && (
                <div className="flex flex-col gap-2 mt-1">
                  {v.reviewerReasons.length > 0 && (
                    <div className={small}>Проверяющая модель: {v.reviewerReasons.join(' ')}</div>
                  )}
                  {v.unverifiedTenses.map(t => (
                    <TenseReview key={t.tense} tense={t} lemma={v.lemma} busy={busy !== null} act={review(v.lemma)} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
