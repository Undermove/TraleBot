import React, { useEffect, useMemo, useState } from 'react'
import Header from '../components/Header'
import Mascot from '../components/Mascot'
import Button from '../components/Button'
import { ProgressState, Screen } from '../types'
import { api, ApiError, VocabularyItem, VocabularyQuizMode } from '../api'

interface Props {
  progress: ProgressState
  navigate: (s: Screen) => void
}

type Phase = 'loading' | 'auth-required' | 'ready' | 'error'
type Filter = 'all' | 'new' | 'weak' | 'mastered'

export default function VocabularyList({ progress, navigate }: Props) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [items, setItems] = useState<VocabularyItem[]>([])
  const [isStarterMode, setIsStarterMode] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())

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
        if (item.successCount > 0 || item.successReverseCount > 0 || item.failedCount > 0) return false
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

  if (phase === 'loading') {
    return (
      <div className="flex flex-col min-h-full">
        <Header progress={progress} onBack={() => navigate({ kind: 'dashboard' })} title="Мой словарь" />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <Mascot mood="think" size={120} />
          <div className="text-dog-muted">Бомбора роется в твоём словарике...</div>
        </div>
      </div>
    )
  }

  if (phase === 'auth-required') {
    return (
      <div className="flex flex-col min-h-full">
        <Header progress={progress} onBack={() => navigate({ kind: 'dashboard' })} title="Мой словарь" />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-5 text-center">
          <Mascot mood="sleep" size={120} />
          <div className="font-extrabold text-lg">Открывай через Telegram</div>
          <div className="text-dog-muted">
            Чтобы Бомбора узнал твой словарь, зайди в мини-аб через кнопку «🐶 Бомбора» в боте.
          </div>
          <Button variant="ghost" onClick={() => navigate({ kind: 'dashboard' })}>
            На главную
          </Button>
        </div>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="flex flex-col min-h-full">
        <Header progress={progress} onBack={() => navigate({ kind: 'dashboard' })} title="Мой словарь" />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-5 text-center">
          <Mascot mood="sleep" size={120} />
          <div className="text-dog-muted">Что-то пошло не так. Попробуй ещё раз позже.</div>
          <Button variant="ghost" onClick={() => navigate({ kind: 'dashboard' })}>
            На главную
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full">
      <Header progress={progress} onBack={() => navigate({ kind: 'dashboard' })} title="Мой словарь" />
      <div className="flex-1 p-5 pb-36 anim-slide">
        <div className="bg-white rounded-3xl shadow-card p-4 mb-4 flex items-center gap-3">
          <Mascot mood={isStarterMode ? 'think' : 'happy'} size={72} />
          <div className="flex-1">
            <div className="font-extrabold">
              {isStarterMode
                ? 'Твой словарь пока пуст'
                : `${items.length} ${pluralizeWord(items.length)} в словаре`}
            </div>
            <div className="text-dog-muted text-sm">
              {isStarterMode
                ? 'Начни с базового набора слов от Бомборы, а свои слова добавляй через бота'
                : 'Выбери слова галочками или жми готовые наборы ниже'}
            </div>
          </div>
        </div>

        <input
          className="w-full bg-white rounded-2xl shadow-card px-4 py-3 font-semibold outline-none border-2 border-transparent focus:border-dog-accent"
          placeholder="Поиск по слову или переводу"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="grid grid-cols-4 gap-1.5 mt-3">
          <Chip active={filter === 'all'} onClick={() => setFilter('all')}>Все</Chip>
          <Chip active={filter === 'new'} onClick={() => setFilter('new')}>Новые</Chip>
          <Chip active={filter === 'weak'} onClick={() => setFilter('weak')}>Сложные</Chip>
          <Chip active={filter === 'mastered'} onClick={() => setFilter('mastered')}>Изучено</Chip>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {filtered.map((item) => {
            const isSelected = selected.has(item.id)
            const masteryDot =
              item.mastery === 'MasteredInBothDirections'
                ? 'bg-dog-green'
                : item.mastery === 'MasteredInForwardDirection'
                ? 'bg-dog-gold'
                : 'bg-dog-line'
            const { georgian, russian } = sides(item)
            return (
              <button
                key={item.id}
                onClick={() => toggle(item.id)}
                className={`text-left bg-white rounded-2xl shadow-card p-3 flex items-center gap-3 transition active:translate-y-1 border-2 ${
                  isSelected ? 'border-dog-accent' : 'border-transparent'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center font-extrabold text-xs ${
                    isSelected ? 'bg-dog-accent text-white' : 'bg-dog-line text-transparent'
                  }`}
                >
                  ✓
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold truncate">{georgian}</div>
                  <div className="text-dog-muted text-sm truncate">{russian}</div>
                </div>
                <div className={`w-2.5 h-2.5 rounded-full ${masteryDot}`} />
              </button>
            )
          })}
          {filtered.length === 0 && (
            <div className="text-center text-dog-muted p-6">Ничего не нашлось</div>
          )}
        </div>
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto px-4 pt-4 bg-dog-bg/95 backdrop-blur border-t border-dog-line flex flex-col gap-2"
        style={{ paddingBottom: 'calc(var(--safe-b) + 16px)' }}
      >
        {isStarterMode ? (
          <Button variant="green" onClick={() => startQuiz('starter')}>
            ▶ Пробный квиз ({items.length} слов)
          </Button>
        ) : selected.size > 0 ? (
          <>
            <Button variant="green" onClick={() => startQuiz('custom')}>
              ▶ Квиз по выбранным ({selected.size})
            </Button>
            <Button variant="ghost" onClick={() => setSelected(new Set())}>
              Снять выделение
            </Button>
          </>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <QuickQuizButton variant="green" onClick={() => startQuiz('all')}>
              Все
            </QuickQuizButton>
            <QuickQuizButton variant="blue" onClick={() => startQuiz('new')}>
              Новые
            </QuickQuizButton>
            <QuickQuizButton variant="primary" onClick={() => startQuiz('weak')}>
              Сложные
            </QuickQuizButton>
          </div>
        )}
      </div>
    </div>
  )
}

function QuickQuizButton({
  children,
  variant,
  onClick
}: {
  children: React.ReactNode
  variant: 'green' | 'blue' | 'primary'
  onClick: () => void
}) {
  const styles: Record<string, string> = {
    green: 'bg-dog-green text-white shadow-btngreen',
    blue: 'bg-dog-blue text-white shadow-btnblue',
    primary: 'bg-dog-accent text-white shadow-btn'
  }
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl px-2 py-3 font-extrabold uppercase text-xs tracking-tight transition active:translate-y-1 text-center ${styles[variant]}`}
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

function Chip({
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
      className={`rounded-full px-2 py-1.5 text-xs font-extrabold shadow-card text-center ${
        active ? 'bg-dog-accent text-white' : 'bg-white text-dog-ink'
      }`}
    >
      {children}
    </button>
  )
}
