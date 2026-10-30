import { useState } from 'react'
import type { ModelMadeVerbDto } from '../../api'
import { TENSES } from '../../verbs/types'
import { parseVerbFix, type VerbFix } from './verbFix'
import { tenseName } from './verbReview'

const button = 'min-h-[48px] px-4 rounded border-[1.5px] border-jewelInk font-sans text-[14px] font-extrabold disabled:opacity-50'
const quiet = 'min-h-[48px] px-3 font-sans text-[14px] font-bold text-navy underline disabled:opacity-50'

interface Props {
  verb: ModelMadeVerbDto
  busy: boolean
  onApply: (fix: VerbFix) => void
}

/** Что не так с исправлением именно для этого глагола; null — можно применять. */
function mismatch(fix: VerbFix, v: ModelMadeVerbDto): string | null {
  if (fix.lemma && fix.lemma !== v.lemma) return `исправление для ${fix.lemma}, а открыт ${v.lemma}`
  const absent = [...fix.edits.map(e => e.tense), ...fix.confirm].find(t => !v.tenses.some(r => r.tense === t))
  if (absent) return `у глагола нет времени «${TENSES[absent].name}»`
  if (fix.approve) {
    const touched = (t: string) => fix.confirm.some(c => c === t) || fix.edits.some(e => e.tense === t)
    const left = v.unverifiedTenses.filter(r => !touched(r.tense))
    if (left.length) return `чтобы отметить глагол проверенным, надо исправить или подтвердить: ${left.map(r => tenseName(r.tense)).join(', ')}`
  }
  return null
}

/**
 * «Вставить исправление»: весь разбор глагола одним текстом из буфера обмена — исправленные
 * времена, подтверждённые как есть и отметка «глагол проверен». Перед применением видно, что изменится.
 */
export default function VerbFixPaste({ verb: v, busy, onApply }: Props) {
  const [text, setText] = useState<string | null>(null)

  if (text === null) {
    return <button type="button" className={`${button} self-start`} disabled={busy} onClick={() => setText('')}>Вставить исправление</button>
  }

  async function fromClipboard() {
    // В части клиентов Telegram чтение буфера запрещено — тогда вставляют долгим нажатием в поле.
    try { setText(await navigator.clipboard.readText()) } catch { /* остаётся поле */ }
  }

  const parsed = text.trim() ? parseVerbFix(text) : null
  const problem = parsed && ('error' in parsed ? parsed.error : mismatch(parsed.fix, v))
  const fix = parsed && 'fix' in parsed && !problem ? parsed.fix : null
  const was = (tense: string) => v.tenses.find(r => r.tense === tense)?.cells ?? []

  return (
    <div className="flex flex-col gap-2 rounded-lg border-[1.5px] border-jewelInk p-3" data-testid="verb-fix">
      <div className="font-sans text-[14px] font-extrabold text-jewelInk">Исправление одним текстом</div>
      <textarea
        aria-label="Текст исправления" value={text} onChange={e => setText(e.target.value)} rows={5}
        placeholder="Вставь сюда текст исправления"
        className="w-full px-2 py-2 rounded border-[1.5px] border-jewelInk/40 bg-cream font-sans text-[14px] placeholder:text-jewelInk-hint"
      />
      {!text && <button type="button" className={`${quiet} self-start px-0`} onClick={fromClipboard}>Вставить из буфера</button>}
      {problem && <div className="font-sans text-[13px] font-bold text-ruby" data-testid="verb-fix-problem">{problem}</div>}
      {fix && (
        <div className="flex flex-col gap-1.5 font-sans text-[13px] text-jewelInk" data-testid="verb-fix-preview">
          {fix.edits.map(e => (
            <div key={e.tense}>
              <div className="font-extrabold">{TENSES[e.tense].name}: исправить</div>
              {e.cells.map((c, i) => (
                <div key={i} className="font-geo text-[15px]">
                  {was(e.tense)[i] === c ? <span>{c ?? '—'}</span> : (
                    <><span className="text-jewelInk-hint line-through">{was(e.tense)[i] ?? '—'}</span> → <span className="font-bold">{c ?? '—'}</span></>
                  )}
                </div>
              ))}
            </div>
          ))}
          {fix.confirm.length > 0 && <div><span className="font-extrabold">Подтвердить как есть:</span> {fix.confirm.map(t => TENSES[t].name).join(', ')}</div>}
          {fix.approve && <div className="font-extrabold">Отметить глагол проверенным</div>}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`${button} bg-navy text-cream border-navy`} disabled={busy || !fix} onClick={() => { onApply(fix!); setText(null) }}>Применить</button>
        <button type="button" className={quiet} onClick={() => setText(null)}>Отмена</button>
      </div>
    </div>
  )
}
