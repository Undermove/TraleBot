import React, { useState } from 'react'
import IntroInterlude from './IntroInterlude'
import IntroOpener, { STEP_TITLE } from './IntroOpener'
import { ACTS, INTRO_LESSONS, introLesson } from './story'

// Стенд сцен «Знакомства»: ?intro-lab — оглавление всех уроков и сцен; ?intro-lab=<урок>&step=<номер сцены>
// (или step=opener / step=finale) — одна сцена с настоящими данными урока, без сервера и прогресса.

export default function IntroLab() {
  const q = new URLSearchParams(window.location.search)
  const lessonId = Number(q.get('intro-lab')) || 0
  const stepParam = q.get('step') ?? '0'
  const [run, setRun] = useState(0)
  const back = () => { window.location.search = '?intro-lab' }

  if (!lessonId) {
    return (
      <div className="min-h-full bg-cream px-5 py-6" style={{ paddingTop: 'calc(var(--safe-t) + 16px)' }}>
        <h1 className="text-[24px] font-extrabold">Знакомство · стенд сцен</h1>
        {ACTS.map(a => (
          <section key={a.id} className="mt-4">
            <div className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-jewelInk-hint">акт {a.id} · {a.title}</div>
            {INTRO_LESSONS.filter(l => l.act === a.id).map(l => (
              <div key={l.id} className="mt-2 rounded-xl border-[1.5px] border-jewelInk bg-cream-tile px-3 py-2">
                <div className="font-bold text-[14px]">{l.id}. {l.title}</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <a className="rounded-full border-[1.5px] border-jewelInk px-2 text-[12px] font-bold" href={`?intro-lab=${l.id}&step=opener`}>начало</a>
                  {l.steps.map((s, k) => (
                    <a key={k} className="rounded-full border-[1.5px] border-jewelInk bg-gold-wash px-2 text-[12px] font-bold" href={`?intro-lab=${l.id}&step=${k}`}>{STEP_TITLE[s.kind]}{'mode' in s ? ` · ${s.mode}` : 'rule' in s ? ` · ${s.rule}` : 'set' in s ? ` · ${s.set}` : 'script' in s ? ` · ${s.script}` : ''}</a>
                  ))}
                  <a className="rounded-full border-[1.5px] border-jewelInk px-2 text-[12px] font-bold" href={`?intro-lab=${l.id}&step=finale`}>праздник</a>
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>
    )
  }

  const lesson = introLesson(lessonId)
  if (stepParam === 'opener') return <IntroOpener lessonId={lessonId} onBack={back} onStart={() => { window.location.search = `?intro-lab=${lessonId}&step=0` }} details={<p className="text-[14px]">Теория урока.</p>} />
  const result = { kind: 'result' as const, moduleId: 'intro', lessonId, correct: 5, total: 5, xpEarned: 10, wrongQuestions: [] }
  if (stepParam === 'finale') return <IntroInterlude scene={{ kind: 'finale', result }} lessonId={lessonId} fraction={1} onExit={back} onDone={back} />
  const index = Math.min(Number(stepParam) || 0, lesson.steps.length - 1)
  const next = () => {
    if (index + 1 < lesson.steps.length) window.location.search = `?intro-lab=${lessonId}&step=${index + 1}`
    else window.location.search = `?intro-lab=${lessonId}&step=finale`
  }
  return (
    <IntroInterlude key={run} scene={{ kind: 'step', step: lesson.steps[index], index }} lessonId={lessonId}
      fraction={(index / lesson.steps.length) * 0.8} onExit={back} onDone={() => { setRun(r => r + 1); next() }} />
  )
}
