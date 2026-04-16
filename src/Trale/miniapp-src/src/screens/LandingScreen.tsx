import React, { useState } from 'react'
import Mascot from '../components/Mascot'

interface Props {
  botUsername?: string
}

// ── Georgian phrases for the teaser section ─────────────────────────────────
const GEORGIAN_WORDS = [
  { geo: 'გამარჯობა', ru: 'привет', level: 'A0 · Выживание' },
  { geo: 'მადლობა', ru: 'спасибо', level: 'A0 · Выживание' },
  { geo: 'კარგი', ru: 'хорошо', level: 'A0 · Выживание' },
  { geo: 'სახლი', ru: 'дом', level: 'A0 · Выживание' },
  { geo: 'ბოდიში', ru: 'извини', level: 'A0 · Выживание' },
  { geo: 'მე მქვია', ru: 'меня зовут', level: 'A0 · Выживание' },
]

// ── Learning program accordion data ─────────────────────────────────────────
const PROGRAM_LEVELS = [
  {
    badge: 'A0',
    title: 'Алфавит',
    defaultOpen: true,
    lessons: [
      { letter: 'ა', name: 'Гласные', detail: '5 букв' },
      { letter: 'ბ', name: 'Лёгкие согласные', detail: '5 букв' },
      { letter: 'გ', name: 'Частые согласные', detail: '5 букв' },
      { letter: 'დ', name: 'Тройки', detail: '5 букв' },
      { letter: 'ე', name: 'Оставшиеся', detail: '11 букв' },
    ],
  },
  {
    badge: 'A0→A1',
    title: 'Выживание',
    defaultOpen: false,
    lessons: [
      { letter: 'ა', name: 'Приветствия', detail: 'გამარჯობა, მადლობა' },
      { letter: 'ბ', name: 'О себе', detail: 'меня зовут, откуда ты' },
      { letter: 'გ', name: 'SOS-фразы', detail: 'не понимаю, сколько стоит' },
    ],
  },
  {
    badge: 'A1',
    title: 'Числительные',
    defaultOpen: false,
    lessons: [
      { letter: 'ა', name: '1–10', detail: 'ერთი...ათი' },
      { letter: 'ბ', name: '11–20', detail: 'двадцатеричная система' },
      { letter: 'გ', name: '21–100', detail: 'ოცდაერთი, ასი' },
      { letter: 'დ', name: '100+, порядковые, дни', detail: 'მეორე, ოთხშაბათი' },
    ],
  },
  {
    badge: 'A1',
    title: 'Основы грамматики',
    defaultOpen: false,
    lessons: [
      { letter: 'ა', name: 'Местоимения + «быть»', detail: 'ვარ, ხარ, არის' },
      { letter: 'ბ', name: '«Иметь»', detail: 'აქვს vs ჰყავს' },
      { letter: 'გ', name: 'Указательные', detail: 'ეს / ეგ / ის' },
      { letter: 'დ', name: 'Базовые глаголы', detail: 'ვ- = я, -ს = он' },
      { letter: 'ე', name: 'Падежи', detail: 'все 7 грузинских падежей' },
      { letter: 'ვ', name: 'Послелоги', detail: '-ში, -ზე, -თან и другие' },
      { letter: 'ზ', name: 'Прилагательные', detail: 'ლამაზი → საუკეთესო' },
    ],
  },
  {
    badge: 'A1-A2',
    title: 'Лексика по темам',
    defaultOpen: false,
    lessons: [
      { letter: 'ა', name: 'Кафе', detail: 'меню, заказ, счёт' },
      { letter: 'ბ', name: 'Такси и город', detail: 'маршрут, районы' },
      { letter: 'გ', name: 'Врач', detail: 'симптомы, аптека' },
      { letter: 'დ', name: 'Магазин', detail: 'покупки, цены' },
      { letter: 'ე', name: 'Знакомство', detail: 'профессия, семья' },
      { letter: 'ვ', name: 'Глаголы движения', detail: '11 уроков, направления' },
    ],
  },
  {
    badge: 'A2→B1',
    title: 'Глаголы в системе',
    defaultOpen: false,
    lessons: [
      { letter: 'ა', name: 'Четыре класса глаголов', detail: 'переходные, непереходные' },
      { letter: 'ბ', name: 'Версионные гласные', detail: '-უ-, -ი-, -ე-' },
      { letter: 'გ', name: 'Приставки направления', detail: 'და- შე- გა- ა-...' },
      { letter: 'დ', name: 'Имперфект', detail: 'ვწერდი — я писал' },
      { letter: 'ე', name: 'Аорист', detail: 'переворот падежей' },
      { letter: 'ვ', name: 'Склонение местоимений', detail: 'ის→მან/მას/მისი' },
      { letter: 'ზ', name: 'Условные предложения', detail: 'реальные и нереальные' },
    ],
  },
  {
    badge: 'B1→B2',
    title: 'Продвинутая грамматика',
    defaultOpen: false,
    lessons: [
      { letter: 'ა', name: 'Перфект (Серия III)', detail: 'подлежащее в дательном' },
      { letter: 'ბ', name: 'Плюсквамперфект', detail: 'დამეწერა' },
      { letter: 'გ', name: 'Сослагательное наклонение', detail: 'все три серии' },
      { letter: 'დ', name: 'Причастия', detail: '-ება/-ობა формы' },
      { letter: 'ე', name: 'Относительные предложения', detail: 'რომელიც (склоняется!)' },
      { letter: 'ვ', name: 'Каузатив и потенциал', detail: 'შეუძლია' },
    ],
  },
]

// ── FAQ data ────────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  {
    question: 'Нужно ли знать грузинский язык заранее?',
    answer: 'Нет. Алфавит — первый модуль. Мы идём от ა до ყ по шагам.',
  },
  {
    question: 'Как это работает в Telegram?',
    answer:
      'Бомбора — это мини-апп внутри бота @trale_bot. Открывается кнопкой «🐶 Бомбора» в меню бота.',
  },
  {
    question: 'Есть ли жизни, стрики или штрафы?',
    answer:
      'Никаких. Учи в своём темпе, возвращайся когда хочешь, пропускай что уже знаешь.',
  },
  {
    question: 'Сколько стоит?',
    answer:
      'Первые 30 дней — полный доступ ко всему контенту бесплатно. Дальше — подписка от 100 ⭐ в месяц или разовая покупка «Навсегда» за 1399 ⭐. Оплата через Telegram Stars.',
  },
  {
    question: 'Работает без интернета?',
    answer: 'Нет, мини-апп требует соединения. Данные хранятся на сервере.',
  },
]

// ── Main screen ──────────────────────────────────────────────────────────────

export default function LandingScreen({ botUsername }: Props) {
  const tgLink = `https://t.me/${botUsername ?? 'trale_bot'}`

  return (
    <div className="flex flex-col min-h-full bg-cream">
      {/* Kilim top strip — full viewport width */}
      <div style={{ paddingTop: 'var(--safe-t)' }}>
        <div className="mn-kilim-full" />
      </div>

      {/* ══ Hero ══ */}
      <section className="px-6 pt-10 pb-8 text-center">
        <div className="mn-eyebrow text-navy mb-3">ბომბორა · bombora</div>

        <h1 className="font-sans text-[36px] font-extrabold text-jewelInk leading-[1.05] tracking-tight">
          Изучение{' '}
          <span className="text-ruby">грузинского языка</span>
          {' '}— весело, в Telegram
        </h1>

        <div className="mt-8 flex justify-center pb-breath" role="img" aria-label="Бомбора — маскот для изучения грузинского">
          <Mascot mood="cheer" size={160} />
        </div>

        <p className="mt-5 font-sans text-[15px] text-jewelInk-soft leading-snug max-w-[340px] mx-auto">
          Маленький щенок-гид проведёт от первой буквы{' '}
          <span className="font-geo font-bold text-jewelInk">ქართული</span> до
          живого разговора.
        </p>

        <div className="mt-6 flex flex-col items-center gap-3">
          <a
            href={tgLink}
            target="_blank"
            rel="noopener noreferrer"
            className="jewel-btn jewel-btn-navy w-full max-w-[320px]"
          >
            <TgIcon />
            <span className="relative z-[1]">Начать в Telegram</span>
          </a>
          <div className="font-sans text-[12px] text-jewelInk-hint">
            работает как мини-апп внутри бота
          </div>
        </div>
      </section>

      {/* ══ Для кого ══ */}
      <section className="px-5 pb-10">
        <h2 className="font-sans text-[22px] font-extrabold text-jewelInk mb-4 text-center">
          Для кого этот курс
        </h2>
        <div className="flex flex-col gap-3">
          <div className="jewel-tile px-4 py-4 flex items-start gap-3">
            <span className="text-[24px] shrink-0">🏔</span>
            <div>
              <div className="font-sans text-[15px] font-extrabold text-jewelInk">
                Собираешься в Грузию
              </div>
              <div className="font-sans text-[13px] text-jewelInk-soft leading-snug mt-0.5">
                Хочу ориентироваться, читать меню и торговаться на Дезертирском рынке
              </div>
            </div>
          </div>
          <div className="jewel-tile px-4 py-4 flex items-start gap-3">
            <span className="text-[24px] shrink-0">📖</span>
            <div>
              <div className="font-sans text-[15px] font-extrabold text-jewelInk">
                Начинаешь с нуля
              </div>
              <div className="font-sans text-[13px] text-jewelInk-soft leading-snug mt-0.5">
                Не знаю ни одной буквы — хочу начать с алфавита и идти по порядку
              </div>
            </div>
          </div>
          <div className="jewel-tile px-4 py-4 flex items-start gap-3">
            <span className="text-[24px] shrink-0">🗣</span>
            <div>
              <div className="font-sans text-[15px] font-extrabold text-jewelInk">
                Уже знаешь алфавит
              </div>
              <div className="font-sans text-[13px] text-jewelInk-soft leading-snug mt-0.5">
                Нужна грамматика и словарный запас — все модули открыты сразу
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ Как это работает ══ */}
      <section className="px-5 pb-10">
        <h2 className="font-sans text-[22px] font-extrabold text-jewelInk mb-4 text-center">
          Как это работает
        </h2>
        <div className="flex flex-col">
          <StepItem
            letter="ა"
            stepLabel="шаг один"
            title="Запусти бота — «🐶 Бомбора» в меню"
            description="Бот просит выбрать уровень: с нуля или уже знаю алфавит"
          />
          <div className="ml-[52px] my-1">
            <span className="ink-dash block text-jewelInk" style={{ opacity: 0.25 }} />
          </div>
          <StepItem
            letter="ბ"
            stepLabel="шаг два"
            title="Открой мини-апп — начинается первый урок"
            description="Теория с карточками, затем квиз на узнавание"
          />
          <div className="ml-[52px] my-1">
            <span className="ink-dash block text-jewelInk" style={{ opacity: 0.25 }} />
          </div>
          <StepItem
            letter="გ"
            stepLabel="шаг три"
            title="Учи в своём темпе — все уроки открыты"
            description="Повторяй, пропускай, возвращайся — без штрафов"
          />
        </div>
      </section>

      {/* ══ Georgian phrases teaser ══ */}
      <section className="pb-10">
        <div className="px-5 mb-4">
          <h2 className="font-sans text-[22px] font-extrabold text-jewelInk text-center">
            Ты научишься говорить
          </h2>
        </div>
        <div
          className="flex gap-3 overflow-x-auto pb-2 px-5"
          style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
        >
          {GEORGIAN_WORDS.map((w) => (
            <WordTeaser key={w.geo} geo={w.geo} ru={w.ru} level={w.level} />
          ))}
        </div>
        <p className="font-sans text-[12px] text-jewelInk-soft text-center mt-3 px-5">
          Эти слова ждут тебя в модуле «Выживание»
        </p>
      </section>

      {/* ══ Программа A0 → B2 ══ */}
      <section className="px-5 pb-10">
        <h2 className="font-sans text-[22px] font-extrabold text-jewelInk mb-1 text-center">
          Программа A0 → B2
        </h2>
        <p className="font-sans text-[13px] text-jewelInk-soft text-center mb-4">
          Все уроки открыты сразу — выбирай с любого места
        </p>
        <div className="jewel-tile divide-y divide-jewelInk/10 overflow-hidden">
          {PROGRAM_LEVELS.map((level) => (
            <AccordionSection
              key={level.badge + level.title}
              title={level.title}
              badge={level.badge}
              defaultOpen={level.defaultOpen}
            >
              <div className="px-4 pb-3">
                {level.lessons.map((lesson) => (
                  <div
                    key={lesson.letter + lesson.name}
                    className="flex items-center gap-3 py-2 border-b border-jewelInk/10 last:border-0"
                  >
                    <span className="font-geo text-[13px] text-navy font-bold w-5 shrink-0">
                      {lesson.letter}
                    </span>
                    <span className="font-sans text-[13px] text-jewelInk flex-1">
                      {lesson.name}
                    </span>
                    <span className="font-sans text-[11px] text-jewelInk-soft shrink-0">
                      {lesson.detail}
                    </span>
                  </div>
                ))}
              </div>
            </AccordionSection>
          ))}
        </div>
      </section>

      {/* ══ Что ты получишь ══ */}
      <section className="px-5 pb-10">
        <h2 className="font-sans text-[22px] font-extrabold text-jewelInk mb-4 text-center">
          Что ты получишь
        </h2>
        <div className="flex flex-col gap-3">
          <FeatureTile
            num="ა"
            numLabel="1"
            accent="navy"
            geo="ანბანი"
            title="Алфавит"
            body="33 буквы, разложенные по шагам. Теория и практика на узнавание — от нуля до свободного чтения."
          />
          <FeatureTile
            num="ბ"
            numLabel="2"
            accent="ruby"
            geo="ზმნები"
            title="Глаголы и грамматика"
            body="50+ уроков грамматики — местоимения, падежи, глаголы, лексика. Разложено по шагам."
          />
          <FeatureTile
            num="გ"
            numLabel="3"
            accent="gold"
            geo="ლექსიკონი"
            title="Твой словарь"
            body="Слова, которые ты переводил через бота, приходят на экран как персональная колода."
          />
          <FeatureTile
            num="დ"
            numLabel="4"
            accent="navy"
            geo="თავისუფლად"
            title="По твоему темпу"
            body="Никаких потерянных жизней и напоминаний-угроз. Купил — учишь. Знаешь алфавит — пропускаешь."
          />
          <FeatureTile
            num="ე"
            numLabel="5"
            accent="ruby"
            geo="გრამატიკა"
            title="Грамматика и падежи"
            body="Все 7 грузинских падежей, местоимения, глагольные классы — разложены по шагам."
          />
        </div>
      </section>

      {/* ══ Наш подход ══ */}
      <section className="px-5 pb-10">
        <h2 className="font-sans text-[22px] font-extrabold text-jewelInk mb-4 text-center">
          Наш подход
        </h2>
        <div className="jewel-tile px-5 py-6 text-center">
          <div className="relative z-[1]">
            <p className="font-sans text-[16px] text-jewelInk leading-[1.5]">
              Мини-апп путешественника, в который Бомбора складывает страницы
              по одной. Ни стыда, ни штрафов. Только буквы, слова и тёплый
              тбилисский двор.
            </p>
          </div>
        </div>
      </section>

      {/* ══ Pricing ══ */}
      <section className="px-5 pb-10">
        <h2 className="font-sans text-[22px] font-extrabold text-jewelInk mb-2 text-center">
          Сколько стоит
        </h2>

        {/* Free trial highlight */}
        <div
          className="jewel-tile px-5 py-5 mb-3 text-center relative overflow-hidden"
          style={{ background: '#FBF6EC' }}
        >
          <div
            className="absolute -top-2 -right-2 px-2 py-1 rounded font-sans text-[10px] font-extrabold uppercase tracking-wider border-[1.5px] border-jewelInk"
            style={{ background: '#F5B820', color: '#15100A' }}
          >
            ★ free
          </div>
          <div className="relative z-[1]">
            <div className="mn-eyebrow text-jewelInk-mid mb-2">первое знакомство</div>
            <div className="font-sans text-[28px] font-extrabold text-jewelInk leading-tight">
              30 дней — бесплатно
            </div>
            <div className="font-sans text-[13px] text-jewelInk-mid mt-2 max-w-[300px] mx-auto">
              Полный доступ ко всему контенту. Без карт, без trial-trick'ов.
              Просто открой бота и начни.
            </div>
            <div className="font-geo text-[12px] text-gold-deep font-bold mt-3">
              უფასო · бесплатно
            </div>
          </div>
        </div>

        {/* Tariffs grid */}
        <div className="mn-eyebrow text-center mb-2">а потом</div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <PriceTile title="1 месяц" stars={100} perMonth="100 ⭐/мес" />
          <PriceTile title="3 месяца" stars={249} perMonth="83 ⭐/мес" />
          <PriceTile title="6 месяцев" stars={449} perMonth="75 ⭐/мес" />
          <PriceTile title="1 год" stars={949} perMonth="79 ⭐/мес" highlight />
        </div>
        <div className="mb-3">
          <PriceTile title="Навсегда" stars={1399} perMonth="разовая покупка" wide />
        </div>
        <div className="font-sans text-[11px] text-jewelInk-mid text-center max-w-[320px] mx-auto">
          Все цены в Telegram Stars (⭐). Платёж проходит внутри Telegram, карта не нужна.
          Возврат — 21 день, без вопросов.
        </div>
      </section>

      {/* ══ FAQ ══ */}
      <section className="px-5 pb-10">
        <h2 className="font-sans text-[22px] font-extrabold text-jewelInk mb-4 text-center">
          Часто спрашивают
        </h2>
        <div className="jewel-tile divide-y divide-jewelInk/10 overflow-hidden">
          {FAQ_ITEMS.map((item) => (
            <AccordionSection key={item.question} title={item.question}>
              <div className="px-4 pb-3">
                <p className="font-sans text-[13px] text-jewelInk-soft leading-snug">
                  {item.answer}
                </p>
              </div>
            </AccordionSection>
          ))}
        </div>
      </section>

      {/* ══ CTA ══ */}
      <section
        className="px-6 text-center flex flex-col items-center gap-4"
        style={{ paddingBottom: 'calc(var(--safe-b) + 48px)' }}
      >
        <h2 className="sr-only">Начать изучение грузинского языка</h2>
        <div className="mn-eyebrow">начать путь</div>

        <a
          href={tgLink}
          target="_blank"
          rel="noopener noreferrer"
          className="jewel-btn jewel-btn-navy w-full max-w-[320px]"
        >
          <TgIcon />
          <span className="relative z-[1]">Начать в Telegram</span>
        </a>

        <div className="font-sans text-[12px] text-jewelInk-mid mt-1 max-w-[300px] leading-snug">
          Мини-апп работает внутри бота @trale_bot
        </div>

        <div className="mt-8 font-sans text-[10px] font-bold text-jewelInk-hint uppercase tracking-widest">
          TraleBot · ბომბორა · 2026
        </div>
      </section>

      {/* Kilim bottom strip — full viewport width */}
      <div className="mn-kilim-full opacity-70" />
      <div style={{ height: 'var(--safe-b)' }} />
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function PriceTile({
  title,
  stars,
  perMonth,
  highlight,
  wide,
}: {
  title: string
  stars: number
  perMonth: string
  highlight?: boolean
  wide?: boolean
}) {
  return (
    <div
      className={`jewel-tile px-4 py-3 relative ${wide ? 'flex items-center justify-between gap-4' : 'text-center'}`}
      style={{
        background: highlight ? '#FBF6EC' : undefined,
        border: highlight ? '2px solid #15100A' : undefined,
        boxShadow: highlight ? '0 3px 0 #15100A' : undefined,
      }}
    >
      {highlight && (
        <span
          className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full font-sans text-[10px] font-extrabold uppercase tracking-wider border-[1.5px] border-jewelInk whitespace-nowrap"
          style={{ background: '#F5B820', color: '#15100A' }}
        >
          выгодно
        </span>
      )}
      <div className="relative z-[1] flex-1 min-w-0">
        <div className="font-sans text-[13px] font-extrabold text-jewelInk">{title}</div>
        <div className="font-sans text-[10px] text-jewelInk-mid mt-0.5">{perMonth}</div>
      </div>
      <div
        className={`relative z-[1] font-sans font-extrabold text-jewelInk tabular-nums ${wide ? 'text-[24px]' : 'text-[20px] mt-1'}`}
      >
        {stars} ⭐
      </div>
    </div>
  )
}

function WordTeaser({ geo, ru, level }: { geo: string; ru: string; level: string }) {
  return (
    <div className="jewel-tile p-4 w-[140px] shrink-0 flex flex-col items-center text-center gap-2">
      <span className="font-geo text-[22px] font-extrabold text-jewelInk leading-tight">
        {geo}
      </span>
      <span className="font-sans text-[12px] text-jewelInk-mid">{ru}</span>
      <span className="mn-eyebrow text-navy" style={{ fontSize: '9px' }}>
        {level}
      </span>
    </div>
  )
}

function AccordionSection({
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string
  badge?: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="jewel-pressable w-full flex items-center justify-between gap-3 px-4 py-3 min-h-[44px] text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {badge && (
            <span className="mn-eyebrow text-navy bg-navy/10 px-1.5 py-0.5 rounded-sm shrink-0" style={{ fontSize: '9px' }}>
              {badge}
            </span>
          )}
          <span className="font-sans text-[15px] font-extrabold text-jewelInk">
            {title}
          </span>
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className="shrink-0 text-jewelInk/50"
          style={{
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 200ms ease-out',
          }}
        >
          <path
            d="M6 4l4 4-4 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div
        style={{
          overflow: 'hidden',
          maxHeight: open ? '2000px' : '0',
          transition: open ? 'max-height 280ms ease-out' : 'max-height 220ms ease-in',
        }}
      >
        {children}
      </div>
    </div>
  )
}

function StepItem({
  letter,
  stepLabel,
  title,
  description,
}: {
  letter: string
  stepLabel: string
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="shrink-0">
        <div
          className="w-10 h-10 rounded-lg bg-navy border-[1.5px] border-jewelInk flex items-center justify-center"
          style={{ boxShadow: '2px 2px 0 #15100A' }}
        >
          <span className="font-geo text-[20px] font-extrabold text-cream leading-none">
            {letter}
          </span>
        </div>
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="mn-eyebrow text-jewelInk-hint mb-0.5">{stepLabel}</div>
        <div className="font-sans text-[15px] font-extrabold text-jewelInk leading-tight">
          {title}
        </div>
        <div className="font-sans text-[13px] text-jewelInk-soft leading-snug mt-0.5">
          {description}
        </div>
      </div>
    </div>
  )
}

function FeatureTile({
  num,
  numLabel,
  accent,
  geo,
  title,
  body,
}: {
  num: string
  numLabel: string
  accent: 'navy' | 'ruby' | 'gold'
  geo: string
  title: string
  body: string
}) {
  const accentBg =
    accent === 'navy' ? 'bg-navy' : accent === 'ruby' ? 'bg-ruby' : 'bg-gold'
  const numColor = accent === 'gold' ? 'text-jewelInk' : 'text-cream'

  return (
    <div className="jewel-tile px-5 py-4 flex items-start gap-4">
      <div className="shrink-0 relative z-[1]">
        <div
          className={`w-14 h-14 rounded-xl ${accentBg} border-[1.5px] border-jewelInk flex items-center justify-center`}
          style={{ boxShadow: '2px 2px 0 #15100A' }}
        >
          <span className={`font-geo text-[28px] font-extrabold leading-none ${numColor}`}>
            {num}
          </span>
        </div>
        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-cream border-[1.5px] border-jewelInk flex items-center justify-center">
          <span className="font-sans text-[9px] font-extrabold text-jewelInk leading-none tabular-nums">
            {numLabel}
          </span>
        </div>
      </div>
      <div className="flex-1 min-w-0 relative z-[1] pt-1">
        <div className="font-geo text-[11px] text-jewelInk-mid font-semibold uppercase tracking-wide">
          {geo}
        </div>
        <h3 className="font-sans text-[18px] font-extrabold text-jewelInk leading-tight mt-0.5">
          {title}
        </h3>
        <p className="font-sans text-[13px] text-jewelInk-soft mt-1 leading-snug">{body}</p>
      </div>
    </div>
  )
}

function TgIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="relative z-[1] shrink-0"
      aria-hidden="true"
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
    </svg>
  )
}
