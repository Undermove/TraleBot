import Header from '../components/Header'
import CampaignPanel from '../components/admin/CampaignPanel'
import { BroadcastPanel } from './AdminScreen'
import type { ProgressState, Screen } from '../types'

// «Рассылка» — подраздел админки: рассылка по частям и старая разовая. Обе формы сами ничего не
// отправляют и не показывают не владельцу (сервер отвечает 404 на каждый их запрос).

export default function AdminBroadcastScreen({ progress, navigate }: { progress: ProgressState; navigate: (s: Screen) => void }) {
  return (
    <div className="flex flex-col min-h-full bg-cream" data-testid="admin-broadcast-screen">
      <Header progress={progress} onBack={() => navigate({ kind: 'admin' })} eyebrow="админка" title="Рассылка" />
      <div className="flex-1 px-5 pt-4" style={{ paddingBottom: 'calc(var(--safe-b) + 32px)' }}>
        <CampaignPanel />
        <BroadcastPanel />
      </div>
    </div>
  )
}
