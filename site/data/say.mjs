// «Как сказать … по-грузински»: one page per everyday phrase people look up in search engines
// («спасибо по грузински», «очень вкусно по грузински как сказать»). No Georgian is spelled here:
// every phrase is found in the lesson theory and lexicons by its RUSSIAN side, the same way
// data/reference.mjs selects lists. A phrase the lessons do not have gets no page.
//
//   main     — the Russian of the phrase itself; the first list/lexicon pair whose Russian equals one of
//              these (case and trailing punctuation ignored) is the page's phrase
//   also     — Russian of other ways to say it (shown as «Ещё варианты»)
//   reply    — Russian of the answer, when the lessons have one
//   topic    — the phrasebook page the phrase belongs to (linked as «Все фразы темы»)
//   related  — other «как сказать» pages, by slug

export const SAY_SECTION = {
  name: 'kak-skazat',
  label: 'Как сказать',
  ctaTag: 'seo_say_index',
  title: 'Как сказать по-грузински: частые фразы с транскрипцией русскими буквами',
  h1: 'Как сказать по-грузински',
  description: 'Спасибо, здравствуйте, до свидания, очень вкусно, сколько стоит и другие частые фразы по-грузински: как пишется, как читается русскими буквами и как звучит в разговоре.',
  lead: 'Самые частые фразы по одной на странице: грузинское написание, чтение русскими буквами, разбор по буквам и примеры из живого разговора.',
  cta: { heading: 'Выучить эти фразы за пару минут в день', text: 'TraleBot в Telegram: фразы с озвучкой, короткие уроки-игры и задание дня под твой уровень. Начать можно с нуля.' }
}

export const SAY = [
  { slug: 'spasibo', phrase: 'спасибо', main: ['спасибо'], also: ['большое спасибо', 'хорошо, спасибо'], topic: '/phrases/greetings/', related: ['pozhaluysta', 'izvinite', 'zdravstvuyte'] },
  { slug: 'zdravstvuyte', phrase: 'здравствуйте', alt: 'привет', main: ['здравствуй'], reply: ['здравствуй и ты (ответ)'], topic: '/phrases/greetings/', related: ['dobroe-utro', 'kak-dela', 'do-svidaniya'] },
  { slug: 'do-svidaniya', phrase: 'до свидания', main: ['до свидания'], topic: '/phrases/greetings/', related: ['zdravstvuyte', 'spasibo', 'dobroe-utro'] },
  { slug: 'dobroe-utro', phrase: 'доброе утро', main: ['доброе утро'], topic: '/phrases/greetings/', related: ['zdravstvuyte', 'kak-dela', 'do-svidaniya'] },
  { slug: 'kak-dela', phrase: 'как дела', main: ['как дела?'], also: ['хорошо, спасибо'], topic: '/phrases/greetings/', related: ['zdravstvuyte', 'khorosho', 'menya-zovut'] },
  { slug: 'ochen-vkusno', phrase: 'очень вкусно', main: ['это очень вкусно!'], also: ['было очень вкусно! счёт, пожалуйста.'], topic: '/phrases/cafe/', related: ['schet-pozhaluysta', 'spasibo', 'pozhaluysta'] },
  { slug: 'pozhaluysta', phrase: 'пожалуйста', main: ['пожалуйста'], also: ['счёт, пожалуйста', 'один кофе, пожалуйста'], topic: '/phrases/cafe/', related: ['spasibo', 'izvinite', 'schet-pozhaluysta'] },
  { slug: 'schet-pozhaluysta', phrase: 'счёт, пожалуйста', main: ['счёт, пожалуйста'], topic: '/phrases/cafe/', related: ['ochen-vkusno', 'skolko-stoit', 'pozhaluysta'] },
  { slug: 'izvinite', phrase: 'извините', main: ['извините'], also: ['извините, я не говорю по-грузински'], topic: '/phrases/greetings/', related: ['spasibo', 'ne-ponimayu', 'pozhaluysta'] },
  { slug: 'da-i-net', phrase: 'да и нет', main: ['да'], extra: ['нет'], also: ['да, хорошо'], topic: '/phrases/greetings/', related: ['khorosho', 'spasibo', 'ne-ponimayu'] },
  { slug: 'khorosho', phrase: 'хорошо', main: ['хороший, хорошо'], also: ['да, хорошо', 'хорошо, спасибо'], topic: '/phrases/greetings/', related: ['da-i-net', 'kak-dela', 'spasibo'] },
  { slug: 'ne-ponimayu', phrase: 'я не понимаю', main: ['я не понимаю'], also: ['я не говорю по-грузински'], topic: '/phrases/emergency/', related: ['izvinite', 'pomogite', 'menya-zovut'] },
  { slug: 'menya-zovut', phrase: 'меня зовут', main: ['меня зовут…'], also: ['привет! меня зовут нино. а тебя?', 'меня зовут карлос'], topic: '/phrases/intro/', related: ['zdravstvuyte', 'kak-dela', 'ya-lyublyu'] },
  { slug: 'skolko-stoit', phrase: 'сколько стоит', main: ['сколько стоит?'], also: ['это дорого!', 'очень дорого!'], topic: '/phrases/shopping/', related: ['schet-pozhaluysta', 'pozhaluysta', 'spasibo'] },
  { slug: 'pomogite', phrase: 'помогите', main: ['помогите мне'], also: ['помогите!'], topic: '/phrases/emergency/', related: ['ne-ponimayu', 'izvinite', 'skolko-stoit'] },
  { slug: 'ya-lyublyu', phrase: 'я люблю', main: ['я люблю (букв. «мне любится»)'], also: ['я люблю грузию', 'люблю кофе'], topic: '/phrases/intro/', related: ['menya-zovut', 'ochen-vkusno', 'spasibo'] }
]
