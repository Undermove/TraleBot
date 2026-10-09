import { useEffect, useState } from 'react'
import AdminPage, { Empty, phaseOf, type AdminPhase } from '../components/admin/AdminPage'
import { adminCampaigns, type CampaignListItemDto } from '../api'
import { audienceName, day } from '../admin/words'
import type { Screen } from '../types'

// Рассылки: все кампании, отправленные людям, новые сверху — с тем, как далеко каждая дошла.
// Новая собирается по шагам; недосланную можно открыть и продолжить. Опросы живут в «Обратной связи».

const STATE: Record<CampaignListItemDto['state'], string> = { draft: 'черновик', running: 'идёт', done: 'завершена' }

export default function AdminBroadcastsScreen({ navigate }: { navigate: (s: Screen) => void }) {
  const [phase, setPhase] = useState<AdminPhase>('loading')
  const [campaigns, setCampaigns] = useState<CampaignListItemDto[]>([])

  const load = () => {
    setPhase('loading')
    adminCampaigns.list(false).then(r => { setCampaigns(r.campaigns); setPhase('ready') }).catch(e => setPhase(phaseOf(e)))
  }
  useEffect(load, [])

  return (
    <AdminPage title="Рассылки" onBack={() => navigate({ kind: 'admin' })} phase={phase} onRetry={load} testId="admin-broadcasts">
      <button type="button" onClick={() => navigate({ kind: 'admin-broadcast' })} data-testid="broadcast-new"
        className="jewel-btn jewel-btn-gold w-full mb-4 font-sans text-[16px] font-extrabold">
        Новая рассылка
      </button>

      {campaigns.length === 0 && <Empty>Рассылок пока не было.</Empty>}
      <div className="flex flex-col gap-2" data-testid="broadcasts-list">
        {campaigns.map(c => (
          <button key={c.key} type="button" onClick={() => navigate({ kind: 'admin-broadcast', key: c.key })}
            className="jewel-tile jewel-pressable w-full text-left px-4 py-3 min-h-[56px]" data-testid={`broadcast-${c.key}`}>
            <div className="relative z-[1]">
              <div className="flex items-center justify-between gap-2">
                <span className={`px-2 py-0.5 rounded-lg font-sans text-[12px] font-extrabold ${c.state === 'running' ? 'bg-ruby text-white' : 'bg-jewelInk/10 text-jewelInk'}`}>{STATE[c.state]}</span>
                <span className="font-sans text-[12px] text-jewelInk-mid tabular-nums shrink-0">{day(c.createdAtUtc)}</span>
              </div>
              <div className="font-sans text-[15px] font-extrabold text-jewelInk line-clamp-2 break-words mt-1">{c.message.split('\n')[0]}</div>
              <div className="font-sans text-[12px] text-jewelInk-mid tabular-nums mt-0.5">
                {audienceName(c.audience)} · отправлено {c.picked - c.pending} из {c.picked}
              </div>
              <div className="font-sans text-[12px] text-jewelInk-mid tabular-nums">
                {c.buttonText ? `открыли по кнопке ${c.opened}` : 'без кнопки'}{c.giftDays > 0 ? ` · подарков выдано ${c.gifted} (${c.giftDays} дн.)` : ''}
              </div>
            </div>
          </button>
        ))}
      </div>
    </AdminPage>
  )
}
