// Данные игр модуля «Алфавит». Вопросы и теорию уроков здесь не трогаем: порядок букв, их звучание
// и грузинские слова с переводом списаны из теории уроков (MiniAppContentProvider.cs, «Грузинские слова
// урока»), русские слова — из примеров теории и вопросов. data.test.ts сверяет, что каждое слово
// составлено только из букв, выученных к своему уроку.

/** Три новые буквы каждого урока, по порядку уроков 1–11. */
export const LESSON_LETTERS: readonly (readonly string[])[] = [
  ['ა', 'დ', 'რ'],
  ['ე', 'ი', 'ს'],
  ['ვ', 'მ', 'ნ'],
  ['ლ', 'ჩ', 'ხ'],
  ['თ', 'ო', 'შ'],
  ['ბ', 'გ', 'ქ'],
  ['კ', 'ც', 'წ'],
  ['ტ', 'უ', 'ფ'],
  ['პ', 'ღ', 'ძ'],
  ['ზ', 'ყ', 'ჭ'],
  ['ჟ', 'ჯ', 'ჰ']
]

export const LESSON_COUNT = LESSON_LETTERS.length

/**
 * Как звучит буква — так же, как в теории урока. group — буквы с похожим звуком: пока ученик знает
 * только одну из пары, говорим просто «к»; когда узнал вторую — уточняем, какая из них.
 */
export const SOUNDS: Record<string, { plain: string; exact?: string; group?: string }> = {
  ა: { plain: 'а' }, დ: { plain: 'д' }, რ: { plain: 'р' },
  ე: { plain: 'э' }, ი: { plain: 'и' }, ს: { plain: 'с' },
  ვ: { plain: 'в' }, მ: { plain: 'м' }, ნ: { plain: 'н' },
  ლ: { plain: 'л' }, ჩ: { plain: 'ч', exact: '«ч» с выдохом', group: 'ч' }, ხ: { plain: 'х', group: 'х' },
  თ: { plain: 'т', exact: '«т» с выдохом', group: 'т' }, ო: { plain: 'о' }, შ: { plain: 'ш' },
  ბ: { plain: 'б' }, გ: { plain: 'г', group: 'г' }, ქ: { plain: 'к', exact: '«к» с выдохом', group: 'к' },
  კ: { plain: 'к', exact: '«к» коротко', group: 'к' }, ც: { plain: 'ц', exact: '«ц» с выдохом', group: 'ц' }, წ: { plain: 'ц', exact: '«ц» коротко', group: 'ц' },
  ტ: { plain: 'т', exact: '«т» коротко', group: 'т' }, უ: { plain: 'у' }, ფ: { plain: 'п', exact: '«п» с выдохом', group: 'п' },
  პ: { plain: 'п', exact: '«п» коротко', group: 'п' }, ღ: { plain: 'г', exact: 'мягкое «г»', group: 'г' }, ძ: { plain: 'дз' },
  ზ: { plain: 'з' }, ყ: { plain: 'к', exact: '«к» в горле', group: 'к' }, ჭ: { plain: 'ч', exact: '«ч» коротко', group: 'ч' },
  ჟ: { plain: 'ж' }, ჯ: { plain: 'дж' }, ჰ: { plain: 'х', exact: 'лёгкое «х»', group: 'х' }
}

/** Грузинские слова урока с переводом — базовый словарь курса, по урокам 1–11. */
export const LESSON_WORDS: readonly (readonly [string, string][])[] = [
  [['და', 'и'], ['არა', 'нет'], ['რა', 'что']],
  [['სად', 'где'], ['ეს', 'это'], ['ის', 'он, она'], ['არის', 'есть'], ['დედა', 'мама'], ['დიდი', 'большой']],
  [['მამა', 'папа'], ['მე', 'я'], ['მინდა', 'хочу'], ['ვინ', 'кто'], ['სამი', 'три'], ['ვარ', '(я) есть'], ['რამდენი', 'сколько']],
  [['ჩაი', 'чай'], ['სახლი', 'дом'], ['ჩემი', 'мой'], ['ჩვენ', 'мы'], ['ახალი', 'новый'], ['ნახვამდის', 'до свидания'], ['ხვალ', 'завтра']],
  [['ერთი', 'один'], ['ორი', 'два'], ['ათი', 'десять'], ['შენ', 'ты'], ['შენი', 'твой'], ['თავი', 'голова'], ['რადიო', 'радио']],
  [['მანქანა', 'машина'], ['ქალი', 'женщина'], ['ბავშვი', 'ребёнок'], ['მეგობარი', 'друг'], ['მადლობა', 'спасибо'], ['საქართველო', 'Грузия'], ['ქალაქი', 'город'], ['ექიმი', 'врач']],
  [['კი', 'да'], ['კარგი', 'хорошо'], ['კაცი', 'мужчина'], ['წიგნი', 'книга'], ['სკოლა', 'школа'], ['ცივი', 'холодный'], ['კინო', 'кино']],
  [['ფული', 'деньги'], ['ხუთი', 'пять'], ['ქუჩა', 'улица'], ['იაფი', 'дешёвый'], ['კატა', 'кошка'], ['გუშინ', 'вчера'], ['მეტრო', 'метро'], ['კაფე', 'кафе']],
  [['პური', 'хлеб'], ['ღვინო', 'вино'], ['ძაღლი', 'собака'], ['დღე', 'день'], ['ძმა', 'брат'], ['ძვირი', 'дорогой']],
  [['ყავა', 'кофе'], ['წყალი', 'вода'], ['ყველი', 'сыр'], ['ლამაზი', 'красивый'], ['ჭიქა', 'стакан'], ['ჭამს', 'ест']],
  [['გამარჯობა', 'здравствуй'], ['ოჯახი', 'семья'], ['ჰაერი', 'воздух'], ['ჰო', 'ага']]
]

/**
 * Записи слов — для знакомства с буквой (слово на эту букву) и со словом урока. Где запись уже была в
 * public/audio (у вопроса другого модуля transcript — ровно это слово, или словарь «Мои слова» в теории),
 * берём её; остальные озвучены тем же голосом Piper ka_GE-natia-medium, что и прочие записи мини-аппа,
 * и лежат в public/audio/alphabet-words.
 */
export const WORD_AUDIO: Readonly<Record<string, string>> = {
  რძე: '/audio/shopping/rdze.m4a',
  ჩაი: '/audio/cafe/chai.m4a',
  შაქარი: '/audio/shopping/shakari.m4a',
  წყალი: '/audio/cafe/wqali.m4a',
  პური: '/audio/cafe/puri.m4a',
  ღვინო: '/audio/cafe/ghvino.m4a',
  ყავა: '/audio/cafe/kava.m4a',
  არა: '/audio/intro/ara.m4a',
  რა: '/audio/pronouns/ra.m4a',
  სად: '/audio/pronouns/sad.m4a',
  ეს: '/audio/pronouns/es.m4a',
  ის: '/audio/pronouns/is.m4a',
  არის: '/audio/present-tense/aris.m4a',
  დიდი: '/audio/adjectives/didi.m4a',
  მე: '/audio/pronouns/me.m4a',
  მინდა: '/audio/verb-classes/minda.m4a',
  ვინ: '/audio/pronouns/vin.m4a',
  სამი: '/audio/numbers/sami.m4a',
  ვარ: '/audio/present-tense/var.m4a',
  სახლი: '/audio/cases/saxli.m4a',
  ჩემი: '/audio/pronouns/chemi.m4a',
  ჩვენ: '/audio/pronouns/chven.m4a',
  ახალი: '/audio/adjectives/akhali.m4a',
  ნახვამდის: '/audio/intro/nakhvamdis.m4a',
  ერთი: '/audio/numbers/erti.m4a',
  ორი: '/audio/numbers/ori.m4a',
  ათი: '/audio/numbers/ati.m4a',
  შენ: '/audio/pronouns/shen.m4a',
  შენი: '/audio/pronouns/sheni.m4a',
  თავი: '/audio/doctor/tavi.m4a',
  ქალი: '/audio/cases/kali.m4a',
  ბავშვი: '/audio/cases/bavshvi.m4a',
  მადლობა: '/audio/intro/madloba.m4a',
  კი: '/audio/intro/ki.m4a',
  კარგი: '/audio/adjectives/kargi.m4a',
  კაცი: '/audio/cases/katsi.m4a',
  ცივი: '/audio/adjectives/tsivi.m4a',
  ხუთი: '/audio/numbers/khuti.m4a',
  ქუჩა: '/audio/taxi/qucha.m4a',
  იაფი: '/audio/shopping/iafi.m4a',
  მეტრო: '/audio/taxi/metro.m4a',
  ყველი: '/audio/cafe/qveli.m4a',
  ლამაზი: '/audio/adjectives/lamazi.m4a',
  ჭამს: '/audio/verb-classes/chams.m4a',
  გამარჯობა: '/audio/intro/gamarjoba.m4a',
  ოჯახი: '/audio/intro/ojakhi.m4a',
  დედა: '/audio/vocabulary/deda.m4a',
  მამა: '/audio/vocabulary/mama.m4a',
  ძაღლი: '/audio/vocabulary/dzaghli.m4a',
  კატა: '/audio/vocabulary/kata.m4a',
  მზე: '/audio/vocabulary/mze.m4a',
  წიგნი: '/audio/vocabulary/tsigni.m4a',
  ატამი: '/audio/alphabet-words/atami.m4a',
  დათვი: '/audio/alphabet-words/datvi.m4a',
  ელვა: '/audio/alphabet-words/elva.m4a',
  ია: '/audio/alphabet-words/ia.m4a',
  საზამთრო: '/audio/alphabet-words/sazamtro.m4a',
  ვაშლი: '/audio/alphabet-words/vashli.m4a',
  ნაყინი: '/audio/alphabet-words/naqini.m4a',
  ლიმონი: '/audio/alphabet-words/limoni.m4a',
  ხაჭაპური: '/audio/alphabet-words/khachapuri.m4a',
  თოვლი: '/audio/alphabet-words/tovli.m4a',
  ოქრო: '/audio/alphabet-words/okro.m4a',
  ბადრიჯანი: '/audio/alphabet-words/badrijani.m4a',
  გოგრა: '/audio/alphabet-words/gogra.m4a',
  ქვა: '/audio/alphabet-words/kva.m4a',
  ცომი: '/audio/alphabet-words/tsomi.m4a',
  ტყე: '/audio/alphabet-words/tqe.m4a',
  ულვაში: '/audio/alphabet-words/ulvashi.m4a',
  ფოთოლი: '/audio/alphabet-words/potoli.m4a',
  ზღარბი: '/audio/alphabet-words/zgharbi.m4a',
  ჭიქა: '/audio/alphabet-words/chika.m4a',
  ჟირაფი: '/audio/alphabet-words/zhirapi.m4a',
  ჯინსი: '/audio/alphabet-words/jinsi.m4a',
  ჰაერი: '/audio/alphabet-words/haeri.m4a',
  და: '/audio/alphabet-words/da.m4a',
  რამდენი: '/audio/alphabet-words/ramdeni.m4a',
  ხვალ: '/audio/alphabet-words/khval.m4a',
  რადიო: '/audio/alphabet-words/radio.m4a',
  მანქანა: '/audio/alphabet-words/mankana.m4a',
  მეგობარი: '/audio/alphabet-words/megobari.m4a',
  საქართველო: '/audio/alphabet-words/sakartvelo.m4a',
  ქალაქი: '/audio/alphabet-words/kalaki.m4a',
  ექიმი: '/audio/alphabet-words/ekimi.m4a',
  სკოლა: '/audio/alphabet-words/skola.m4a',
  კინო: '/audio/alphabet-words/kino.m4a',
  ფული: '/audio/alphabet-words/puli.m4a',
  გუშინ: '/audio/alphabet-words/gushin.m4a',
  კაფე: '/audio/alphabet-words/kape.m4a',
  დღე: '/audio/alphabet-words/dghe.m4a',
  ძმა: '/audio/alphabet-words/dzma.m4a',
  ძვირი: '/audio/alphabet-words/dzviri.m4a',
  ჰო: '/audio/alphabet-words/ho.m4a'
}

/**
 * Настоящие грузинские слова вне базового словаря, которые модуль показывает целиком грузинскими буквами
 * (теория и вопросы уроков, заказы в кафе). Каждое сверено со словарём — ссылка рядом. Русских слов,
 * написанных грузинскими буквами («სახარ»), в модуле нет: content.test.ts это проверяет.
 */
export const VERIFIED_WORDS: readonly { geo: string; ru: string; source: string }[] = [
  { geo: 'არ', ru: 'не', source: 'https://en.wiktionary.org/wiki/არ' },
  { geo: 'ხელი', ru: 'рука', source: 'https://en.wiktionary.org/wiki/ხელი' },
  { geo: 'შვილი', ru: 'ребёнок', source: 'https://en.wiktionary.org/wiki/შვილი' },
  { geo: 'ბანანი', ru: 'банан', source: 'https://en.wiktionary.org/wiki/ბანანი' },
  { geo: 'ბარი', ru: 'бар', source: 'https://en.wiktionary.org/wiki/ბარი' },
  { geo: 'გორა', ru: 'холм', source: 'https://en.wiktionary.org/wiki/გორა' },
  { geo: 'ცხენი', ru: 'лошадь', source: 'https://en.wiktionary.org/wiki/ცხენი' },
  { geo: 'ტელეფონი', ru: 'телефон', source: 'https://en.wiktionary.org/wiki/ტელეფონი' },
  { geo: 'ფოტო', ru: 'фото', source: 'https://en.wiktionary.org/wiki/ფოტო' },
  { geo: 'პასპორტი', ru: 'паспорт', source: 'https://en.wiktionary.org/wiki/პასპორტი' },
  { geo: 'პიცა', ru: 'пицца', source: 'https://en.wiktionary.org/wiki/პიცა' },
  { geo: 'ზებრა', ru: 'зебра', source: 'https://en.wiktionary.org/wiki/ზებრა' },
  { geo: 'ზღვა', ru: 'море', source: 'https://en.wiktionary.org/wiki/ზღვა' },
  { geo: 'ჟურნალი', ru: 'журнал', source: 'https://en.wiktionary.org/wiki/ჟურნალი' },
  { geo: 'ჟირაფი', ru: 'жираф', source: 'https://en.wiktionary.org/wiki/ჟირაფი' },
  { geo: 'ქართული', ru: 'грузинский', source: 'https://en.wiktionary.org/wiki/ქართული' },
  { geo: 'ლიმონი', ru: 'лимон', source: 'https://en.wiktionary.org/wiki/ლიმონი' },
  { geo: 'მანდარინი', ru: 'мандарин', source: 'https://en.wiktionary.org/wiki/მანდარინი' },
  { geo: 'ხაჭაპური', ru: 'хачапури', source: 'https://en.wiktionary.org/wiki/ხაჭაპური' }
]

/**
 * Уроки слов (копия words.json → wordLessons, сервер — главный; content.test.ts сверяет). После урока букв N
 * идут его уроки слов по 2–4 слова: каждое слово — своя сцена «Новое слово». id 12+ по порядку.
 */
export const WORD_LESSONS: readonly { id: number; after: number; words: readonly (readonly [string, string])[] }[] = [
  { id: 12, after: 1, words: [['და', 'и'], ['არა', 'нет'], ['რა', 'что']] },
  { id: 13, after: 2, words: [['სად', 'где'], ['ეს', 'это'], ['ის', 'он, она']] },
  { id: 14, after: 2, words: [['არის', 'есть'], ['დედა', 'мама'], ['დიდი', 'большой']] },
  { id: 15, after: 3, words: [['მამა', 'папа'], ['მე', 'я'], ['მინდა', 'хочу'], ['ვინ', 'кто']] },
  { id: 16, after: 3, words: [['სამი', 'три'], ['ვარ', '(я) есть'], ['რამდენი', 'сколько']] },
  { id: 17, after: 4, words: [['ჩაი', 'чай'], ['სახლი', 'дом'], ['ჩემი', 'мой'], ['ჩვენ', 'мы']] },
  { id: 18, after: 4, words: [['ახალი', 'новый'], ['ნახვამდის', 'до свидания'], ['ხვალ', 'завтра']] },
  { id: 19, after: 5, words: [['ერთი', 'один'], ['ორი', 'два'], ['ათი', 'десять'], ['შენ', 'ты']] },
  { id: 20, after: 5, words: [['შენი', 'твой'], ['თავი', 'голова'], ['რადიო', 'радио']] },
  { id: 21, after: 6, words: [['მანქანა', 'машина'], ['ქალი', 'женщина'], ['ბავშვი', 'ребёнок'], ['მეგობარი', 'друг']] },
  { id: 22, after: 6, words: [['მადლობა', 'спасибо'], ['საქართველო', 'Грузия'], ['ქალაქი', 'город'], ['ექიმი', 'врач']] },
  { id: 23, after: 7, words: [['კი', 'да'], ['კარგი', 'хорошо'], ['კაცი', 'мужчина'], ['წიგნი', 'книга']] },
  { id: 24, after: 7, words: [['სკოლა', 'школа'], ['ცივი', 'холодный'], ['კინო', 'кино']] },
  { id: 25, after: 8, words: [['ფული', 'деньги'], ['ხუთი', 'пять'], ['ქუჩა', 'улица'], ['იაფი', 'дешёвый']] },
  { id: 26, after: 8, words: [['კატა', 'кошка'], ['გუშინ', 'вчера'], ['მეტრო', 'метро'], ['კაფე', 'кафе']] },
  { id: 27, after: 9, words: [['პური', 'хлеб'], ['ღვინო', 'вино'], ['ძაღლი', 'собака']] },
  { id: 28, after: 9, words: [['დღე', 'день'], ['ძმა', 'брат'], ['ძვირი', 'дорогой']] },
  { id: 29, after: 10, words: [['ყავა', 'кофе'], ['წყალი', 'вода'], ['ყველი', 'сыр']] },
  { id: 30, after: 10, words: [['ლამაზი', 'красивый'], ['ჭიქა', 'стакан'], ['ჭამს', 'ест']] },
  { id: 31, after: 11, words: [['გამარჯობა', 'здравствуй'], ['ოჯახი', 'семья'], ['ჰაერი', 'воздух'], ['ჰო', 'ага']] }
]
