import React, { useMemo, useState } from 'react'
import GameFrame from '../../alphabet/games/GameFrame'
import { burst, haptic, sound } from '../../alphabet/games/fx'
import { useLater } from '../../verbs/games/useLater'
import { cyr } from '../../verbs/types'
import Mascot from '../../components/Mascot'
import Button from '../../components/Button'
import { newPhrases, shuffle, type Phrase } from '../story'
import { Bubble, GameEnd, say } from '../ui'
import type { SceneProps, StepOf } from './types'

/**
 * «Новая фраза» — событие урока. Бомбора говорит фразу (запись, если есть), человек открывает каждое слово
 * фразы, чтобы увидеть, что оно значит, а фразу из нескольких слов потом сам собирает плитками по порядку.
 * Так каждая новая фраза урока — своя короткая сцена; в конце — что легло в копилку.
 */

type Phase = 'hear' | 'open' | 'build' | 'got'

export default function PhraseScene({ lesson, fraction, onExit, onDone, rng = Math.random }: SceneProps<StepOf<'phrase'>>) {
  const list = useMemo(() => newPhrases(lesson), [lesson])
  const [i, setI] = useState(0)
  const [phase, setPhase] = useState<Phase>('hear')
  const [opened, setOpened] = useState<number[]>([])
  const [built, setBuilt] = useState<number[]>([])
  const [shake, setShake] = useState<number | null>(null)
  const later = useLater()
  const p: Phrase | undefined = list[i]
  const words = useMemo(() => p?.words ?? [], [p])
  const order = useMemo(() => shuffle(words.map((_, k) => k), rng), [words]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!p) {
    return (
      <GameFrame title="Новые фразы" eyebrow={`урок ${lesson.id}`} fraction={fraction} onExit={onExit}>
        <GameEnd
          title={list.length === 1 ? 'Одна новая фраза' : `${list.length} новые фразы`}
          text="Они уже в копилке. Сейчас попробуешь их в деле."
          rule={<div className="flex flex-wrap justify-center gap-1.5">{list.map(x => (
            <span key={x.id} className="rounded-lg border-[1.5px] border-jewelInk bg-cream-tile px-2 py-0.5 text-[13px]"><b className="font-geo">{x.geo}</b> — {x.ru}</span>
          ))}</div>}
          onNext={onDone}
        />
      </GameFrame>
    )
  }

  const multi = words.length > 1
  const next = () => {
    haptic('pop')
    setOpened([]); setBuilt([]); setPhase('hear')
    setI(n => n + 1)
  }
  const hear = () => {
    say(p)
    sound.pop()
    setPhase(words.length ? 'open' : 'got')
  }
  const open = (k: number) => {
    if (opened.includes(k)) return
    haptic('tap'); sound.snap(opened.length)
    const o = [...opened, k]
    setOpened(o)
    if (o.length === words.length) later(() => setPhase(multi ? 'build' : 'got'), 700)
  }
  const tapTile = (k: number, el: HTMLElement) => {
    if (built.includes(k)) return
    // Одинаковые слова (და … და) взаимозаменяемы: засчитываем, если слово совпадает с нужным.
    const want = built.length
    if (words[k][0] !== words[want][0]) {
      setShake(k); haptic('bad'); sound.miss(); later(() => setShake(null), 400)
      return
    }
    haptic('snap'); sound.snap(want)
    const b = [...built, k]
    setBuilt(b)
    if (b.length === words.length) {
      burst(el, 'small')
      sound.win()
      say(p)
      later(() => setPhase('got'), 600)
    }
  }

  return (
    <GameFrame title="Новая фраза" eyebrow={`новая фраза · ${i + 1} из ${list.length}`} fraction={fraction} onExit={onExit}>
      <div className="flex-1 min-h-0 flex flex-col items-center gap-3 text-center" data-testid="phrase-scene">
        <div className="flex items-end gap-2">
          <Mascot mood={phase === 'got' ? 'cheer' : 'guide'} size={74} />
          <Bubble className="mb-6 max-w-[220px]">
            <span className="text-[13px]">{phase === 'hear' ? 'Послушай, как это говорят' : phase === 'open' ? 'Нажми на каждое слово' : phase === 'build' ? 'Теперь собери фразу сам' : 'Вот и всё!'}</span>
          </Bubble>
        </div>

        <button onClick={hear} data-testid="phrase-card"
          className="w-full rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile px-4 py-4" style={{ boxShadow: '3px 3px 0 #15100A' }}>
          <div className="font-geo font-extrabold leading-tight" style={{ fontSize: p.geo.length > 22 ? 22 : 28 }}>{p.geo}</div>
          <div className="mt-1 text-[13px] font-semibold text-jewelInk-hint">{cyr(p.geo)}</div>
          {(phase === 'got' || phase === 'build') && <div className="mt-2 text-[16px] font-bold text-navy zn-pop">{p.ru}</div>}
          {phase === 'hear' && <div className="mt-2 text-[12px] font-bold text-navy">нажми, чтобы услышать</div>}
        </button>

        {phase === 'open' && (
          <div className="flex flex-wrap justify-center gap-2" data-testid="phrase-words">
            {words.map(([g, ru], k) => (
              <button key={k} onClick={() => open(k)} data-testid={`word-${k}`}
                className={`min-h-[44px] rounded-xl border-[1.5px] border-jewelInk px-3 py-1.5 ${opened.includes(k) ? 'bg-gold-wash' : 'bg-cream-tile'}`} style={{ boxShadow: '2px 2px 0 #15100A' }}>
                <div className="font-geo font-bold text-[17px]">{g}</div>
                <div className="text-[11px] font-semibold text-jewelInk-hint">{opened.includes(k) ? ru : '?'}</div>
              </button>
            ))}
          </div>
        )}

        {phase === 'build' && (
          <>
            <div className="min-h-[48px] flex flex-wrap justify-center gap-1.5 rounded-xl border-[1.5px] border-dashed border-jewelInk-faint px-2 py-2 w-full" data-testid="phrase-slots">
              {built.map(k => <span key={k} className="zn-pop font-geo font-bold text-[17px] rounded-lg bg-gold-wash border-[1.5px] border-jewelInk px-2">{words[k][0]}</span>)}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {order.map(k => (
                <button key={k} disabled={built.includes(k)} onClick={e => tapTile(k, e.currentTarget)} data-testid={`tile-${k}`}
                  className={`min-h-[44px] rounded-xl border-[1.5px] border-jewelInk bg-cream-tile px-3 py-1.5 font-geo font-bold text-[17px] ${built.includes(k) ? 'opacity-30' : ''} ${shake === k ? 'zn-shake bg-ruby-wash' : ''}`}
                  style={{ boxShadow: '2px 2px 0 #15100A' }}>{words[k][0]}</button>
              ))}
            </div>
          </>
        )}

        <div className="flex-1" />
        {phase === 'got' && (
          <div className="w-full max-w-[300px] zn-pop">
            <div className="mb-2 text-[12px] text-jewelInk-hint">в копилку: <b className="font-geo">{p.geo}</b> — {p.ru}</div>
            <Button onClick={next}>{i + 1 < list.length ? 'Следующая фраза' : 'Дальше'}</Button>
          </div>
        )}
        {phase === 'hear' && <div className="w-full max-w-[300px]"><Button variant="ghost" onClick={hear}>Послушать</Button></div>}
      </div>
    </GameFrame>
  )
}
