import React from 'react'
import type { TenseKey, VerbCardDto, VerbCardLineDto, VerbCardVerbDto } from '../types'

// Карточка глагола вместо одного слова-перевода. Русский инфинитив — название действия и главные
// формы («я делаю», «он делает», «я сделаю», «я сделал»); грузинская форма — что именно она значит
// и от какого глагола. Все грузинские слова, транскрипция (кириллицей) и подписи приходят с сервера
// из базы глаголов; названий времён из учебника здесь нет.

interface Props {
  card: VerbCardDto
  /** Слово, как оно лежит в словаре, и что записано к нему. */
  word: string
  definition: string
  /** Слово уже было в словаре до этого перевода. */
  alreadySaved: boolean
  example?: string
  onOpen: (verbId: string, at?: { tense: TenseKey; person: number }) => void
}

const INK = '#15100A'

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="inline-block align-[-0.15em]">
      <circle cx="12" cy="12" r="9.5" fill="#F5B820" />
      <path d="M7.5 12.5l3 3 6-6.5" />
    </svg>
  )
}

/** Грузинское слово и кириллическая транскрипция под ним. */
function Georgian({ forms, big = false, align = 'right' }: { forms: { form: string; transcription: string }[]; big?: boolean; align?: 'left' | 'right' }) {
  return (
    <span className={`inline-flex flex-col ${align === 'right' ? 'items-end text-right' : 'items-start text-left'}`}>
      <span className={`font-geo ${big ? 'text-[24px]' : 'text-[17px]'} font-bold text-jewelInk leading-tight`}>{forms.map(f => f.form).join(', ')}</span>
      <span className="text-[11px] text-jewelInk-hint leading-tight">{forms.map(f => f.transcription).join(', ')}</span>
    </span>
  )
}

/** Строка «я делаю — ვაკეთებ»: русская фраза из базы слева, форма с транскрипцией справа. */
function KeyForm({ line }: { line: VerbCardLineDto }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-t border-jewelInk/10 first:border-t-0" data-testid="verb-card-line">
      <span className="min-w-0 text-[14px] font-semibold text-jewelInk">
        {line.meaning ?? line.caption}
        {line.meaning && line.note && <span className="block text-[11px] font-semibold text-jewelInk-mid leading-tight">{line.note}</span>}
      </span>
      <Georgian forms={line.forms} />
    </div>
  )
}

/** Одно прочтение грузинской формы: что она значит и что это за форма — простыми словами. */
function Reading({ line }: { line: VerbCardLineDto }) {
  return (
    <div className="py-1.5 border-t border-jewelInk/10 first:border-t-0" data-testid="verb-card-reading">
      {line.meaning && <div className="text-[16px] font-extrabold text-navy leading-tight">«{line.meaning}»</div>}
      <div className={`text-[12px] text-jewelInk-mid leading-snug ${line.meaning ? 'mt-0.5' : 'font-semibold text-[14px] text-jewelInk'}`}>{line.caption}</div>
    </div>
  )
}

function OpenButton({ verb, onOpen, at, named }: { verb: VerbCardVerbDto; onOpen: Props['onOpen']; at?: { tense: TenseKey; person: number }; named: boolean }) {
  return (
    <button
      onClick={() => onOpen(verb.verbId, at)}
      data-testid="verb-card-open"
      aria-label={named ? `Открыть в глаголах: ${verb.ru}` : undefined}
      className="jewel-pressable mt-2.5 w-full min-h-[44px] px-3.5 rounded-xl bg-navy text-cream border-[1.5px] border-jewelInk text-[13px] font-extrabold flex items-center justify-center gap-2"
      style={{ boxShadow: `2px 2px 0 ${INK}` }}
    >
      Открыть в глаголах <ArrowIcon />
    </button>
  )
}

/** От какого глагола форма: русское значение и название действия (или словарная форма, если названия в базе нет). */
function VerbOf({ verb }: { verb: VerbCardVerbDto }) {
  const name = verb.actionName
    ? { label: 'название действия', form: verb.actionName, transcription: verb.actionNameTranscription ?? '' }
    : { label: 'словарная форма', form: verb.lemma, transcription: verb.lemmaTranscription }
  return (
    <div className="flex items-center justify-between gap-3" data-testid="verb-card-verb">
      <span className="min-w-0">
        <span className="block mn-eyebrow text-navy">глагол</span>
        <span className="block text-[15px] font-extrabold text-jewelInk leading-tight">«{verb.ru}»</span>
        <span className="block text-[11px] text-jewelInk-mid leading-tight mt-0.5">{name.label}</span>
      </span>
      <Georgian forms={[name]} />
    </div>
  )
}

export default function VerbTranslationCard({ card, word, definition, alreadySaved, example, onOpen }: Props) {
  const several = card.verbs.length > 1
  const isForm = card.kind === 'form'

  return (
    <div className="mt-3 jewel-tile px-4 py-3.5" data-testid="verb-translation-card" data-kind={card.kind}>
      <div className="relative z-[1]">
        {isForm || card.kind === 'actionName' ? (
          <div data-testid="verb-card-head">
            <Georgian forms={[{ form: card.text, transcription: card.transcription ?? '' }]} big align="left" />
            {card.kind === 'actionName' && <div className="mt-1 text-[13px] font-semibold text-jewelInk-mid">название действия</div>}
            {isForm && card.verbs.reduce((n, v) => n + v.lines.length, 0) > 1 && (
              <div className="mt-1 text-[13px] font-semibold text-jewelInk-mid">у этого слова несколько значений</div>
            )}
          </div>
        ) : (
          <div data-testid="verb-card-head">
            <div className="mn-eyebrow text-navy">глагол</div>
            <div className="text-[20px] font-extrabold text-navy leading-tight">«{card.text}»</div>
            {several && <div className="mt-1 text-[13px] font-semibold text-jewelInk-mid">в базе несколько глаголов с таким значением</div>}
          </div>
        )}

        {card.verbs.map(verb => (
          <section
            key={verb.verbId}
            data-testid="verb-card-section"
            className="mt-3 rounded-xl bg-cream border-[1.5px] border-jewelInk/60 px-3.5 py-3"
          >
            {isForm ? (
              <>
                <div>{verb.lines.map(line => <Reading key={`${line.tense}-${line.person}`} line={line} />)}</div>
                <div className="mt-2 pt-2 border-t border-jewelInk/20"><VerbOf verb={verb} /></div>
                <OpenButton verb={verb} onOpen={onOpen} at={verb.lines[0] && { tense: verb.lines[0].tense, person: verb.lines[0].person }} named={several} />
              </>
            ) : (
              <>
                {(card.kind === 'actionName' || several || verb.actionName) && (
                  <div className="pb-2 mb-1 border-b border-jewelInk/20">
                    {card.kind === 'infinitive' && !several && verb.actionName ? (
                      <div className="flex items-center justify-between gap-3" data-testid="verb-card-action-name">
                        <span className="text-[12px] font-semibold text-jewelInk-mid">название действия</span>
                        <Georgian forms={[{ form: verb.actionName, transcription: verb.actionNameTranscription ?? '' }]} />
                      </div>
                    ) : (
                      <VerbOf verb={verb} />
                    )}
                  </div>
                )}
                <div>{verb.lines.map(line => <KeyForm key={`${line.tense}-${line.person}`} line={line} />)}</div>
                <OpenButton verb={verb} onOpen={onOpen} named={several} />
              </>
            )}
          </section>
        ))}

        {card.moreVerbs > 0 && (
          <div className="mt-2 text-[12px] text-jewelInk-mid">Есть и другие, ещё {card.moreVerbs} — их можно найти в разделе «Глаголы».</div>
        )}
        {card.related.length > 0 && (
          <div className="mt-2 text-[12px] text-jewelInk-mid" data-testid="verb-card-related">
            Ещё в разделе «Глаголы»: {card.related.map(gloss => `«${gloss}»`).join(', ')}.
          </div>
        )}
        {example && <div className="mt-2 text-[12px] text-jewelInk-mid italic">{example}</div>}

        <div className="mt-2.5 text-[12px] font-bold text-gold-deep" data-testid="verb-card-saved">
          <CheckIcon /> {alreadySaved ? 'Уже в словаре' : 'В словарь записано'}: {word} — <span className="font-geo">{definition}</span>
        </div>
      </div>
    </div>
  )
}
