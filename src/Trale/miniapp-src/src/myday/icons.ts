// Картинки модуля «Мой день»: контур чернилами + заливка эмалью (классы f-* — в myday.css).
// Каждая рисует ровно то, что значит слово: чай — кружка с пакетиком на нитке, маршрутка — жёлтая, как в Тбилиси.
const S = 'fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"'
const svg = (body: string) => `<svg viewBox="0 0 64 64" ${S} aria-hidden="true">${body}</svg>`

export const ICON: Record<string, string> = {
  // будильник: красный корпус, два колокольчика, стрелки на семь
  wake: svg(`<path class="f-gold" d="M8 22a11 11 0 0 1 14-14z"/><path class="f-gold" d="M56 22a11 11 0 0 0-14-14z"/>
    <path d="M18 54l-4 5M46 54l4 5"/><circle class="f-ruby" cx="32" cy="36" r="20"/><circle class="f-paper" cx="32" cy="36" r="14"/>
    <path d="M32 36V26M32 36l-6 5"/><circle class="f-ink ns" cx="32" cy="36" r="2.2"/>`),
  // футболка
  dress: svg(`<path class="f-navy" d="M23 9L9 17l5 11 7-3v29h22V25l7 3 5-11-14-8c-2 5-5 7-9 7s-7-2-9-7z"/>
    <path d="M23 9c2 5 5 7 9 7s7-2 9-7" />`),
  // чашка кофе на блюдце: тёмный кофе и пар
  coffee: svg(`<ellipse class="f-paper" cx="31" cy="53" rx="23" ry="4.5"/>
    <path class="f-paper" d="M12 27h36v9a18 16 0 0 1-36 0z"/><path d="M48 30h3a6 6 0 0 1 0 12h-5"/>
    <ellipse class="f-coffee" cx="30" cy="27" rx="18" ry="3.6"/>
    <path d="M23 8c-3 4 3 7 0 11M31 6c-3 4 3 7 0 11M39 8c-3 4 3 7 0 11" stroke-width="2.2"/>`),
  // кружка чая: янтарный чай и пакетик на нитке через край
  tea: svg(`<path class="f-glass" d="M18 20h30v28a7 7 0 0 1-7 7H25a7 7 0 0 1-7-7z"/>
    <path class="f-amber ns" d="M19.3 30h27.4v18a5.7 5.7 0 0 1-5.7 5.7H25a5.7 5.7 0 0 1-5.7-5.7z"/>
    <path d="M18 20h30v28a7 7 0 0 1-7 7H25a7 7 0 0 1-7-7z"/><path d="M48 27h3a7 7 0 0 1 0 14h-3"/>
    <path d="M28 38V17q0-5-5-5h-4q-4 0-4 4v14" stroke-width="1.8"/><rect class="f-ruby" x="9" y="29" width="12" height="13" rx="2"/>
    <path d="M12 34h6M12 37.5h4" stroke="#fff" stroke-width="1.6"/>`),
  // завтрак: яичница на тарелке и вилка
  breakfast: svg(`<path d="M9 8v11a4 4 0 0 0 8 0V8M13 8v48"/><circle class="f-paper" cx="38" cy="34" r="20"/>
    <circle cx="38" cy="34" r="14" stroke-width="1.6" opacity=".45"/>
    <path class="f-white" d="M30 30c2-6 10-7 13-3 5 0 7 6 3 9 1 5-6 8-10 5-5 2-10-3-7-6-3-1-2-5 1-5z"/>
    <circle class="f-gold" cx="38" cy="33" r="4.6"/>`),
  // жёлтая маршрутка
  towork: svg(`<path class="f-gold" d="M8 44V20q0-8 8-8h32q8 0 8 8v24q0 4-4 4H12q-4 0-4-4z"/>
    <path class="f-glass" d="M13 18q0-1 1-1h36q1 0 1 1v12H13z"/><path d="M32 17v13"/>
    <circle class="f-paper" cx="16" cy="39" r="3"/><circle class="f-paper" cx="48" cy="39" r="3"/><path d="M26 40h12"/>
    <rect class="f-ink" x="13" y="48" width="9" height="7" rx="2"/><rect class="f-ink" x="42" y="48" width="9" height="7" rx="2"/>`),
  // работаю: ноутбук со строчками на экране
  work: svg(`<rect class="f-navyw" x="12" y="13" width="40" height="27" rx="3"/><path d="M19 21h16M19 27h24M19 33h11" stroke-width="2"/>
    <path class="f-paper" d="M5 44h54l-4 7H9z"/>`),
  // обедаю: глубокая тарелка супа, ложка и пар
  lunch: svg(`<path class="f-paper" d="M7 31h50a25 20 0 0 1-50 0z"/><ellipse class="f-amber" cx="32" cy="31" rx="25" ry="4"/>
    <path d="M44 22l10-14" stroke-width="3"/><path d="M22 10c-3 4 3 6 0 10M31 8c-3 4 3 6 0 10" stroke-width="2.2"/><path d="M20 55h24"/>`),
  // возвращаюсь домой: дом с красной крышей и жёлтой дверью
  home: svg(`<path class="f-paper" d="M13 28v26h38V28"/><path class="f-ruby" d="M5 31L32 9l27 22z"/>
    <path class="f-gold" d="M27 54V40h10v14z"/><rect class="f-glass" x="16" y="34" width="7" height="7" rx="1"/><rect class="f-glass" x="41" y="34" width="7" height="7" rx="1"/>`),
  // стол: деревянная столешница на четырёх ножках
  table: svg(`<path class="f-gold" d="M6 26h52l-4 7H10z"/><path d="M13 33v22M51 33v22M20 33v15M44 33v15" stroke-width="3"/>`),
  // читаю книгу: раскрытая книга
  read: svg(`<path class="f-paper" d="M32 17c-7-5-16-6-25-4v38c9-2 18-1 25 4 7-5 16-6 25-4V13c-9-2-18-1-25 4z"/><path d="M32 17v38"/>
    <path d="M13 22c5-1 10 0 13 2M13 29c5-1 10 0 13 2M38 24c3-2 8-3 13-2M38 31c3-2 8-3 13-2" stroke-width="1.8"/>`),
  // отдыхаю: зелёный диван
  rest: svg(`<path class="f-leafw" d="M14 33V22q0-6 6-6h24q6 0 6 6v11"/><path class="f-leafw" d="M7 35a5 5 0 0 1 10 0v5h30v-5a5 5 0 0 1 10 0v13H7z"/>
    <path d="M17 40h30M11 48v6M53 48v6"/>`),
  // засыпаю: кровать, одеяло и «з-з»
  sleep: svg(`<path d="M6 24v30M58 42v12M6 46h52"/><circle class="f-paper" cx="14" cy="34" r="5"/>
    <path class="f-navyw" d="M21 46v-9a4 4 0 0 1 4-4h27a6 6 0 0 1 6 6v7z"/><path d="M36 6h8l-8 9h8M48 14h6l-6 7h6" stroke-width="2.2"/>`),
  // рассвет: солнце встаёт над линией
  morning: svg(`<path class="f-gold" d="M16 46a16 16 0 0 1 32 0z"/><path d="M6 46h52M32 14v7M13 25l5 5M51 25l-5 5M8 38h4M52 38h4"/>
    <path d="M14 54h10M30 54h20" opacity=".5"/>`),
  // вечер: месяц и звёзды
  evening: svg(`<path class="f-gold" d="M38 10a17 17 0 1 0 16 24A14 14 0 0 1 38 10z"/>
    <path d="M14 14v6M11 17h6M20 34v4M18 36h4" stroke-width="2"/><path d="M6 54h52" opacity=".5"/>`),
  // настенные часы на восемь
  clock8: svg(`<circle class="f-paper" cx="32" cy="32" r="24"/><path d="M32 12v3M32 49v3M12 32h3M49 32h3" stroke-width="2"/>
    <path d="M32 32V17M32 32l-10 6" stroke-width="3"/><circle class="f-ruby ns" cx="32" cy="32" r="3"/>`),
  // те же часы на семь
  clock7: svg(`<circle class="f-paper" cx="32" cy="32" r="24"/><path d="M32 12v3M32 49v3M12 32h3M49 32h3" stroke-width="2"/>
    <path d="M32 32V17M32 32l-5.5 9.5" stroke-width="3"/><circle class="f-ruby ns" cx="32" cy="32" r="3"/>`),
  // пью воду: стакан воды с бликом
  water: svg(`<path class="f-glass" d="M17 10h30l-4 44a4 4 0 0 1-4 4H25a4 4 0 0 1-4-4z"/>
    <path class="f-navyw ns" d="M19.6 26h24.8l-2.6 27.6a3 3 0 0 1-3 2.6H25.2a3 3 0 0 1-3-2.6z"/>
    <path d="M17 10h30l-4 44a4 4 0 0 1-4 4H25a4 4 0 0 1-4-4z"/><path d="M27 33v14" stroke="#fff" stroke-width="2.4"/>`),
  // ем хачапури: лодочка с жёлтым яйцом
  khach: svg(`<path class="f-amber" d="M2 24c6 16 16 24 30 24s24-8 30-24c-7 5-13 7-20 7H22c-7 0-13-2-20-7z"/>
    <path class="f-paper" d="M12 30c6 3 12 4 20 4s14-1 20-4c-5-6-12-8-20-8s-15 2-20 8z"/>
    <circle class="f-gold" cx="30" cy="28" r="5"/><rect class="f-white" x="38" y="24" width="6" height="5" rx="1" stroke-width="1.8"/><path d="M10 56h44" opacity=".5"/>`),
  // ем фрукты: красное яблоко с листком
  fruit: svg(`<path class="f-ruby" d="M32 20c-6-5-20-3-20 13 0 12 8 23 14 23 3 0 4-2 6-2s3 2 6 2c6 0 14-11 14-23 0-16-14-18-20-13z"/>
    <path d="M32 20c0-6 2-10 6-13"/><path class="f-leafw" d="M35 14c3-6 10-7 14-5-2 5-8 8-14 5z"/>`),
  // готовлю ужин: кастрюля на огне
  cook: svg(`<path class="f-navyw" d="M12 24h40v18a10 10 0 0 1-10 10H22a10 10 0 0 1-10-10z"/><path d="M6 27h6M52 27h6M10 24h44"/>
    <path class="f-ink" d="M28 18h8v-3h-8z"/><path class="f-gold" d="M24 60c-3-3 0-5 2-7 1 3 3 3 3 1 2 2 4 4 1 6zM36 60c-3-3 0-5 2-7 1 3 3 3 3 1 2 2 4 4 1 6z"/>`),
  // мою посуду: тарелка и пена
  dishes: svg(`<circle class="f-paper" cx="30" cy="36" r="20"/><circle cx="30" cy="36" r="12" stroke-width="1.6" opacity=".45"/>
    <circle class="f-glass" cx="48" cy="14" r="6"/><circle class="f-glass" cx="56" cy="26" r="4"/><circle class="f-glass" cx="40" cy="8" r="3"/>`),
  // звоню маме: телефон с волнами
  call: svg(`<rect class="f-navy" x="18" y="8" width="24" height="46" rx="5"/><rect class="f-glass" x="22" y="14" width="16" height="30" rx="1.5"/>
    <path d="M27 49h6"/><path d="M48 18a10 10 0 0 1 0 14M53 13a17 17 0 0 1 0 24" stroke-width="2.2"/>`),
  // гуляю: дерево и дорожка
  walk: svg(`<circle class="f-leafw" cx="20" cy="20" r="13"/><path d="M20 33v21M4 56h56"/>
    <path class="f-ink" d="M40 50c-3 0-4-3-4-6s2-6 4-6 4 3 4 6-1 6-4 6zM50 38c-3 0-4-3-4-6s2-6 4-6 4 3 4 6-1 6-4 6z"/>`),
  // тренируюсь: гантель
  sport: svg(`<rect class="f-ruby" x="6" y="20" width="10" height="24" rx="3"/><rect class="f-ruby" x="48" y="20" width="10" height="24" rx="3"/>
    <rect class="f-ink" x="16" y="25" width="5" height="14" rx="1"/><rect class="f-ink" x="43" y="25" width="5" height="14" rx="1"/><path d="M21 32h22" stroke-width="4"/>`),
  // учу грузинский: тетрадь с буквой ა
  study: svg(`<rect class="f-paper" x="12" y="8" width="40" height="48" rx="4"/><path d="M20 8v48"/><path d="M8 18h8M8 30h8M8 42h8" stroke-width="2"/>
    <text x="36" y="42" text-anchor="middle" font-size="26" font-weight="800" fill="var(--navy)" stroke="none" style="font-family:var(--f-ka)">ა</text>`),
  // иду в магазин: сумка с ручками
  shop: svg(`<path class="f-gold" d="M12 22h40l-3 32H15z"/><path d="M24 26v-8a8 8 0 0 1 16 0v8"/>
    <circle class="f-ink ns" cx="24" cy="27" r="2"/><circle class="f-ink ns" cx="40" cy="27" r="2"/>`),
  // выходные в календаре: суббота и воскресенье закрашены
  sat: svg(`<rect class="f-paper" x="6" y="12" width="52" height="42" rx="5"/><path class="f-ruby" d="M6 17a5 5 0 0 1 5-5h42a5 5 0 0 1 5 5v7H6z"/>
    <path d="M18 8v8M46 8v8"/><rect class="f-gold" x="36" y="30" width="9" height="9" rx="2"/><rect x="47" y="30" width="7" height="9" rx="2" stroke-width="1.6" opacity=".5"/>
    <path d="M12 34h4M20 34h4M28 34h4M12 46h4M20 46h4M28 46h4" stroke-width="2" opacity=".5"/>`),
  sun: svg(`<rect class="f-paper" x="6" y="12" width="52" height="42" rx="5"/><path class="f-ruby" d="M6 17a5 5 0 0 1 5-5h42a5 5 0 0 1 5 5v7H6z"/>
    <path d="M18 8v8M46 8v8"/><rect x="36" y="30" width="9" height="9" rx="2" stroke-width="1.6" opacity=".5"/><rect class="f-gold" x="46" y="30" width="9" height="9" rx="2"/>
    <path d="M12 34h4M20 34h4M28 34h4M12 46h4M20 46h4M28 46h4" stroke-width="2" opacity=".5"/>`),
  // каждый день / часто / иногда: календарь с отметками
  daily: svg(`<rect class="f-paper" x="6" y="12" width="52" height="42" rx="5"/><path class="f-navy" d="M6 17a5 5 0 0 1 5-5h42a5 5 0 0 1 5 5v7H6z"/>
    <path d="M14 33l3 3 5-6M28 33l3 3 5-6M42 33l3 3 5-6M14 45l3 3 5-6M28 45l3 3 5-6M42 45l3 3 5-6" stroke="var(--leaf)" stroke-width="2.4"/>`),
  often: svg(`<rect class="f-paper" x="6" y="12" width="52" height="42" rx="5"/><path class="f-navy" d="M6 17a5 5 0 0 1 5-5h42a5 5 0 0 1 5 5v7H6z"/>
    <path d="M14 33l3 3 5-6M42 33l3 3 5-6M28 45l3 3 5-6M14 45l3 3 5-6" stroke="var(--leaf)" stroke-width="2.4"/><path d="M28 34h6M42 46h6" stroke-width="2" opacity=".4"/>`),
  some: svg(`<rect class="f-paper" x="6" y="12" width="52" height="42" rx="5"/><path class="f-navy" d="M6 17a5 5 0 0 1 5-5h42a5 5 0 0 1 5 5v7H6z"/>
    <path d="M28 45l3 3 5-6" stroke="var(--leaf)" stroke-width="2.4"/><path d="M14 34h6M42 34h6M28 34h6M14 46h6M42 46h6" stroke-width="2" opacity=".4"/>`),
  // часы на шесть
  clock6: svg(`<circle class="f-paper" cx="32" cy="32" r="24"/><path d="M32 12v3M32 49v3M12 32h3M49 32h3" stroke-width="2"/>
    <path d="M32 32V17M32 32v11" stroke-width="3"/><circle class="f-ruby ns" cx="32" cy="32" r="3"/>`),
  // фильм: экран с кнопкой «играть»
  film: svg(`<rect class="f-navyw" x="6" y="12" width="52" height="34" rx="5"/><path class="f-ruby" d="M27 21v16l13-8z"/>
    <path d="M26 46l-4 8M38 46l4 8M18 54h28"/>`),
  // музыка: наушники
  music: svg(`<path d="M10 38v-6a22 22 0 0 1 44 0v6"/><rect class="f-ruby" x="7" y="35" width="11" height="18" rx="4"/>
    <rect class="f-ruby" x="46" y="35" width="11" height="18" rx="4"/>`),
  // бокал красного вина
  wine: svg(`<path class="f-wine ns" d="M20.8 18h22.4c-.6 9-4.6 15-11.2 15s-10.6-6-11.2-15z"/>
    <path d="M19 8h26c0 16-5 25-13 25S19 24 19 8zM32 33v18M22 56h20"/>`),
  // море: солнце и волны
  sea: svg(`<circle class="f-gold" cx="44" cy="17" r="8"/>
    <path class="f-navyw" d="M4 36c5-5 9-5 14 0s9 5 14 0 9-5 14 0 9 5 14 0v22H4z"/>
    <path d="M4 36c5-5 9-5 14 0s9 5 14 0 9-5 14 0 9 5 14 0M8 48c5-4 8-4 12 0s8 4 12 0 8-4 12 0 8 4 12 0"/>`),
  // горы со снежной шапкой
  mount: svg(`<circle class="f-gold" cx="50" cy="14" r="6"/><path class="f-leafw" d="M34 56l12-20 14 20z"/>
    <path class="f-navyw" d="M4 56L24 20l20 36z"/><path class="f-paper" d="M24 20l-7 12.6 4-2 3 3 3-3 4 2z"/>`),
}

ICON.tosea = ICON.sea

export const EAR = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>'
export const BACK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>'
