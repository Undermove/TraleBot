import React, { useEffect, useMemo, useRef, useState } from 'react'
import Button from '../../components/Button'
import GeorgianKeyboard from '../../components/GeorgianKeyboard'
import Mascot from '../../components/Mascot'
import { parseVerbForm } from '../../api'
import { cyr } from '../types'
import { Coach, GameShell, OptionButton, PULSE, useFirstTime, type SceneHooks } from '../ui/GameShell'
import { SOLID_STEP, STEP } from '../ladder/engine'
import { LockIcon } from '../ui/icons'
import { bad, good, haptic } from '../ui/juice'
import { OVERLAY, useOverlay } from '../ui/overlayStack'
import { orderNote, wordOrderVerdict } from '../wordOrder'
import FrameImage from './FrameImage'
import { cellName, explainTyped, explainWrong, frameImages, gap, shuffled, usedForms, words } from './logic'
import type { StoryFormDto, VerbStoryDto } from './types'
import './story.css'

// Комикс «кадр под замком»: кадры идут лентой сверху вниз, следующий размыт и закрыт,
// пока не сказана реплика текущего. Неверная форма — не «ошибка»: Бомбора объясняет,
// что она значит, и можно пробовать снова.


const HELP = [
  'Это комикс. Под каждой картинкой — реплика, в которой не хватает одного слова.',
  'Выбери, набери или собери реплику. Скажешь верно — откроется следующий кадр.',
  'Ошибиться не страшно: я объясню, что значит твоё слово, и можно пробовать снова.'
]

const COACH = {
  choose: 'Нажми слово, которое стоит на месте пропуска.',
  type: 'Нажми на поле, набери пропущенное слово и нажми «Сказать».',
  build: 'Нажимай слова по порядку, чтобы получилась фраза, и нажми «Сказать».'
}

export default function StoryReader({ story, onExit, scene }: {
  story: VerbStoryDto; onExit: () => void
  /** В сессии: с какого кадра продолжить и куда сообщать ответы. То, что комикс дочитан, сессия сохраняет на сервере. */
  scene?: SceneHooks
}) {
  const frames = story.frames
  const [at, setAt] = useState(scene ? Math.min(scene.startAt, frames.length - 1) : 0)
  /** В этом кадре уже ошибались: ответ засчитывается один раз. */
  const missed = useRef(false)
  const [note, setNote] = useState<string | null>(null)
  const [tried, setTried] = useState<string[]>([])
  const [typed, setTyped] = useState('')
  const [keyboard, setKeyboard] = useState(false)
  const [checking, setChecking] = useState(false)
  const [built, setBuilt] = useState<number[]>([])
  // Слова те, порядок другой: засчитано, показываем фразу источника и ждём «Дальше».
  const [revealed, setRevealed] = useState(false)
  useOverlay(onExit, OVERLAY.screen)
  // Подсказка и подсветка — на первый ход каждого вида: выбрать, набрать, собрать.
  const firstTime = {
    choose: useFirstTime('story_choose'),
    type: useFirstTime('story_type'),
    build: useFirstTime('story_build')
  }

  const frame = at < frames.length ? frames[at] : null
  const chips = useMemo(() => (frame ? words(frame.ka) : []), [frame])
  const order = useMemo(() => shuffled(chips.length), [chips])

  const scroller = useRef<HTMLDivElement>(null)
  const frameEls = useRef<(HTMLElement | null)[]>([])
  const talk = useRef<HTMLDivElement>(null)
  const ending = useRef<HTMLDivElement>(null)
  const current = useRef(at)
  current.current = at

  // Открылся новый кадр: ставим его картинку к верху ленты, чтобы она была видна целиком.
  useEffect(() => {
    if (at === 0) return
    const el = at < frames.length ? frameEls.current[at] : ending.current
    el?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }, [at, frames.length])

  // Клавиатура забирает низ экрана: подтягиваем реплику с полем и кнопкой вплотную к ней.
  useEffect(() => {
    if (keyboard) talk.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' })
  }, [keyboard, note])

  function solved() {
    if (!frame) return
    firstTime[frame.mode][1]()
    const last = at === frames.length - 1
    good(last ? null : frameEls.current[at], last ? 'big' : 'small')
    if (scene) {
      // Комикс показывает форму в деле — это и есть знакомство с ней. Выбрал — узнал; набрал или собрал — сказал сам.
      scene.onResult(frame.target, !missed.current, frame.mode === 'choose' ? SOLID_STEP : STEP.TYPE, true)
      scene.onStep()
    }
    missed.current = false
    setAt(at + 1)
    setNote(null); setTried([]); setTyped(''); setKeyboard(false); setBuilt([]); setRevealed(false)
  }

  function choose(option: StoryFormDto) {
    if (!frame) return
    if (option.form === frame.target.form) return solved()
    bad()
    missed.current = true
    setTried(t => [...t, option.form])
    setNote(explainWrong(option, frame.target))
  }

  async function sayTyped() {
    if (!frame) return
    const value = typed.trim()
    if (value === frame.target.form) return solved()
    setChecking(true)
    let text: string
    try {
      text = explainTyped(value, (await parseVerbForm(value)).hits, story, frame.target)
    } catch {
      text = `Пока не то. Здесь нужно ${cellName(frame.target)}.`
    }
    setChecking(false)
    if (current.current !== at) return
    bad()
    missed.current = true
    setNote(text); setTyped('')
  }

  function sayBuilt() {
    if (!frame) return
    if (wordOrderVerdict(built.map(i => chips[i]), frame.ka) === 'exact') return solved()
    // Порядок слов в грузинском гибкий: другой порядок тех же слов не ошибка (см. wordOrder.ts).
    haptic('good')
    setRevealed(true)
    setNote(orderNote(frame.ka))
  }

  function restart() {
    setAt(0)
    scroller.current?.scrollTo?.({ top: 0 })
  }

  const hint = frame && firstTime[frame.mode][0] && !note
  const pulse = hint ? PULSE : ''

  return (
    <div className="fixed inset-0 z-[60] bg-cream [&>.j-root]:h-full [&>.j-root]:min-h-0" data-testid="story-reader">
      <GameShell
        id="story" title={story.title} onExit={onExit} help={HELP}
        right={<span data-testid="story-progress">{Math.min(at, frames.length)}/{frames.length}</span>}
      >
        <div ref={scroller} className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="w-full max-w-[480px] mx-auto px-5 pt-1 pb-6 flex flex-col gap-4">
            {frames.map((f, i) => {
              // Дальше следующего кадра не показываем ничего: ни картинки, ни заглушки.
              if (i > at + 1) return null
              const open = i < at
              const here = i === at
              const cut = gap(f.ka, f.target.form)
              return (
                <article
                  key={i}
                  ref={el => { frameEls.current[i] = el }}
                  data-testid={`story-frame-${i}`}
                  data-state={open ? 'open' : here ? 'current' : 'locked'}
                  className="rounded-xl border-[1.5px] border-jewelInk overflow-hidden bg-cream-tile scroll-mt-1"
                  style={{ boxShadow: '3px 3px 0 #15100A' }}
                >
                  <FrameImage images={frameImages(story, f)} alt={f.scene} locked={i > at}>
                    {i > at && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                        <span key={note ?? ''} className={note ? 'j-wiggle' : ''}><LockIcon size={56} /></span>
                        <span className="rounded-full bg-cream/90 border border-jewelInk/60 px-3 py-1 text-[12px] font-bold">
                          Скажи реплику — кадр откроется
                        </span>
                      </div>
                    )}
                    {here && at > 0 && (
                      <div className="story-unlock absolute inset-0 flex items-center justify-center"><LockIcon size={56} /></div>
                    )}
                  </FrameImage>

                  {i <= at && (
                    <div ref={here ? talk : undefined} className={here && at > 0 ? 'j-rise' : ''}>
                      <div className="p-3">
                        <div className="text-[12px] text-jewelInk-hint">{f.scene}</div>
                        <div className="mt-1 text-[11px] font-bold uppercase tracking-wider text-navy">{f.who}</div>
                        <div className="font-geo text-[19px] font-extrabold leading-snug" data-testid={`story-line-${i}`}>
                          {open || (here && revealed) ? (
                            <>{cut.before}<span className="text-navy">{f.target.form}</span>{cut.after}</>
                          ) : f.mode === 'build' ? (
                            <span className="text-jewelInk-faint">…</span>
                          ) : (
                            <>
                              {cut.before}
                              <span data-testid="story-gap" className={`inline-block w-20 h-[1.1em] align-text-bottom rounded-md border-b-[3px] border-jewelInk/60 bg-gold-wash ${pulse}`} />
                              {cut.after}
                            </>
                          )}
                        </div>
                        {open && <div className="text-[12px] text-jewelInk-hint">{cyr(f.ka)}</div>}
                        <div className="text-[14px] text-jewelInk-mid">{f.ru}</div>
                      </div>

                      {here && (
                        <div className="px-3 pb-3 flex flex-col gap-2">
                          {note && (
                            <div key={note} role="status" data-testid="story-note" className="j-pop flex items-center gap-2 rounded-lg bg-gold-wash border border-jewelInk/30 p-2 text-[13px]">
                              <Mascot mood="think" size={36} className="shrink-0" />
                              <span>{note}</span>
                            </div>
                          )}
                          {hint && <Coach>{COACH[f.mode]}</Coach>}

                          {f.mode === 'choose' && f.options.map(o => (
                            <OptionButton
                              key={o.form}
                              onClick={() => choose(o)}
                              tone={tried.includes(o.form) ? 'bg-cream-deep text-jewelInk-hint' : ''}
                            >
                              {o.form}
                              <span className="block font-sans text-[11px] font-normal text-jewelInk-hint">{cyr(o.form)}</span>
                            </OptionButton>
                          ))}

                          {f.mode === 'type' && (
                            <>
                              <button
                                data-testid="story-type-field"
                                onClick={() => setKeyboard(true)}
                                className={`h-12 rounded-xl border-[1.5px] border-jewelInk bg-cream flex items-center justify-center font-geo text-[20px] font-bold ${keyboard ? '' : pulse}`}
                              >
                                {typed || <span className="text-[13px] font-sans font-normal text-jewelInk-hint">{keyboard ? 'набери пропущенное слово' : 'нажми, чтобы набрать слово'}</span>}
                              </button>
                              <Button disabled={!typed.trim() || checking} onClick={sayTyped}>Сказать</Button>
                            </>
                          )}

                          {f.mode === 'build' && !revealed && (
                            <>
                              <div data-testid="story-built" className={`min-h-[56px] rounded-xl border-[1.5px] border-dashed border-jewelInk/50 p-2 flex flex-wrap gap-2 justify-center ${built.length ? '' : pulse}`}>
                                {built.map(k => <OptionButton key={k} onClick={() => setBuilt(built.filter(x => x !== k))}>{chips[k]}</OptionButton>)}
                              </div>
                              <div data-testid="story-chips" className="min-h-[56px] flex flex-wrap gap-2 justify-center">
                                {order.map(k => !built.includes(k) && <OptionButton key={k} onClick={() => setBuilt([...built, k])}>{chips[k]}</OptionButton>)}
                              </div>
                              <Button disabled={built.length !== chips.length} onClick={sayBuilt}>Сказать</Button>
                            </>
                          )}
                          {f.mode === 'build' && revealed && <Button onClick={solved}>Дальше</Button>}
                        </div>
                      )}
                    </div>
                  )}
                </article>
              )
            })}

            {!frame && (
              <div ref={ending} data-testid="story-end" className="scroll-mt-2 rounded-xl border-[1.5px] border-jewelInk bg-cream-tile p-4 text-center" style={{ boxShadow: '3px 3px 0 #15100A' }}>
                <Mascot mood="cheer" size={96} className="mx-auto j-hop" />
                <div className="mt-1 text-[18px] font-extrabold text-navy j-pop">Конец истории</div>
                <div className="mt-1 text-[13px] text-jewelInk-mid">В ней прозвучали вот эти слова — теперь они твои:</div>
                <div className="mt-3 flex flex-col gap-1.5 text-left">
                  {usedForms(frames).map(t => (
                    <div key={t.form} className="flex items-baseline justify-between gap-3 rounded-lg bg-cream px-3 py-1.5 border border-cream-edge">
                      <span>
                        <span className="font-geo text-[16px] font-bold">{t.form}</span>{' '}
                        <span className="text-[11px] text-jewelInk-hint">{cyr(t.form)}</span>
                      </span>
                      <span className="text-[12px] text-jewelInk-mid text-right">{cellName(t)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-col gap-2">
                  {scene
                    ? <Button onClick={scene.onDone}>Дальше</Button>
                    : <>
                        <Button onClick={onExit}>Готово</Button>
                        <Button variant="ghost" onClick={restart}>Пройти ещё раз</Button>
                      </>}
                </div>
                <div className="mt-3 text-[11px] text-jewelInk-hint">
                  Фразы — из корпуса{' '}
                  <a href="https://tatoeba.org" target="_blank" rel="noreferrer" className="underline">Tatoeba</a> (CC BY 2.0 FR).
                  {frames.some(f => f.ruAdapted) && ' Перевод некоторых реплик подогнан под сюжет.'}
                </div>
              </div>
            )}
          </div>
        </div>

        {keyboard && frame?.mode === 'type' && (
          <div className="shrink-0 w-full max-w-[480px] mx-auto" data-testid="story-keyboard" style={{ paddingBottom: 'var(--safe-b)' }}>
            <GeorgianKeyboard value={typed} onChange={setTyped} disabled={checking} />
          </div>
        )}
      </GameShell>
    </div>
  )
}
