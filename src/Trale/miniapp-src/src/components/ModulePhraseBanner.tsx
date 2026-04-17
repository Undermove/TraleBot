import React, { useState, useEffect } from 'react'
import Mascot from './Mascot'

interface ModulePhrase {
  georgian: string
  translation: string
}

const PHRASE_MAP: Record<string, ModulePhrase> = {
  // Фаза 1: Алфавит
  'alphabet-progressive': {
    georgian: 'ანბანი — ყველაფრის საწყისი',
    translation: 'Алфавит — начало всего',
  },
  'alphabet': {
    georgian: 'ანბანი — ყველაფრის საწყისი',
    translation: 'Алфавит — начало всего',
  },

  // Фаза 2: Выживание
  'intro': {
    georgian: 'გამარჯობა! მე მქვია...',
    translation: 'Привет! Меня зовут...',
  },
  'emergency': {
    georgian: 'არ მესმის — ეს ნორმალურია!',
    translation: 'Я не понимаю — это нормально!',
  },

  // Фаза 2.5: Числительные
  'numbers': {
    georgian: 'ათი, ოცი, ასი — ვითვლით!',
    translation: 'Десять, двадцать, сто — считаем!',
  },

  // Фаза 3: Грамматика
  'pronouns': {
    georgian: 'მე, შენ, ის — ჩვენ',
    translation: 'Я, ты, он — мы',
  },
  'present-tense': {
    georgian: 'ახლა ვლაპარაკობ ქართულად!',
    translation: 'Сейчас я говорю по-грузински!',
  },
  'cases': {
    georgian: 'ვინ? ვის? ვისთვის? ვისგან?',
    translation: 'Кто? Кому? Для кого? От кого?',
  },
  'postpositions': {
    georgian: 'სად? საით? საიდან?',
    translation: 'Где? Куда? Откуда?',
  },
  'adjectives': {
    georgian: 'ლამაზი, კარგი, ძლიერი',
    translation: 'Красивый, хороший, сильный',
  },

  // Фаза 5: Глаголы
  'verb-classes': {
    georgian: 'ზმნა — ქართული ენის გული',
    translation: 'Глагол — сердце грузинского языка',
  },
  'version-vowels': {
    georgian: 'ვისთვის? ვის? სად?',
    translation: 'Для кого? Кому? Куда?',
  },
  'preverbs': {
    georgian: 'მი-მო-გა-შე-ა — მოძრაობა!',
    translation: 'Ми-мо-га-ше-а — направление движения!',
  },
  'verbs-of-movement': {
    georgian: 'ვიდი, ვდივარ — ვმოძრაობ!',
    translation: 'Я шёл, я хожу — я двигаюсь!',
  },
  'imperfect': {
    georgian: 'ვიყავი, ვწერდი, ვლაპარაკობდი...',
    translation: 'Я был, я писал, я говорил...',
  },
  'aorist': {
    georgian: 'ვთქვი, ვნახე, ვიყიდე',
    translation: 'Я сказал, увидел, купил',
  },
  'pronoun-declension': {
    georgian: 'მე → მე, მე-ს, ჩე-მ-ი',
    translation: 'Я → мне, меня, мой',
  },
  'conditionals': {
    georgian: 'თუ მოხვალ — ვიქნები!',
    translation: 'Если придёшь — я буду здесь!',
  },

  // Фаза 4: Тематическая лексика
  'cafe': {
    georgian: 'ერთი ყავა, გთხოვთ!',
    translation: 'Один кофе, пожалуйста!',
  },
  'taxi': {
    georgian: 'გამიჩერეთ! — остановите!',
    translation: 'Остановите!',
  },
  'doctor': {
    georgian: 'ყველა კარგადაა?',
    translation: 'Все хорошо?',
  },
  'shopping': {
    georgian: 'რამდენი ღირს?',
    translation: 'Сколько стоит?',
  },
}

type Phase = 'phrase' | 'translated' | 'dismissing' | 'dismissed'

interface Props {
  moduleId: string
}

export default function ModulePhraseBanner({ moduleId }: Props) {
  const entry = PHRASE_MAP[moduleId]
  const storageKey = `bombora_phrase_shown_${moduleId}`

  const [phase, setPhase] = useState<Phase>(() => {
    if (!entry || sessionStorage.getItem(storageKey)) return 'dismissed'
    return 'phrase'
  })

  // Write sessionStorage as soon as the banner is shown
  useEffect(() => {
    if (phase !== 'dismissed') {
      sessionStorage.setItem(storageKey, '1')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-dismiss after 3s — only if user hasn't tapped yet
  useEffect(() => {
    if (phase !== 'phrase') return
    const t = setTimeout(() => {
      setPhase(p => (p === 'phrase' ? 'dismissing' : p))
    }, 3000)
    return () => clearTimeout(t)
  }, [phase])

  // Complete dismissal after slide-up animation
  useEffect(() => {
    if (phase === 'dismissing') {
      const t = setTimeout(() => setPhase('dismissed'), 280)
      return () => clearTimeout(t)
    }
  }, [phase])

  if (phase === 'dismissed') return null

  const isDismissing = phase === 'dismissing'

  const handleTap = () => {
    if (phase === 'phrase') {
      setPhase('translated')
    } else if (phase === 'translated') {
      setPhase('dismissing')
    }
  }

  return (
    <div
      className="jewel-tile px-4 py-3 mb-4"
      style={{
        minHeight: 88,
        overflow: 'hidden',
        animation: isDismissing
          ? 'phrase-slide-up 250ms ease-in both'
          : 'phrase-slide-in 320ms ease-out both',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}
      onClick={handleTap}
    >
      <div className="relative z-[1]">
        {/* Top row: Mascot + Georgian phrase */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <Mascot mood="guide" size={48} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-sans text-[18px] font-extrabold text-navy leading-snug mt-2">
              {entry.georgian}
            </div>
          </div>
        </div>

        {/* Hint — pulsing tap prompt so user knows the banner is interactive */}
        {phase === 'phrase' && (
          <div
            className="font-sans text-[11px] text-center mt-1"
            style={{ color: 'rgba(21,16,10,0.5)', animation: 'pulse-hint 1.2s ease-in-out infinite' }}
          >
            👆 тапни — узнай перевод
          </div>
        )}

        {/* Translation — revealed on first tap */}
        {(phase === 'translated' || phase === 'dismissing') && (
          <div
            className="font-sans text-[14px] leading-snug mt-2"
            style={{
              color: 'rgba(21,16,10,0.7)',
              animation: 'slow-fade 250ms 100ms ease both',
            }}
          >
            {entry.translation}
          </div>
        )}

        {/* Countdown bar — 3px gold strip shrinking to zero over 3 seconds */}
        <div
          className="rounded-full overflow-hidden mt-3"
          style={{ height: 3, width: '100%', background: 'rgba(21,16,10,0.1)' }}
        >
          <div
            style={{
              height: '100%',
              background: '#F5B820',
              animation: 'phrase-countdown 3000ms linear both',
            }}
          />
        </div>
      </div>
    </div>
  )
}
