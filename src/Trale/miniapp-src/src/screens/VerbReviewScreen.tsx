import { useEffect, useMemo, useState } from 'react'
import Header from '../components/Header'
import LoaderLetter from '../components/LoaderLetter'
import TenseBlock from '../components/admin/TenseBlock'
import {
  day, inQueueOrder, matchesFilter, matchesSearch, missingText, needsAttention, rank, statusText, tenseName, type ReviewFilter
} from '../components/admin/verbReview'
import { adminVerbs, ApiError, type ModelMadeVerbDto, type RegenerateVerbDto } from '../api'
import { cyr } from '../verbs/types'
import { setInnerBack } from '../admin/adminNav'
import type { Screen } from '../types'

// Проверка глаголов, которые составила нейросеть, — отдельный экран владельца. Сервер отдаёт данные
// только владельцу; остальным экран не показывает ничего, кроме «нет доступа».
// Два вида: очередь (сначала то, что требует внимания) и один глагол на экран с переходом к
// следующему — чтобы пройти пачку подряд, не возвращаясь к списку.

interface Props {
  /** Открыть сразу этот глагол (ссылка ?screen=verb-review&verb=…). */
  lemma?: string
  navigate: (s: Screen) => void
}

const button = 'min-h-[48px] px-4 rounded border-[1.5px] border-jewelInk font-sans text-[14px] font-extrabold disabled:opacity-50'
const quiet = 'min-h-[48px] px-3 font-sans text-[14px] font-bold text-navy underline disabled:opacity-50'
const small = 'font-sans text-[12px] text-jewelInk-mid'
const navButton = 'min-h-[48px] px-1 font-sans text-[13px] font-bold text-navy underline whitespace-nowrap disabled:opacity-40'

const FILTERS: { id: ReviewFilter; name: string }[] = [
  { id: 'waiting', name: 'ждут' },
  { id: 'unverified', name: 'непроверенные времена' },
  { id: 'approved', name: 'проверены' },
  { id: 'all', name: 'все' }
]

const KEPT: Record<string, string> = {
  'fewer-tenses': 'новая запись вышла беднее',
  'not-approved': 'проверяющая модель не одобрила новую запись',
  'another-verb': 'модель составила другой глагол',
  'not-a-verb': 'модель не взялась за этот глагол',
  failed: 'модель не ответила'
}

function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 429) return 'дневной лимит составления глаголов исчерпан'
    if (e.status === 409) return 'этот глагол менять нельзя'
    if (e.status === 400) return 'в каждой клетке — одно слово грузинскими буквами'
    return `ошибка ${e.status}`
  }
  // Пересборка идёт до пары минут, связь может оборваться раньше; сервер работу не бросает.
  return 'связь оборвалась; если шла пересборка, она продолжается — обнови через минуту'
}

const rebuilt = (r: RegenerateVerbDto) =>
  r.outcome === 'replaced'
    ? `Пересобрано: было ${r.mainTensesBefore} из 6 времён, стало ${r.mainTensesAfter} из 6` +
      (r.changedForms?.length ? `; изменилось форм: ${r.changedForms.length}` : '')
    : `Оставлена прежняя запись: ${KEPT[r.reason ?? ''] ?? 'новая не подошла'}`

export default function VerbReviewScreen({ lemma, navigate }: Props) {
  const [verbs, setVerbs] = useState<ModelMadeVerbDto[] | null>(null)
  const [denied, setDenied] = useState(false)
  const [failed, setFailed] = useState(false)
  const [filter, setFilter] = useState<ReviewFilter>('waiting')
  const [search, setSearch] = useState('')
  // Пачка, по которой идём: порядок зафиксирован при входе в глагол, чтобы после действия он не «уехал».
  const [batch, setBatch] = useState<string[]>(lemma ? [lemma] : [])
  const [current, setCurrent] = useState<string | null>(lemma ?? null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [ask, setAsk] = useState<'approve-all' | 'rebuild-approved' | null>(null)
  const [notes, setNotes] = useState(false)

  async function load() {
    try {
      setVerbs(inQueueOrder((await adminVerbs.modelMade()).verbs))
      setFailed(false)
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 401 || e.status === 403)) setDenied(true)
      else setFailed(true)
    }
  }
  useEffect(() => { load() }, [])

  const queue = useMemo(
    () => (verbs ?? []).filter(v => matchesFilter(v, filter) && matchesSearch(v, search)),
    [verbs, filter, search])
  const verb = current ? verbs?.find(v => v.lemma === current) ?? null : null

  /** Действие над глаголом: данные обновляются на месте, экран не перерисовывается с нуля и не прыгает. */
  async function run(pending: string, action: () => Promise<string>) {
    setBusy(true)
    setNote(pending)
    setAsk(null)
    let text: string
    try { text = await action() } catch (e) { text = errorText(e) }
    await load()
    setNote(text)
    setBusy(false)
  }

  function open(target: string, list: string[]) {
    setBatch(list)
    setCurrent(target)
    setNote(null)
    setAsk(null)
    setNotes(false)
    window.scrollTo?.(0, 0)
  }

  const back = () => (current ? setCurrent(null) : navigate({ kind: 'admin' }))
  // Системное «Назад» Telegram из одного глагола возвращает к очереди, а не выходит из раздела.
  useEffect(() => {
    setInnerBack(current ? () => { setCurrent(null); return true } : null)
    return () => setInnerBack(null)
  }, [current])

  const body = () => {
    if (denied) return <div className="py-16 text-center font-sans text-[14px] text-jewelInk-mid" data-testid="verb-review-denied">Нет доступа.</div>
    if (failed && !verbs) return <div className="py-16 text-center font-sans text-[14px] text-jewelInk-mid">Не получилось загрузить. Попробуй ещё раз.</div>
    if (!verbs) return <div className="flex justify-center py-16"><LoaderLetter size={72} /></div>
    if (current) return verb ? verbView(verb) : <div className="py-16 text-center font-sans text-[14px] text-jewelInk-mid">Такого глагола от нейросети нет.</div>
    return queueView()
  }

  function queueView() {
    const waiting = verbs!.filter(needsAttention).length
    return (
      <div className="flex flex-col gap-3" data-testid="verb-review-queue">
        <div className="font-sans text-[13px] text-jewelInk-mid">
          Всего {verbs!.length} · ждут {waiting} · проверены {verbs!.length - waiting}
        </div>
        <input
          value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск: по-русски или по-грузински" aria-label="Поиск"
          className="w-full min-h-[48px] px-3 rounded border-[1.5px] border-jewelInk/40 bg-cream font-sans text-[14px] placeholder:text-jewelInk-hint"
        />
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(f => (
            <button
              key={f.id} type="button" onClick={() => setFilter(f.id)} aria-pressed={filter === f.id}
              className={`min-h-[44px] px-3 rounded-full border-[1.5px] font-sans text-[13px] font-bold ${filter === f.id ? 'bg-navy text-cream border-navy' : 'border-jewelInk/30 text-jewelInk'}`}
            >
              {f.name} · {verbs!.filter(v => matchesFilter(v, f.id)).length}
            </button>
          ))}
        </div>
        {queue.length === 0 && <div className={small}>{verbs!.length === 0 ? 'Глаголов от нейросети пока нет.' : 'Здесь пусто.'}</div>}
        {queue.map(v => (
          <button
            key={v.lemma} type="button" data-testid={`verb-review-row-${v.lemma}`}
            onClick={() => open(v.lemma, queue.map(q => q.lemma))}
            className="w-full min-h-[64px] px-3 py-2 rounded-lg border-[1.5px] border-jewelInk/25 bg-cream-tile text-left flex items-center justify-between gap-3"
          >
            <span className="min-w-0">
              <span className="block font-sans text-[15px] font-extrabold text-jewelInk">{v.translation}</span>
              <span className="block">
                <span className="font-geo text-[15px] font-bold text-jewelInk-mid">{v.lemma}</span>
                <span className="ml-2 font-sans text-[12px] text-jewelInk-hint">{cyr(v.lemma)}</span>
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className={`block font-sans text-[12px] font-extrabold ${rank(v) === 0 ? 'text-ruby' : rank(v) === 1 ? 'text-jewelInk' : 'text-jewelInk-hint'}`}>{statusText(v)}</span>
              <span className="block font-sans text-[12px] text-jewelInk-hint">{v.mainTenses} из 6 времён</span>
            </span>
          </button>
        ))}
      </div>
    )
  }

  function verbView(v: ModelMadeVerbDto) {
    const at = batch.indexOf(v.lemma)
    const go = (step: number) => open(batch[at + step], batch)
    const nav = (place: string) => at >= 0 && batch.length > 1 && (
      <div className="flex items-center justify-between gap-2" data-testid={`verb-review-nav-${place}`}>
        <button type="button" className={navButton} disabled={at === 0} onClick={() => go(-1)}>← Предыдущий</button>
        <span className="font-sans text-[13px] font-bold text-jewelInk-mid tabular-nums whitespace-nowrap">{at + 1} из {batch.length}</span>
        <button type="button" className={navButton} disabled={at === batch.length - 1} onClick={() => go(1)}>Следующий глагол →</button>
      </div>
    )
    const act = (pending: string, done: string, call: () => Promise<{ progressReset?: number }>) =>
      run(pending, async () => {
        const r = await call()
        return done + (r.progressReset ? `; у учеников сброшен прогресс по изменённым формам: ${r.progressReset}` : '')
      })

    return (
      <div className="flex flex-col gap-3" data-testid="verb-review-verb">
        {nav('top')}
        <div>
          <div className="font-sans text-[22px] font-extrabold text-navy leading-tight">{v.translation}</div>
          <div className="mt-0.5">
            <span className="font-geo text-[22px] font-extrabold text-jewelInk">{v.lemma}</span>
            <span className="ml-2 font-sans text-[13px] text-jewelInk-hint">{cyr(v.lemma)}</span>
          </div>
          <div className={`${small} mt-1`}>
            спросили «{v.askedText}» · {day(v.approvedAtUtc)}{v.learners > 0 ? ` · учат: ${v.learners}` : ''}
          </div>
          <div className={`mt-1 font-sans text-[13px] font-extrabold ${rank(v) === 0 ? 'text-ruby' : 'text-jewelInk'}`} data-testid="verb-review-status">
            {v.mainTenses} из 6 времён · {v.ownerApprovedAtUtc ? `проверен ${day(v.ownerApprovedAtUtc)}` : statusText(v)}
          </div>
          {v.missingTenses.map(m => (
            <div key={m.tense} className={small}>нет: {missingText(m)}</div>
          ))}
          <button type="button" className={`${quiet} px-0`} onClick={() => setNotes(!notes)}>{notes ? 'Скрыть заметки моделей' : 'Заметки моделей'}</button>
          {notes && (
            <div className={`${small} flex flex-col gap-1`} data-testid="verb-review-notes">
              <div>Составила {v.generatorModel}, проверила {v.reviewerModel}.</div>
              {v.reviewerReasons.map((r, i) => <div key={i}>{r}</div>)}
              {v.missingTenses.filter(m => m.note).map(m => <div key={m.tense}>{tenseName(m.tense)}: {m.note}</div>)}
            </div>
          )}
        </div>

        {v.tenses.map(t => (
          <TenseBlock
            // Состояние времени в ключе: после подтверждения блок сворачивается сам, не трогая соседей и прокрутку.
            key={`${v.lemma}-${t.tense}-${t.unverified}`}
            tense={t} busy={busy}
            onConfirm={() => act('сохраняю…', `${tenseName(t.tense)}: подтверждено, теперь есть в играх`, () => adminVerbs.confirmTense(v.lemma, t.tense))}
            onEdit={cells => act('сохраняю…', `${tenseName(t.tense)}: исправлено и проверено`, () => adminVerbs.editTense(v.lemma, t.tense, cells))}
            onRemove={() => act('сохраняю…', `${tenseName(t.tense)}: убрано`, () => adminVerbs.removeTense(v.lemma, t.tense))}
          />
        ))}

        {/* Что вышло из последнего действия — прилипает к низу экрана, чтобы было видно, где бы ни стояла прокрутка. */}
        {note && (
          <div className="sticky bottom-2 z-10 rounded-lg bg-jewelInk px-3 py-2 font-sans text-[13px] font-bold text-cream" data-testid="verb-review-note" role="status">
            {note}
          </div>
        )}

        <div className="flex flex-col gap-1 rounded-lg border-[1.5px] border-jewelInk/20 p-3">
          {v.ownerApprovedAtUtc ? (
            <div className="flex flex-wrap items-center gap-x-2">
              <span className="font-sans text-[14px] font-extrabold text-jewelInk">Глагол проверен</span>
              <button
                type="button" className={quiet} disabled={busy}
                onClick={() => act('сохраняю…', 'Отметка снята: у учеников снова «составлено нейросетью»', () => adminVerbs.unapprove(v.lemma))}
              >Снять отметку</button>
            </div>
          ) : v.unverifiedTenses.length === 0 ? (
            <button
              type="button" className={`${button} bg-navy text-cream border-navy`} disabled={busy}
              onClick={() => act('сохраняю…', 'Глагол проверен: пометка «составлено нейросетью» убрана', () => adminVerbs.approve(v.lemma))}
            >Глагол проверен</button>
          ) : ask === 'approve-all' ? (
            <div className="flex flex-col gap-1">
              <span className="font-sans text-[13px] text-jewelInk">
                Непроверенные времена ({v.unverifiedTenses.map(t => tenseName(t.tense).toLowerCase()).join(', ')}) станут проверенными и попадут в игры. Подтвердить?
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button" className={button} disabled={busy}
                  onClick={() => act('сохраняю…', 'Глагол проверен: пометка «составлено нейросетью» убрана', () => adminVerbs.approve(v.lemma, true))}
                >Да, подтвердить всё</button>
                <button type="button" className={quiet} onClick={() => setAsk(null)}>Отмена</button>
              </div>
            </div>
          ) : (
            <button type="button" className={button} disabled={busy} onClick={() => setAsk('approve-all')}>
              Подтвердить всё и отметить проверенным
            </button>
          )}

          {ask === 'rebuild-approved' ? (
            <div className="flex flex-col gap-1">
              <span className="font-sans text-[13px] text-jewelInk">Глагол отмечен проверенным. Если модели составят новую запись, отметка снимется. Пересобрать?</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button" className={button} disabled={busy}
                  onClick={() => run('пересобираю, это до пары минут…', async () => rebuilt(await adminVerbs.regenerate(v.lemma, true)))}
                >Да, пересобрать</button>
                <button type="button" className={quiet} onClick={() => setAsk(null)}>Отмена</button>
              </div>
            </div>
          ) : (
            <button
              type="button" className={`${quiet} self-start px-0`} disabled={busy}
              onClick={() => v.ownerApprovedAtUtc
                ? setAsk('rebuild-approved')
                : run('пересобираю, это до пары минут…', async () => rebuilt(await adminVerbs.regenerate(v.lemma)))}
            >Пересобрать</button>
          )}
        </div>
        {nav('bottom')}
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full bg-cream">
      <Header onBack={back} eyebrow="админка · глаголы" title={current ? 'Проверка глагола' : 'Проверка глаголов'} />
      <div className="flex-1 px-5 pt-4" style={{ paddingBottom: 'calc(var(--safe-b) + 24px)' }}>{body()}</div>
    </div>
  )
}
