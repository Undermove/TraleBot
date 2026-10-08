import React, { useState } from 'react'
import { CARD_TENSES, PERSONS, RARE_TENSES, TENSES, cyr, type TenseKey, type VerbDto } from './types'
import { meaningOf } from './meaning'
import { MeaningText, VerbForm } from './parts'

interface Props {
  verb: VerbDto
  person: number
  onPerson: (person: number) => void
  /** Строка, которую надо подсветить (слово, с которого пришли). */
  highlight?: { tense: string; person: number }
  initialRare?: boolean
  /** Лицо, вкладку которого подсветить для первого раза. */
  pulsePerson?: number
}

/**
 * Таблица слов глагола: лицо переключается вкладками в шапке, строки — времена.
 * Слева — что слово значит по-русски («я пишу»), справа — само слово. Редкие времена свёрнуты.
 * Одна и та же таблица стоит в виде глагола и открывается из заданий по «Подсмотреть в таблице».
 */
export default function FormsTable({ verb, person, onPerson, highlight, initialRare = false, pulsePerson }: Props) {
  const [rare, setRare] = useState(initialRare)
  // У неполных глаголов («хотеть», «знать») части времён нет вовсе: такие строки не рисуем прочерками.
  const has = (t: TenseKey) => !!verb.tenses[t]?.some(variants => variants.length)
  const mainTenses = CARD_TENSES.filter(has)
  const rareTenses = RARE_TENSES.filter(has)
  // Непроверенные времена глагола от нейросети: сервер держит их отдельно от tenses, в заданиях их нет.
  const unverified = [...CARD_TENSES, ...RARE_TENSES].filter(t => !!verb.unverified?.[t]?.some(variants => variants.length))
  const absent = CARD_TENSES.filter(t => !has(t) && !unverified.includes(t))

  const rows = (tenses: TenseKey[]) =>
    tenses.map(t => {
      const odd = verb.oddTenses.includes(t)
      const hit = highlight?.tense === t && highlight.person === person
      return (
        <div
          key={t}
          data-testid={`verb-tense-${t}`}
          className={`flex items-center justify-between gap-3 px-4 py-2.5 border-t border-cream-edge ${hit ? 'bg-gold-wash' : odd ? 'bg-ruby-wash/60' : ''}`}
        >
          {/* Слева — что форма значит по-русски («я пишу»); название времени простыми словами — мелко под ней. */}
          <span className="min-w-0">
            {verb.meanings?.[t] ? (
              <>
                <span className="block text-[14px] font-bold text-jewelInk"><MeaningText meaning={{ ...meaningOf(verb, t, person), note: null }} /></span>
                <span className="block text-[11px] text-jewelInk-hint">{TENSES[t].name}</span>
              </>
            ) : (
              <span className="block text-[13px] font-bold text-jewelInk">{TENSES[t].name}</span>
            )}
          </span>
          <VerbForm variants={verb.tenses[t]?.[person] ?? []} big root={verb.root} prefixes={verb.family?.prefixes} />
        </div>
      )
    })

  return (
    <div
      className="rounded-xl bg-cream-tile border-[1.5px] border-jewelInk overflow-hidden"
      style={{ boxShadow: '3px 3px 0 #15100A' }}
    >
      <div className="p-1.5 bg-navy flex gap-1">
        {PERSONS.map((p, i) => (
          <button
            key={p}
            data-testid={`verb-person-${i}`}
            onClick={() => onPerson(i)}
            className={`flex-1 h-8 rounded-md text-[12px] font-bold ${person === i ? 'bg-cream text-jewelInk' : 'text-cream/80'} ${pulsePerson === i ? 'ring-4 ring-gold animate-pulse' : ''}`}
          >
            {p}
          </button>
        ))}
      </div>
      {rows(mainTenses)}
      {unverified.map(t => (
        <div
          key={t}
          data-testid={`verb-unverified-${t}`}
          className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-dashed border-jewelInk/25 bg-cream-deep/40"
        >
          <span className="min-w-0">
            {verb.unverifiedMeanings?.[t]?.[person] ? (
              <>
                <span className="block text-[14px] font-bold text-jewelInk-mid">{verb.unverifiedMeanings[t]![person]}</span>
                <span className="block text-[11px] text-jewelInk-hint">{TENSES[t].name} · не проверено</span>
              </>
            ) : (
              <span className="block text-[13px] font-bold text-jewelInk-mid">{TENSES[t].name} <span className="font-normal text-[11px] text-jewelInk-hint">· не проверено</span></span>
            )}
          </span>
          {/* Без подсветки корня и окончаний: о строении этих форм ничего не утверждаем. */}
          <span className="text-right">
            <span className="block font-geo text-[17px] font-bold text-jewelInk-mid">{verb.unverified![t]![person]?.join(' / ') || '—'}</span>
            {verb.unverified![t]![person]?.[0] && (
              <span className="block text-[11px] text-jewelInk-hint">{cyr(verb.unverified![t]![person][0])}</span>
            )}
          </span>
        </div>
      ))}
      {unverified.length > 0 && (
        <div data-testid="verb-unverified-note" className="px-4 py-2 border-t border-cream-edge text-[11px] text-jewelInk-hint">
          Формы с пометкой «не проверено» собраны автоматически и ещё не проверены. В заданиях их нет.
        </div>
      )}
      {absent.length > 0 && (
        <div data-testid="verb-partial" className="px-4 py-2 border-t border-cream-edge text-[11px] text-jewelInk-hint">
          У этого глагола не все времена: {absent.map(t => TENSES[t].name.toLowerCase()).join(', ')} — таких форм в базе нет.
        </div>
      )}
      {rareTenses.length > 0 && (
        <button
          onClick={() => setRare(!rare)}
          data-testid="verb-rare-toggle"
          className="w-full flex items-center justify-between px-4 py-2.5 border-t border-cream-edge text-left bg-cream-deep/60"
        >
          <span>
            <span className="block text-[12px] font-bold text-jewelInk-mid">Редкие формы · {rareTenses.length}</span>
            {!rare && <span className="block text-[11px] text-jewelInk-hint">понадобятся позже, сейчас можно не открывать</span>}
          </span>
          <span className="text-jewelInk-hint text-[18px]">{rare ? '−' : '+'}</span>
        </button>
      )}
      {rare && rows(rareTenses)}
    </div>
  )
}
