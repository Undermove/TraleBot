import { useEffect, useState } from 'react'
import AdminPage, { Empty, Figure, NavTile, phaseOf, type AdminPhase } from '../components/admin/AdminPage'
import { api, type AdminUserAccess, type AdminUserDetail } from '../api'
import { ACCESS, PLAN, ago, dayYear, fmt, sourceName, when } from '../admin/words'
import type { Screen } from '../types'

// Карточка человека: когда и откуда пришёл, какой у него доступ, чем занимался и когда в последний раз,
// что платил, что отвечал в опросах — и переписка с ним (владелец может написать первым).
// Выдать или отозвать подписку можно здесь же, с подтверждением.

interface Props {
  telegramId: number
  navigate: (s: Screen) => void
}

const PLANS = ['Month', 'Quarter', 'HalfYear', 'Year', 'Lifetime']
const row = 'flex justify-between gap-3 font-sans text-[14px] text-jewelInk py-1.5 border-b border-jewelInk/10 last:border-0'
const label = 'text-jewelInk-mid shrink-0'
const value = 'text-right break-words min-w-0'

export default function AdminUserScreen({ telegramId, navigate }: Props) {
  const [phase, setPhase] = useState<AdminPhase>('loading')
  const [user, setUser] = useState<AdminUserDetail | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const load = () => api.adminUserDetail(telegramId).then(u => { setUser(u); setPhase('ready') }).catch(e => setPhase(phaseOf(e)))
  useEffect(() => { setPhase('loading'); void load() }, [telegramId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function change(question: string, act: () => Promise<unknown>, done: string) {
    if (!confirm(question)) return
    setBusy(true)
    setNote(null)
    try { await act(); setNote(done); await load() } catch { setNote('Не получилось — попробуй ещё раз.') } finally { setBusy(false) }
  }

  const access = (user?.access ? user.access[0].toLowerCase() + user.access.slice(1) : 'ended') as AdminUserAccess
  const until = user?.subscriptionPlan === 'Lifetime' && access === 'paying' ? 'без срока' : user?.accessUntilUtc ? `до ${dayYear(user.accessUntilUtc)}` : null

  return (
    <AdminPage title={`Пользователь ${telegramId}`} section="админка · пользователи" onBack={() => navigate({ kind: 'admin-users' })}
      phase={phase} onRetry={() => { setPhase('loading'); void load() }} testId="admin-user">
      {user && (
        <>
          <div className="jewel-tile px-4 py-3 mb-4" data-testid="user-summary">
            <div className="relative z-[1]">
              <div className={row}><span className={label}>пришёл</span><span className={value}>{dayYear(user.registeredAtUtc)}</span></div>
              <div className={row}><span className={label}>откуда</span><span className={value}>{sourceName(user.acquisitionSource)}</span></div>
              <div className={row}>
                <span className={label}>доступ</span>
                <span className={value}>{ACCESS[access]}{until ? `, ${until}` : ''}{user.subscriptionPlan ? ` · ${PLAN[user.subscriptionPlan] ?? user.subscriptionPlan}` : ''}</span>
              </div>
              <div className={row}><span className={label}>занятия</span><span className={value}>{ago(user.lastStudiedAtUtc)}</span></div>
              <div className={row}>
                <span className={label}>бот</span>
                <span className={`${value} ${user.isActive ? '' : 'text-ruby font-bold'}`}>
                  {user.isActive ? (user.notificationsEnabled === false ? 'уведомления выключены' : 'на связи') : 'заблокировал бота'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 mb-5">
            <NavTile
              testId="user-write" name="Написать" about={user.writtenTexts ? `Переписка: текстов от человека — ${user.writtenTexts}` : 'Человек ещё ничего не писал — можно написать первым'}
              onOpen={() => navigate({ kind: 'admin-feedback', view: { thread: telegramId } })}
            />
          </div>

          <div className="mn-eyebrow mb-2">Чем занимался</div>
          <div className="grid grid-cols-2 gap-2 mb-5" data-testid="user-activity">
            <Figure label="уроков пройдено" value={fmt(user.lessonsCompleted ?? 0)} note={`уровень: ${user.level === 'beginner' ? 'с нуля' : user.level === 'intermediate' ? 'продолжает' : 'не выбран'}`} />
            <Figure label="слов в словаре" value={fmt(user.vocabularyCount)} note={`квизов начато ${fmt(user.quizzesStarted ?? 0)}`} />
            <Figure label="игр с глаголами" value={fmt(user.verbSessionsStarted ?? 0)} note={`доиграно ${fmt(user.verbSessionsFinished ?? 0)}`} />
            <Figure label="опыта" value={fmt(user.xp)} note={`дней подряд ${user.streak}`} />
          </div>

          <div className="mn-eyebrow mb-2">Оплаты</div>
          {user.payments.length === 0 ? <Empty>Оплат не было.</Empty> : (
            <div className="jewel-tile px-4 py-2 mb-2" data-testid="user-payments">
              <div className="relative z-[1]">
                {user.payments.map(p => (
                  <div key={p.chargeId} className={row}>
                    <span className="tabular-nums">{dayYear(p.purchasedAtUtc)} · {PLAN[p.plan] ?? p.plan}</span>
                    <span className={`tabular-nums shrink-0 ${p.refundedAtUtc ? 'line-through text-jewelInk-mid' : 'font-extrabold'}`}>
                      {p.amount} {p.currency === 'XTR' ? 'зв.' : p.currency}{p.refundedAtUtc ? ' · возврат' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mn-eyebrow mt-5 mb-2">Ответы в опросах</div>
          {(user.surveyAnswers ?? []).length === 0 ? <Empty>В опросах не отвечал.</Empty> : (
            <div className="flex flex-col gap-2" data-testid="user-answers">
              {user.surveyAnswers!.map((a, i) => (
                <button key={i} type="button" onClick={() => navigate({ kind: 'admin-feedback', view: { survey: a.campaignKey } })}
                  className="jewel-tile jewel-pressable w-full text-left px-4 py-3 min-h-[56px]">
                  <div className="relative z-[1]">
                    <div className="font-sans text-[12px] text-jewelInk-mid break-words">{a.question} · <span className="tabular-nums">{when(a.atUtc)}</span></div>
                    {a.option && <div className="font-sans text-[14px] font-bold text-jewelInk break-words">{a.option}</div>}
                    {a.text && <div className="font-sans text-[14px] text-jewelInk whitespace-pre-wrap break-words">{a.text}</div>}
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="mn-eyebrow mt-5 mb-2">Выдать подписку вручную</div>
          <div className="flex flex-wrap gap-2" data-testid="user-grant">
            {PLANS.map(plan => (
              <button key={plan} type="button" disabled={busy}
                onClick={() => change(`Выдать подписку «${PLAN[plan]}» пользователю ${telegramId}?`, () => api.adminGrantPro(telegramId, plan), `Выдано: ${PLAN[plan]}.`)}
                className="px-3 min-h-[44px] rounded-xl border-[1.5px] border-jewelInk bg-white font-sans text-[13px] font-bold text-jewelInk disabled:opacity-50">
                {PLAN[plan]}
              </button>
            ))}
          </div>
          {user.isPro && (
            <button type="button" disabled={busy}
              onClick={() => change(`Отозвать подписку у пользователя ${telegramId}?`, () => api.adminRevokePro(telegramId), 'Подписка отозвана.')}
              className="mt-3 font-sans text-[14px] font-bold text-ruby underline min-h-[44px] disabled:opacity-50" data-testid="user-revoke">
              Отозвать подписку
            </button>
          )}
          {note && <div className="font-sans text-[14px] text-jewelInk mt-2" data-testid="user-note">{note}</div>}
        </>
      )}
    </AdminPage>
  )
}
