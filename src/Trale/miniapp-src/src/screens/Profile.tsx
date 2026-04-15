import React, { useState } from 'react'
import Header from '../components/Header'
import Mascot from '../components/Mascot'
import KilimProgress from '../components/KilimProgress'
import ProPaywall from '../components/ProPaywall'
import { CatalogDto, ProgressState, Screen } from '../types'

interface Props {
  catalog: CatalogDto
  progress: ProgressState
  setProgress: (p: ProgressState) => void
  isPro: boolean
  onPurchaseSuccess: () => void
  navigate: (s: Screen) => void
}

export default function Profile({ catalog, progress, isPro, onPurchaseSuccess, navigate }: Props) {
  const [showPaywall, setShowPaywall] = useState(false)
  const modules = catalog.modules
  const totalDone = Object.values(progress.completedLessons).reduce(
    (s, arr) => s + arr.length,
    0
  )
  const totalAvailable = modules.reduce((s, m) => s + m.lessons.length, 0)

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
        {/* Passport card */}
        <div className="jewel-tile px-5 py-5 mb-6 relative overflow-hidden">
          {/* Pro corner badge for Pro users */}
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
              <Mascot mood="happy" size={96} />
            </div>
            <div className="flex-1">
              <div className="mn-eyebrow mb-1">владелец</div>
              <div className="font-sans text-[20px] font-extrabold text-jewelInk leading-none">
                ученик
              </div>
              <div className="font-geo text-[13px] font-bold text-jewelInk-mid mt-1.5">
                ქართული
              </div>
            </div>
          </div>

          <div className="relative z-[1] mt-5 pt-4 border-t border-jewelInk/15 grid grid-cols-3 gap-3">
            <PassportField
              label="стрик"
              value={`${progress.streak}`}
              unit="дн"
              accent="ruby"
            />
            <PassportField
              label="опыт"
              value={`${progress.xp}`}
              unit="xp"
              accent="navy"
            />
            <PassportField
              label="уроков"
              value={`${totalDone}`}
              unit={`/ ${totalAvailable}`}
              accent="gold"
            />
          </div>

          {/* Upgrade CTA for free users */}
          {!isPro && (
            <div className="relative z-[1] mt-4 pt-4 border-t border-jewelInk/15">
              <div className="flex items-center gap-1 mb-0.5">
                <span className="text-gold text-[13px] font-bold">★</span>
                <span className="font-sans text-[13px] font-bold text-jewelInk">Про-доступ</span>
              </div>
              <div className="font-sans text-[11px] text-jewelInk-mid mb-3">
                Открыть все модули
              </div>
              <button
                onClick={() => setShowPaywall(true)}
                className="w-full font-sans text-[14px] font-extrabold text-jewelInk min-h-[40px] rounded border-[1.5px] border-jewelInk flex items-center justify-center"
                style={{ background: '#F5B820', boxShadow: '0 2px 0 #15100A' }}
              >
                Купить за 150 ⭐
              </button>
            </div>
          )}
        </div>

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

        <style>{`
          @keyframes proBadgeAppear {
            from { transform: scale(0.5); opacity: 0; }
            to   { transform: scale(1);   opacity: 1; }
          }
        `}</style>

        {/* Module progress */}
        <div className="mn-eyebrow mb-3">разделы блокнота</div>
        <div className="flex flex-col gap-4">
          {modules.map((m) => {
            const total = m.lessons.length
            const done = (progress.completedLessons[m.id] ?? []).length
            const accent: 'navy' | 'ruby' | 'gold' =
              m.id === 'alphabet'
                ? 'navy'
                : m.id === 'verbs-of-movement'
                ? 'ruby'
                : 'gold'
            const accentText =
              accent === 'navy'
                ? 'text-navy'
                : accent === 'ruby'
                ? 'text-ruby'
                : 'text-gold-deep'

            if (total === 0) {
              return (
                <div
                  key={m.id}
                  className="jewel-tile px-4 py-3 flex items-center justify-between"
                >
                  <div className="relative z-[1]">
                    <div className="font-sans text-[15px] font-bold text-jewelInk">
                      {m.title}
                    </div>
                    <div className="font-sans text-[11px] text-jewelInk-mid">
                      живой словарь
                    </div>
                  </div>
                </div>
              )
            }

            const isDone = done === total
            return (
              <div key={m.id} className="jewel-tile px-4 py-4">
                <div className="relative z-[1]">
                  <div className="flex items-baseline justify-between mb-2 gap-2">
                    <div className="font-sans text-[15px] font-bold text-jewelInk truncate">
                      {m.title}
                    </div>
                    <div className="shrink-0 font-sans text-[12px] font-bold tabular-nums">
                      {isDone ? (
                        <span className="text-gold-deep">
                          ✓ {done} / {total}
                        </span>
                      ) : (
                        <>
                          <span className={accentText}>{done}</span>
                          <span className="text-jewelInk-hint"> / {total}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <KilimProgress done={done} total={total} accent={accent} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Change level */}
        <div className="mt-8">
          <button
            onClick={() => navigate({ kind: 'onboarding' })}
            className="jewel-tile jewel-pressable w-full text-left px-4 py-4"
          >
            <div className="relative z-[1]">
              <div className="font-sans text-[15px] font-bold text-jewelInk">
                Выбрать свой уровень
              </div>
              <div className="font-sans text-[12px] text-jewelInk-mid mt-0.5">
                Если пропустили этот шаг или хотите изменить
              </div>
            </div>
          </button>
        </div>

        <div className="mt-6 text-center">
          <div className="mn-eyebrow text-jewelInk-mid">
            учись в своём темпе — блокнот ждёт
          </div>
          <div className="mt-4 font-sans text-[10px] font-bold text-jewelInk-hint uppercase tracking-widest">
            ბომბორა · 2026
          </div>
        </div>
      </div>

      <div className="mn-kilim opacity-70" />
      <div style={{ height: 'calc(var(--safe-b) + 4px)' }} />
    </div>
  )
}

function PassportField({
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
    <div className="text-center">
      <div className="mn-eyebrow text-jewelInk-mid mb-1">{label}</div>
      <div
        className={`font-sans text-[22px] font-extrabold tabular-nums leading-none ${accentText}`}
      >
        {value}
      </div>
      <div className="font-sans text-[10px] font-bold text-jewelInk-hint uppercase tracking-wider mt-0.5">
        {unit}
      </div>
    </div>
  )
}
