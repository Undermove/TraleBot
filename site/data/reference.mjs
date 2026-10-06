// Which lesson lists go on which phrasebook / word page. No Georgian is spelled here: blocks
// select lists by module and lesson number (theory: MiniAppContentProvider.cs) or by lesson_id
// (lexicons: Lessons/**/questions*.json), and filter or reword by the RUSSIAN side only.
//
//   S.list(module, lesson[, listIndex]) · S.examples(module, lesson) · S.lexicon(lesson_id)
//   link.verb('хотеть') → a link to that verb's page, looked up by the catalog's Russian gloss.

const not = (...words) => (ru) => !words.some((w) => ru.toLowerCase().includes(w))
const has = (...words) => (ru) => words.some((w) => ru.toLowerCase().includes(w))

const CTA = {
  phrases: { heading: 'Запомнить эти фразы', text: 'В мини-аппе TraleBot эти фразы есть в уроках: карточки, озвучка и короткий квиз на каждую тему.' },
  words: { heading: 'Выучить эти слова', text: 'В мини-аппе TraleBot эти слова разобраны в уроках с озвучкой и квизом, а свои слова можно добавлять в словарь.' }
}

export const SECTIONS = {
  phrases: {
    label: 'Разговорник',
    title: 'Русско-грузинский разговорник с транскрипцией русскими буквами',
    h1: 'Грузинский разговорник: фразы с переводом и транскрипцией',
    description: 'Грузинские фразы по ситуациям: приветствия, знакомство, кафе, такси, магазин, врач, экстренные случаи. У каждой фразы перевод и чтение русскими буквами.',
    lead: 'Фразы по ситуациям. У каждой — перевод и чтение русскими буквами, чтобы сказать сразу, даже если грузинские буквы пока не читаются.',
    cta: { heading: 'Учить фразы в Telegram', text: 'TraleBot: те же фразы по урокам, с озвучкой и квизами. Алфавит можно пройти там же.' }
  },
  words: {
    label: 'Слова',
    title: 'Грузинские слова с переводом на русский и транскрипцией',
    h1: 'Грузинские слова с переводом и транскрипцией',
    description: 'Грузинские слова по темам: числа, дни недели, местоимения, семья, еда. Перевод на русский и чтение русскими буквами.',
    lead: 'Слова по темам. У каждого — перевод и чтение русскими буквами.',
    cta: { heading: 'Учить слова в Telegram', text: 'TraleBot: тематические уроки, озвучка и личный словарь с квизами.' }
  }
}

export function referenceDefs(S, link) {
  return [
    // ---------------------------------------------------------------- phrases
    {
      section: 'phrases', slug: 'greetings', order: 10,
      title: 'Здравствуйте, спасибо, как дела по-грузински: приветствия русскими буквами',
      h1: 'Здравствуйте, спасибо, как дела по-грузински',
      card: 'Приветствия и вежливые слова',
      description: 'Как по-грузински здравствуйте, до свидания, спасибо, извините, как дела, да и нет: грузинское написание, перевод и чтение русскими буквами.',
      lead: 'Слова, с которых начинается любой разговор: поздороваться, поблагодарить, извиниться, переспросить.',
      cta: CTA.phrases, related: ['/phrases/intro/', '/phrases/cafe/', '/grammar/alphabet/'],
      blocks: [
        { h2: 'Поздороваться и попрощаться', id: 'hello', short: 'Здравствуйте', items: S.list('intro', 1), ru: { 'здравствуй': 'здравствуйте, привет' } },
        { h2: 'Спасибо, извините, да и нет', id: 'thanks', short: 'Спасибо', items: S.list('intro', 6) },
        { h2: 'Если не понял', id: 'again', short: 'Не понимаю', items: S.list('intro', 7), where: not('помогите', 'врач') },
        { h2: 'Короткий диалог', id: 'dialogue', short: 'Диалог', dialogue: true, items: S.examples('intro', 1) }
      ]
    },
    {
      section: 'phrases', slug: 'intro', order: 20,
      title: 'Знакомство по-грузински: меня зовут, откуда ты, я живу — фразы с транскрипцией',
      h1: 'Знакомство по-грузински: как представиться',
      card: 'Знакомство',
      description: 'Как по-грузински сказать «меня зовут», «откуда ты», «я из…», «я живу в Тбилиси», «я работаю», «приятно познакомиться». Фразы с переводом и транскрипцией русскими буквами.',
      lead: 'Назвать имя, сказать, откуда ты и чем занимаешься, и спросить то же у собеседника.',
      cta: CTA.phrases, related: ['/phrases/greetings/', '/words/family/', '/words/pronouns/'],
      blocks: [
        { h2: 'Имя и откуда ты', id: 'name', items: S.list('intro', 2), where: not('семья') },
        { h2: 'О себе', id: 'about', items: S.list('intro', 4) },
        { h2: 'Как это звучит в разговоре', id: 'dialogue', short: 'Диалог', dialogue: true, items: [...S.examples('intro', 5), ...S.examples('intro', 2), ...S.examples('intro', 4)] },
        { html: `<p>В этих фразах работают глаголы ${link.verb('быть')}, ${link.verb('жить')} и ${link.verb('иметь')} — у каждого есть таблица по лицам и временам.</p>` }
      ]
    },
    {
      section: 'phrases', slug: 'cafe', order: 30,
      title: 'В кафе и ресторане по-грузински: как заказать и попросить счёт — разговорник',
      h1: 'Фразы на грузинском в кафе и ресторане',
      card: 'В кафе и ресторане',
      description: 'Как по-грузински заказать еду, попросить меню и счёт, сказать «очень вкусно»: фразы для кафе и ресторана с переводом и транскрипцией русскими буквами.',
      lead: 'Попросить меню, заказать, похвалить еду и попросить счёт.',
      cta: CTA.phrases, related: ['/words/food/', '/words/numbers/', '/phrases/shopping/'],
      blocks: [
        { h2: 'Заказ и счёт', id: 'order', items: S.list('cafe', 2) },
        { h2: 'Как это звучит', id: 'dialogue', short: 'Диалог', dialogue: true, items: [...S.examples('cafe', 5), ...S.examples('cafe', 2), ...S.examples('cafe', 1), ...S.examples('cafe', 3)] },
        { h2: 'Слова из меню', id: 'menu', short: 'Меню', items: [...S.list('cafe', 1), ...S.list('cafe', 7)], where: not('хочу') },
        { h2: 'Какая еда', id: 'taste', short: 'Вкус', items: S.list('cafe', 3) },
        { html: `<p>«Я хочу» — форма глагола ${link.verb('хотеть')}: на его странице есть «ты хочешь», «мы хотим» и прошедшее время.</p>` }
      ]
    },
    {
      section: 'phrases', slug: 'taxi', order: 40,
      title: 'Такси и город по-грузински: отвезите, остановите здесь, направо — фразы с транскрипцией',
      h1: 'Фразы на грузинском в такси и в городе',
      card: 'Такси и город',
      description: 'Фразы для такси и города по-грузински: «отвезите меня», «остановите здесь», «сколько стоит», «где находится», направо, налево, прямо. С переводом и транскрипцией русскими буквами.',
      lead: 'Назвать адрес, объяснить дорогу, остановить машину и спросить, где что находится.',
      cta: CTA.phrases, related: ['/phrases/shopping/', '/words/numbers/', '/grammar/verbs-of-motion/'],
      blocks: [
        { h2: 'В такси', id: 'taxi', items: S.list('taxi', 4) },
        { h2: 'Направо, налево, прямо', id: 'directions', short: 'Направления', items: S.lexicon('taxi-2') },
        { h2: 'Как это звучит', id: 'dialogue', short: 'Диалог', dialogue: true, items: [...S.examples('taxi', 5), ...S.examples('taxi', 4), ...S.examples('taxi', 7), ...S.examples('taxi', 1), ...S.examples('taxi', 3)] , where: not('направо') },
        { h2: 'Транспорт', id: 'transport', items: S.lexicon('taxi-1') },
        { h2: 'Места в городе', id: 'places', short: 'Места', items: S.list('taxi', 3) }
      ]
    },
    {
      section: 'phrases', slug: 'shopping', order: 50,
      title: 'В магазине и на рынке по-грузински: сколько стоит, дайте, дорого — разговорник',
      h1: 'Фразы на грузинском в магазине и на рынке',
      card: 'Магазин и рынок',
      description: 'Как по-грузински спросить «сколько стоит», попросить «дайте мне», сказать «дорого» и «дёшево»: фразы для магазина и рынка с переводом и транскрипцией русскими буквами.',
      lead: 'Спросить цену, попросить взвесить, сказать, что дорого.',
      cta: CTA.phrases, related: ['/words/numbers/', '/words/food/', '/phrases/cafe/'],
      blocks: [
        { h2: 'Цена и покупка', id: 'price', items: [...S.list('shopping', 4), ...S.lexicon('cafe-4'), ...S.lexicon('shopping-4')], where: not('фрукты', 'овощи') },
        { h2: 'Как это звучит', id: 'dialogue', short: 'Диалог', dialogue: true, items: [...S.examples('shopping', 5), ...S.examples('shopping', 4), ...S.examples('shopping', 3), ...S.examples('shopping', 1), ...S.examples('shopping', 2)] },
        { h2: 'Деньги', id: 'money', items: S.lexicon('numbers-4'), where: has('лари', 'тетри') },
        { html: `<p>Продукты — на странице <a href="/words/food/">«Еда и продукты»</a>, цены — в <a href="/words/numbers/">числах</a>. «Покупаю» — форма глагола ${link.verb('покупать')}.</p>` }
      ]
    },
    {
      section: 'phrases', slug: 'doctor', order: 60,
      title: 'У врача и в аптеке по-грузински: фразы, симптомы, части тела с транскрипцией',
      h1: 'Фразы на грузинском у врача и в аптеке',
      card: 'У врача и в аптеке',
      description: 'Как по-грузински сказать «у меня болит голова», «мне нужен врач», «у меня температура»; части тела, симптомы и слова для аптеки с переводом и транскрипцией русскими буквами.',
      lead: 'Объяснить, что болит, назвать симптомы и купить лекарство.',
      cta: CTA.phrases, related: ['/phrases/emergency/', '/phrases/greetings/', '/words/numbers/'],
      blocks: [
        { h2: 'Что сказать врачу', id: 'say', short: 'Врачу', items: S.list('doctor', 4) },
        { h2: 'Как это звучит', id: 'dialogue', short: 'Диалог', dialogue: true, items: [...S.examples('doctor', 5), ...S.examples('doctor', 1), ...S.examples('doctor', 2), ...S.examples('doctor', 4), ...S.examples('doctor', 3)] },
        { h2: 'Части тела по-грузински', id: 'body', short: 'Части тела', items: S.list('doctor', 1) },
        { h2: 'Симптомы', id: 'symptoms', items: S.list('doctor', 2) },
        { h2: 'В аптеке', id: 'pharmacy', short: 'Аптека', items: S.list('doctor', 3) },
        { html: `<p>«Болит» — глагол ${link.verb('болеть (у кого-то болит)')}: «у тебя болит», «у нас болело» — на его странице. «У меня температура» строится с глаголом ${link.verb('иметь')}.</p>` }
      ]
    },
    {
      section: 'phrases', slug: 'emergency', order: 70,
      title: 'Помогите по-грузински: фразы для экстренных ситуаций с транскрипцией',
      h1: 'Экстренные ситуации: фразы на грузинском',
      card: 'Экстренные ситуации',
      description: 'Как по-грузински позвать на помощь: «помогите», «вызовите полицию», «я потерялся», «у меня украли телефон», «я не говорю по-грузински». С переводом и транскрипцией русскими буквами.',
      lead: 'Позвать на помощь, объяснить, что случилось, и сказать, что ты не говоришь по-грузински.',
      cta: CTA.phrases, related: ['/phrases/doctor/', '/phrases/taxi/', '/phrases/greetings/'],
      blocks: [
        { h2: 'Позвать на помощь', id: 'help', short: 'Помогите', items: S.list('emergency', 3) },
        { h2: 'Я не говорю по-грузински', id: 'language', short: 'Язык', items: S.list('emergency', 4) },
        { h2: 'Как это звучит', id: 'dialogue', short: 'Диалог', dialogue: true, items: [...S.examples('emergency', 5), ...S.examples('emergency', 3), ...S.examples('emergency', 2), ...S.examples('emergency', 4)] },
        { h2: 'Службы и опасность', id: 'words', short: 'Слова', items: S.list('emergency', 1) },
        { h2: 'Потерял документы или вещи', id: 'lost', short: 'Потерял', items: S.list('emergency', 2) }
      ]
    },

    // ------------------------------------------------------------------ words
    {
      section: 'words', slug: 'numbers', order: 10,
      title: 'Цифры и числа на грузинском от 1 до 100 с транскрипцией русскими буквами',
      h1: 'Числа на грузинском: счёт от 1 до 100 и дальше',
      card: 'Числа от 1 до 100',
      description: 'Счёт на грузинском от 1 до 10, до 20, до 100 и тысячи: как пишется каждое число и как читается русскими буквами. Почему 50 — это «два по двадцать и десять», и порядковые: первый, второй, третий.',
      lead: 'Счёт до десяти, до двадцати, десятки до ста, сотни и порядковые числа.',
      cta: CTA.words, related: ['/words/days/', '/phrases/shopping/', '/phrases/cafe/'],
      blocks: [
        { h2: 'Счёт от 1 до 10', id: 'n1', short: '1–10', items: S.lexicon('numbers-1') },
        { h2: 'От 11 до 20', id: 'n11', short: '11–20', items: S.lexicon('numbers-2') },
        { h2: 'Десятки от 21 до 100', id: 'n21', short: '21–100', note: 'Грузинский считает двадцатками. В скобках видно, из чего сложено число: 30 — это двадцать и десять, 40 — два по двадцать.', items: S.lexicon('numbers-3') },
        { h2: 'Сотни, тысяча, миллион', id: 'n100', short: '100+', items: S.lexicon('numbers-4'), where: has('двести', 'триста', 'тысяча', 'миллион') },
        { h2: 'Первый, второй, третий', id: 'ordinal', short: 'Порядковые', items: S.lexicon('numbers-4'), where: has('первый', 'второй', 'третий', 'четвёртый', 'пятый') },
        { h2: 'Числа в разговоре', id: 'examples', short: 'Примеры', dialogue: true, items: [...S.examples('numbers', 1), ...S.examples('numbers', 4), ...S.examples('shopping', 3), ...S.examples('shopping', 2)] }
      ]
    },
    {
      section: 'words', slug: 'days', order: 20,
      title: 'Дни недели на грузинском языке с переводом и транскрипцией',
      h1: 'Дни недели на грузинском',
      card: 'Дни недели',
      description: 'Понедельник, вторник, среда, четверг, пятница, суббота и воскресенье по-грузински: как пишутся и как читаются русскими буквами.',
      lead: 'Семь дней недели: как пишутся и как читаются.',
      cta: CTA.words, related: ['/words/numbers/', '/words/pronouns/', '/phrases/greetings/'],
      blocks: [
        { h2: '', id: 'days', items: S.lexicon('numbers-4'), where: has('понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье') },
        { html: '<p>В названиях от понедельника до четверга слышны числа от двух до пяти — сравни с таблицей <a href="/words/numbers/">чисел</a>.</p>' }
      ]
    },
    {
      section: 'words', slug: 'pronouns', order: 30,
      title: 'Местоимения в грузинском языке: личные, притяжательные, указательные — таблица',
      h1: 'Грузинские местоимения: я, ты, он, мой, этот, кто',
      card: 'Местоимения',
      description: 'Личные, притяжательные, указательные и вопросительные местоимения в грузинском языке: я, ты, он, мы, мой, твой, этот, тот, кто, что, где. С переводом, транскрипцией и примерами.',
      lead: 'Я, ты, он; мой, твой; этот, тот; кто, что, где — четыре короткие таблицы.',
      cta: CTA.words, related: ['/grammar/cases/', '/phrases/intro/', '/words/family/'],
      blocks: [
        { h2: 'Личные: я, ты, он, мы, вы, они', id: 'personal', short: 'Я, ты, он', note: 'Личное местоимение часто опускают: кто действует, видно по форме глагола.', items: S.list('pronouns', 1) },
        { h2: 'Притяжательные: мой, твой, его', id: 'possessive', short: 'Мой, твой', items: S.list('pronouns', 3) },
        { h2: 'Указательные: этот, тот — и здесь, там', id: 'demonstrative', short: 'Этот, тот', note: 'Указательных местоимений три — по тому, насколько предмет далеко от говорящего.', items: S.list('pronouns', 2) },
        { h2: 'Вопросительные: кто, что, где', id: 'question', short: 'Кто, что', items: S.list('pronouns', 4) },
        { h2: 'Примеры', id: 'examples', dialogue: true, items: [...S.examples('pronouns', 1), ...S.examples('pronouns', 3), ...S.examples('pronouns', 2), ...S.examples('pronouns', 4)] }
      ]
    },
    {
      section: 'words', slug: 'family', order: 40,
      title: 'Семья на грузинском: мама, папа, брат, сестра, муж, жена — с транскрипцией',
      h1: 'Семья по-грузински: мама, папа, брат, сестра',
      card: 'Семья',
      description: 'Как по-грузински мама, папа, брат, сестра, сын, дочь, муж и жена: написание, перевод и чтение русскими буквами. И как сказать «у меня есть брат».',
      lead: 'Мама, папа, брат, сестра, сын, дочь, муж, жена — и как сказать, что они у тебя есть.',
      cta: CTA.words, related: ['/grammar/have/', '/words/pronouns/', '/phrases/intro/'],
      blocks: [
        { h2: '', id: 'family', items: S.list('intro', 3, 0) },
        { h2: 'У меня есть брат и сестра', id: 'have', dialogue: true, items: S.examples('intro', 3).slice(0, 1) },
        { html: `<p>«У меня есть» о людях — форма глагола ${link.verb('иметь (кого-то)')}. О вещах говорят другим глаголом — разница разобрана на странице <a href="/grammar/have/">«У меня есть» по-грузински</a>.</p>` }
      ]
    },
    {
      section: 'words', slug: 'food', order: 50,
      title: 'Еда на грузинском: продукты, напитки и блюда с переводом и транскрипцией',
      h1: 'Еда и продукты по-грузински',
      card: 'Еда и продукты',
      description: 'Хлеб, сыр, мясо, рыба, вода, вино, кофе, хачапури и хинкали по-грузински: продукты, напитки, блюда и слова о вкусе с переводом и транскрипцией русскими буквами.',
      lead: 'Продукты, напитки, блюда и слова о вкусе — то, что встретится в меню и на рынке.',
      cta: CTA.words, related: ['/phrases/cafe/', '/phrases/shopping/', '/words/numbers/'],
      blocks: [
        { h2: 'Продукты', id: 'products', items: [...S.list('shopping', 1), ...S.list('cafe', 1)], where: not('меню', 'заказ', 'счёт', 'официант', 'стол', 'кофе', 'чай', 'вода', 'вино', 'пиво') },
        { h2: 'Напитки', id: 'drinks', items: [...S.list('cafe', 1), ...S.list('shopping', 2)], where: has('кофе', 'чай', 'вода', 'вино', 'пиво', 'сок', 'лимонад') },
        { h2: 'Блюда', id: 'dishes', items: S.list('shopping', 2) },
        { h2: 'Завтрак, обед', id: 'meals', short: 'Приёмы пищи', items: S.lexicon('cafe-2'), where: has('обед', 'завтрак') },
        { h2: 'Какая еда на вкус', id: 'taste', short: 'Вкус', items: S.list('cafe', 3) }
      ]
    }
  ]
}
