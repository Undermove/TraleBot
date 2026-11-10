import { useEffect, useState } from 'react'
import AdminPage, { Empty, phaseOf, type AdminPhase } from '../components/admin/AdminPage'
import { readClipboard } from '../admin/pastedBroadcast'
import { adminCampaigns, type CampaignListItemDto } from '../api'
import { audienceName, day } from '../admin/words'
import { adminBack } from '../admin/adminNav'
import { scheduledText } from '../admin/schedule'
import { draft } from '../admin/useKept'
import type { Screen } from '../types'

// Рассылки: все кампании, отправленные людям, новые сверху — с тем, как далеко каждая дошла.
// Новая собирается по шагам; недосланную можно открыть и продолжить, запланированную — отменить. Опросы живут в «Обратной связи».

const STATE: Record<CampaignListItemDto['state'], string> = { scheduled: 'запланирована', draft: 'черновик', running: 'идёт', done: 'завершена' }

export default function AdminBroadcastsScreen({ navigate }: { navigate: (s: Screen) => void }) {
  const [phase, setPhase] = useState<AdminPhase>('loading')
  const [campaigns, setCampaigns] = useState<CampaignListItemDto[]>([])
  const [saved, setSaved] = useState(() => draft.read<{ message: string }>('broadcast'))

  const load = () => {
    setPhase('loading')
    adminCampaigns.list(false).then(r => { setCampaigns(r.campaigns); setPhase('ready') }).catch(e => setPhase(phaseOf(e)))
  }
  useEffect(load, [])

  return (
    <AdminPage title="Рассылки" onBack={() => navigate(adminBack())} phase={phase} onRetry={load} testId="admin-broadcasts">
      <button type="button" onClick={() => navigate({ kind: 'admin-broadcast' })} data-testid="broadcast-new"
        className="jewel-btn jewel-btn-gold w-full mb-4 font-sans text-[16px] font-extrabold">
        Новая рассылка
      </button>
      <button type="button" onClick={async () => navigate({ kind: 'admin-broadcast', paste: await readClipboard() })} data-testid="broadcast-paste-clipboard"
        className="w-full min-h-[52px] mb-4 rounded-xl border-[1.5px] border-jewelInk font-sans text-[15px] font-extrabold text-jewelInk">
        Вставить готовую из буфера
      </button>

      {saved && (
        <div className="jewel-tile px-4 py-3 mb-4" data-testid="broadcast-draft">
          <div className="relative z-[1]">
            <div className="mn-eyebrow text-navy">Черновик на этом устройстве</div>
            <div className="font-sans text-[15px] font-extrabold text-jewelInk line-clamp-2 break-words mt-1">{saved.message.trim().split('\n')[0] || 'Без текста'}</div>
            <div className="flex gap-2 mt-2">
              <button type="button" onClick={() => navigate({ kind: 'admin-broadcast', draft: true })} data-testid="broadcast-draft-continue"
                className="flex-1 min-h-[48px] rounded-xl border-[1.5px] border-jewelInk font-sans text-[15px] font-extrabold text-jewelInk" style={{ background: '#F5B820' }}>
                Продолжить черновик
              </button>
              <button type="button" onClick={() => { if (confirm('Удалить черновик рассылки?')) { draft.clear('broadcast'); setSaved(null) } }}
                className="min-h-[48px] px-3 font-sans text-[14px] font-bold text-ruby underline">
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {campaigns.length === 0 && <Empty>Рассылок пока не было. Нажми «Новая рассылка» — она собирается по шагам, и сначала её можно отправить себе.</Empty>}
      <div className="flex flex-col gap-2" data-testid="broadcasts-list">
        {campaigns.map(c => (
          <button key={c.key} type="button" onClick={() => navigate({ kind: 'admin-broadcast', key: c.key })}
            className="jewel-tile jewel-pressable w-full text-left px-4 py-3 min-h-[56px]" data-testid={`broadcast-${c.key}`}>
            <div className="relative z-[1]">
              <div className="flex items-center justify-between gap-2">
                <span className={`px-2 py-0.5 rounded-lg font-sans text-[12px] font-extrabold ${c.state === 'running' ? 'bg-ruby text-white' : 'bg-jewelInk/10 text-jewelInk'}`}
                  style={c.state === 'scheduled' ? { background: '#F5B820' } : undefined}>{STATE[c.state]}</span>
                <span className="font-sans text-[12px] text-jewelInk-mid tabular-nums shrink-0">{day(c.createdAtUtc)}</span>
              </div>
              <div className="font-sans text-[15px] font-extrabold text-jewelInk line-clamp-2 break-words mt-1">{c.message.split('\n')[0]}</div>
              <div className="font-sans text-[12px] text-jewelInk-mid tabular-nums mt-0.5">
                {audienceName(c.audience)} · {c.scheduledAtUtc ? `уйдёт сама ${scheduledText(c.scheduledAtUtc, c.scheduledTimeZone)}` : `отправлено ${c.picked - c.pending} из ${c.picked}`}
              </div>
              <div className="font-sans text-[12px] text-jewelInk-mid tabular-nums">
                {c.scheduledAtUtc && c.picked === 0
                  ? `${c.buttonText ? `с кнопкой «${c.buttonText}»` : 'без кнопки'}${c.giftDays > 0 ? ` · подарок ${c.giftDays} дн.` : ''}`
                  : `${c.buttonText ? `открыли по кнопке ${c.opened}` : 'без кнопки'}${c.giftDays > 0 ? ` · подарков выдано ${c.gifted} (${c.giftDays} дн.)` : ''}`}
              </div>
            </div>
          </button>
        ))}
      </div>
    </AdminPage>
  )
}
