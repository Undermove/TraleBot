import { useState } from 'react'
import { adminVerbs, ApiError, type MissingTenseDto, type ModelMadeVerbDto, type RegenerateVerbDto } from '../../api'
import { TENSES, type TenseKey } from '../../verbs/types'

// Глаголы, которые составила нейросеть: сколько из шести основных времён у каждого есть и почему
// остальных нет. Бедную запись можно пересобрать — сервер заменит её, только если новая одобрена
// и не беднее прежней; прогресс учеников остаётся. Список грузится по нажатию: экран не тяжелеет.

const button = 'min-h-[44px] px-3 rounded border-[1.5px] border-jewelInk font-sans text-[13px] font-extrabold disabled:opacity-50'

const KEPT: Record<string, string> = {
  'fewer-tenses': 'новая запись вышла беднее',
  'not-approved': 'проверяющая модель не одобрила новую запись',
  'another-verb': 'модель составила другой глагол',
  'not-a-verb': 'модель не взялась за этот глагол',
  failed: 'модель не ответила'
}

const tenseName = (tense: string) => TENSES[tense as TenseKey]?.name ?? tense

function why(m: MissingTenseDto): string {
  const said = m.why === 'verb-lacks-it' ? 'у глагола его нет' : 'модель не уверена'
  return `${tenseName(m.tense)} — ${said}${m.reviewerDisagrees ? ', проверяющая считает, что есть' : ''}`
}

function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 429) return 'дневной лимит составления глаголов исчерпан'
    if (e.status === 409) return 'этот глагол пересобрать нельзя'
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

export default function ModelVerbsPanel() {
  const [verbs, setVerbs] = useState<ModelMadeVerbDto[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setError(null)
    try {
      const { verbs } = await adminVerbs.modelMade()
      // Бедные записи сверху: их и надо пересобирать.
      setVerbs([...verbs].sort((a, b) => a.mainTenses - b.mainTenses))
    } catch {
      setError('не получилось загрузить')
    }
  }

  async function regenerate(lemma: string) {
    setBusy(lemma)
    setNotes(n => ({ ...n, [lemma]: 'пересобираю, это до пары минут…' }))
    let note: string
    try { note = resultText(await adminVerbs.regenerate(lemma)) } catch (e) { note = errorText(e) }
    await load()
    setNotes(n => ({ ...n, [lemma]: note }))
    setBusy(null)
  }

  return (
    <div className="mb-5">
      <div className="mn-eyebrow mb-2">Глаголы от нейросети</div>
      <div className="jewel-tile px-4 py-4">
        <div className="relative z-[1] flex flex-col gap-3">
          {verbs === null && (
            <button type="button" className={button} onClick={load}>Показать список</button>
          )}
          {error && <div className="font-sans text-[12px] text-jewelInk-mid">{error}</div>}
          {verbs?.length === 0 && <div className="font-sans text-[12px] text-jewelInk-mid">Пока ни одного.</div>}
          {verbs?.map(v => (
            <div key={v.lemma} data-testid={`model-verb-${v.lemma}`} className="flex flex-col gap-1 border-b border-jewelInk/15 pb-3 last:border-0 last:pb-0">
              <div className="flex items-baseline justify-between gap-2">
                <div className="font-sans text-[14px] font-bold text-jewelInk">«{v.lemma}» — {v.translation}</div>
                <div className={`font-sans text-[12px] font-extrabold tabular-nums ${v.mainTenses < 6 ? 'text-ruby' : 'text-jewelInk-mid'}`}>
                  {v.mainTenses} из 6 времён
                </div>
              </div>
              {v.missingTenses.map(m => (
                <div key={m.tense} className="font-sans text-[12px] text-jewelInk-mid">нет: {why(m)}</div>
              ))}
              {v.learners > 0 && <div className="font-sans text-[12px] text-jewelInk-mid">учат: {v.learners}</div>}
              {notes[v.lemma] && <div className="font-sans text-[12px] text-jewelInk">{notes[v.lemma]}</div>}
              <button type="button" className={`${button} self-start`} disabled={busy !== null} onClick={() => regenerate(v.lemma)}>
                Пересобрать
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
