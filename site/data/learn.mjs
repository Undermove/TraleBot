// The English pages /learn/<language>/: what each one says. They ask one question — would you learn
// this language with us, and where — and the answer is a row in the waitlist (POST /waitlist).
// The keys of LANGUAGES and PLATFORMS are the ones the server accepts (WaitlistOptions in
// src/Application/Waitlist/JoinWaitlistService.cs); a test compares the two lists.
//
// No word of any of these languages is written here: the pages promise a course, they do not teach.

export const PLATFORMS = [
  { key: 'telegram', label: 'Telegram' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'ios', label: 'iPhone' },
  { key: 'android', label: 'Android' },
  { key: 'web', label: 'Web browser' }
]

const SESSIONS = { t: 'Two or three minutes at a time', d: 'The app puts a short session together for you. You open it, play it, and you are done for the day.' }
const REAL_LIFE = { t: 'Words and verbs for real life', d: 'A café, a taxi, a shop, a chat with a neighbour: what you need this week, not a textbook chapter.' }
const DICTIONARY = { t: 'Your own dictionary', d: 'Send any word and get its translation. It is saved, and it comes back in your practice until you know it.' }
const ALPHABET = { t: 'The alphabet first', d: 'A few short lessons, letter by letter, so that signs and menus stop being a picture.' }

export const LANGUAGES = [
  {
    key: 'georgian',
    name: 'Georgian',
    live: true,
    title: 'Learn Georgian in a few minutes a day',
    description: 'TraleBot teaches Georgian in short daily sessions: the alphabet, verbs, everyday phrases and your own dictionary. The English version is on its way — join the waitlist.',
    lead: 'TraleBot already teaches Georgian inside Telegram, in Russian. We are deciding where the English version should live: Telegram, WhatsApp, a phone app or the web. Tell us where you would use it, and we will write to you when it opens.',
    features: [ALPHABET, REAL_LIFE, SESSIONS, DICTIONARY]
  },
  {
    key: 'armenian',
    name: 'Armenian',
    title: 'Learn Armenian in a few minutes a day',
    description: 'A course of Armenian in short daily sessions: the alphabet, verbs, everyday phrases and your own dictionary. It is not built yet — join the waitlist and help us decide.',
    features: [ALPHABET, REAL_LIFE, SESSIONS, DICTIONARY]
  },
  {
    key: 'azerbaijani',
    name: 'Azerbaijani',
    title: 'Learn Azerbaijani in a few minutes a day',
    description: 'A course of Azerbaijani in short daily sessions: verbs, everyday phrases and your own dictionary. It is not built yet — join the waitlist and help us decide.',
    features: [REAL_LIFE, SESSIONS, DICTIONARY]
  },
  {
    key: 'kazakh',
    name: 'Kazakh',
    title: 'Learn Kazakh in a few minutes a day',
    description: 'A course of Kazakh in short daily sessions: verbs, everyday phrases and your own dictionary. It is not built yet — join the waitlist and help us decide.',
    features: [REAL_LIFE, SESSIONS, DICTIONARY]
  },
  {
    key: 'uzbek',
    name: 'Uzbek',
    title: 'Learn Uzbek in a few minutes a day',
    description: 'A course of Uzbek in short daily sessions: verbs, everyday phrases and your own dictionary. It is not built yet — join the waitlist and help us decide.',
    features: [REAL_LIFE, SESSIONS, DICTIONARY]
  }
]

/** What a page of a language we do not teach yet says under its heading. */
export const NOT_BUILT_LEAD = (name) =>
  `We teach Georgian today. ${name} could be next, and whether it will be depends on how many people ask. Join the waitlist: tell us where you would use it, and we will write to you once, when it opens or when we decide not to build it.`
