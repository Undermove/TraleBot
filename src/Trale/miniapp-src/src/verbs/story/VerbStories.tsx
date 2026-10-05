import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { fetchVerbStories } from '../../api'
import { LockIcon } from '../ui/icons'
import { frameImages } from './logic'
import StoryReader, { storyDoneKey } from './StoryReader'
import type { VerbStoryDto } from './types'

const wasDone = (id: string) => { try { return !!localStorage.getItem(storyDoneKey(id)) } catch { return false } }

/**
 * Комиксы глагола на его карточке: обложка с первым кадром «под замком» и названием.
 * Обложка — заглушка в 32 px, полные кадры начинают грузиться только в открытой истории.
 * У глагола без историй не рисует ничего.
 */
export default function VerbStories({ verbId }: { verbId: string }) {
  const [stories, setStories] = useState<VerbStoryDto[]>([])
  const [opened, setOpened] = useState<VerbStoryDto | null>(null)

  useEffect(() => {
    let alive = true
    setStories([])
    fetchVerbStories(verbId).then(r => { if (alive) setStories(r.stories) }).catch(() => {})
    return () => { alive = false }
  }, [verbId])

  return (
    <>
      {stories.map(story => (
        <button
          key={story.id}
          data-testid={`verb-story-${story.id}`}
          onClick={() => setOpened(story)}
          className="jewel-pressable w-full text-left rounded-xl bg-cream-tile border-[1.5px] border-jewelInk p-2 flex items-center gap-3"
          style={{ boxShadow: '2px 2px 0 #15100A' }}
        >
          <span className="relative w-14 h-14 shrink-0 rounded-lg overflow-hidden border border-jewelInk/60 bg-cream-deep">
            <img
              src={frameImages(story, story.frames[0]).placeholder}
              alt="" aria-hidden width={32} height={32} loading="lazy"
              className="absolute inset-0 w-full h-full object-cover blur-[3px] scale-125"
            />
            <span className="absolute inset-0 flex items-center justify-center"><LockIcon size={26} /></span>
          </span>
          <span className="flex-1 min-w-0">
            <span className="block mn-eyebrow text-navy">Комикс · {story.frames.length} кадров{wasDone(story.id) ? ' · пройден' : ''}</span>
            <span className="block mt-0.5 text-[15px] font-bold text-jewelInk leading-tight">{story.title}</span>
            <span className="block text-[12px] text-jewelInk-mid">Скажи реплику — откроется следующий кадр</span>
          </span>
          <span className="shrink-0 text-[12px] font-bold text-navy whitespace-nowrap">читать →</span>
        </button>
      ))}
      {/* Карточка глагола сдвинута transform-ом, поэтому полноэкранный комикс выносим в body. */}
      {opened && createPortal(<StoryReader story={opened} onExit={() => setOpened(null)} />, document.body)}
    </>
  )
}
