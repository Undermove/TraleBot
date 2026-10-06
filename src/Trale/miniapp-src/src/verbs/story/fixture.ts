import type { VerbStoryDto } from './types'

// Для тестов: три кадра истории «go-fishing» в том виде, в каком их отдаёт сервер.
// Русские фразы форм (meaning) — те же, что в каталоге у глагола «идти».
// Грузинский текст — из каталога (предложения Tatoeba 8475459, 13841494, 8090988), не сочинён.
export const storyFixture: VerbStoryDto = {
  id: 'go-fishing',
  verbId: 'მიდის',
  title: 'Бомбора идёт на рыбалку',
  images: 'go-fishing/d404709ff4',
  frames: [
    {
      image: 'f1', who: 'Кот', scene: 'Кот видит Бомбору с удочкой.', mode: 'choose', sentenceId: 8475459,
      ka: 'შენ სად მიდიხარ ახლა?', ru: 'Куда ты сейчас идёшь?', sourceRu: 'Куда ты сейчас идёшь?', ruAdapted: false,
      target: { form: 'მიდიხარ', tense: 'present', person: 1, meaning: 'ты идёшь' },
      options: [
        { form: 'მიდიხარ', tense: 'present', person: 1, meaning: 'ты идёшь' },
        { form: 'მივდივარ', tense: 'present', person: 0, meaning: 'я иду' },
        { form: 'მიდის', tense: 'present', person: 2, meaning: 'он идёт' }
      ]
    },
    {
      image: 'f4', who: 'Бомбора', scene: 'Кот предлагает идти пешком. Подъезжает маршрутка.', mode: 'type', sentenceId: 13841494,
      ka: 'არა, მე ავტობუსით წავალ.', ru: 'Нет, я поеду на автобусе.', sourceRu: 'Нет, я поеду на автобусе.', ruAdapted: false,
      target: { form: 'წავალ', tense: 'future', person: 0, meaning: 'я буду идти' },
      options: []
    },
    {
      image: 'f5', who: 'Рассказчик', scene: 'Кот увидел воду.', mode: 'build', sentenceId: 8090988,
      ka: 'ის წავიდა სახლში.', ru: 'Он ушёл домой.', sourceRu: 'Она пошла домой.', ruAdapted: true,
      target: { form: 'წავიდა', tense: 'aorist', person: 2, meaning: 'он шёл', meaningNote: 'один раз · сделано' },
      options: []
    }
  ]
}
