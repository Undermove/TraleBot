import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { buzz, reducedMotion } from './sensors'
import { sparkFountain, type Gift3DHandle } from './Gift3D'
import './chest3d.css'

// Сундук дня в «ненастоящем 3D» — то, во что превращается подарок, если внутри что-то получше:
// деревянный сундучок, эмалевый сундук, золотой сундук. Умеет то же, что подарок: ждать, подпрыгивать
// от тапа, открываться (крышка откидывается назад, изнутри свет).

export type ChestModel = 'wood' | 'ruby' | 'gold'

const MODEL: Record<ChestModel, { c: string; cd: string; cl: string; band: string; w: number; hh: number; d: number; lh: number }> = {
  wood: { c: '#A5612F', cd: '#7E4520', cl: '#C07A45', band: '#5E6A73', w: 1.05, hh: 0.62, d: 0.72, lh: 0.26 },
  ruby: { c: '#D0173A', cd: '#A61026', cl: '#F04A64', band: '#F5B820', w: 1.2, hh: 0.7, d: 0.8, lh: 0.3 },
  gold: { c: '#E8A70D', cd: '#B98208', cl: '#FCD76D', band: '#1B5FB0', w: 1.25, hh: 0.74, d: 0.82, lh: 0.32 }
}

interface Props {
  model: ChestModel
  size?: number
  opened?: boolean
  /** Открыт, но без награды изнутри — для главной. */
  ajar?: boolean
  idle?: boolean
  tilt?: { x: number; y: number }
  /** Сколько тапов уже было до появления сундука (свечение щелей). */
  charge?: number
}

const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

const Chest3D = forwardRef<Gift3DHandle, Props>(function Chest3D({ model, size = 150, opened = false, ajar = false, idle = true, tilt, charge = 0 }, ref) {
  const [state, setState] = useState<'closed' | 'shaking' | 'open'>(opened ? 'open' : 'closed')
  const [knocks, setKnocks] = useState(charge)
  const [bump, setBump] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const busy = useRef(false)
  useEffect(() => { setState(opened ? 'open' : 'closed') }, [opened])

  useImperativeHandle(ref, () => ({
    async open() {
      if (busy.current || state === 'open') return
      busy.current = true
      if (reducedMotion()) { setState('open'); buzz.success(); busy.current = false; return }
      if (knocks < 2) {
        setState('shaking')
        ;[0, 110, 220, 330].forEach(t => setTimeout(buzz.tick, t))
        await wait(480)
      }
      buzz.heavy()
      setState('open')
      sparkFountain(root.current, 30)
      await wait(180)
      buzz.success()
      await wait(650)
      busy.current = false
    },
    nope() {
      buzz.rigid()
      setBump(n => n + 1)
    },
    knock(level) {
      if (level >= 2) buzz.heavy(); else buzz.rigid()
      setKnocks(level)
      setBump(n => n + 1)
      sparkFountain(root.current, 4 + level * 4)
    }
  }), [state, knocks])

  const m = MODEL[model]
  const s = size
  const vars = {
    ['--s' as any]: `${s}px`, ['--w' as any]: `${s * m.w}px`, ['--hh' as any]: `${s * m.hh}px`, ['--d' as any]: `${s * m.d}px`, ['--lh' as any]: `${s * m.lh}px`,
    ['--c' as any]: m.c, ['--cd' as any]: m.cd, ['--cl' as any]: m.cl, ['--band' as any]: m.band,
    ['--tx' as any]: `${(tilt?.y ?? 0) * -10}deg`, ['--ty' as any]: `${(tilt?.x ?? 0) * 18}deg`
  }
  const bands = <><div className="c3-band a" /><div className="c3-band b" /></>
  const fancy = model !== 'wood'

  return (
    <div
      ref={root}
      className={`c3 c3-${model} c3-${state} ${ajar ? 'c3-ajar' : ''} ${idle && state === 'closed' && !knocks ? 'c3-idle' : ''}`}
      style={{ width: s * 1.6, height: s * 1.6, ...vars }}
      data-testid="chest3d" data-model={model} data-state={state} data-charge={knocks}
    >
      <div className="c3-scene">
        <div key={bump} className={`c3-body ${bump ? 'c3-knock' : ''}`}>
          <div className="c3-shadow" />
          <div className="c3-beam" />
          <div className="c3-f c3-floor" />
          <div className="c3-f c3-back">{bands}</div>
          <div className="c3-f c3-side c3-left"><div className="c3-band" /></div>
          <div className="c3-f c3-side c3-right"><div className="c3-band" /></div>
          <div className="c3-f c3-front">{fancy && <div className="c3-kilim" />}{bands}<div className="c3-lock" /></div>
          <div className="c3-lid">
            <div className="c3-f c3-under" />
            <div className="c3-f c3-back">{bands}</div>
            <div className="c3-f c3-side c3-left" />
            <div className="c3-f c3-side c3-right" />
            <div className="c3-f c3-lid-top">{bands}{model === 'gold' && <div className="c3-gem" />}</div>
            <div className="c3-f c3-front">{bands}{model === 'gold' && <div className="c3-gem" />}<div className="c3-hasp" /></div>
          </div>
        </div>
      </div>
    </div>
  )
})

export default Chest3D
