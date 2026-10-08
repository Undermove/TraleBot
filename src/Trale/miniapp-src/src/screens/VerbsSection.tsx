import React, { useCallback, useEffect, useState } from 'react'
import Header from '../components/Header'
import LoaderLetter from '../components/LoaderLetter'
import ProPaywall from '../components/ProPaywall'
import { reportVerbSectionOpen } from '../api'
import { giftUntilText, peekCampaignGift, pluralDays, takeCampaignGift } from '../campaignOpen'
import type { ProgressState, Screen } from '../types'
import VerbSheet from '../verbs/VerbSheet'
import type { VerbFormHitDto } from '../verbs/types'
import { hintSeen, markHintSeen } from '../verbs/ui/hints'
import { CloseIcon } from '../verbs/ui/icons'
import LevelGroup, { Bar } from '../verbs/section/LevelGroup'
import MyVerbs from '../verbs/section/MyVerbs'
import NowCard from '../verbs/section/NowCard'
import OwnVerbUnlocked, { ownVerbIsNews } from '../verbs/section/OwnVerbUnlocked'
import PlaySession from '../verbs/section/PlaySession'
import Spotlight from '../verbs/section/Spotlight'
import { cachedSection, loadSection } from '../verbs/section/store'
import { AFTER_FIRST_SESSION, SECTION_OPENED_HINT, TOUR_HINT, TOUR_TARGET, TOUR_TEXT, nextTourStep, type TourStep } from '../verbs/section/tour'
import type { VerbSectionDto } from '../verbs/section/types'

interface Props {
  progress: ProgressState
  navigate: (s: Screen) => void
  /** Метка, с которой пришли (кампания рассылки, ссылка); нет — плитка на главной. */
  source?: string
  onPurchaseSuccess: () => void
}

const ALPHABET_LINE_HINT = 'verbs_alphabet_line'
const ALPHABET_MODULE = 'alphabet-progressive'

/**
 * Раздел «Глаголы». Сверху вниз: сколько выучено; одна большая карточка «что делать сейчас»
 * (глагол и сессию выбирает приложение); «Мои глаголы»; пять уровней, раскрыт текущий.
 * Ничего не заперто. Без триала/Pro раздел — обзор: играть и открыть глагол ведут к оплате.
 */
export default function VerbsSection({ progress, navigate, source, onPurchaseSuccess }: Props) {
  const [section, setSection] = useState<VerbSectionDto | null>(cachedSection)
  const [failed, setFailed] = useState(false)
  const [openLevel, setOpenLevel] = useState<number | null>(() => cachedSection()?.currentLevel ?? null)
  const [levelTouched, setLevelTouched] = useState(false)
  const [openPack, setOpenPack] = useState<string | null>(null)
  const [sheet, setSheet] = useState<string | null>(null)
  const [play, setPlay] = useState<string | null>(null)
  const [paywall, setPaywall] = useState(false)
  const [tour, setTour] = useState<TourStep | null>(null)
  const [unlocked, setUnlocked] = useState<{ id: string; ru: string } | null>(null)
  // О подарке рассылки говорим один раз: строка живёт, пока открыт этот экран.
  const [gift] = useState(peekCampaignGift)
  const [alphabetLine, setAlphabetLine] = useState(() => !hintSeen(ALPHABET_LINE_HINT))

  const reload = useCallback(() => {
    return loadSection()
      .then(s => { setSection(s); setFailed(false); return s })
      .catch(() => { setFailed(true); return null })
  }, [])

  useEffect(() => {
    void reload()
    takeCampaignGift()
    markHintSeen(SECTION_OPENED_HINT)
    void reportVerbSectionOpen(source ?? 'home').catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Раскрыт текущий уровень — пока человек сам не начал открывать и закрывать.
  useEffect(() => {
    if (section && !levelTouched) setOpenLevel(section.currentLevel)
  }, [section, levelTouched])

  // Знакомство: шаг появляется, когда поверх раздела ничего не открыто.
  const busy = !!sheet || !!play || paywall
  useEffect(() => {
    if (!section || busy || tour) return
    const step = nextTourStep(section, hintSeen)
    if (!step) return
    markHintSeen(TOUR_HINT[step])
    if (step === 'level') { setLevelTouched(true); setOpenLevel(section.currentLevel) }
    setTour(step)
  }, [section, busy, tour])

  if (!section) {
    return (
      <div className="flex flex-col min-h-full bg-cream">
        <Header progress={progress} onBack={() => navigate({ kind: 'dashboard' })} eyebrow="ზმნები" title="Глаголы" />
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
          {failed
            ? <div className="text-[14px] text-jewelInk-mid" data-testid="verbs-section-failed">Не получилось загрузить глаголы. Проверь связь и открой раздел ещё раз.</div>
            : <LoaderLetter size={96} />}
        </div>
      </div>
    )
  }

  const { hasAccess } = section
  const needAccess = () => setPaywall(true)
  const openVerb = (id: string | null) => (hasAccess && id ? setSheet(id) : needAccess())
  const playVerb = (id: string | null) => (hasAccess && id ? setPlay(id) : needAccess())

  function onAdded(hit: VerbFormHitDto) {
    if (ownVerbIsNews()) setUnlocked({ id: hit.verbId, ru: hit.ru })
    void reload()
  }

  // Шаги после первой сессии идут подряд: «Дальше» ведёт к следующему, который ещё не показывали.
  const sequence = tour && tour !== 'now' ? AFTER_FIRST_SESSION : []
  const later = sequence.slice(sequence.indexOf(tour as TourStep) + 1).filter(step => !hintSeen(TOUR_HINT[step]))
  function advance() {
    const next = later[0] ?? null
    if (next) {
      markHintSeen(TOUR_HINT[next])
      if (next === 'level') { setLevelTouched(true); setOpenLevel(section!.currentLevel) }
    }
    setTour(next)
  }
  function skipTour() {
    later.forEach(step => markHintSeen(TOUR_HINT[step]))
    setTour(null)
  }

  return (
    <div className="flex flex-col min-h-full bg-cream" data-testid="verbs-section" data-access={hasAccess}>
      <Header progress={progress} onBack={() => navigate({ kind: 'dashboard' })} eyebrow="ზმნები" title="Глаголы" />
      <div className="mn-kilim" />

      <div className="flex-1 px-5 pt-4 flex flex-col gap-4" style={{ paddingBottom: 'calc(var(--safe-b) + 28px)' }}>
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-[15px] font-extrabold text-jewelInk" data-testid="verbs-learned">
              Выучено {section.learned} из {section.total}
            </div>
            {!hasAccess && <div className="text-[11px] text-jewelInk-hint">играть — с подпиской</div>}
          </div>
          <div className="mt-1.5"><Bar fraction={section.learned / Math.max(1, section.total)} testId="verbs-total-bar" /></div>
        </div>

        {gift && (
          <div className="rounded-xl bg-gold-wash border border-jewelInk/40 px-3.5 py-2.5 text-[13px] text-jewelInk" role="status" data-testid="verbs-gift">
            <b>Подарок:</b> {gift.days} {pluralDays(gift.days)} полного доступа — до {giftUntilText(gift)}.
          </div>
        )}

        <NowCard next={section.next} hasAccess={hasAccess} onPlay={() => playVerb(section.next?.id ?? null)} />

        {section.alphabetHint && alphabetLine && (
          <div className="-mt-1 flex items-center gap-1 text-[12px] text-jewelInk-mid" data-testid="verbs-alphabet-line">
            <button className="flex-1 min-h-[44px] text-left" onClick={() => navigate({ kind: 'module', moduleId: ALPHABET_MODULE })}>
              Ещё не знаешь буквы? <span className="text-navy underline">Начни с алфавита</span> — так будет легче.
            </button>
            <button
              aria-label="Скрыть" className="shrink-0 w-11 h-11 flex items-center justify-center"
              onClick={() => { markHintSeen(ALPHABET_LINE_HINT); setAlphabetLine(false) }}
            >
              <CloseIcon size={14} />
            </button>
          </div>
        )}

        {unlocked && (
          <OwnVerbUnlocked
            ru={unlocked.ru} action="Сыграть — 2 минуты"
            onAction={() => { setUnlocked(null); playVerb(unlocked.id) }}
            onClose={() => setUnlocked(null)}
          />
        )}

        <MyVerbs
          verbs={section.myVerbs} examples={section.examples} hasAccess={hasAccess}
          tourRow={tour === 'card'} tourAdd={tour === 'mine'}
          onOpen={verb => openVerb(verb.id)} onNeedAccess={needAccess} onAdded={onAdded}
        />

        <section className="flex flex-col gap-3" data-testid="verbs-levels">
          <div className="flex items-center gap-3 px-1">
            <div className="mn-eyebrow">по порядку</div>
            <div className="flex-1 h-px bg-jewelInk/15" />
            <div className="text-[11px] text-jewelInk-hint">ничего не заперто</div>
          </div>
          {section.levels.map(level => (
            <LevelGroup
              key={level.id} level={level} open={openLevel === level.id} tour={tour === 'level' && level.id === section.currentLevel}
              onToggle={() => { setLevelTouched(true); setOpenLevel(openLevel === level.id ? null : level.id) }}
              openPack={openPack} onTogglePack={id => setOpenPack(openPack === id ? null : id)}
              onVerb={verb => openVerb(verb.id)} currentPack={section.next?.packId}
              hasAccess={hasAccess} onPlay={verb => playVerb(verb?.id ?? null)}
            />
          ))}
        </section>
      </div>

      {tour && (
        <Spotlight
          key={tour} target={TOUR_TARGET[tour]} text={TOUR_TEXT[tour]}
          counter={sequence.length ? `${sequence.indexOf(tour) + 1} из ${sequence.length}` : undefined}
          action={later.length ? 'Дальше' : 'Понятно'} onAction={advance}
          onSkip={later.length ? skipTour : undefined} onTargetClick={() => setTour(null)}
        />
      )}

      {sheet && <VerbSheet verbId={sheet} onClose={() => { setSheet(null); void reload() }} />}
      {play && <PlaySession verbId={play} onExit={() => { setPlay(null); void reload() }} />}
      {paywall && (
        <ProPaywall
          trigger="module" onClose={() => setPaywall(false)}
          onPurchaseSuccess={() => { setPaywall(false); onPurchaseSuccess(); void reload() }}
        />
      )}
    </div>
  )
}
