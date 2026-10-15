import React, { useEffect } from 'react'
import Button from '../../components/Button'
import Mascot from '../../components/Mascot'
import { burst, haptic, sound } from '../../alphabet/games/fx'
import { ACTS, INTRO_LESSONS, INTRO_TOTAL, actOf, newPhrases, type IntroLesson } from '../story'
import '../../alphabet/games/alphabet.css'

/**
 * Праздник после урока без ошибок: что теперь умеешь (новые фразы урока), где ты в истории
 * (акт и сколько уроков акта позади) и что дальше.
 */
export default function StoryFinale({ lesson, onNext }: { lesson: IntroLesson; onNext: () => void }) {
  const act = actOf(lesson)
  const inAct = INTRO_LESSONS.filter(l => l.act === act.id)
  const pos = inAct.findIndex(l => l.id === lesson.id) + 1
  const next = INTRO_LESSONS.find(l => l.id === lesson.id + 1)
  const actDone = pos === inAct.length
  useEffect(() => { haptic('good'); sound.win(); burst(null, 'big') }, [])
  return (
    <div className="ab-screen flex flex-col items-center justify-center bg-cream px-6 text-center gap-3" data-testid="intro-finale" style={{ paddingTop: 'var(--safe-t)', paddingBottom: 'calc(var(--safe-b) + 16px)' }}>
      <Mascot mood="cheer" size={110} />
      <div className="mn-eyebrow text-navy">акт {act.id} из {ACTS.length} · урок {lesson.id} из {INTRO_TOTAL}</div>
      <h1 className="text-[27px] font-extrabold leading-tight">{actDone ? `Акт «${act.title}» пройден!` : 'Урок пройден!'}</h1>
      <p className="text-[15px] text-jewelInk-soft max-w-[32ch]">{lesson.goal.replace(/\.$/, '')} — теперь это умеешь.</p>
      {newPhrases(lesson).length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {newPhrases(lesson).map(p => <span key={p.id} className="rounded-lg border-[1.5px] border-jewelInk bg-cream-tile px-2 py-0.5 text-[13px]"><b className="font-geo">{p.geo}</b> — {p.ru}</span>)}
        </div>
      )}
      <div className="flex gap-1 mt-1" aria-label={`урок ${pos} из ${inAct.length} в акте`}>
        {inAct.map((l, k) => <span key={l.id} className={`h-2.5 w-6 rounded-full border-[1.5px] border-jewelInk ${k < pos ? 'bg-gold' : 'bg-cream-tile'}`} />)}
      </div>
      {next && <p className="text-[13px] text-jewelInk-hint">Дальше: {next.title}</p>}
      <div className="w-full max-w-[280px] mt-2"><Button onClick={onNext}>Дальше</Button></div>
    </div>
  )
}
