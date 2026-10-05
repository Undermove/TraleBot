import React, { useEffect, useMemo, useRef, useState } from 'react'
import Button from '../../components/Button'
import GeorgianKeyboard from '../../components/GeorgianKeyboard'
import { VerbForm } from '../parts'
import { PERSONS, type TenseKey, type VerbDto } from '../types'
import { SHORT_TIME } from '../meaning'
import { MeaningText } from '../parts'
import { Coach, GameShell, OptionButton, PULSE, useFirstTime, type SceneHooks } from '../ui/GameShell'
import { SOLID_STEP, STEP } from '../ladder/engine'
import { BoneIcon, iconMarkup } from '../ui/icons'
import { bad, floater, good, haptic } from '../ui/juice'
import { ALL_PERSONS, boneCount, boneRows, bonesNear, cellSlot as slotAt, digOptions as optionsAt, digs as digsAt, plantBones } from './boneField'
import { describeSlot, slotMeaning, slotsOf, variantsOf, type Rng } from './common'

const BONE = iconMarkup(BoneIcon, 24)

/**
 * «Косточки»: таблица спряжения как поле. Чтобы раскопать клетку, набери её форму.
 * Пустая клетка показывает, сколько косточек рядом, — по цифрам решаешь, где копать дальше.
 */
export default function Bones({ verb, onExit, rng = Math.random, scene }: {
  verb: VerbDto; onExit: () => void; rng?: Rng
  /** В сессии: маленькое поле (часть времён и лиц) и куда сообщать ответы. typing: false — только выбор из четырёх. */
  scene?: SceneHooks & { tenses: TenseKey[]; persons: number[]; typing: boolean }
}) {
  const rows = useMemo(() => scene?.tenses ?? boneRows(verb), [verb, scene?.tenses])
  const persons = scene?.persons ?? ALL_PERSONS
  const COLS = persons.length
  const cellSlot = (r: readonly TenseKey[], i: number) => slotAt(r, i, persons)
  const digs = (v: VerbDto, r: readonly TenseKey[], i: number, typed: string) => digsAt(v, r, i, typed, persons)
  const digOptions = (v: VerbDto, r: readonly TenseKey[], i: number, random: Rng) => optionsAt(v, r, i, random, persons)
  const choiceOnly = !!scene && !scene.typing
  /** Клетки, в которых уже ошибались: ответ по клетке засчитывается один раз. */
  const missedCells = useRef(new Set<number>())
  const cells = rows.length * COLS
  const total = boneCount(cells)
  const [bones, setBones] = useState(() => plantBones(cells, rng))
  const [open, setOpen] = useState<Set<number>>(new Set())
  /** Клетка, которую сейчас копаем. */
  const [cell, setCell] = useState<number | null>(null)
  /** Раскопанная клетка, чью форму показываем крупно под полем: в самой клетке её не прочитать. */
  const [peek, setPeek] = useState<number | null>(null)
  const [typed, setTyped] = useState('')
  const [options, setOptions] = useState<string[] | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [tries, setTries] = useState(0)
  const [first, played] = useFirstTime('verb_bones')
  const grid = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  const found = [...open].filter(i => bones.has(i)).length
  const won = found === total
  const slot = cell === null ? null : cellSlot(rows, cell)
  const typing = cell !== null && !options && !won

  // Панель с клавиатурой занимает низ экрана — выбранная клетка должна остаться на виду.
  // Прокручиваем после отрисовки панели: до неё прокручивать ещё некуда.
  useEffect(() => {
    const el = cell === null ? null : grid.current?.querySelector<HTMLElement>(`[data-cell="${cell}"]`)
    if (!el) return
    // Панель прилипает к низу и перекрывает поле: отступ на её высоту, иначе «на виду» окажется под ней.
    el.style.scrollMarginBottom = `${(panel.current?.offsetHeight ?? 0) + 12}px`
    el.scrollIntoView?.({ block: 'nearest' })
  }, [cell])

  function select(i: number) {
    if (won) return
    haptic('tap')
    setNote(null); setTyped(''); setOptions(null)
    if (open.has(i)) { setPeek(i); setCell(null); return }
    setCell(i); setPeek(null)
    if (choiceOnly) setOptions(digOptions(verb, rows, i, rng))
  }

  function dig(value: string) {
    if (cell === null || !value.trim()) return
    setTries(n => n + 1)
    if (digs(verb, rows, cell, value)) {
      played()
      const el = grid.current?.querySelector(`[data-cell="${cell}"]`) ?? null
      const last = bones.has(cell) && found + 1 === total
      if (bones.has(cell)) { good(el, last ? 'big' : 'small', BONE); floater(BONE, el) } else haptic('tap')
      setOpen(new Set([...open, cell])); setPeek(cell); setCell(null); setNote(null); setOptions(null)
      if (scene) {
        // Набрал сам — это уже «сказать самому»; выбрал из четырёх — узнавание.
        if (!missedCells.current.has(cell)) scene.onResult(cellSlot(rows, cell), true, options ? SOLID_STEP : STEP.TYPE)
        scene.onStep()
        if (last) setTimeout(scene.onDone, 1400)
      }
      return
    }
    bad()
    if (scene && !missedCells.current.has(cell)) scene.onResult(cellSlot(rows, cell), false, SOLID_STEP)
    missedCells.current.add(cell)
    // Не наказываем: говорим, что значит набранное, и даём выбрать из четырёх.
    const hit = slotsOf(verb, value.trim(), Object.keys(verb.tenses) as TenseKey[])[0]
    setNote(hit ? `— это ${describeSlot(verb, hit)}. Нужно другое — выбери из четырёх.` : '— такого слова у этого глагола нет. Выбери из четырёх.')
    setTyped(value.trim())
    if (!options) setOptions(digOptions(verb, rows, cell, rng))
  }

  function restart() {
    setBones(plantBones(cells, rng)); setOpen(new Set()); setCell(null); setPeek(null); setTries(0); setNote(null); setOptions(null)
  }

  return (
    <GameShell
      id="verb_bones" title="Косточки" onExit={onExit}
      right={<span key={found} className="inline-block j-bump"><BoneIcon /> {found}/{total}</span>}
      help={[
        `Я закопал ${total} косточек в таблице глагола «${verb.ru}». Строка — когда, столбец — кто.`,
        choiceOnly
          ? 'Нажми любую клетку. Я скажу по-русски, что в ней. Выбери это слово по-грузински — клетка раскопается.'
          : 'Нажми любую клетку. Я скажу по-русски, что в ней. Набери это по-грузински — клетка раскопается.',
        'В пустой клетке появится цифра: столько косточек в соседних клетках. По цифрам ищи, где копать дальше.',
        ...(choiceOnly ? [] : ['Не помню слово — нажми «Не помню — дай варианты» и выбери из четырёх.'])
      ]}
    >
      <div className="px-3 flex-1 flex flex-col gap-3 pb-3">
        <div ref={grid} className="grid gap-1" style={{ gridTemplateColumns: `66px repeat(${COLS}, minmax(0, 1fr))` }}>
          <div />
          {persons.map(p => <div key={p} className="text-center text-[12px] font-bold text-jewelInk-mid">{PERSONS[p]}</div>)}
          {rows.map((t, r) => (
            <React.Fragment key={t}>
              <div className="text-[11px] font-bold leading-[1.1] text-jewelInk-mid flex items-center break-words min-w-0">{SHORT_TIME[t]}</div>
              {persons.map((who, c) => {
                const p = PERSONS[who]
                const i = r * COLS + c
                const isOpen = open.has(i)
                const bone = bones.has(i)
                const near = bonesNear(bones, rows.length, i, COLS)
                return (
                  <button
                    key={c}
                    data-cell={i}
                    data-testid={`bones-cell-${i}`}
                    data-state={isOpen ? (bone ? 'bone' : 'empty') : 'closed'}
                    aria-label={`${p}, ${SHORT_TIME[t]}`}
                    onClick={() => select(i)}
                    className={`${scene ? 'h-14' : 'h-9'} rounded-lg border-[1.5px] border-jewelInk flex items-center justify-center
                      ${isOpen ? 'j-flip' : ''}
                      ${isOpen ? (bone ? 'bg-gold' : 'bg-cream-deep') : cell === i ? 'bg-navy-wash' : 'bg-cream-tile'}
                      ${peek === i || cell === i ? 'ring-2 ring-navy' : ''}
                      ${first && cell === null && i === 0 ? PULSE : ''}`}
                    style={isOpen ? undefined : { boxShadow: '2px 2px 0 #15100A' }}
                  >
                    {isOpen && (bone
                      ? <span className="j-pop leading-none"><BoneIcon size={24} /></span>
                      : <span className={`text-[18px] font-extrabold leading-none ${near ? 'text-navy' : 'text-jewelInk-faint'}`}>{near}</span>)}
                  </button>
                )
              })}
            </React.Fragment>
          ))}
        </div>

        {won ? (
          <div className="text-center py-3" data-testid="bones-won">
            <div className="text-[18px] font-extrabold text-navy j-pop">Все косточки найдены за {tries} {plural(tries)}</div>
            {!scene && <div className="mt-3"><Button onClick={restart}>Закопать заново</Button></div>}
          </div>
        ) : cell === null && (
          peek !== null ? peekCard() : first
            ? <Coach>Нажми любую клетку — например, подсвеченную.</Coach>
            : <div className="text-center text-[13px] text-jewelInk-mid py-2">Выбери клетку. Цифра — сколько косточек в соседних клетках.</div>
        )}
      </div>

      {slot && !won && (
        <div ref={panel} className="sticky bottom-0 bg-cream border-t-[1.5px] border-jewelInk" data-testid="bones-dig">
          <div className="px-3 pt-2 pb-2 flex flex-col gap-2">
            <div className="text-center">
              <div className="mn-eyebrow text-navy">Как сказать?</div>
              <div className="text-[20px] font-extrabold leading-tight" data-testid="bones-ask"><MeaningText meaning={slotMeaning(verb, slot)} /></div>
            </div>
            {note && (
              <div key={tries} className="text-center text-[13px] font-bold j-pop" data-testid="bones-note">
                <span className="font-geo">{typed}</span> {note}
              </div>
            )}
            {first && !note && !options && <Coach>Набери это по-грузински и нажми «Копать».</Coach>}
            {first && !note && choiceOnly && <Coach>Выбери слово, которое это значит, — клетка раскопается.</Coach>}
            {options ? (
              <div className="grid grid-cols-2 gap-2 pb-2">
                {options.map(o => <OptionButton key={o} onClick={() => { setTyped(o); dig(o) }}>{o}</OptionButton>)}
              </div>
            ) : (
              <>
                <div className="flex items-stretch gap-2">
                  <div data-testid="bones-typed" className="flex-1 min-w-0 rounded-xl border-[1.5px] border-jewelInk bg-cream-tile flex items-center justify-center font-geo text-[20px] font-bold">{typed}</div>
                  <div className="w-[112px] shrink-0"><Button disabled={!typed.trim()} onClick={() => dig(typed)}>Копать</Button></div>
                </div>
                <button
                  onClick={() => setOptions(digOptions(verb, rows, cell!, rng))}
                  className="self-center px-3 py-1 text-[13px] font-bold text-navy underline"
                >Не помню — дай варианты</button>
              </>
            )}
          </div>
          {typing && <GeorgianKeyboard value={typed} onChange={setTyped} />}
        </div>
      )}
    </GameShell>
  )

  /** Форма раскопанной клетки крупно: в клетке шириной в палец её не прочитать. */
  function peekCard() {
    if (peek === null) return null
    const at = cellSlot(rows, peek)
    const near = bonesNear(bones, rows.length, peek, COLS)
    return (
      <div
        key={peek} data-testid="bones-peek"
        className="j-rise rounded-xl bg-cream-tile border-[1.5px] border-jewelInk px-4 py-2.5 flex items-center justify-between gap-3"
        style={{ boxShadow: '3px 3px 0 #15100A' }}
      >
        <span className="min-w-0">
          <span className="block text-[13px] font-bold text-jewelInk"><MeaningText meaning={slotMeaning(verb, at)} /></span>
          <span className="block text-[11px] text-jewelInk-hint">
            {bones.has(peek) ? 'здесь была косточка' : near ? `косточек в соседних клетках: ${near}` : 'рядом косточек нет'}
          </span>
        </span>
        <VerbForm variants={variantsOf(verb, at.tense, at.person)} big root={verb.root} />
      </div>
    )
  }
}

/** «за 1 попытку / 3 попытки / 7 попыток». */
function plural(n: number): string {
  const d = n % 10, h = n % 100
  if (d === 1 && h !== 11) return 'попытку'
  if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return 'попытки'
  return 'попыток'
}
