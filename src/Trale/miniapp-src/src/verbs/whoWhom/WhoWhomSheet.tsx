import React, { useEffect, useRef, useState } from 'react'
import { fetchVerb } from '../../api'
import { TENSES, cyr, type VerbDto } from '../types'
import { meaningOf } from '../meaning'
import { OVERLAY, useOverlay } from '../ui/overlayStack'
import { useSheetDrag } from '../ui/useSheetDrag'
import { haptic } from '../../alphabet/games/fx'
import '../../alphabet/games/alphabet.css'
import { ATTESTED, WHOMS, WHOS, WHO_WHOM_TENSES, WHO_WHOM_VERBS, flip, formFor, possible, sameSpelling, whomOf, type Cell, type Whom } from './logic'

/** Слово с подсвеченной меткой «кого». */
function Marked({ cell, className = '' }: { cell: Cell; className?: string }) {
  const { form, mark, tail } = cell
  if (!mark) return <span className={`font-geo ${className}`}>{form}</span>
  const hi = 'text-ruby bg-gold-wash rounded px-[1px]'
  const end = tail ? form.length - 1 : form.length
  return (
    <span className={`font-geo ${className}`}>
      {form.slice(0, mark.at)}
      <span className={hi} data-testid="whom-mark">{form.slice(mark.at, mark.at + mark.len)}</span>
      {form.slice(mark.at + mark.len, end)}
      {tail && <span className={hi} data-testid="whom-tail">{form.slice(end)}</span>}
    </span>
  )
}

/**
 * Правило «Кто кого» шторкой поверх карточки глагола: выбираешь «кто» и «кого» — видно слово
 * и букву в его начале, которая говорит «кого». ⇄ меняет стороны: «я → его» становится «он → меня».
 */
export default function WhoWhomSheet({ verbId, onClose }: { verbId: string; onClose: () => void }) {
  const [lemma, setLemma] = useState(verbId)
  const [verbs, setVerbs] = useState<Record<string, VerbDto>>({})
  const [who, setWho] = useState(0)
  const [whom, setWhom] = useState<Whom>('you')
  const [spin, setSpin] = useState(0)
  const [visible, setVisible] = useState(false)
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])
  useEffect(() => {
    WHO_WHOM_VERBS.forEach(id => fetchVerb(id).then(v => setVerbs(all => ({ ...all, [id]: v }))).catch(() => {}))
  }, [])

  function close() {
    setVisible(false)
    setTimeout(onClose, 220)
  }
  useOverlay(close, OVERLAY.help)
  const drag = useSheetDrag(panel, close)

  const verb = verbs[lemma]
  const order = [lemma, ...WHO_WHOM_VERBS.filter(v => v !== lemma)]

  function pickWho(p: number) {
    haptic('tap')
    setWho(p)
    if (!possible(p, whom)) setWhom(p === 0 || p === 3 ? 'you' : 'me')
  }
  function turn() {
    haptic('pop')
    const f = flip(who, whom)
    setWho(f.who); setWhom(f.whom); setSpin(s => s + 1)
  }

  const now = verb ? formFor(verb, 'present', who, whom) : null
  const same = verb ? sameSpelling(verb, 'present', who, whom) : []

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col justify-end"
      data-testid="who-whom-sheet"
      onClick={e => { if (e.target === e.currentTarget) close() }}
      style={{ background: `rgba(21,16,10,${visible ? '0.4' : '0'})`, transition: 'background 200ms ease' }}
    >
      <div
        ref={panel}
        className="bg-cream rounded-t-2xl border-t-2 border-x-2 border-jewelInk max-h-[92dvh] overflow-y-auto overscroll-contain w-full max-w-[480px] mx-auto"
        style={{
          boxShadow: '0 -4px 0 #15100A',
          transform: visible ? `translateY(${drag.offset}px)` : 'translateY(100%)',
          transition: drag.dragging ? 'none' : visible ? 'transform 300ms ease-out' : 'transform 220ms ease-in'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-8 h-1 bg-jewelInk/20 rounded-full mx-auto mt-3 mb-2" />
        <div className="px-5 flex flex-col gap-3" style={{ paddingBottom: 'calc(var(--safe-b) + 20px)' }}>
          <div className="text-center">
            <div className="mn-eyebrow text-navy">правило</div>
            <h2 className="text-[24px] font-extrabold leading-tight">Кто кого</h2>
            <p className="mt-1 text-[13px] text-jewelInk-soft">
              Грузинский глагол говорит не только <b>кто</b>, но и <b>кого</b> — буквой в начале слова.
            </p>
          </div>

          {/* Метки — все сразу: их всего три. */}
          <div className="flex flex-wrap justify-center gap-1.5 text-[12px]" data-testid="who-whom-marks">
            {[['მ', 'меня'], ['გ', 'тебя'], ['გვ', 'нас'], ['გ…თ', 'вас'], ['—', 'его, их']].map(([m, ru]) => (
              <span key={ru} className="rounded-full border-[1.5px] border-jewelInk bg-cream-tile px-2.5 py-0.5 font-bold">
                <span className="font-geo text-ruby">{m}</span> {ru}
              </span>
            ))}
          </div>

          {/* Глагол: этот и ещё три, на которых правило то же. */}
          <div className="flex gap-1.5 overflow-x-auto -mx-5 px-5 pb-1" data-testid="who-whom-verbs">
            {order.map(id => (
              <button key={id} onClick={() => { haptic('tap'); setLemma(id) }}
                className={`shrink-0 rounded-lg border-[1.5px] border-jewelInk px-2.5 py-1 text-[12px] font-bold ${id === lemma ? 'bg-navy text-cream' : 'bg-cream-tile'}`}>
                {verbs[id]?.ru ?? '…'}
              </button>
            ))}
          </div>

          <div className="rounded-xl bg-cream-tile border-[1.5px] border-jewelInk overflow-hidden" style={{ boxShadow: '3px 3px 0 #15100A' }}>
            <Pick label="кто" items={WHOS} active={who} onPick={pickWho} testid="who" />
            <Pick label="кого" items={WHOMS.map(w => w.ru)} active={WHOMS.findIndex(w => w.key === whom)}
              disabled={WHOMS.map(w => !possible(who, w.key))} onPick={i => { haptic('tap'); setWhom(WHOMS[i].key) }} testid="whom" />

            <div className="px-4 pt-4 pb-3 text-center border-t border-cream-edge">
              {verb && now ? (
                <div key={spin} className="ab-deal">
                  <div className="text-[15px] font-bold text-jewelInk" data-testid="who-whom-ru">
                    {meaningOf(verb, 'present', who).text} {whomOf(whom).ru}
                  </div>
                  <Marked cell={now} className="block mt-1 text-[34px] font-extrabold leading-none" />
                  <div className="mt-1 text-[13px] text-jewelInk-hint">{cyr(now.form)}</div>
                </div>
              ) : <div className="py-6 text-[13px] text-jewelInk-hint">…</div>}
              <button onClick={turn} data-testid="who-whom-flip"
                className="mt-3 inline-flex items-center gap-2 rounded-xl border-[1.5px] border-jewelInk bg-gold px-4 min-h-[44px] text-[14px] font-extrabold"
                style={{ boxShadow: '2px 2px 0 #15100A' }}>
                <span aria-hidden>⇄</span> поменять стороны
              </button>
              {verb && <div className="mt-1 text-[12px] text-jewelInk-mid">
                {meaningOf(verb, 'present', flip(who, whom).who).text} {whomOf(flip(who, whom).whom).ru}
              </div>}
            </div>

            {verb && WHO_WHOM_TENSES.filter(t => t !== 'present').map(t => {
              const cell = formFor(verb, t, who, whom)
              if (!cell) return null
              return (
                <div key={t} className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-cream-edge" data-testid={`who-whom-${t}`}>
                  <span className="min-w-0">
                    <span className="block text-[14px] font-bold">{meaningOf(verb, t, who).text} {whomOf(whom).ru}</span>
                    <span className="block text-[11px] text-jewelInk-hint">{TENSES[t].name}</span>
                  </span>
                  <span className="text-right">
                    <Marked cell={cell} className="block text-[19px] font-bold" />
                    <span className="block text-[11px] text-jewelInk-hint">{cyr(cell.form)}</span>
                  </span>
                </div>
              )
            })}
          </div>

          {same.length > 0 && (
            <div className="text-[12px] text-jewelInk-mid text-center" data-testid="who-whom-same">
              Так же пишется: {same.join(', ')} — кого именно, понятно из разговора.
            </div>
          )}

          <div className="rounded-xl border border-jewelInk/40 bg-navy-wash p-3 text-[12px] text-jewelInk-mid flex flex-col gap-1.5">
            <div>Метка встаёт туда, где у «я» стоит <span className="font-geo font-bold">ვ</span>, и вытесняет её: «я → тебя» — <span className="font-geo font-bold">გხედავ</span>, а не ვგხედავ.</div>
            <div>У «любить» и «нравиться» наоборот: в <span className="font-geo font-bold">მიყვარს</span> буква <span className="font-geo">მ</span> — это «я люблю».</div>
            <div className="text-jewelInk-hint">
              Формы выведены по правилу из таблицы глагола. Нашли в живых предложениях:{' '}
              {Object.entries(ATTESTED).map(([f, s]) => <span key={f} className="block font-geo">{s}</span>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Pick({ label, items, active, onPick, disabled, testid }: {
  label: string; items: string[]; active: number; onPick: (i: number) => void; disabled?: boolean[]; testid: string
}) {
  return (
    <div className="flex items-center gap-1 px-1.5 py-1.5 bg-navy first:pt-1.5 [&+&]:pt-0">
      <span className="w-9 shrink-0 text-[10px] font-extrabold uppercase text-cream/70 text-center">{label}</span>
      {items.map((p, i) => (
        <button key={p} data-testid={`${testid}-${i}`} disabled={disabled?.[i]} onClick={() => onPick(i)}
          className={`flex-1 h-8 rounded-md text-[12px] font-bold ${active === i ? 'bg-cream text-jewelInk' : disabled?.[i] ? 'text-cream/25' : 'text-cream/80'}`}>
          {p}
        </button>
      ))}
    </div>
  )
}
