import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Mascot from '../components/Mascot'
import { CloseIcon } from '../verbs/ui/icons'
import { SAFE_TOP } from '../verbs/ui/GameShell'
import { api, wearItem } from '../api'
import { appEvents } from '../analytics/appEvents'
import { shareReferral } from '../referralShare'
import BomboraRoom from './BomboraRoom'
import { FurnThumb, ItemThumb } from './CollectionThumbs'
import { FURNITURE, ITEMS, type ItemInfo, type Slot } from './collection'
import { cachedCollection, loadStash, onCollection, setStash } from './stashStore'
import type { TreasureCard } from './collection'
import { buzz } from './sensors'

// Дом Бомборы — всё, что собрано из подарков дня: комната с мебелью, гардероб (надеть/снять), слова-сокровища
// с озвучкой и открытки, которые можно отправить другу. Чего ещё нет — силуэт с вопросом: хочется собрать.

type Tab = 'wear' | 'room' | 'words' | 'cards'
const TABS: { id: Tab; name: string }[] = [
  { id: 'wear', name: 'Гардероб' },
  { id: 'room', name: 'Комната' },
  { id: 'words', name: 'Сокровища' },
  { id: 'cards', name: 'Открытки' }
]


/** Озвучка слова или открытки. */
export function playTreasure(id: string) {
  try { new Audio(`/audio/treasures/${id}.m4a`).play().catch(() => {}) } catch {}
}

/** Открытку — другу: фраза, перевод и ссылка на бота. */
export function shareCard(card: TreasureCard, link: string) {
  shareReferral(link, `${card.ka} (${card.tr}) — «${card.ru}». Учу грузинский с Бомборой — присоединяйся!`)
}

export default function BomboraHome({ onExit, inviteLink, startTab = 'wear' }: { onExit: () => void; inviteLink: string; startTab?: Tab }) {
  const [col, setCol] = useState(cachedCollection)
  const stash = col.stash
  const [tab, setTab] = useState<Tab>(startTab)
  const [busy, setBusy] = useState(false)
  useEffect(() => { loadStash(); return onCollection(setCol) }, [])
  // Ссылка-приглашение для открыток: из подарка дня, а нет — своя реферальная.
  const [link, setLink] = useState(inviteLink)
  useEffect(() => { if (!link) api.referral().then(r => setLink(r.link)).catch(() => {}) }, [link])

  async function toggle(item: ItemInfo) {
    if (!stash.items.includes(item.id) || busy) return
    const on = stash.wear[item.slot] === item.id
    buzz.light()
    appEvents.tap(`bombora-wear-${item.id}`)
    // Сразу на Бомборе, сервер — следом.
    const next = { ...stash, wear: { ...stash.wear } }
    if (on) delete next.wear[item.slot as Slot]; else next.wear[item.slot as Slot] = item.id
    setStash(next)
    setBusy(true)
    try { setStash((await wearItem(item.slot, on ? null : item.id)).stash) } catch {} finally { setBusy(false) }
  }

  const count = (have: number, all: number) => <span className="tabular-nums">{have}/{all}</span>

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-cream text-jewelInk" data-testid="bombora-home" style={{ paddingBottom: 'calc(var(--safe-b, 0px) + 16px)' }}>
      <div className="flex items-center gap-3 px-5 pb-2" style={{ paddingTop: SAFE_TOP }}>
        <button onClick={onExit} aria-label="Закрыть" data-testid="bombora-home-close" className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center"><CloseIcon size={20} /></button>
        <div className="mn-eyebrow flex-1">Дом Бомборы</div>
        {stash.hints > 0 && (
          <div className="rounded-full border-[1.5px] border-jewelInk bg-gold px-2.5 py-0.5 font-sans text-[12px] font-extrabold" data-testid="bombora-hints">Подсказок: {stash.hints}</div>
        )}
      </div>

      <div className="px-4">
        <BomboraRoom furniture={stash.furniture}>
          <motion.div key={JSON.stringify(stash.wear)} initial={{ scale: 0.92 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 14 }}>
            <Mascot mood="happy" size={140} wear={stash.wear} className="w-full h-auto" />
          </motion.div>
        </BomboraRoom>
      </div>

      <div className="mt-3 flex gap-1.5 px-4" role="tablist">
        {TABS.map(t => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => { buzz.tick(); setTab(t.id) }}
            className={`flex-1 rounded-xl border-[1.5px] border-jewelInk px-1 py-2 font-sans text-[12.500px] font-extrabold ${tab === t.id ? 'bg-navy text-cream' : 'bg-cream-tile text-jewelInk'}`}
            data-testid={`bombora-tab-${t.id}`}>
            {t.name}
          </button>
        ))}
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-4 pb-2" data-testid={`bombora-panel-${tab}`}>
        {tab === 'wear' && (
          <>
            <div className="mb-2 font-sans text-[12.500px] font-bold text-jewelInk-mid">Собрано {count(stash.items.length, ITEMS.length)} · нажми, чтобы надеть или снять</div>
            <div className="grid grid-cols-4 gap-2">
              {ITEMS.map(item => {
                const owned = stash.items.includes(item.id)
                const on = stash.wear[item.slot] === item.id
                return (
                  <button key={item.id} onClick={() => toggle(item)} disabled={!owned}
                    className={`flex flex-col items-center rounded-xl border-[1.5px] px-1 pb-1.5 pt-2 ${on ? 'border-navy bg-navy/10' : 'border-jewelInk/30 bg-cream-tile'} ${owned ? '' : 'opacity-80'}`}
                    data-testid={`bombora-item-${item.id}`} data-owned={owned} data-on={on}>
                    <ItemThumb item={item} owned={owned} />
                    <div className="mt-1 text-center font-sans text-[10.500px] font-bold leading-tight">{owned ? item.name : '?'}</div>
                    {item.golden && <div className="font-sans text-[10px] font-extrabold" style={{ color: '#B98208' }}>золотой</div>}
                  </button>
                )
              })}
            </div>
          </>
        )}

        {tab === 'room' && (
          <>
            <div className="mb-2 font-sans text-[12.500px] font-bold text-jewelInk-mid">Собрано {count(stash.furniture.length, FURNITURE.length)} · мебель выпадает из деревянного сундучка</div>
            <div className="grid grid-cols-4 gap-2">
              {FURNITURE.map(f => {
                const owned = stash.furniture.includes(f.id)
                return (
                  <div key={f.id} className="flex flex-col items-center rounded-xl border-[1.5px] border-jewelInk/30 bg-cream-tile p-1" data-testid={`bombora-furn-${f.id}`} data-owned={owned}>
                    <FurnThumb id={f.id} owned={owned} className="h-10 w-full" />
                    <div className="text-center font-sans text-[10.500px] font-bold leading-tight">{owned ? f.name : '?'}</div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {tab === 'words' && (
          <>
            <div className="mb-2 font-sans text-[12.500px] font-bold text-jewelInk-mid">Собрано {count(col.words.length, col.wordsTotal)} · слова уже в твоём словаре</div>
            <div className="flex flex-col gap-2">
              {col.words.length === 0 && <Empty text="Сокровища выпадают из деревянного сундучка" />}
              {col.words.map(w => (
                <button key={w.id} onClick={() => playTreasure(w.id)} className="jewel-tile w-full px-3 py-2.5 text-left" data-testid={`bombora-word-${w.id}`}>
                  <div className="relative z-[1]">
                    <div className="flex items-baseline gap-2"><span className="font-geo text-[20px] font-bold">{w.ka}</span><span className="text-[13px] text-jewelInk-mid">{w.tr}</span><span className="ml-auto text-[13px] font-bold">{w.ru}</span></div>
                    <div className="mt-1 text-[12.500px] leading-snug text-jewelInk-mid">{w.story}</div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {tab === 'cards' && (
          <>
            <div className="mb-2 font-sans text-[12.500px] font-bold text-jewelInk-mid">Собрано {count(col.cards.length, col.cardsTotal)} · отправь другу</div>
            <div className="flex flex-col gap-2">
              {col.cards.length === 0 && <Empty text="Открытки выпадают из подарочной коробки" />}
              {col.cards.map(c => (
                <div key={c.id} className="jewel-tile px-3 py-2.5" data-testid={`bombora-card-${c.id}`}>
                  <div className="relative z-[1] flex items-center gap-2">
                    <button onClick={() => playTreasure(c.id)} className="min-w-0 flex-1 text-left">
                      <div className="font-geo text-[18px] font-bold leading-tight">{c.ka}</div>
                      <div className="text-[12.500px] text-jewelInk-mid">{c.tr} — «{c.ru}»</div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-ruby">{c.when}</div>
                    </button>
                    <button onClick={() => { appEvents.tap('bombora-card-share'); shareCard(c, link) }} className="shrink-0 rounded-xl border-[1.5px] border-jewelInk bg-ruby px-3 py-2 font-sans text-[12.500px] font-extrabold text-cream" data-testid="bombora-card-share">Отправить</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border-[1.5px] border-dashed border-jewelInk/30 px-3 py-4 text-center font-sans text-[13px] font-bold text-jewelInk-mid">{text}</div>
}
