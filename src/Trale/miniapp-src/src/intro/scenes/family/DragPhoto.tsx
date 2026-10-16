import React, { useEffect, useRef, useState } from 'react'
import { animate, motion, useMotionValue, useTransform, useVelocity } from 'framer-motion'
import { haptic, sound } from '../../../alphabet/games/fx'

// Фото, которое тащат в рамку: едет за пальцем с наклоном, у пустой рамки его притягивает (рамка
// подсвечивается, щелчок вибрации), отпустил — долетает и ложится; не та рамка — отлетает обратно.

const PULL = 64

export default function DragPhoto({ board, disabled, shake, onNear, onDrop, children }: {
  /** Где искать рамки: пустые помечены data-frame и data-filled="no". */
  board: React.RefObject<HTMLElement>
  disabled: boolean
  /** Меняется на каждый промах — фото встряхивается. */
  shake: number
  onNear: (role: string | null) => void
  /** true — легло в рамку; false — вернуть на место. */
  onDrop: (role: string, el: HTMLElement) => boolean
  children: React.ReactNode
}) {
  const x = useMotionValue(0), y = useMotionValue(0)
  const rotate = useTransform(useVelocity(x), [-900, 0, 900], [-16, -3, 12])
  const el = useRef<HTMLDivElement>(null)
  const [lift, setLift] = useState(false)
  const near = useRef<{ role: string; el: HTMLElement } | null>(null)
  const tick = useRef({ x: 0, y: 0 })

  useEffect(() => { if (shake) void animate(x, [x.get(), x.get() - 10, x.get() + 10, x.get() - 6, x.get()], { duration: 0.35 }) }, [shake]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onNear(null), []) // eslint-disable-line react-hooks/exhaustive-deps

  const offsetTo = (t: HTMLElement) => {
    const r = t.getBoundingClientRect(), me = el.current!.getBoundingClientRect()
    return { dx: r.left + r.width / 2 - (me.left + me.width / 2 - x.get()), dy: r.top + r.height / 2 - (me.top + me.height / 2 - y.get()) }
  }
  const closest = () => {
    if (!el.current || !board.current) return null
    let best: { role: string; el: HTMLElement } | null = null
    let dist = Infinity
    for (const f of Array.from(board.current.querySelectorAll<HTMLElement>('[data-frame][data-filled="no"]'))) {
      const o = offsetTo(f), d = Math.hypot(o.dx - x.get(), o.dy - y.get())
      if (d < dist) { dist = d; best = { role: f.dataset.frame!, el: f } }
    }
    return dist < PULL ? best : null
  }
  const home = () => {
    animate(x, 0, { type: 'spring', stiffness: 420, damping: 18 })
    animate(y, 0, { type: 'spring', stiffness: 420, damping: 18 })
  }

  return (
    <motion.div ref={el} data-testid="family-photo" className="relative z-30 touch-none select-none cursor-grab active:cursor-grabbing"
      style={{ x, y, rotate }}
      drag={!disabled} dragMomentum={false} dragElastic={0.2}
      initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: lift ? 1.1 : 1 }}
      transition={{ type: 'spring', stiffness: 360, damping: 22 }}
      onDragStart={() => { setLift(true); tick.current = { x: 0, y: 0 }; haptic('pop'); sound.pop(1) }}
      onDrag={() => {
        if (Math.hypot(x.get() - tick.current.x, y.get() - tick.current.y) > 55) { tick.current = { x: x.get(), y: y.get() }; haptic('soft') }
        const n = closest()
        if ((n?.role ?? null) !== (near.current?.role ?? null)) { near.current = n; onNear(n?.role ?? null); if (n) haptic('snap') }
      }}
      onDragEnd={() => {
        setLift(false)
        const n = near.current
        near.current = null; onNear(null)
        if (!n) { haptic('soft'); home(); return }
        const o = offsetTo(n.el)
        void Promise.all([animate(x, o.dx, { type: 'spring', stiffness: 520, damping: 30 }), animate(y, o.dy, { type: 'spring', stiffness: 520, damping: 30 })])
          .then(() => { if (!onDrop(n.role, n.el)) home() })
      }}>
      <div className="rounded-lg border-[1.5px] border-jewelInk bg-[#FDFAEF] p-1.5 pb-4"
        style={{ boxShadow: lift ? '8px 12px 0 rgba(21,16,10,0.3)' : '3px 3px 0 #15100A', transition: 'box-shadow 160ms' }}>
        {children}
      </div>
    </motion.div>
  )
}
