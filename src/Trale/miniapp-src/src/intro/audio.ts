// Записи фраз «Знакомства» в public/audio/intro-story/. Голос — ElevenLabs «Alice», eleven_v4, язык ka
// (как слова алфавита): mp3 → обрезка тишины, loudnorm → AAC mono 64k. Фразы без записи просто молчат.

/** id фразы из story.json → запись. */
export const INTRO_AUDIO: Readonly<Record<string, string>> = {
  gamarjoba: '/audio/intro-story/gamarjoba.m4a',
  gagimarjos: '/audio/intro-story/gagimarjos.m4a',
  nakhvamdis: '/audio/intro-story/nakhvamdis.m4a',
  dila: '/audio/intro-story/dila.m4a',
  saghamo: '/audio/intro-story/saghamo.m4a',
  rogor: '/audio/intro-story/rogor.m4a',
  kargad_madloba: '/audio/intro-story/kargad_madloba.m4a',
  kargad_shen: '/audio/intro-story/kargad_shen.m4a',
  madloba: '/audio/intro-story/madloba.m4a',
  bodishi: '/audio/intro-story/bodishi.m4a',
  ki: '/audio/intro-story/ki.m4a',
  ara: '/audio/intro-story/ara.m4a',
  ar_vici: '/audio/intro-story/ar_vici.m4a',
  me_mkvia: '/audio/intro-story/me_mkvia.m4a',
  me_mkvia_nino: '/audio/intro-story/me_mkvia_nino.m4a',
  me_mkvia_karlosi: '/audio/intro-story/me_mkvia_karlosi.m4a',
  ra_gkvia: '/audio/intro-story/ra_gkvia.m4a',
  sasiamovnoa: '/audio/intro-story/sasiamovnoa.m4a',
  vin_aris: '/audio/intro-story/vin_aris.m4a',
  es_chemi_megobaria: '/audio/intro-story/es_chemi_megobaria.m4a',
  saidan: '/audio/intro-story/saidan.m4a',
  sakartvelodan: '/audio/intro-story/sakartvelodan.m4a',
  espanetidan: '/audio/intro-story/espanetidan.m4a',
  safrangetidan: '/audio/intro-story/safrangetidan.m4a',
  tbilisshi: '/audio/intro-story/tbilisshi.m4a',
  batumshi: '/audio/intro-story/batumshi.m4a',
  kutaisshi: '/audio/intro-story/kutaisshi.m4a',
  studenti: '/audio/intro-story/studenti.m4a',
  eqimi: '/audio/intro-story/eqimi.m4a',
  mascavlebeli: '/audio/intro-story/mascavlebeli.m4a',
  vmushaob: '/audio/intro-story/vmushaob.m4a',
  ra_profesia: '/audio/intro-story/ra_profesia.m4a',
  deda: '/audio/intro-story/deda.m4a',
  mama: '/audio/intro-story/mama.m4a',
  dzma: '/audio/intro-story/dzma.m4a',
  da: '/audio/intro-story/da.m4a',
  vazhi: '/audio/intro-story/vazhi.m4a',
  kalishvili: '/audio/intro-story/kalishvili.m4a',
  kmari: '/audio/intro-story/kmari.m4a',
  coli: '/audio/intro-story/coli.m4a',
  ojakhi: '/audio/intro-story/ojakhi.m4a',
  myavs_dzma_da: '/audio/intro-story/myavs_dzma_da.m4a',
  myavs_da: '/audio/intro-story/myavs_da.m4a',
  myavs_dzaghli: '/audio/intro-story/myavs_dzaghli.m4a',
  makvs_manqana: '/audio/intro-story/makvs_manqana.m4a',
  miyvars_sakartvelo: '/audio/intro-story/miyvars_sakartvelo.m4a',
  mogcons: '/audio/intro-story/mogcons.m4a',
  lamazia: '/audio/intro-story/lamazia.m4a',
  gaumarjos: '/audio/intro-story/gaumarjos.m4a',
  gaumarjos_sakartvelos: '/audio/intro-story/gaumarjos_sakartvelos.m4a',
  // Слова сцены (story.json → lessons[].scene)
  puri: '/audio/intro-story/puri.m4a',
  khachapuri: '/audio/intro-story/khachapuri.m4a',
  gtkhovt: '/audio/intro-story/gtkhovt.m4a',
  dzalian_kargad: '/audio/intro-story/dzalian_kargad.m4a',
  mets_kargad: '/audio/intro-story/mets_kargad.m4a',
  kidev: '/audio/intro-story/kidev.m4a',
  gachereba: '/audio/intro-story/gachereba.m4a',
  gamicheret: '/audio/intro-story/gamicheret.m4a',
  aq: '/audio/intro-story/aq.m4a',
  zghva: '/audio/intro-story/zghva.m4a',
  chai: '/audio/intro-story/chai.m4a',
  qava: '/audio/intro-story/qava.m4a',
  tskali: '/audio/intro-story/tskali.m4a',
  minda: '/audio/intro-story/minda.m4a',
  pasporti: '/audio/intro-story/pasporti.m4a',
  gasaghebi: '/audio/intro-story/gasaghebi.m4a',
  otakhi: '/audio/intro-story/otakhi.m4a',
  ghvino: '/audio/intro-story/ghvino.m4a',
  gemrielia: '/audio/intro-story/gemrielia.m4a',
  amanati: '/audio/intro-story/amanati.m4a',
  es_shenia: '/audio/intro-story/es_shenia.m4a',
  marjvniv: '/audio/intro-story/marjvniv.m4a',
  marcxniv: '/audio/intro-story/marcxniv.m4a',
  pirdapir: '/audio/intro-story/pirdapir.m4a',
  gaachere: '/audio/intro-story/gaachere.m4a',
  ramdeni_ghirs: '/audio/intro-story/ramdeni_ghirs.m4a',
  lari: '/audio/intro-story/lari.m4a',
  bebia: '/audio/intro-story/bebia.m4a',
  babua: '/audio/intro-story/babua.m4a',
  foto: '/audio/intro-story/foto.m4a',
  kata: '/audio/intro-story/kata.m4a',
  chemodani: '/audio/intro-story/chemodani.m4a',
  telefoni: '/audio/intro-story/telefoni.m4a',
  khinkali: '/audio/intro-story/khinkali.m4a',
  churchkhela: '/audio/intro-story/churchkhela.m4a',
  tamada: '/audio/intro-story/tamada.m4a',
}

/** Отдельные формы словарика (страна + დან, город + ში, профессии) → запись; ключ — грузинский текст. */
export const INTRO_WORD_AUDIO: Readonly<Record<string, string>> = {
  'საქართველოდან': '/audio/intro-story/w_ge_from.m4a',
  'ესპანეთიდან': '/audio/intro-story/w_es_from.m4a',
  'საფრანგეთიდან': '/audio/intro-story/w_fr_from.m4a',
  'თბილისში': '/audio/intro-story/w_tbilisi_in.m4a',
  'ბათუმში': '/audio/intro-story/w_batumi_in.m4a',
  'ქუთაისში': '/audio/intro-story/w_kutaisi_in.m4a',
  'სტუდენტი': '/audio/intro-story/w_job0.m4a',
  'ექიმი': '/audio/intro-story/w_job1.m4a',
  'მასწავლებელი': '/audio/intro-story/w_job2.m4a',
}

// Разные голоса в разговорах (ElevenLabs, eleven_v4, ka, та же обработка): герой — это ты — Will (молодой
// мужской), знакомые-мужчины — George, женщины и дети — Alice (записи выше). Чтобы на слух было ясно,
// кто говорит: ты или тебе.
const HERO_IDS = ['gamarjoba', 'gagimarjos', 'nakhvamdis', 'dila', 'saghamo', 'kargad_madloba', 'kargad_shen', 'ra_gkvia', 'saidan', 'ra_profesia', 'rogor', 'madloba', 'bodishi', 'ki', 'ara']
const MALE_IDS = ['gamarjoba', 'gagimarjos', 'dila', 'saghamo', 'rogor', 'kargad_madloba', 'nakhvamdis', 'madloba', 'kargad_shen']

/** Слова сцены записаны всеми тремя голосами. */
const SCENE_IDS: readonly string[] = ['puri', 'khachapuri', 'gtkhovt', 'dzalian_kargad', 'mets_kargad', 'kidev', 'gachereba', 'gamicheret', 'aq', 'zghva', 'chai', 'qava', 'tskali', 'minda', 'pasporti', 'gasaghebi', 'otakhi', 'ghvino', 'gemrielia', 'amanati', 'es_shenia', 'marjvniv', 'marcxniv', 'pirdapir', 'gaachere', 'ramdeni_ghirs', 'lari', 'bebia', 'babua', 'foto', 'kata', 'chemodani', 'telefoni', 'khinkali', 'churchkhela', 'tamada']

/** Голос реплики: hero — ты, m — знакомый-мужчина, f — женщина (по умолчанию, записи Alice). */
export type Voice = 'hero' | 'm' | 'f'

export function voicedAudio(id: string, voice: Voice): string | undefined {
  if (SCENE_IDS.includes(id) && voice !== 'f') return `/audio/intro-story/${voice}/${id}.m4a`
  if (voice === 'hero' && HERO_IDS.includes(id)) return `/audio/intro-story/hero/${id}.m4a`
  if (voice === 'm' && MALE_IDS.includes(id)) return `/audio/intro-story/m/${id}.m4a`
  return INTRO_AUDIO[id]
}

/** Число 1–10 (story.json → vocab.numbers) нужным голосом. */
export function numberAudio(n: number, voice: Voice = 'f'): string | undefined {
  if (n < 1 || n > 10) return undefined
  return voice === 'f' ? `/audio/intro-story/num/n${n}.m4a` : `/audio/intro-story/num/${voice}/n${n}.m4a`
}
