import React, { useEffect, useRef, useState } from 'react'
import { api, VocabularyItem } from '../api'
import AudioPlayer from './AudioPlayer'
import LoaderLetter from './LoaderLetter'
import MasteryIndicator from './MasteryIndicator'

interface Props {
  item: VocabularyItem
  isSelected: boolean
  onClose: () => void
  onToggleSelect: (id: string) => void
  onDelete: (id: string) => void
}

type DeleteState = 'default' | 'confirming' | 'loading' | 'error'

const RUSSIAN_MONTHS = [
  'янв.', 'февр.', 'март', 'апр.', 'май', 'июн.',
  'июл.', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'
]

function formatDate(dateUtc: string | null): string {
  if (!dateUtc) return '—'
  const d = new Date(dateUtc)
  return `${d.getDate()} ${RUSSIAN_MONTHS[d.getMonth()]}`
}

function containsGeorgian(s: string): boolean {
  for (const c of s) {
    const code = c.codePointAt(0) ?? 0
    if (code >= 0x10a0 && code <= 0x10ff) return true
  }
  return false
}

function sides(item: VocabularyItem): { georgian: string; russian: string } {
  if (containsGeorgian(item.word)) {
    return { georgian: item.word, russian: item.definition }
  }
  return { georgian: item.definition, russian: item.word }
}

export default function WordCard({ item, isSelected, onClose, onToggleSelect, onDelete }: Props) {
  const [visible, setVisible] = useState(false)
  const [deleteState, setDeleteState] = useState<DeleteState>('default')
  const [errorMsg, setErrorMsg] = useState('')
  const sheetRef = useRef<HTMLDivElement>(null)

  const { georgian, russian } = sides(item)

  // Slide-up on mount
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 220)
  }

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) handleClose()
  }

  async function handleConfirmDelete() {
    setDeleteState('loading')
    setErrorMsg('')
    try {
      await api.deleteVocabularyEntry(item.id)
      // Animate close, then notify parent
      setVisible(false)
      setTimeout(() => onDelete(item.id), 220)
    } catch {
      setDeleteState('error')
      setErrorMsg('Не удалось удалить. Попробуй ещё раз.')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      onClick={handleBackdropClick}
      style={{
        background: `rgba(21,16,10,${visible ? '0.4' : '0'})`,
        transition: 'background 200ms ease'
      }}
    >
      <div
        ref={sheetRef}
        className="bg-cream rounded-t-2xl border-t-2 border-x-2 border-jewelInk max-h-[90dvh] overflow-y-auto"
        style={{
          boxShadow: '0 -4px 0 #15100A',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: visible
            ? 'transform 300ms ease-out'
            : 'transform 220ms ease-in'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="w-8 h-1 bg-jewelInk/20 rounded-full mx-auto mt-3 mb-5" />

        <div className="px-5 pb-6 flex flex-col gap-4">
          {/* Eyebrow */}
          <div className="mn-eyebrow text-gold-deep">ლექსიკონი · слово</div>

          {/* Word identification */}
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-geo font-extrabold text-[28px] text-jewelInk leading-tight break-words">
                {georgian}
              </div>
              <div className="font-sans font-semibold text-[18px] text-jewelInk mt-1">
                {russian}
              </div>
            </div>
            {item.audioUrl && (
              <div className="shrink-0 mt-1">
                <AudioPlayer url={item.audioUrl} />
              </div>
            )}
          </div>

          {/* Mastery block */}
          <MasteryIndicator mastery={item.mastery} />

          {/* Example / additionalInfo */}
          {item.example && (
            <div className="flex flex-col gap-1">
              <div className="font-sans text-[14px] text-jewelInk/80 italic">
                «{item.example}»
              </div>
              {item.additionalInfo && (
                <div className="font-sans text-[12px] text-jewelInk-hint">
                  {item.additionalInfo}
                </div>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="h-px bg-jewelInk/15" />

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-1">
            <StatCell abbr="სწ." value={item.successCount} icon="check" />
            <StatCell abbr="უკ." value={item.successReverseCount} icon="check" />
            <StatCell abbr="შეც." value={item.failedCount} icon="cross" />
            <StatCell abbr="📅" value={formatDate(item.dateAddedUtc)} />
          </div>

          {/* Divider */}
          <div className="h-px bg-jewelInk/15" />

          {/* Actions */}
          {deleteState === 'default' || deleteState === 'error' ? (
            <div className="flex flex-col gap-2">
              {/* Toggle quiz selection */}
              {!item.isStarter && (
                <button
                  onClick={() => { onToggleSelect(item.id); handleClose() }}
                  className="w-full min-h-[52px] flex items-center justify-center gap-2 bg-navy border-[1.5px] border-jewelInk rounded-xl font-sans text-[15px] font-bold text-cream active:translate-x-0.5 active:translate-y-0.5 transition-all"
                  style={{ boxShadow: '2px 2px 0 #15100A' }}
                >
                  <span className="text-[14px]">{isSelected ? '✓' : '☑'}</span>
                  {isSelected ? 'Убрать из квиза' : 'Добавить в квиз'}
                </button>
              )}

              {/* Delete — only for non-starter words */}
              {!item.isStarter && (
                <button
                  onClick={() => setDeleteState('confirming')}
                  className="w-full min-h-[52px] flex items-center justify-center bg-cream border-[1.5px] border-jewelInk/40 rounded-xl font-sans text-[15px] font-bold text-ruby active:translate-x-0.5 active:translate-y-0.5 transition-all"
                  style={{ boxShadow: '2px 2px 0 #15100A40' }}
                >
                  Удалить слово
                </button>
              )}

              {deleteState === 'error' && (
                <div className="text-ruby text-[12px] text-center font-sans">
                  {errorMsg}
                </div>
              )}
            </div>
          ) : deleteState === 'confirming' ? (
            <div
              className="jewel-tile px-4 py-4 flex flex-col gap-3"
              style={{ animation: 'mn-reveal 200ms ease-out both' }}
            >
              <div className="relative z-[1] font-sans text-[14px] text-jewelInk text-center">
                Удалить «{georgian}» из словаря?
              </div>
              <div className="relative z-[1] grid grid-cols-2 gap-2">
                <button
                  onClick={handleConfirmDelete}
                  className="min-h-[48px] flex items-center justify-center bg-ruby border-[1.5px] border-jewelInk rounded-xl font-sans text-[14px] font-bold text-cream active:translate-x-0.5 active:translate-y-0.5 transition-all"
                  style={{ boxShadow: '2px 2px 0 #15100A' }}
                >
                  Да, удалить
                </button>
                <button
                  onClick={() => setDeleteState('default')}
                  className="min-h-[48px] flex items-center justify-center bg-cream border-[1.5px] border-jewelInk rounded-xl font-sans text-[14px] font-bold text-jewelInk active:translate-x-0.5 active:translate-y-0.5 transition-all"
                  style={{ boxShadow: '2px 2px 0 #15100A' }}
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            /* loading state */
            <div className="flex items-center justify-center py-4">
              <LoaderLetter size={48} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface StatCellProps {
  abbr: string
  value: number | string
  icon?: 'check' | 'cross'
}

function StatCell({ abbr, value, icon }: StatCellProps) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="font-geo text-[10px] text-jewelInk-hint">{abbr}</span>
      <div className="flex items-center gap-0.5">
        <span className="font-sans font-extrabold text-[15px] text-jewelInk tabular-nums">
          {value}
        </span>
        {icon === 'check' && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5 L4 7 L8 3" stroke="#1B5FB0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {icon === 'cross' && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M3 3 L7 7 M7 3 L3 7" stroke="#E01A3C" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        )}
      </div>
    </div>
  )
}
