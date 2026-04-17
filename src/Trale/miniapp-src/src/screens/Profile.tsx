import React, { useEffect, useMemo, useState } from 'react'
import Header from '../components/Header'
import Mascot from '../components/Mascot'
import ProPaywall from '../components/ProPaywall'
import KilimProgress from '../components/KilimProgress'
import AlphabetGrid from '../components/AlphabetGrid'
import LetterPopover from '../components/LetterPopover'
import { AlphabetLetterDto, CatalogDto, ProgressState, Screen } from '../types'
import { api } from '../api'

interface Props {
  catalog: CatalogDto
  progress: ProgressState
  setProgress: (p: ProgressState) => void
  isPro: boolean
  isOwner?: boolean
  telegramId?: number | null
  onPurchaseSuccess: () => void
  navigate: (s: Screen) => void
}

// Phrase of the day — small daily learning hit on the Profile screen.
const DAILY_PHRASES: { ge: string; ru: string; hint: string }[] = [
  { ge: 'როგორ ხარ?', ru: 'Как дела?', hint: 'Самый частый вопрос на улице' },
  { ge: 'მადლობა', ru: 'Спасибо', hint: 'Можно сократить до მადლი' },
  { ge: 'არაფერი', ru: 'Не за что', hint: 'Дословно — «ничего»' },
  { ge: 'ყავა, თუ შეიძლება', ru: 'Кофе, если можно', hint: 'Вежливая просьба' },
  { ge: 'ნახვამდის', ru: 'До свидания', hint: 'Дословно — «до встречи»' },
  { ge: 'ბოდიში', ru: 'Извини / простите', hint: 'Универсальное' },
  { ge: 'რამდენი ღირს?', ru: 'Сколько стоит?', hint: 'На рынке и в такси' },
  { ge: 'მე მიყვარს', ru: 'Я люблю', hint: 'Дательный: «мне любится»' },
  { ge: 'სუპერ!', ru: 'Супер!', hint: 'Заимствование, но звучит по-грузински' },
  { ge: 'წადი', ru: 'Иди / поехали', hint: 'Императив от წავიდე' },
  { ge: 'რა გქვია?', ru: 'Как тебя зовут?', hint: 'Дословно — «как тебе называется»' },
  { ge: 'აქ', ru: 'Здесь', hint: 'Минимум — два звука' },
  { ge: 'იქ', ru: 'Там', hint: 'И тоже два звука' },
  { ge: 'კარგია', ru: 'Хорошо', hint: 'Дословно — «есть хорошее»' },
]

function pickDailyPhrase(): { ge: string; ru: string; hint: string } {
  const day = Math.floor(Date.now() / (1000 * 60 * 60 * 24))
  return DAILY_PHRASES[day % DAILY_PHRASES.length]
}

function pickEncouragement(streak: number, totalLessons: number): string {
  if (streak >= 7) return `🔥 Стрик ${streak} дн — ты уже привычка!`
  if (streak >= 3) return `Третий день подряд — продолжай.`
  if (totalLessons === 0) return `Открой первый урок — алфавит ждёт.`
  if (totalLessons < 5) return `Уже несколько уроков. Ещё чуть-чуть — и почувствуешь язык.`
  if (totalLessons < 20) return `Половина пути. Грамматика начинает складываться.`
  return `Ты уже знаешь много. Бомбора гордится.`
}

export default function Profile({ catalog, progress, isPro, isOwner = false, telegramId, onPurchaseSuccess, navigate }: Props) {
  const [showPaywall, setShowPaywall] = useState(false)
  const [activityDates, setActivityDates] = useState<Set<string>>(new Set())
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null)
  const [showReveal, setShowReveal] = useState(false)
  const [stampFadingOut, setStampFadingOut] = useState(false)

  const modules = catalog.modules
  const totalDone = Object.values(progress.completedLessons).reduce(
    (s, arr) => s + arr.length,
    0
  )
  const phrase = pickDailyPhrase()
  const encouragement = pickEncouragement(progress.streak, totalDone)

  // Favorite module = module with the highest absolute completion progress
  const favorite = modules
    .filter((m) => m.lessons.length > 0)
    .map((m) => ({
      module: m,
      done: (progress.completedLessons[m.id] ?? []).length,
      total: m.lessons.length
    }))
    .sort((a, b) => b.done - a.done)[0]

  // Build learned letters set and letter data map from catalog + progress
  const { learnedLetters, letterData } = useMemo(() => {
    const alphabetModule = catalog.modules.find((m) => m.id === 'alphabet-progressive')
    const completedIds = new Set(progress.completedLessons['alphabet-progressive'] ?? [])
    const learned = new Set<string>()
    const data = new Map<string, AlphabetLetterDto>()
    for (const lesson of alphabetModule?.lessons ?? []) {
      for (const block of lesson.theory.blocks) {
        if (block.type === 'letters' && block.letters) {
          for (const dto of block.letters) {
            data.set(dto.letter, dto)
            if (completedIds.has(lesson.id)) {
              learned.add(dto.letter)
            }
          }
        }
      }
    }
    return { learnedLetters: learned, letterData: data }
  }, [catalog, progress.completedLessons])

  const learnedCount = learnedLetters.size

  // Trigger 33/33 reveal animation once
  useEffect(() => {
    if (learnedCount === 33 && localStorage.getItem('bombora_alphabet_complete_shown') !== '1') {
      localStorage.setItem('bombora_alphabet_complete_shown', '1')
      setShowReveal(true)
      setStampFadingOut(false)
      const t1 = setTimeout(() => setStampFadingOut(true), 2000)
      const t2 = setTimeout(() => setShowReveal(false), 2300)
      return () => { clearTimeout(t1); clearTimeout(t2) }
    }
  }, [learnedCount])

  useEffect(() => {
    let cancelled = false
    api
      .activityDays(35)
      .then((r) => {
        if (cancelled) return
        // Backend now returns ISO UTC timestamps; convert to user's LOCAL date
        // so playing at 02:00 local lights up today, not yesterday-UTC.
        const local = new Set<string>()
        for (const ts of r.dates) {
          const d = new Date(ts)
          if (isNaN(d.getTime())) continue
          local.add(localDateKey(d))
        }
        setActivityDates(local)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex flex-col min-h-full bg-cream">
      <Header
        progress={progress}
        onBack={() => navigate({ kind: 'dashboard' })}
        eyebrow="вкладка"
        title="Мой профиль"
      />

      <div
        className="flex-1 px-5 pt-6 pb-in"
        style={{ paddingBottom: 'calc(var(--safe-b) + 40px)' }}
      >
        {/* Hero — mascot + greeting + encouragement */}
        <div className="jewel-tile px-5 py-5 mb-5 relative overflow-hidden">
          {isPro && (
            <div
              className="absolute top-0 right-0 z-[2] bg-gold text-jewelInk text-[11px] font-extrabold px-2 py-1 border-l-[1.5px] border-b-[1.5px] border-jewelInk rounded-bl-md"
              style={{ borderTopRightRadius: '14px', animation: 'proBadgeAppear 350ms cubic-bezier(0.34,1.56,0.64,1) both' }}
            >
              ★ PRO
              <div className="font-geo text-[10px] text-gold-deep text-center mt-px">სრული</div>
            </div>
          )}

          <div className="relative z-[1] flex items-center gap-4">
            <div className="shrink-0">
              <Mascot mood={progress.streak >= 3 ? 'cheer' : 'happy'} size={88} />
            </div>
            <div className="flex-1">
              <div className="mn-eyebrow mb-1">გამარჯობა</div>
              <div className="font-sans text-[18px] font-extrabold text-jewelInk leading-tight">
                {encouragement}
              </div>
            </div>
          </div>
        </div>

        {/* Phrase of the day — daily learning hit */}
        <div className="mn-eyebrow mb-2">фраза дня</div>
        <div className="jewel-tile px-5 py-4 mb-5">
          <div className="relative z-[1] text-center">
            <div className="font-geo text-[26px] font-extrabold text-jewelInk leading-tight">
              {phrase.ge}
            </div>
            <div className="font-sans text-[14px] text-jewelInk-mid mt-1">
              {phrase.ru}
            </div>
            <div className="mn-eyebrow text-jewelInk-hint mt-3">
              {phrase.hint}
            </div>
          </div>
        </div>

        {/* Streak heatmap — last 35 days (5 weeks × 7) */}
        <div className="mn-eyebrow mb-2">активность · 35 дней</div>
        <div className="jewel-tile px-4 py-4 mb-5">
          <div className="relative z-[1]">
            <StreakHeatmap activityDates={activityDates} days={35} />
            <div className="font-sans text-[11px] text-jewelInk-mid text-center mt-2">
              {activityDates.size > 0
                ? `${activityDates.size} ${plural(activityDates.size, 'день', 'дня', 'дней')} с активностью`
                : 'Сделай первый шаг — добавь слово или пройди урок'}
            </div>
          </div>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          <StatCard label="стрик" value={`${progress.streak}`} unit="дн" accent="ruby" />
          <StatCard label="опыт" value={`${progress.xp}`} unit="xp" accent="navy" />
          <StatCard label="всего" value={`${totalDone}`} unit="ур" accent="gold" />
        </div>

        {/* My Alphabet widget */}
        <div className="mn-eyebrow mb-2">мой алфавит</div>
        <div className="jewel-tile px-4 py-4 mb-5 relative overflow-hidden">
          <div className="relative z-[1]">
            {/* Counter */}
            <div className="font-sans text-[15px] font-extrabold text-navy mb-3">
              {learnedCount} / 33 буквы
            </div>

            {/* KilimProgress */}
            <div className="mb-3">
              <KilimProgress done={learnedCount} total={33} accent="navy" size="sm" />
            </div>

            {/* Grid or empty state */}
            {learnedCount === 0 ? (
              <div className="flex items-start gap-3">
                <div className="shrink-0">
                  <Mascot mood="guide" size={48} />
                </div>
                <div className="mn-eyebrow text-jewelInk-hint leading-relaxed">
                  Начни модуль «Алфавит» — буквы откроются по мере уроков
                </div>
              </div>
            ) : (
              <AlphabetGrid
                learnedLetters={learnedLetters}
                onLetterTap={setSelectedLetter}
                goldFlash={showReveal}
              />
            )}
          </div>

          {/* 33/33 reveal stamp */}
          {showReveal && (
            <div
              className="absolute inset-0 flex items-center justify-center z-[2]"
              style={{
                opacity: stampFadingOut ? 0 : 1,
                transition: stampFadingOut ? 'opacity 300ms ease-in' : 'none'
              }}
            >
              <div
                className="bg-gold border-[1.5px] border-jewelInk rounded-lg px-4 py-2 text-center"
                style={{ boxShadow: 'none' }}
              >
                <div className="font-geo text-[22px] text-jewelInk">მთელი ანბანი!</div>
                <div className="font-sans text-[13px] text-jewelInk-mid mt-1">
                  Ты знаешь весь грузинский алфавит
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Favorite module */}
        {favorite && favorite.done > 0 && (
          <>
            <div className="mn-eyebrow mb-2">любимый раздел</div>
            <button
              onClick={() => navigate({ kind: 'module', moduleId: favorite.module.id })}
              className="jewel-tile jewel-pressable text-left w-full px-4 py-3 mb-5"
            >
              <div className="relative z-[1] flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-sans text-[15px] font-extrabold text-jewelInk">
                    {favorite.module.title}
                  </div>
                  <div className="font-sans text-[11px] text-jewelInk-mid mt-0.5">
                    Пройдено: {favorite.done} / {favorite.total} уроков
                  </div>
                </div>
                <span className="text-jewelInk-hint text-[14px] shrink-0">→</span>
              </div>
            </button>
          </>
        )}

        {/* Pro CTA / refund */}
        {!isPro ? (
          <div className="jewel-tile px-5 py-4 mb-5">
            <div className="relative z-[1]">
              <div className="flex items-center gap-1 mb-0.5">
                <span className="text-gold text-[13px] font-bold">★</span>
                <span className="font-sans text-[14px] font-bold text-jewelInk">Открыть всё</span>
              </div>
              <div className="font-sans text-[11px] text-jewelInk-mid mb-3">
                Все модули, словарь без лимита, новые уроки по мере выхода
              </div>
              <button
                onClick={() => setShowPaywall(true)}
                className="w-full font-sans text-[14px] font-extrabold text-jewelInk min-h-[44px] rounded border-[1.5px] border-jewelInk flex items-center justify-center"
                style={{ background: '#F5B820', boxShadow: '0 2px 0 #15100A' }}
              >
                Выбрать тариф
              </button>
            </div>
          </div>
        ) : (
          <RefundButton onRefunded={onPurchaseSuccess} />
        )}

        <style>{`
          @keyframes proBadgeAppear {
            from { transform: scale(0.5); opacity: 0; }
            to   { transform: scale(1);   opacity: 1; }
          }
        `}</style>

        {/* Settings: change level */}
        <div className="mn-eyebrow mb-2 mt-2">настройки</div>
        <button
          onClick={() => navigate({ kind: 'onboarding' })}
          className="jewel-tile jewel-pressable w-full text-left px-4 py-3"
        >
          <div className="relative z-[1]">
            <div className="font-sans text-[14px] font-bold text-jewelInk">
              Сменить уровень
            </div>
            <div className="font-sans text-[11px] text-jewelInk-mid mt-0.5">
              Если хочешь начать заново или поменять стартовую точку
            </div>
          </div>
        </button>

        {/* Referral — invite friends, get bonus */}
        <ReferralCard />

        {/* Telegram ID for support — copyable */}
        {telegramId != null && <TelegramIdCard telegramId={telegramId} />}

        {/* Legal */}
        <div className="mt-6 flex justify-center gap-4 font-sans text-[12px] text-jewelInk-mid">
          <a href="/privacy.html" target="_blank" rel="noopener" className="underline">Приватность</a>
          <span className="text-jewelInk-hint">·</span>
          <a href="/terms.html" target="_blank" rel="noopener" className="underline">Условия</a>
        </div>

        {/* Owner-only entries */}
        {isOwner && (
          <button
            onClick={() => navigate({ kind: 'admin' })}
            className="mt-6 jewel-tile jewel-pressable w-full text-left px-4 py-3"
          >
            <div className="relative z-[1] flex items-center justify-between gap-3">
              <div>
                <div className="font-sans text-[14px] font-bold text-jewelInk">📊 Админка</div>
                <div className="font-sans text-[11px] text-jewelInk-mid mt-0.5">
                  Аналитика, пользователи, гранты
                </div>
              </div>
              <span className="text-jewelInk-hint text-[14px] shrink-0">→</span>
            </div>
          </button>
        )}
        {isOwner && <OwnerDebugPanel />}

        <div className="mt-6 text-center">
          <div className="font-sans text-[10px] font-bold text-jewelInk-hint uppercase tracking-widest">
            TraleBot · ბომბორა · 2026
          </div>
        </div>
      </div>

      <div className="mn-kilim opacity-70" />
      <div style={{ height: 'calc(var(--safe-b) + 4px)' }} />

      {/* Pro Paywall — rendered at root so fixed positioning isn't broken
          by ancestor transform/contain on the scroll container. */}
      {showPaywall && (
        <ProPaywall
          trigger="module"
          onClose={() => setShowPaywall(false)}
          onPurchaseSuccess={() => {
            setShowPaywall(false)
            onPurchaseSuccess()
          }}
        />
      )}

      {/* Letter popover — rendered at root for correct fixed positioning */}
      {selectedLetter !== null && (
        <LetterPopover
          letter={selectedLetter}
          data={letterData.get(selectedLetter) ?? null}
          isLearned={learnedLetters.has(selectedLetter)}
          onClose={() => setSelectedLetter(null)}
        />
      )}
    </div>
  )
}

function ReferralCard() {
  const [data, setData] = useState<{
    link: string
    shareText: string
    invitedCount: number
    activatedCount: number
    bonusLabel: string
    todayActivated: number
    dailyLimit: number
    yearActivated: number
    yearlyLimit: number
  } | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    api
      .referral()
      .then((r) => { if (!cancelled) setData(r) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  if (!data) return null

  async function copy() {
    if (!data) return
    try {
      const tg = (window as any).Telegram?.WebApp
      if (tg?.HapticFeedback?.impactOccurred) tg.HapticFeedback.impactOccurred('light')
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(data.link)
      } else {
        const ta = document.createElement('textarea')
        ta.value = data.link
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  function share() {
    const tg = (window as any).Telegram?.WebApp
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(
      data!.link
    )}&text=${encodeURIComponent(data!.shareText)}`
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(shareUrl)
    } else {
      window.open(shareUrl, '_blank', 'noopener')
    }
  }

  return (
    <div className="mt-6">
      <div className="mn-eyebrow mb-2">пригласи друга</div>
      <div className="jewel-tile px-4 py-4">
        <div className="relative z-[1]">
          <div className="font-sans text-[13px] text-jewelInk-mid mb-3 leading-snug">
            Друг получит 60 дней триала вместо 30. Ты — {data.bonusLabel}, когда он
            пройдёт первый урок или добавит 5 слов.
          </div>
          <div className="flex items-center gap-2 mb-3 jewel-tile px-3 py-2">
            <div className="relative z-[1] flex-1 min-w-0 font-sans text-[12px] text-jewelInk truncate">
              {data.link}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={share}
              className="flex-1 font-sans text-[13px] font-extrabold text-jewelInk min-h-[40px] rounded border-[1.5px] border-jewelInk"
              style={{ background: '#F5B820', boxShadow: '0 2px 0 #15100A' }}
            >
              Поделиться
            </button>
            <button
              onClick={copy}
              className="flex-1 font-sans text-[13px] font-bold text-jewelInk min-h-[40px] rounded border-[1.5px] border-jewelInk/40"
            >
              {copied ? '✓ скопировано' : 'Копировать'}
            </button>
          </div>
          {data.invitedCount > 0 && (
            <div className="mt-3 font-sans text-[11px] text-jewelInk-mid">
              Пригласил: {data.invitedCount} · активных: {data.activatedCount}
            </div>
          )}
          <div className="mt-2 font-sans text-[10px] text-jewelInk-hint">
            {data.todayActivated >= data.dailyLimit
              ? 'Сегодня лимит достигнут, бонусы продолжатся завтра'
              : `До ${data.dailyLimit} бонусов в день · до ${data.yearlyLimit} в год`}
          </div>
        </div>
      </div>
    </div>
  )
}

function TelegramIdCard({ telegramId }: { telegramId: number }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    const text = String(telegramId)
    try {
      // Telegram WebApp helper if available
      const tg = (window as any).Telegram?.WebApp
      if (tg?.HapticFeedback?.impactOccurred) tg.HapticFeedback.impactOccurred('light')

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        // Fallback for older webviews
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Best effort
    }
  }

  return (
    <div className="mt-6">
      <div className="mn-eyebrow mb-2">для техподдержки</div>
      <button
        onClick={copy}
        className="jewel-tile jewel-pressable w-full text-left px-4 py-3"
      >
        <div className="relative z-[1] flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="font-sans text-[11px] text-jewelInk-mid mb-0.5">
              Твой Telegram ID
            </div>
            <div className="font-sans text-[16px] font-extrabold text-jewelInk tabular-nums">
              {telegramId}
            </div>
          </div>
          <span className="font-sans text-[12px] font-bold text-jewelInk-mid shrink-0">
            {copied ? '✓ скопировано' : '📋 копировать'}
          </span>
        </div>
      </button>
    </div>
  )
}

// "yyyy-MM-dd" in the device's local timezone — used as the canonical key
// for both stored activity timestamps and the heatmap cells.
function localDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function plural(n: number, one: string, two: string, many: string): string {
  const mod100 = n % 100
  const mod10 = n % 10
  if (mod100 >= 11 && mod100 <= 14) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return two
  return many
}

function StreakHeatmap({ activityDates, days }: { activityDates: Set<string>; days: number }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const cells: { date: string; active: boolean; isToday: boolean }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const key = localDateKey(d)
    cells.push({
      date: key,
      active: activityDates.has(key),
      isToday: i === 0
    })
  }

  // Render as 5 rows × 7 columns (oldest top-left, today bottom-right)
  const rows: typeof cells[] = []
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7))
  }

  return (
    <div className="flex flex-col gap-1.5 items-center">
      {rows.map((row, ri) => (
        <div key={ri} className="flex gap-1.5">
          {row.map((c) => (
            <div
              key={c.date}
              title={c.date}
              className="w-6 h-6 rounded border-[1.5px] border-jewelInk"
              style={{
                background: c.active ? '#0d4a6e' : 'rgba(21,16,10,0.06)',
                outline: c.isToday ? '2px solid #F5B820' : 'none',
                outlineOffset: c.isToday ? '1px' : undefined
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function StatCard({
  label,
  value,
  unit,
  accent
}: {
  label: string
  value: string
  unit: string
  accent: 'navy' | 'ruby' | 'gold'
}) {
  const accentText =
    accent === 'navy' ? 'text-navy' : accent === 'ruby' ? 'text-ruby' : 'text-gold-deep'
  return (
    <div className="jewel-tile px-3 py-3 text-center">
      <div className="relative z-[1]">
        <div className="mn-eyebrow text-jewelInk-mid mb-1">{label}</div>
        <div className={`font-sans text-[22px] font-extrabold tabular-nums leading-none ${accentText}`}>
          {value}
        </div>
        <div className="font-sans text-[10px] font-bold text-jewelInk-hint uppercase tracking-wider mt-0.5">
          {unit}
        </div>
      </div>
    </div>
  )
}

function RefundButton({ onRefunded }: { onRefunded: () => void }) {
  const [state, setState] = useState<'idle' | 'confirming' | 'pending' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function doRefund() {
    setState('pending')
    setErrorMsg(null)
    try {
      await api.refund()
      setState('done')
      setTimeout(onRefunded, 1200)
    } catch (e: any) {
      setState('error')
      setErrorMsg(e?.message ?? 'Не получилось')
    }
  }

  if (state === 'done') {
    return (
      <div className="mt-2 mb-5 jewel-tile px-4 py-3 text-center">
        <div className="relative z-[1] font-sans text-[13px] font-bold text-jewelInk">
          ✓ Возврат оформлен
        </div>
      </div>
    )
  }

  if (state === 'confirming') {
    return (
      <div className="mt-2 mb-5 jewel-tile px-4 py-4">
        <div className="relative z-[1]">
          <div className="font-sans text-[14px] font-bold text-jewelInk mb-1">
            Вернуть звёзды?
          </div>
          <div className="font-sans text-[12px] text-jewelInk-mid mb-3">
            Подписка будет отменена, звёзды вернутся в твой Telegram-кошелёк
          </div>
          <div className="flex gap-2">
            <button
              onClick={doRefund}
              className="flex-1 font-sans text-[13px] font-extrabold text-cream min-h-[40px] rounded border-[1.5px] border-jewelInk"
              style={{ background: '#b54e5e', boxShadow: '0 2px 0 #15100A' }}
            >
              Вернуть
            </button>
            <button
              onClick={() => setState('idle')}
              className="flex-1 font-sans text-[13px] font-bold text-jewelInk min-h-[40px] rounded border-[1.5px] border-jewelInk/40"
            >
              Отмена
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-5">
      <button
        onClick={() => setState('confirming')}
        disabled={state === 'pending'}
        className="w-full font-sans text-[13px] text-jewelInk-mid py-2 underline opacity-60 active:opacity-100 transition-opacity"
      >
        {state === 'pending' ? 'Оформляем возврат…' : 'Запросить возврат подписки'}
      </button>
      {errorMsg && (
        <div className="mt-1 font-sans text-[11px] text-ruby text-center">{errorMsg}</div>
      )}
    </div>
  )
}

function OwnerDebugPanel() {
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 1500)
  }

  function clearKeys(keys: string[], label: string) {
    for (const k of keys) localStorage.removeItem(k)
    showToast(`${label} → cleared`)
  }

  function clearAllLocalStorage() {
    if (!confirm('Очистить весь localStorage?')) return
    localStorage.clear()
    showToast('localStorage cleared')
  }

  function reload() {
    location.reload()
  }

  const actions = [
    { label: 'Сбросить reveal ქ', hint: 'Покажет оверлей буквы ქ снова', fn: () => clearKeys(['bombora_kani_reveal_shown'], 'kani reveal') },
    { label: 'Сбросить unlock-анимации', hint: 'Повторит анимацию открытия секций', fn: () => clearKeys(['bombora_unlocked_once'], 'unlock') },
    { label: 'Сбросить алфавит 33/33', hint: 'Повторит анимацию завершения алфавита', fn: () => clearKeys(['bombora_alphabet_complete_shown'], 'alphabet complete') },
    { label: 'Очистить весь localStorage', hint: 'Онбординг, прогресс UI, флаги', fn: clearAllLocalStorage },
    { label: 'Reload мини-аппа', hint: 'location.reload()', fn: reload },
  ]

  return (
    <div className="mt-8">
      <div className="mn-eyebrow mb-3">debug (owner only)</div>
      <div className="flex flex-col gap-2">
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={a.fn}
            className="jewel-tile jewel-pressable w-full text-left px-4 py-3"
          >
            <div className="relative z-[1] flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-sans text-[13px] font-bold text-jewelInk">{a.label}</div>
                <div className="font-sans text-[11px] text-jewelInk-mid mt-0.5">{a.hint}</div>
              </div>
              <span className="text-jewelInk-hint text-[12px] shrink-0">→</span>
            </div>
          </button>
        ))}
      </div>

      {toast && (
        <div
          className="fixed left-1/2 bottom-[80px] -translate-x-1/2 z-50 bg-jewelInk text-cream font-sans text-[13px] font-bold px-4 py-2 rounded-lg border-[1.5px] border-jewelInk"
          style={{ boxShadow: '2px 2px 0 #15100A' }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
