import { fetchVerbLearning, saveVerbProgress, saveVerbSession } from '../../api'
import type { FormState, LadderItem } from '../ladder/engine'
import { dropSent, readPending, writePending } from '../ladder/progressStore'
import type { SceneType, SessionPlan, VerbLearningDto, VerbSessionReportDto, VerbSessionSavedDto } from './types'

// Состояние сессии живёт на сервере: после каждого ответа туда уходит, где человек сейчас и что
// стало с формами. На устройстве — только то, что ещё не доехало: очередь ответов (progressStore)
// и последний неотправленный отчёт. Пропала сеть — доедет со следующим ответом или при следующем
// открытии глагола; сервер принимает повтор без вреда.

type Report = Omit<VerbSessionReportDto, 'forms' | 'plan'>
interface Stored { report: Report; plan: SessionPlan }

const storeKey = (verbId: string) => `verb_session_pending_v1:${verbId}`

function readStored(verbId: string): Stored | null {
  try {
    const raw = localStorage.getItem(storeKey(verbId))
    return raw ? (JSON.parse(raw) as Stored) : null
  } catch {
    return null
  }
}

function writeStored(verbId: string, stored: Stored | null) {
  try {
    if (stored) localStorage.setItem(storeKey(verbId), JSON.stringify(stored))
    else localStorage.removeItem(storeKey(verbId))
  } catch {
    // Хранилище недоступно: отчёт уйдёт, пока мини-апп открыт.
  }
}

export interface SessionSync {
  /** Новое состояние формы — в очередь; уйдёт со следующим отчётом. */
  record: (item: LadderItem, state: FormState) => void
  /** Где сейчас сессия: сцена и сколько заданий в ней пройдено. */
  beat: (scene: number, done: number) => void
  /** Комикс дочитан. */
  storyDone: () => void
  /** Сессия закончена. null — отчёт не доехал (нет сети) и остался в очереди. */
  finish: (exam?: { asked: number; correct: number }) => Promise<VerbSessionSavedDto | null>
}

export function createSessionSync(
  verbId: string, sessionId: string, plan: SessionPlan, now: () => Date = () => new Date()
): SessionSync {
  const report: Report = {
    sessionId, scene: 0, done: 0, finished: false,
    scenes: plan.scenes.map(s => s.type) as SceneType[], storyCompleted: false, examAsked: 0, examCorrect: 0
  }
  let planKnown = false
  let dirty = false
  let chain: Promise<VerbSessionSavedDto | null> = Promise.resolve(null)

  /** Отправить последнее состояние. Несколько вызовов подряд сливаются: уходит только самое свежее. */
  function send() {
    dirty = true
    writeStored(verbId, { report: { ...report }, plan })
    chain = chain.then(async previous => {
      if (!dirty) return previous
      dirty = false
      const forms = readPending(verbId)
      const sent = JSON.stringify(report)
      try {
        const saved = await saveVerbSession(verbId, { ...report, plan: planKnown ? undefined : plan, forms: Object.values(forms) })
        planKnown = true
        dropSent(verbId, forms)
        if (sent === JSON.stringify(report)) writeStored(verbId, null)
        return saved
      } catch {
        dirty = true
        return null
      }
    })
    return chain
  }

  return {
    record(item, state) {
      const pending = readPending(verbId)
      pending[item.key] = { tense: item.tense, person: item.person, step: state.step, reviews: state.reviews, at: now().toISOString() }
      writePending(verbId, pending)
    },
    beat(scene, done) {
      report.scene = scene
      report.done = done
      void send()
    },
    storyDone() {
      report.storyCompleted = true
    },
    finish(exam) {
      report.finished = true
      if (exam) { report.examAsked = exam.asked; report.examCorrect = exam.correct }
      return send()
    }
  }
}

/**
 * Состояние глагола для этого человека. Если с прошлого раза что-то не доехало (ответы, отчёт о
 * сессии) — сначала досылаем: сервер сам разберётся, что новее.
 */
export async function loadLearning(verbId: string): Promise<VerbLearningDto> {
  const stored = readStored(verbId)
  const forms = readPending(verbId)
  try {
    if (stored) {
      const saved = await saveVerbSession(verbId, { ...stored.report, plan: stored.plan, forms: Object.values(forms) })
      dropSent(verbId, forms)
      writeStored(verbId, null)
      return saved.state
    }
    if (Object.keys(forms).length) {
      await saveVerbProgress(verbId, Object.values(forms))
      dropSent(verbId, forms)
    }
  } catch {
    // Не ушло — покажем, что знает сервер; очередь подождёт.
  }
  return fetchVerbLearning(verbId)
}
