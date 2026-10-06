import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Button from '../components/Button'
import LoaderLetter from '../components/LoaderLetter'
import { fetchVerb } from '../api'
import FormsTable from './FormsTable'
import { OVERLAY, useOverlay } from './ui/overlayStack'
import type { VerbDto } from './types'

interface Props {
  verbId: string
  /** Если глагол уже загружен — не запрашиваем его второй раз. */
  verb?: VerbDto
  /** На каком лице открыть таблицу: том, про которое задание. */
  person?: number
  /** Человек подсмотрел: задание засчитывается как сделанное с помощью. */
  onPeek?: () => void
}

/**
 * «Подсмотреть в таблице» в задании, где слово надо набрать самому: таблица слов глагола
 * открывается поверх игры, задание под ней остаётся как было — закрыл и продолжаешь с того же места.
 * Нужную строку не подсвечиваем: найти слово по русской фразе — тоже упражнение.
 */
export default function TablePeek({ verbId, verb: given, person: initialPerson = 0, onPeek }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        data-testid="table-peek"
        onClick={() => { onPeek?.(); setOpen(true) }}
        className="min-h-[44px] self-center text-[13px] text-navy underline"
      >
        Не помню — подсмотреть в таблице
      </button>
      {open && <Sheet verbId={verbId} given={given} person={initialPerson} onClose={() => setOpen(false)} />}
    </>
  )
}

function Sheet({ verbId, given, person: initialPerson, onClose }: { verbId: string; given?: VerbDto; person: number; onClose: () => void }) {
  const [verb, setVerb] = useState<VerbDto | null>(given ?? null)
  const [failed, setFailed] = useState(false)
  const [person, setPerson] = useState(initialPerson)
  useOverlay(onClose, OVERLAY.help)

  useEffect(() => {
    if (given) return
    let stale = false
    fetchVerb(verbId).then(v => { if (!stale) setVerb(v) }).catch(() => { if (!stale) setFailed(true) })
    return () => { stale = true }
  }, [verbId, given])

  return createPortal(
    <div
      className="j-root fixed inset-0 z-[80] flex flex-col justify-end bg-jewelInk/40"
      data-testid="table-peek-sheet"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bg-cream rounded-t-2xl border-t-2 border-x-2 border-jewelInk max-h-[88dvh] overflow-y-auto w-full max-w-[480px] mx-auto px-5 pt-4 flex flex-col gap-3 j-rise"
        style={{ paddingBottom: 'calc(var(--safe-b) + 16px)' }}
      >
        <div className="text-center text-[13px] text-jewelInk-mid">Найди нужное слово и возвращайся — задание тебя ждёт.</div>
        {failed && <div className="py-8 text-center text-[14px] text-jewelInk-mid">Не получилось загрузить таблицу.</div>}
        {!failed && !verb && <div className="flex items-center justify-center py-10"><LoaderLetter size={72} /></div>}
        {verb && <FormsTable verb={verb} person={person} onPerson={setPerson} />}
        <Button onClick={onClose}>Вернуться к заданию</Button>
      </div>
    </div>,
    document.body
  )
}
