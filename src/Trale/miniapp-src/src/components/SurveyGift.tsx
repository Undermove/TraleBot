import { GiftIcon } from '../verbs/ui/icons'
import { pluralDays } from '../campaignOpen'
import type { SurveyGiftDto } from '../api'

// Подарок опроса — дни полного доступа за ответы. Он выдаётся, когда человек дошёл до конца формы и
// ответил хотя бы на один вопрос; само открытие ничего не даёт. Здесь две части формы:
// строка над вопросами («Четыре коротких вопроса — и месяц полного доступа твой») и последний экран,
// который говорит, что человек получил на самом деле. Дни прибавляются к тому, что у него уже есть:
// доступа не было — «включён», подписка или пробный период идут — «добавлен» и новая дата;
// пожизненному доступу прибавлять нечего, и ему месяц не обещают.
// Эти же части показывает владельцу предпросмотр в конструкторе.

/** «11 ноября», а если год другой — «5 марта 2027». */
export function untilText(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  const text = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
  return date.getFullYear() === now.getFullYear() ? text : `${text} ${date.getFullYear()}`
}

/** «месяц», «7 дней», «21 день» — «полный доступ на …». */
export const giftSpan = (days: number) => (days === 30 ? 'месяц' : `${days} ${pluralDays(days)}`)

const COUNT = ['', 'Один', 'Два', 'Три', 'Четыре', 'Пять', 'Шесть']
/** «Четыре коротких вопроса», «Один короткий вопрос», «Пять коротких вопросов». */
export function questionsText(n: number): string {
  const count = COUNT[n] ?? String(n)
  if (n === 1) return `${count} короткий вопрос`
  return n >= 2 && n <= 4 ? `${count} коротких вопроса` : `${count} коротких вопросов`
}

/** Подарок уже у человека. */
export const giftGiven = (gift: SurveyGiftDto | null | undefined) =>
  gift?.outcome === 'given' || gift?.outcome === 'addedToSubscription' || gift?.outcome === 'addedToFreeAccess'

/** Строка над вопросами: что будет за ответы. null — обещать нечего (подарок уже выдан). */
export function giftPromise(gift: SurveyGiftDto, questions: number, now: Date = new Date()): string | null {
  const count = questionsText(questions)
  switch (gift.outcome) {
    case 'given':
    case 'addedToSubscription':
    case 'addedToFreeAccess':
      return null
    case 'lifetime':
      return `Спасибо за поддержку! ${count} ${questions === 1 ? 'поможет' : 'помогут'} мне решить, что делать дальше`
    case 'offerEnded':
      return `Подарок можно было получить до ${gift.untilUtc ? untilText(gift.untilUtc, now) : 'конца срока'}. На вопросы по-прежнему можно ответить.`
    default:
      return gift.days === 30 ? `${count} — и месяц полного доступа твой` : `${count} — и полный доступ на ${giftSpan(gift.days)} твой`
  }
}

/** Что сказать о подарке после формы: заголовок и строка под ним; null — сказать нечего. */
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
    case 'addedToSubscription':
    case 'addedToFreeAccess':
      if (!gift.untilUtc || new Date(gift.untilUtc) <= now) return null
      return {
        title: gift.days === 30 ? 'Месяц полного доступа добавлен' : `Полный доступ продлён на ${span}`,
        line: gift.outcome === 'addedToSubscription' ? `Подписка теперь действует до ${until}.` : `Бесплатный доступ теперь открыт до ${until}.`
      }
    case 'lifetime':
      return {
        title: 'У тебя пожизненный доступ',
        line: 'Он не заканчивается, поэтому прибавить к нему нечего. Спасибо за поддержку!'
      }
    case 'needsAnswer':
      return {
        title: gift.days === 30 ? 'Ответь хотя бы на один вопрос, и месяц твой' : `Ответь хотя бы на один вопрос, и полный доступ на ${span} твой`,
        line: 'Вопросы можно пропускать, но подарок включается после хотя бы одного ответа.'
      }
    case 'offerEnded':
      return {
        title: until ? `Подарок можно было получить до ${until}` : 'Срок подарка вышел',
        line: 'Срок вышел, поэтому доступ не изменился. Спасибо за ответы!'
      }
    case 'notGiven':
      return {
        title: 'Подарок пока не включился',
        line: 'Что-то пошло не так. Закрой мини-апп и открой опрос кнопкой под сообщением ещё раз.'
      }
    default:
      return null
  }
}

const TrialNote = ({ text }: { text: string }) => (
  <div className="rounded-xl border-[1.5px] border-jewelInk/30 bg-white px-3 py-2 font-sans text-[12px] text-jewelInk-mid" data-testid="survey-gift-trial">
    {text}
  </div>
)

/** Строка о подарке над вопросами. */
export function GiftPromiseLine({ gift, questions, now }: { gift: SurveyGiftDto; questions: number; now?: Date }) {
  const text = giftPromise(gift, questions, now)
  if (!text) return null
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2.5 rounded-xl border-[1.5px] border-jewelInk bg-cream-tile px-3 py-2.5" data-testid="survey-gift-promise" data-outcome={gift.outcome}>
        <GiftIcon size={26} className="shrink-0" />
        <div className="font-sans text-[14px] font-bold text-jewelInk leading-snug min-w-0">{text}</div>
      </div>
      {gift.trial && <TrialNote text="Пробная отправка: дни не начисляются, остальное — как у получателя." />}
    </div>
  )
}

/** Карточка на последнем экране: что человек получил. */
export function GiftResultCard({ gift, now }: { gift: SurveyGiftDto; now?: Date }) {
  const words = giftWords(gift, now)
  if (!words) return null
  return (
    <div className="w-full flex flex-col gap-2 text-left" data-testid="survey-gift" data-outcome={gift.outcome}>
      <div className="jewel-tile px-4 py-4">
        <div className="relative z-[1] flex items-start gap-3">
          <div className="shrink-0 w-14 h-14 rounded-xl bg-cream-deep border-[1.5px] border-jewelInk flex items-center justify-center">
            <GiftIcon size={36} />
          </div>
          <div className="min-w-0">
            {/* Кому прибавлять нечего, тому это не «подарок», а справка о его доступе. */}
            <div className="mn-eyebrow text-navy" data-testid="survey-gift-eyebrow">{gift.outcome === 'lifetime' ? 'твой доступ' : 'подарок'}</div>
            <div className="font-sans text-[19px] font-extrabold text-jewelInk leading-tight break-words mt-0.5" data-testid="survey-gift-title">{words.title}</div>
            <div className="font-sans text-[14px] text-jewelInk-mid leading-snug mt-1" data-testid="survey-gift-line">{words.line}</div>
          </div>
        </div>
      </div>
      {gift.trial && giftGiven(gift) && <TrialNote text="Пробная отправка: дни не начислены. Так экран выглядит для человека с таким доступом, как у тебя." />}
    </div>
  )
}
