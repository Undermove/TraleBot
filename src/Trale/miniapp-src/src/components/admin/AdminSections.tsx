import type { Screen } from '../../types'

// Подразделы админки: у рассылки, конструктора опроса и отзывов — свои экраны, сюда выведены только входы.

const SECTIONS: { id: string; screen: Screen; name: string; about: string }[] = [
  { id: 'survey', screen: { kind: 'admin-survey' }, name: 'Опрос', about: 'Спросить людей: готовый вопрос с кнопками-ответами' },
  { id: 'feedback', screen: { kind: 'admin-feedback' }, name: 'Отзывы', about: 'Что ответили в опросах, на экране покупки и написали сами' },
  { id: 'broadcast', screen: { kind: 'admin-broadcast' }, name: 'Рассылка', about: 'Обычное сообщение — пробной группе, потом остальным' }
]

export default function AdminSections({ navigate }: { navigate: (s: Screen) => void }) {
  return (
    <div className="mb-5" data-testid="admin-sections">
      <div className="mn-eyebrow mb-2">Разделы</div>
      <div className="flex flex-col gap-2">
        {SECTIONS.map(s => (
          <button
            key={s.id} type="button" onClick={() => navigate(s.screen)} data-testid={`admin-section-${s.id}`}
            className="jewel-tile jewel-pressable w-full text-left px-4 py-3 min-h-[56px]"
          >
            <div className="relative z-[1] flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-sans text-[15px] font-extrabold text-jewelInk">{s.name}</div>
                <div className="font-sans text-[12px] text-jewelInk-mid mt-0.5">{s.about}</div>
              </div>
              <span aria-hidden className="text-jewelInk-hint text-[14px] shrink-0">→</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
