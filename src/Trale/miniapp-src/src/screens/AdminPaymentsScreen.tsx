import { useEffect, useState } from 'react'
import AdminPage, { Empty, Figure, More, phaseOf, type AdminPhase } from '../components/admin/AdminPage'
import { adminSections, type AdminPaymentRowDto, type AdminPaymentsDto } from '../api'
import { PLAN, dayYear, fmt } from '../admin/words'
import { adminBack } from '../admin/adminNav'
import type { Screen } from '../types'

// Оплаты: у кого подписка скоро закончится или только что закончилась (этим людям стоит написать),
// и все платежи, новые сверху. Тап по строке — карточка человека.

const PAGE = 30
const line = 'w-full flex items-center justify-between gap-3 text-left py-2 min-h-[48px] border-b border-jewelInk/10 last:border-0 font-sans text-[14px] text-jewelInk'

export default function AdminPaymentsScreen({ navigate }: { navigate: (s: Screen) => void }) {
  const [phase, setPhase] = useState<AdminPhase>('loading')
  const [data, setData] = useState<AdminPaymentsDto | null>(null)
  const [payments, setPayments] = useState<AdminPaymentRowDto[]>([])
  const [busy, setBusy] = useState(false)

  const load = (skip: number) => {
    setBusy(true)
    adminSections.payments(skip, PAGE)
      .then(r => { setData(r); setPayments(skip === 0 ? r.payments : [...payments, ...r.payments]); setPhase('ready') })
      .catch(e => setPhase(phaseOf(e)))
      .finally(() => setBusy(false))
  }
  useEffect(() => load(0), []) // eslint-disable-line react-hooks/exhaustive-deps

  const open = (telegramId: number) => navigate({ kind: 'admin-user', telegramId })
  const subscriptions = (title: string, rows: AdminPaymentsDto['endingSoon'], word: string, empty: string, testId: string) => (
    <>
      <div className="mn-eyebrow mb-2">{title}</div>
      {rows.length === 0 ? <Empty>{empty}</Empty> : (
        <div className="jewel-tile px-4 py-1 mb-2" data-testid={testId}>
          <div className="relative z-[1]">
            {rows.map(s => (
              <button key={s.telegramId} type="button" className={line} onClick={() => open(s.telegramId)}>
                <span className="tabular-nums font-bold text-navy underline">{s.telegramId}</span>
                <span className="tabular-nums text-right">{word} {dayYear(s.untilUtc)}{s.plan ? ` · ${PLAN[s.plan] ?? s.plan}` : ''}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )

  return (
    <AdminPage title="Оплаты" section="админка · ещё" onBack={() => navigate(adminBack())} phase={phase} onRetry={() => { setPhase('loading'); load(0) }} testId="admin-payments">
      {data && (
        <>
          <div className="grid grid-cols-2 gap-2 mb-5">
            <Figure label="платежей всего" value={fmt(data.total)} note={`возвратов ${data.refunds}`} />
            <Figure label="звёзд получено" value={fmt(data.starsTotal)} note="без возвратов" />
          </div>

          {subscriptions('Подписка скоро закончится', data.endingSoon, 'до', 'В ближайшие 14 дней ни у кого не заканчивается.', 'payments-ending')}
          <div className="h-3" />
          {subscriptions('Недавно закончилась', data.endedLately, 'закончилась', 'За последние 30 дней ни у кого не закончилась.', 'payments-ended')}

          <div className="mn-eyebrow mt-5 mb-2">Все платежи</div>
          {payments.length === 0 ? <Empty>Платежей пока не было.</Empty> : (
            <div className="jewel-tile px-4 py-1" data-testid="payments-list">
              <div className="relative z-[1]">
                {payments.map((p, i) => (
                  <button key={i} type="button" className={line} onClick={() => open(p.telegramId)}>
                    <span className="min-w-0">
                      <span className="block tabular-nums font-bold text-navy underline">{p.telegramId}</span>
                      <span className="block font-sans text-[12px] text-jewelInk-mid tabular-nums">{dayYear(p.purchasedAtUtc)} · {PLAN[p.plan] ?? p.plan}</span>
                    </span>
                    <span className={`tabular-nums shrink-0 text-right ${p.refundedAtUtc ? 'line-through text-jewelInk-mid' : 'font-extrabold'}`}>
                      {fmt(p.amount)} {p.currency === 'XTR' ? 'зв.' : p.currency}{p.refundedAtUtc ? ' · возврат' : ''}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <More shown={payments.length} total={data.total} busy={busy} onMore={() => load(payments.length)} />
        </>
      )}
    </AdminPage>
  )
}
