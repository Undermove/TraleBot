import { useEffect, useState } from 'react'
import AdminPage, { Badge, NavTile } from '../components/admin/AdminPage'
import { adminSections, type AdminOverviewDto } from '../api'
import { adminBack } from '../admin/adminNav'
import type { Screen } from '../types'

// Вкладка «Ещё»: то, чем владелец пользуется реже, — проверка глаголов, оплаты, служебное.

export default function AdminMoreScreen({ navigate }: { navigate: (s: Screen) => void }) {
  const [o, setO] = useState<AdminOverviewDto | null>(null)
  useEffect(() => { adminSections.overview().then(setO).catch(() => {}) }, [])

  return (
    <AdminPage title="Ещё" onBack={() => navigate(adminBack())} testId="admin-more-screen">
      <div className="flex flex-col gap-2">
        <NavTile testId="admin-more-verbs" name="Глаголы" about="Проверка глаголов, которые составила нейросеть"
          badge={(o?.verbsToReview ?? 0) > 0 && <Badge testId="admin-verbs-waits">ждут: {o!.verbsToReview}</Badge>}
          onOpen={() => navigate({ kind: 'verb-review' })} />
        <NavTile testId="admin-more-payments" name="Оплаты" about="Платежи и подписки, которые скоро закончатся" onOpen={() => navigate({ kind: 'admin-payments' })} />
        <NavTile testId="admin-more-system" name="Система" about="Фоновые задачи, тестовые пуши, старая разовая рассылка" onOpen={() => navigate({ kind: 'admin-system' })} />
      </div>
    </AdminPage>
  )
}
