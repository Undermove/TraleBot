import { GiftIcon } from '../verbs/ui/icons'
import { pluralDays } from '../campaignOpen'
import type { SurveyGiftDto } from '../api'

// Первый экран опроса с подарком. Подарок уже выдан — в тот момент, когда человек нажал кнопку под
// сообщением, — поэтому экран ничего не просит взамен: говорит, что именно человек получил и до какого
// числа, зовёт к вопросам и даёт просто уйти. Кому дни не прибавились (доступ и так длиннее или
// бессрочный, срок подарка вышел), тому экран говорит об этом прямо, а не «включено».
// Этот же компонент показывает владельцу предпросмотр в конструкторе.

interface Props {
  gift: SurveyGiftDto
  /** Сколько вопросов в форме. */
  questions: number
  onStart: () => void
  onClose: () => void
  /** Сегодня — для тестов; по умолчанию часы человека. */
  now?: Date
}

/** «11 ноября», а если год другой — «5 марта 2027». */
export function untilText(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  const text = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
  return date.getFullYear() === now.getFullYear() ? text : `${text} ${date.getFullYear()}`
}

/** «месяц», «7 дней», «21 день» — «полный доступ на …». */
export const giftSpan = (days: number) => (days === 30 ? 'месяц' : `${days} ${pluralDays(days)}`)

function questionsText(n: number): string {
  const mod100 = n % 100, mod10 = n % 10
  if (n === 1) return 'один короткий вопрос'
  if (mod100 >= 11 && mod100 <= 14) return `${n} коротких вопросов`
  if (mod10 === 1) return `${n} короткий вопрос`
  if (mod10 >= 2 && mod10 <= 4) return `${n} коротких вопроса`
  return `${n} коротких вопросов`
}

/** Что сказать о подарке: заголовок и строка под ним; null — сказать нечего (подарок давно закончился). */
export function giftWords(gift: SurveyGiftDto, now: Date = new Date()): { title: string; line: string } | null {
  const until = gift.untilUtc ? untilText(gift.untilUtc, now) : null
  const span = giftSpan(gift.days)
  switch (gift.outcome) {
    case 'given':
      if (!gift.untilUtc || new Date(gift.untilUtc) <= now) return null
      return {
        title: gift.days === 30 ? 'Месяц полного доступа включён' : `Полный доступ на ${span} включён`,
        line: `Действует до ${until}. Открыто всё: уроки, глаголы и словарь.`
      }
    case 'lifetime':
      return {
        title: 'У тебя пожизненный доступ',
        line: 'Он не заканчивается, поэтому прибавить к нему нечего. Спасибо за поддержку!'
      }
    case 'subscriptionIsLonger':
      return {
        title: until ? `Подписка действует до ${until}` : 'Подписка действует',
        line: 'Это дольше подарка, поэтому новые дни к ней не прибавились. Полный доступ у тебя и так открыт. Спасибо за поддержку!'
      }
    case 'freeAccessIsLonger':
      return {
        title: until ? `Полный доступ открыт до ${until}` : 'Полный доступ уже открыт',
        line: 'Это дольше подарка, поэтому новые дни не прибавились.'
      }
    case 'offerEnded':
      return {
        title: until ? `Подарок можно было забрать до ${until}` : 'Срок подарка вышел',
        line: 'Срок вышел, поэтому доступ не изменился. На вопросы по-прежнему можно ответить.'
      }
    default:
      return {
        title: 'Подарок пока не включился',
        line: 'Что-то пошло не так. Закрой мини-апп и нажми кнопку под сообщением ещё раз.'
      }
  }
}

export default function SurveyGiftIntro({ gift, questions, onStart, onClose, now }: Props) {
  const words = giftWords(gift, now)
  return (
    <div className="flex flex-col gap-4" data-testid="survey-gift" data-outcome={gift.outcome}>
      {words && (
        <div className="jewel-tile px-4 py-4">
          <div className="relative z-[1] flex items-start gap-3">
            <div className="shrink-0 w-14 h-14 rounded-xl bg-cream-deep border-[1.5px] border-jewelInk flex items-center justify-center">
              <GiftIcon size={36} />
            </div>
            <div className="min-w-0">
              <div className="mn-eyebrow text-navy">подарок</div>
              <div className="font-sans text-[19px] font-extrabold text-jewelInk leading-tight break-words mt-0.5" data-testid="survey-gift-title">{words.title}</div>
              <div className="font-sans text-[14px] text-jewelInk-mid leading-snug mt-1" data-testid="survey-gift-line">{words.line}</div>
            </div>
          </div>
        </div>
      )}

      <div>
        <div className="font-sans text-[17px] font-extrabold text-jewelInk leading-snug">Если найдётся минута</div>
        <div className="font-sans text-[14px] text-jewelInk-mid leading-snug mt-1" data-testid="survey-gift-invite">
          Здесь {questionsText(questions)}. По ответам я решаю, что делать в боте дальше. Отвечать не обязательно{gift.outcome === 'given' && words ? ' — доступ уже твой' : ''}.
        </div>
      </div>

      <button type="button" onClick={onStart} className="jewel-btn jewel-btn-gold w-full font-sans text-[16px] font-extrabold" data-testid="survey-gift-start">
        Ответить на вопросы
      </button>
      <button type="button" onClick={onClose} className="font-sans text-[14px] font-bold text-jewelInk-mid text-center min-h-[44px] active:opacity-60" data-testid="survey-gift-close">
        Закрыть без ответов
      </button>
    </div>
  )
}
