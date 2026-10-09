import { useEffect, useState } from 'react'
import AdminPage, { Badge, Figure, NavTile, phaseOf, type AdminPhase } from '../components/admin/AdminPage'
import { adminSections, type AdminOverviewDto } from '../api'
import { fmt } from '../admin/words'
import type { Screen } from '../types'

// Обзор — первый экран админки: несколько цифр о том, как идут дела, и разделы. На плитке раздела —
// сколько в нём ждёт владельца: неотвеченные сообщения, недосланные опросы и рассылки, глаголы на проверку.

export default function AdminScreen({ navigate }: { navigate: (s: Screen) => void }) {
  const [phase, setPhase] = useState<AdminPhase>('loading')
  const [o, setO] = useState<AdminOverviewDto | null>(null)

  const load = () => {
    setPhase('loading')
    adminSections.overview().then(r => { setO(r); setPhase('ready') }).catch(e => setPhase(phaseOf(e)))
  }
  useEffect(load, [])

  const feedbackWaits = (o?.unansweredMessages ?? 0) + (o?.unfinishedSurveys ?? 0)

  return (
    <AdminPage title="Админка" section="обзор" onBack={() => navigate({ kind: 'profile' })} phase={phase} onRetry={load} testId="admin-overview">
      {o && (
        <>
          <div className="grid grid-cols-2 gap-2 mb-5" data-testid="admin-figures">
            <Figure label="новых за 7 дней" value={fmt(o.newUsers7d)} note={`всего людей ${fmt(o.totalUsers)}`} />
            <Figure label="занимались за 7 дней" value={fmt(o.studied7d)} note={`за сутки ${fmt(o.studiedToday)}`} />
            <Figure label="оплат за 30 дней" value={fmt(o.payments30d)} note={`звёзд ${fmt(o.stars30d)}`} />
            <Figure label="действующих подписок" value={fmt(o.activeSubscriptions)} note={`на пробном периоде ${fmt(o.onTrial)}`} />
          </div>
          <div className="font-sans text-[11px] text-jewelInk-hint -mt-3 mb-5">
            «Занимались» — ответили в уроке, добавили слово, начали квиз или игру с глаголом.
          </div>

          <div className="mn-eyebrow mb-2">Разделы</div>
          <div className="flex flex-col gap-2" data-testid="admin-sections">
            <NavTile
              testId="admin-section-users" name="Пользователи" about="Найти человека, посмотреть, чем занимался и что писал"
              onOpen={() => navigate({ kind: 'admin-users' })}
            />
            <NavTile
              testId="admin-section-feedback" name="Обратная связь" about="Сообщения от людей, опросы, ответы с экрана покупки"
              badge={feedbackWaits > 0 && (
                <Badge testId="admin-feedback-waits">
                  {[o.unansweredMessages > 0 && `без ответа: ${o.unansweredMessages}`, o.unfinishedSurveys > 0 && `не дослано: ${o.unfinishedSurveys}`].filter(Boolean).join(' · ')}
                </Badge>
              )}
              onOpen={() => navigate({ kind: 'admin-feedback' })}
            />
            <NavTile
              testId="admin-section-broadcasts" name="Рассылки" about="Сообщение людям: по шагам, пробной группе, потом остальным"
              badge={o.unfinishedBroadcasts > 0 && <Badge testId="admin-broadcasts-waits">не дослано: {o.unfinishedBroadcasts}</Badge>}
              onOpen={() => navigate({ kind: 'admin-broadcasts' })}
            />
            <NavTile
              testId="admin-section-verbs" name="Глаголы" about="Проверка глаголов, которые составила нейросеть"
              badge={o.verbsToReview > 0 && <Badge testId="admin-verbs-waits">ждут: {o.verbsToReview}</Badge>}
              onOpen={() => navigate({ kind: 'verb-review' })}
            />
            <NavTile testId="admin-section-payments" name="Оплаты" about="Платежи и подписки, которые скоро закончатся" onOpen={() => navigate({ kind: 'admin-payments' })} />
            <NavTile testId="admin-section-system" name="Система" about="Подробные цифры, фоновые задачи, тестовые пуши" onOpen={() => navigate({ kind: 'admin-system' })} />
          </div>
        </>
      )}
    </AdminPage>
  )
}
