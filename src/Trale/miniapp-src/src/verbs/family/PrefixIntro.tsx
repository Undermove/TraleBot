import React, { useEffect, useState } from 'react'
import Button from '../../components/Button'
import LoaderLetter from '../../components/LoaderLetter'
import Mascot from '../../components/Mascot'
import { cyr } from '../types'
import { SessionHeader, type SceneHooks } from '../ui/GameShell'
import { markHintSeen } from '../ui/hints'
import { openLessonModule } from './nav'
import { PREFIX_INTRO_HINT, parseIntroLine } from './prefixPlan'
import { loadFamily } from './store'
import type { FamilyDto } from './types'

// Вступление первой сессии про приставку — для того, кто уроки о приставках не проходил.
// Экраны — теория этих уроков слово в слово (её отдаёт сервер); своего грузинского здесь нет.
// Показывается один раз: отметка ставится, когда вступление дочитано.

interface Props {
  familyId: string
  scene: SceneHooks
  onExit: () => void
}

export default function PrefixIntro({ familyId, scene, onExit }: Props) {
  const [family, setFamily] = useState<FamilyDto | null>(null)
  const [step, setStep] = useState(0)

  function done() {
    markHintSeen(PREFIX_INTRO_HINT)
    scene.onStep()
    scene.onDone()
  }

  useEffect(() => {
    let alive = true
    // Без вступления сыграть можно: не загрузилось или показывать нечего — идём дальше.
    loadFamily(familyId).then(f => { if (alive) (f.intro.screens.length ? setFamily(f) : done()) }).catch(() => { if (alive) done() })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId])

  if (!family) {
    return <div className="min-h-[100dvh] flex items-center justify-center" data-testid="prefix-intro-loading"><LoaderLetter size={96} /></div>
  }

  const screens = family.intro.screens
  const screen = screens[Math.min(step, screens.length - 1)]
  const last = step >= screens.length - 1

  return (
    <div className="j-root flex flex-col min-h-[100dvh]" data-testid="prefix-intro" data-step={step}>
      <SessionHeader />
      <div className="px-5 flex-1 flex flex-col justify-center gap-4 py-4">
        <div className="flex items-start gap-3">
          <Mascot mood="guide" size={72} className="shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="mn-eyebrow text-navy">Приставки · {step + 1} из {screens.length}</div>
            <div className="mt-1 text-[16px] font-bold leading-snug">
              {step === 0
                ? <>Дальше — тот же глагол «{family.baseName}». Меняется только начало слова: оно говорит, куда идут.</>
                : <>Ещё приставки — у того же «{family.baseName}».</>}
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-cream-tile border-[1.5px] border-jewelInk overflow-hidden j-rise" key={step} style={{ boxShadow: '3px 3px 0 #15100A' }}>
          <div className="px-4 py-2 bg-navy text-cream text-[12px] font-bold">Из урока «{screen.title}»</div>
          {screen.lines.map((line, i) => {
            const parsed = parseIntroLine(line)
            return (
              <div key={i} className="px-4 py-2.5 border-t border-cream-edge" data-testid="prefix-intro-line">
                {parsed ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="font-geo text-[20px] font-extrabold text-navy">{parsed.prefix}-</span>
                      <span className="text-[11px] text-jewelInk-hint"> {cyr(parsed.prefix)}-</span>
                      <span className="block text-[14px] font-bold text-jewelInk">{parsed.meaning}</span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className="block font-geo text-[17px] font-bold leading-tight">
                        {parsed.example.startsWith(parsed.prefix)
                          ? <><span className="text-navy">{parsed.prefix}</span>{parsed.example.slice(parsed.prefix.length)}</>
                          : parsed.example}
                      </span>
                      <span className="block text-[11px] text-jewelInk-hint leading-tight">{cyr(parsed.example)}</span>
                      <span className="block text-[12px] text-jewelInk-mid leading-tight">{parsed.exampleRu}</span>
                    </span>
                  </div>
                ) : (
                  <div className="font-geo text-[15px] font-bold text-jewelInk">{line}</div>
                )}
              </div>
            )
          })}
        </div>

        {family.intro.moduleId && (
          <button
            className="self-center min-h-[44px] text-[12px] text-navy underline" data-testid="prefix-intro-lesson"
            onClick={() => { markHintSeen(PREFIX_INTRO_HINT); onExit(); openLessonModule(family.intro.moduleId!) }}
          >
            Пройти уроки «{family.intro.moduleTitle}» целиком
          </button>
        )}
      </div>

      <div className="px-5 flex gap-2" style={{ paddingBottom: 'calc(var(--safe-b, 0px) + 20px)' }}>
        {step > 0 && <Button variant="ghost" onClick={() => setStep(step - 1)}>Назад</Button>}
        {last ? <Button onClick={done}>Понятно, играть</Button> : <Button onClick={() => setStep(step + 1)}>Дальше</Button>}
      </div>
    </div>
  )
}
