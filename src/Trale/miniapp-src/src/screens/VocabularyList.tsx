import React, { useEffect, useMemo, useRef, useState } from 'react'
import Header from '../components/Header'
import Button from '../components/Button'
import LoaderLetter from '../components/LoaderLetter'
import WordCard from '../components/WordCard'
import { ProgressState, Screen } from '../types'
import { api, ApiError, VocabularyItem, VocabularyQuizMode } from '../api'

interface Props {
  progress: ProgressState
  navigate: (s: Screen) => void
}

type Phase = 'loading' | 'auth-required' | 'ready' | 'error'
type TranslateState = 'idle' | 'translating' | 'success' | 'error'
type Filter = 'all' | 'new' | 'weak' | 'mastered'

interface Toast {
  id: number
  message: string
}

export default function VocabularyList({ progress, navigate }: Props) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [items, setItems] = useState<VocabularyItem[]>([])
  const [isStarterMode, setIsStarterMode] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [translateInput, setTranslateInput] = useState('')
  const [translateState, setTranslateState] = useState<TranslateState>('idle')
  const [translateResult, setTranslateResult] = useState<{ word: string; definition: string; additionalInfo: string; example: string } | null>(null)
  const [cardItem, setCardItem] = useState<VocabularyItem | null>(null)
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastCounter = useRef(0)

  useEffect(() => {
    let cancelled = false
    api
      .vocabulary()
      .then((r) => {
        if (cancelled) return
        if (r.items.length === 0 && r.starterItems.length > 0) {
          setItems(r.starterItems)
          setIsStarterMode(true)
        } else {
          setItems(r.items)
          setIsStarterMode(false)
        }
        setPhase('ready')
      })
      .catch((e) => {
        if (cancelled) return
        if (e instanceof ApiError && e.status === 401) {
          setPhase('auth-required')
        } else {
          setPhase('error')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const lowered = search.trim().toLowerCase()
    return items.filter((item) => {
      if (filter === 'new') {
        if (
          item.successCount > 0 ||
          item.successReverseCount > 0 ||
          item.failedCount > 0
        )
          return false
      }
      if (filter === 'weak') {
        if (item.mastery === 'MasteredInBothDirections') return false
      }
      if (filter === 'mastered') {
        if (item.mastery === 'NotMastered') return false
      }
      if (!lowered) return true
      return (
        item.word.toLowerCase().includes(lowered) ||
        item.definition.toLowerCase().includes(lowered)
      )
    })
  }, [items, search, filter])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function openCard(item: VocabularyItem) {
    setCardItem(item)
  }

  function closeCard() {
    setCardItem(null)
  }

  function showToast(message: string) {
    const id = ++toastCounter.current
    setToasts((prev) => [...prev, { id, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 2500)
  }

  function handleDelete(id: string) {
    // Find the word label for the toast
    const item = items.find((i) => i.id === id)
    const { georgian } = item ? sides(item) : { georgian: '' }

    // Start exit animation
    setRemovingIds((prev) => new Set([...prev, id]))

    // Remove from list after animation
    setTimeout(() => {
      setItems((prev) => prev.filter((i) => i.id !== id))
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      setRemovingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, 250)

    showToast(`«${georgian}» удалено из словаря`)
  }

  function startQuiz(mode: VocabularyQuizMode) {
    if (isStarterMode) {
      navigate({ kind: 'vocabulary-quiz', mode: 'starter' })
      return
    }
    if (mode === 'custom') {
      navigate({ kind: 'vocabulary-quiz', mode, wordIds: Array.from(selected) })
    } else {
      navigate({ kind: 'vocabulary-quiz', mode })
    }
  }

  async function translateWord() {
    const word = translateInput.trim()
    if (!word) return
    setTranslateState('translating')
    setTranslateResult(null)
    try {
      const r = await api.translateWord(word)
      if (r.status === 'success' || r.status === 'exists') {
        setTranslateResult({
          word: r.word ?? word,
          definition: r.definition ?? '',
          additionalInfo: r.additionalInfo ?? '',
          example: r.example ?? ''
        })
        setTranslateState('success')
        setTranslateInput('')
        if (r.status === 'success') {
          api.vocabulary().then((v) => {
            setItems(v.items.length > 0 ? v.items : v.starterItems)
            setIsStarterMode(v.items.length === 0)
          }).catch(() => {})
        }
      } else {
        setTranslateState('error')
      }
    } catch {
      setTranslateState('error')
    }
  }

  if (phase === 'loading') {
    return (
      <div className="flex flex-col min-h-full bg-cream">
        <Header
          progress={progress}
          onBack={() => navigate({ kind: 'dashboard' })}
          eyebrow="ლექსიკონი"
          title="Мой словарь"
        />
        <div
          className="flex-1 flex flex-col items-center justify-center"
          style={{ minHeight: '50vh' }}
        >
          <LoaderLetter label="словарь..." size={120} />
        </div>
      </div>
    )
  }

  if (phase === 'auth-required') {
    return (
      <div className="flex flex-col min-h-full bg-cream">
        <Header
          progress={progress}
          onBack={() => navigate({ kind: 'dashboard' })}
          eyebrow="ლექსიკონი"
          title="Мой словарь"
        />
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-5 py-12">
          <div className="mn-eyebrow">нужен Telegram</div>
          <div className="font-sans text-[20px] font-extrabold text-jewelInk max-w-[300px]">
            Словарь живёт в Telegram
          </div>
          <div className="font-sans text-[14px] text-jewelInk-mid max-w-[320px]">
            Открой мини-апп через кнопку «🐶 Бомбора» в чате с ботом.
          </div>
          <div className="w-full max-w-[280px]">
            <Button variant="ghost" onClick={() => navigate({ kind: 'dashboard' })}>
              ← на главную
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="flex flex-col min-h-full bg-cream">
        <Header
          progress={progress}
          onBack={() => navigate({ kind: 'dashboard' })}
          eyebrow="ლექსიკონი"
          title="Мой словарь"
        />
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-5 py-12">
          <div className="mn-eyebrow">ой</div>
          <div className="font-sans text-[14px] text-jewelInk-mid">
            Что-то пошло не так. Попробуй вернуться позже.
          </div>
          <div className="w-full max-w-[280px]">
            <Button variant="ghost" onClick={() => navigate({ kind: 'dashboard' })}>
              ← на главную
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full bg-cream">
      <Header
        progress={progress}
        onBack={() => navigate({ kind: 'dashboard' })}
        eyebrow="ლექსიკონი"
        title="Мой словарь"
      />

      {/* Toast notifications */}
      <div className="fixed top-0 left-0 right-0 max-w-[480px] mx-auto z-[60] flex flex-col items-stretch px-4 pt-4 gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="bg-cream border-b-2 border-ruby rounded-xl px-4 py-3 font-sans text-[14px] font-semibold text-jewelInk shadow-md"
            style={{ animation: 'slide-down-toast 250ms ease-out both' }}
          >
            {t.message}
          </div>
        ))}
      </div>

      <div
        className="flex-1 px-5 pt-5 pb-in"
        style={{ paddingBottom: 'calc(var(--safe-b) + 150px)' }}
      >
        {/* Intro card */}
        <div className="jewel-tile px-5 py-4 mb-5">
          <div className="relative z-[1]">
            <div className="mn-eyebrow mb-1">
              {isStarterMode ? 'стартовая колода' : 'твоя колода'}
            </div>
            <div className="font-sans text-[22px] font-extrabold text-jewelInk leading-tight">
              {isStarterMode
                ? 'Словарь пока пуст'
                : `${items.length} ${pluralizeWord(items.length)}`}
            </div>
            <div className="font-sans text-[13px] text-jewelInk-mid mt-1 leading-snug">
              {isStarterMode
                ? 'Начни с базового набора от Бомборы или добавь свои слова ниже.'
                : 'Отметь слова или выбери готовый набор снизу.'}
            </div>
          </div>
        </div>

        {/* Translate bar */}
        <div className="mb-4">
          <div className="mn-eyebrow mb-2">добавить слово</div>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-cream-tile border-[1.5px] border-jewelInk rounded-xl px-4 py-3 font-sans text-[15px] font-semibold text-jewelInk outline-none focus:border-navy transition-colors"
              style={{ boxShadow: '2px 2px 0 #15100A' }}
              placeholder="слово на русском или грузинском"
              value={translateInput}
              onChange={(e) => { setTranslateInput(e.target.value); setTranslateState('idle') }}
              onKeyDown={(e) => { if (e.key === 'Enter') translateWord() }}
              disabled={translateState === 'translating'}
            />
            <button
              onClick={translateWord}
              disabled={!translateInput.trim() || translateState === 'translating'}
              className="shrink-0 px-4 py-3 bg-navy border-[1.5px] border-jewelInk rounded-xl font-sans text-[14px] font-bold text-cream disabled:opacity-40 active:translate-x-0.5 active:translate-y-0.5 transition-all"
              style={{ boxShadow: '2px 2px 0 #15100A' }}
            >
              {translateState === 'translating' ? '...' : '→'}
            </button>
          </div>
          {translateState === 'success' && translateResult && (
            <div className="mt-3 jewel-tile px-4 py-3">
              <div className="relative z-[1]">
                <div className="flex items-baseline gap-2">
                  <span className="font-sans text-[16px] font-extrabold text-navy">{translateResult.word}</span>
                  <span className="font-sans text-[14px] text-jewelInk">— {translateResult.definition}</span>
                </div>
                {translateResult.additionalInfo && (
                  <div className="font-sans text-[12px] text-jewelInk-mid mt-1">{translateResult.additionalInfo}</div>
                )}
                {translateResult.example && (
                  <div className="font-sans text-[12px] text-jewelInk-mid mt-1 italic">{translateResult.example}</div>
                )}
                <div className="font-sans text-[11px] text-gold-deep font-bold mt-1.5">✓ добавлено в словарь</div>
              </div>
            </div>
          )}
          {translateState === 'error' && (
            <div className="mt-2 font-sans text-[12px] text-ruby">Не удалось перевести. Попробуй другое слово.</div>
          )}
        </div>

        {!isStarterMode && (
          <>
            {/* Search */}
            <div className="relative mb-3">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 text-jewelInk/40"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
              >
                <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.8" />
                <path
                  d="M11 11 L14 14"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              <input
                className="w-full bg-cream-tile border-[1.5px] border-jewelInk rounded-xl pl-9 pr-3 py-3 font-sans text-[14px] text-jewelInk placeholder:text-jewelInk-hint outline-none focus:border-navy"
                style={{ boxShadow: '2px 2px 0 #15100A' }}
                placeholder="поиск по слову"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Filter chips */}
            <div className="grid grid-cols-4 gap-1.5 mb-5">
              <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
                все
              </FilterChip>
              <FilterChip active={filter === 'new'} onClick={() => setFilter('new')}>
                новые
              </FilterChip>
              <FilterChip active={filter === 'weak'} onClick={() => setFilter('weak')}>
                сложные
              </FilterChip>
              <FilterChip
                active={filter === 'mastered'}
                onClick={() => setFilter('mastered')}
              >
                изучено
              </FilterChip>
            </div>
          </>
        )}

        {/* Word list */}
        <div className="flex flex-col gap-2">
          {filtered.map((item, idx) => {
            const isItemSelected = selected.has(item.id)
            const isRemoving = removingIds.has(item.id)
            const { georgian, russian } = sides(item)
            const masteryColor =
              item.mastery === 'MasteredInBothDirections'
                ? 'bg-gold'
                : item.mastery === 'MasteredInForwardDirection'
                ? 'bg-navy'
                : 'bg-jewelInk/15'
            return (
              <div
                key={item.id}
                className={`jewel-tile flex items-center min-h-[56px] ${isItemSelected ? '!bg-ruby/10' : ''}`}
                style={isRemoving ? {
                  transform: 'translateX(-100%)',
                  opacity: 0,
                  transition: 'transform 250ms ease-out, opacity 250ms ease-out'
                } : undefined}
                role="listitem"
              >
                {/* Left zone: checkbox (only non-starter mode) */}
                {!isStarterMode && (
                  <button
                    onClick={() => toggle(item.id)}
                    className="shrink-0 w-[52px] flex items-center justify-center self-stretch"
                    aria-label="Выбрать для квиза"
                  >
                    <div className="relative z-[1] shrink-0 font-sans text-[10px] font-bold text-jewelInk-mid tabular-nums w-6 text-right mr-1">
                      {String(idx + 1).padStart(2, '0')}
                    </div>
                    <div
                      className={`relative z-[1] shrink-0 w-6 h-6 rounded-md border-[1.5px] flex items-center justify-center ${
                        isItemSelected
                          ? 'bg-ruby border-jewelInk'
                          : 'bg-cream-deep border-jewelInk/40'
                      }`}
                    >
                      {isItemSelected && (
                        <svg width="12" height="12" viewBox="0 0 18 18" fill="none">
                          <path
                            d="M3 9 L7 13 L15 4"
                            stroke="#FBF6EC"
                            strokeWidth="2.8"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                  </button>
                )}

                {/* Right zone: word content → opens card */}
                <button
                  onClick={() => openCard(item)}
                  className="flex-1 flex items-center gap-3 py-3 pr-4 min-h-[56px]"
                  style={isStarterMode ? { paddingLeft: '1rem' } : undefined}
                >
                  {isStarterMode && (
                    <div className="relative z-[1] shrink-0 font-sans text-[10px] font-bold text-jewelInk-mid tabular-nums w-6">
                      {String(idx + 1).padStart(2, '0')}
                    </div>
                  )}

                  <div className="relative z-[1] flex-1 min-w-0">
                    <div className="font-geo text-[18px] font-bold text-jewelInk leading-tight truncate">
                      {georgian}
                    </div>
                    <div className="font-sans text-[12px] text-jewelInk-mid truncate leading-snug mt-0.5">
                      {russian}
                    </div>
                  </div>

                  <div
                    className={`relative z-[1] w-2.5 h-2.5 rounded-full shrink-0 ${masteryColor} border border-jewelInk/30`}
                  />

                  {/* Chevron hint */}
                  <svg
                    className="relative z-[1] shrink-0 text-jewelInk/30"
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                  >
                    <path d="M4.5 2.5 L7.5 6 L4.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            )
          })}

          {filtered.length === 0 && (
            <div className="py-10 text-center font-sans text-[14px] text-jewelInk-mid">
              ничего не нашлось
            </div>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div
        className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto px-5 pt-4 bg-cream/95 backdrop-blur-sm border-t border-jewelInk/15 z-20 flex flex-col gap-2.5"
        style={{ paddingBottom: 'calc(var(--safe-b) + 16px)' }}
      >
        {isStarterMode ? (
          <Button variant="primary" onClick={() => startQuiz('starter')}>
            пробный квиз →
          </Button>
        ) : selected.size > 0 ? (
          <>
            <Button variant="primary" onClick={() => startQuiz('custom')}>
              квиз по выбранным ({selected.size})
            </Button>
            <Button variant="ghost" onClick={() => setSelected(new Set())}>
              снять выделение
            </Button>
          </>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <TinyButton color="navy" onClick={() => startQuiz('all')}>
              все
            </TinyButton>
            <TinyButton color="gold" onClick={() => startQuiz('new')}>
              новые
            </TinyButton>
            <TinyButton color="ruby" onClick={() => startQuiz('weak')}>
              сложные
            </TinyButton>
          </div>
        )}
      </div>

      {/* Word card bottom sheet */}
      {cardItem && (
        <WordCard
          item={cardItem}
          isSelected={selected.has(cardItem.id)}
          onClose={closeCard}
          onToggleSelect={toggle}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}

function TinyButton({
  children,
  color,
  onClick
}: {
  children: React.ReactNode
  color: 'navy' | 'gold' | 'ruby'
  onClick: () => void
}) {
  const styles: Record<string, string> = {
    navy: 'bg-navy text-cream',
    gold: 'bg-gold text-jewelInk',
    ruby: 'bg-ruby text-cream'
  }
  return (
    <button
      onClick={onClick}
      className={`px-2 py-3 rounded-xl border-[1.5px] border-jewelInk font-sans text-[12px] font-extrabold uppercase tracking-wide text-center transition-all duration-75 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none ${styles[color]}`}
      style={{ boxShadow: '2px 2px 0 #15100A' }}
    >
      {children}
    </button>
  )
}

function FilterChip({
  children,
  active,
  onClick
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border-[1.5px] px-3 py-2.5 min-h-[44px] flex items-center justify-center text-center font-sans text-[11px] font-bold uppercase tracking-wider transition-all duration-75 ${
        active
          ? 'bg-navy text-cream border-jewelInk'
          : 'bg-cream-tile text-jewelInk-mid border-jewelInk/25'
      }`}
      style={active ? { boxShadow: '2px 2px 0 #15100A' } : {}}
    >
      {children}
    </button>
  )
}

function pluralizeWord(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'слово'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'слова'
  return 'слов'
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
