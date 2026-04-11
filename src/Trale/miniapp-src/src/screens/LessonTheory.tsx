import React from 'react'
import Header from '../components/Header'
import Mascot from '../components/Mascot'
import Button from '../components/Button'
import { CatalogDto, ProgressState, Screen, TheoryBlockDto } from '../types'

interface Props {
  catalog: CatalogDto
  moduleId: string
  lessonId: number
  progress: ProgressState
  navigate: (s: Screen) => void
}

export default function LessonTheory({ catalog, moduleId, lessonId, progress, navigate }: Props) {
  const module = catalog.modules.find((m) => m.id === moduleId)
  const lesson = module?.lessons.find((l) => l.id === lessonId)

  if (!module || !lesson) {
    return (
      <div className="flex flex-col min-h-full">
        <Header
          progress={progress}
          onBack={() => navigate({ kind: 'module', moduleId })}
          title={`Урок ${lessonId}`}
        />
        <div className="p-5 text-dog-muted">Урок не найден.</div>
      </div>
    )
  }

  const theory = lesson.theory

  return (
    <div className="flex flex-col min-h-full">
      <Header
        progress={progress}
        onBack={() => navigate({ kind: 'module', moduleId })}
        title={`Урок ${lessonId}`}
      />
      <div className="flex-1 p-5 pb-32 anim-slide">
        <div className="bg-white rounded-3xl shadow-card p-5">
          <div className="flex items-start gap-3">
            <Mascot mood="think" size={80} />
            <div className="flex-1">
              <div className="text-dog-muted uppercase text-xs font-extrabold tracking-wider">
                Урок {lessonId}
              </div>
              <div className="font-extrabold text-lg leading-tight mt-0.5">{theory.title}</div>
              <div className="text-dog-muted text-sm mt-2">🎯 {theory.goal}</div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3">
            {theory.blocks.map((b, i) => (
              <TheoryBlock key={i} block={b} />
            ))}
          </div>
        </div>
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto px-4 pt-4 bg-dog-bg/95 backdrop-blur border-t border-dog-line"
        style={{ paddingBottom: 'calc(var(--safe-b) + 16px)' }}
      >
        <Button
          variant="green"
          onClick={() => navigate({ kind: 'practice', moduleId, lessonId })}
        >
          ▶ Начать практику
        </Button>
      </div>
    </div>
  )
}

function TheoryBlock({ block }: { block: TheoryBlockDto }) {
  if (block.type === 'paragraph') {
    return <p className="text-dog-ink leading-relaxed text-[15px]">{block.text}</p>
  }
  if (block.type === 'list' && block.items) {
    return (
      <ul className="flex flex-col gap-2">
        {block.items.map((item, j) => (
          <li key={j} className="bg-dog-accent/10 rounded-xl px-3 py-2 text-[15px] font-semibold">
            {item}
          </li>
        ))}
      </ul>
    )
  }
  if (block.type === 'example') {
    return (
      <div className="rounded-xl border-2 border-dog-line p-3 flex flex-col gap-1">
        <div className="font-extrabold text-dog-ink">{block.ge}</div>
        <div className="text-dog-muted text-sm">— {block.ru}</div>
      </div>
    )
  }
  if (block.type === 'letters' && block.letters) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {block.letters.map((l) => (
          <div
            key={l.letter}
            className="rounded-2xl border-2 border-dog-line p-3 flex flex-col items-center gap-1 bg-dog-bg/40"
          >
            <div className="text-5xl font-black text-dog-ink">{l.letter}</div>
            <div className="text-xs text-dog-muted font-bold">
              {l.name} · «{l.translit}»
            </div>
            <div className="mt-1 text-center">
              <div className="font-extrabold text-dog-ink">{l.exampleGe}</div>
              <div className="text-xs text-dog-muted">{l.exampleRu}</div>
            </div>
          </div>
        ))}
      </div>
    )
  }
  return null
}
