import React from 'react'

interface LaunchPathBarProps {
  completedModules: string[]
  launchModuleIds: string[]
}

const GEO_LETTERS = ['ა', 'ბ', 'გ', 'დ', 'ე', 'ვ']
const LABELS = ['Алф', 'Числа', 'Знак', 'Мест', 'Наст', 'Слов']

export default function LaunchPathBar({ completedModules, launchModuleIds }: LaunchPathBarProps) {
  const completedSet = new Set(completedModules)
  const completionState = launchModuleIds.map((id) => completedSet.has(id))

  // First incomplete module index = "current"
  const currentIdx = completionState.findIndex((done) => !done)

  return (
    <div className="px-5 py-4">
      <div className="mn-eyebrow mb-3" style={{ color: '#7A6B52' }}>
        рекомендуемый маршрут
      </div>
      <div className="flex items-start justify-between">
        {launchModuleIds.map((_, idx) => {
          const isDone = completionState[idx]
          const isCurrent = idx === currentIdx
          const label = LABELS[idx] ?? ''
          const letter = GEO_LETTERS[idx] ?? '?'

          return (
            <React.Fragment key={idx}>
              {/* Node + label */}
              <div className="flex flex-col items-center gap-1.5" style={{ minWidth: 0 }}>
                <div
                  className="flex items-center justify-center rounded-full shrink-0"
                  style={{
                    width: 28,
                    height: 28,
                    background: isDone
                      ? '#1B5FB0'
                      : isCurrent
                      ? '#F5B820'
                      : '#F5EFE0',
                    border: isDone || isCurrent
                      ? 'none'
                      : '1.5px solid rgba(21,16,10,0.2)',
                  }}
                >
                  <span
                    className="font-geo font-bold leading-none"
                    style={{
                      fontSize: 12,
                      color: isDone
                        ? '#FBF6EC'
                        : isCurrent
                        ? '#15100A'
                        : 'rgba(21,16,10,0.4)',
                    }}
                  >
                    {letter}
                  </span>
                </div>
                <span
                  className="font-sans text-center leading-none"
                  style={{
                    fontSize: 9,
                    color: isDone || isCurrent ? '#7A6B52' : 'rgba(122,107,82,0.5)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </span>
              </div>

              {/* Connector line between nodes */}
              {idx < launchModuleIds.length - 1 && (
                <div
                  className="flex-1 mt-3.5"
                  style={{
                    height: 1.5,
                    background: isDone
                      ? 'rgba(27,95,176,0.5)'
                      : 'rgba(21,16,10,0.2)',
                  }}
                />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
