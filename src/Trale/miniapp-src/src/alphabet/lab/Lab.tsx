import React from 'react'
import '../games/alphabet.css'
import LessonOpener from '../opener/LessonOpener'
import LetterIntro from '../intro/LetterIntro'
import Catch from '../games/Catch'
import SoundLetter from '../games/SoundLetter'
import Pairs from '../games/Pairs'
import Morph from '../games/Morph'
import Assemble from '../games/Assemble'
import Dialogue from '../games/Dialogue'
import Finale from '../games/Finale'
import Cafe from '../cafe/Cafe'
import WordIntro from '../words/WordIntro'
import { wordGamesFor } from '../AlphabetInterlude'
import { LESSON_WORDS } from '../games/data'
import { learnedLetters, lessonLetters, shuffle, type Word } from '../games/logic'
import { lessonInfo } from '../lessons'
import { DIALOGUES } from '../games/dialogues'
import Practice from '../../screens/Practice'
import { defaultProgress } from '../../progress'
import Welcome, { type Step as WelcomeStep } from '../../screens/Welcome'

// Стенд для проверки вёрстки: одна сцена алфавита с заданными данными, без сервера и без урока вокруг.
// Открывается адресом ?alphabet-lab=<сцена>&lesson=<id урока>&word=<грузинское слово>&letter=<буква>;
// e2e/alphabet-fit.spec.ts прогоняет так все сцены и все слова на разных размерах экрана.

const noop = () => {}

export default function Lab() {
  const q = new URLSearchParams(window.location.search)
  const scene = q.get('alphabet-lab') ?? 'opener'
  const lessonId = Number(q.get('lesson') ?? '1')
  const info = lessonInfo(lessonId)
  const stage = info.stage
  const geo = q.get('word') ?? ''
  const all = LESSON_WORDS.flatMap((ws, i) => ws.map(([g, ru]) => ({ geo: g, ru, lesson: i + 1 }) as Word))
  const word = all.find(w => w.geo === geo) ?? { geo: geo || 'და', ru: '…', lesson: stage }
  const common = { lesson: stage, fraction: 0.5, onExit: noop, onDone: noop }
  switch (scene) {
    case 'opener': return <LessonOpener lessonId={lessonId} onBack={noop} onStart={noop} details={<p className="text-[15px]">Теория урока — для проверки панели «подробнее».</p>} />
    case 'intro': return <LetterIntro letter={q.get('letter') ?? lessonLetters(stage)[0]} index={0} count={3} fraction={0.1} onExit={noop} onDone={noop} />
    case 'catch': return <Catch letters={lessonLetters(stage).slice(0, 2)} {...common} rng={() => 0.4} />
    case 'sound': return <SoundLetter {...common} />
    case 'pairs': return info.kind === 'words' ? <Pairs deck="words" pool={wordGamesFor(lessonId).pool} {...common} /> : <Pairs deck="letters" {...common} />
    case 'words': return <WordIntro featured={[word]} startCount={3} fraction={0.3} onExit={noop} onDone={noop} />
    case 'morph': return <Morph {...common} lesson={Math.max(stage, word.lesson)} words={[word]} />
    case 'assemble': {
      const n = Math.max(stage, word.lesson)
      const letters = [...word.geo]
      const spare = learnedLetters(n).filter(l => !letters.includes(l)).slice(0, 2)
      return <Assemble {...common} lesson={n} rounds={[{ word, letters, tiles: shuffle([...letters, ...spare], () => 0.3) }]} />
    }
    case 'dialogue': {
      const g = wordGamesFor(lessonId)
      // &long=1 — варианты ответа из самых длинных слов словаря.
      if (q.has('long')) {
        const pick = (geo: string) => all.find(w => w.geo === geo)!
        const frame = DIALOGUES.find(f => f.answer === 'მეგობარი')!
        return <Dialogue stage={11} own={[]} known={all} {...common} rounds={[{ frame, answer: pick('მეგობარი'), choices: ['საქართველო', 'ნახვამდის', 'მეგობარი'] }]} />
      }
      return <Dialogue stage={stage} own={g.pool.own} known={g.pool.known} {...common} />
    }
    // Проверка в конце урока — обычный экран вопросов (вопросы стенду отдаёт e2e через page.route).
    // Знакомство с приложением: &step=hello|letter|catch|gift|word|tour|win.
    case 'welcome': return <Welcome start={(q.get('step') ?? 'hello') as WelcomeStep} onComplete={noop} onNext={noop} onBrowse={noop} />
    case 'check': return <Practice moduleId="alphabet-lab-check" lessonId={1} progress={defaultProgress} setProgress={noop} authenticated navigate={noop} />
    case 'cafe': return <Cafe {...common} />
    case 'finale': return <Finale lessonId={lessonId} onNext={noop} onVocabulary={noop} />
    default: return <div>unknown scene</div>
  }
}
