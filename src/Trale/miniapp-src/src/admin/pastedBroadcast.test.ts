import { describe, it, expect } from 'vitest'
import { parsePastedBroadcast } from './pastedBroadcast'

const READY = `имя: myday-back
кому: inactiveLong
проба: 50
подарок: 7
кнопка: Посмотреть первую серию
адрес: moduleId=my-day&lessonId=1
---
Новый модуль — «Мой день»

დილით ყავას ვსვამ (дилит къавас всвам) — утром пью кофе`

describe('готовая рассылка одним куском', () => {
  it('fills every field, keeps the paragraphs of the message', () => {
    expect(parsePastedBroadcast(READY)).toEqual({
      name: 'myday-back', audience: 'inactiveLong', sample: 50, giftDays: 7,
      button: 'Посмотреть первую серию', query: 'moduleId=my-day&lessonId=1',
      message: READY.slice(READY.indexOf('---') + 4), when: null
    })
  })

  it('takes the day, the hour and the zone to send it by itself; Tbilisi when no zone is named', () => {
    expect(parsePastedBroadcast('кому: neverPaid\nкогда: 28.11.2026 12:00\nпояс: Берлин\n---\nПривет'))
      .toMatchObject({ when: { date: '2026-11-28', time: '12:00', zone: 'Europe/Berlin' }, sample: null })
    expect(parsePastedBroadcast('кому: neverPaid\nкогда: 1.12.2026 9:30\n---\nПривет'))
      .toMatchObject({ when: { date: '2026-12-01', time: '09:30', zone: 'Asia/Tbilisi' } })
    expect(parsePastedBroadcast('кому: neverPaid\nкогда: 28.11.2026 12:00\nпояс: Europe/Paris\n---\nПривет'))
      .toMatchObject({ when: { zone: 'Europe/Paris' } })
  })

  it('takes the group by its Russian name, and without a sample sends to everyone', () => {
    const r = parsePastedBroadcast('кому: не занимались больше 30 дней\n---\nПривет')
    expect(r).toMatchObject({ audience: 'inactiveLong', sample: null, button: null, giftDays: 0, name: '' })
  })

  it.each([
    ['кому: inactiveLong\nПривет', '---'],
    ['кому: всем\n---\nПривет', 'Кому'],
    ['кому: owner\n---\nПривет', 'Кому'],
    ['кому: inactiveLong\nцвет: синий\n---\nПривет', 'Непонятная строка'],
    ['кому: inactiveLong\n---\n', 'Нет текста'],
    ['кому: inactiveLong\nподарок: 7\n---\nПривет', 'по кнопке'],
    ['кому: inactiveLong\nкнопка: Открыть\nадрес: screen=verbs lesson\n---\nПривет', 'Адрес'],
    ['кому: inactiveLong\nимя: Мой День\n---\nПривет', 'Имя'],
    ['кому: inactiveLong\nпроба: много\n---\nПривет', 'Проба'],
    ['кому: inactiveLong\nкогда: завтра в полдень\n---\nПривет', 'Когда'],
    ['кому: inactiveLong\nкогда: 31.11.2026 12:00\n---\nПривет', 'Когда'],
    ['кому: inactiveLong\nпояс: Тбилиси\n---\nПривет', 'времени нет'],
    ['кому: inactiveLong\nкогда: 28.11.2026 12:00\nпояс: Марс\n---\nПривет', 'Пояс'],
    ['кому: inactiveLong\nпроба: 50\nкогда: 28.11.2026 12:00\n---\nПривет', 'всей группе']
  ])('rejects a broken paste with a reason: %s', (raw, reason) => {
    expect(parsePastedBroadcast(raw)).toContain(reason)
  })
})
