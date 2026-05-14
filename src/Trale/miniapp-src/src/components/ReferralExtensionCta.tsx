import { useEffect, useState } from 'react'
import { api } from '../api'

interface Props {
  /** Visual style — compact button for inline use inside the trial banner,
   * full block for the standalone "trial expired" banner. */
  variant: 'inline' | 'block'
}

/**
 * "Продли бесплатно — пригласи друга" CTA.
 *
 * Visible when User.ShouldShowReferralExtensionCta = true (trial about to end
 * or already ended; not Lifetime, not active Pro). Tapping shares the user's
 * referral deep-link via Telegram. Per current backend logic, the inviter
 * gets +7d of trial when a friend reaches the activation trigger
 * (first lesson / 5 vocab entries / Pro purchase).
 */
export default function ReferralExtensionCta({ variant }: Props) {
  const [data, setData] = useState<{ link: string; shareText: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    api.referral()
      .then((r) => {
        if (!cancelled) setData({ link: r.link, shareText: r.shareText })
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  if (!data) return null

  function share() {
    if (!data) return
    const tg = (window as any).Telegram?.WebApp
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(data.link)}&text=${encodeURIComponent(data.shareText)}`
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(shareUrl)
    } else {
      window.open(shareUrl, '_blank', 'noopener')
    }
  }

  if (variant === 'inline') {
    return (
      <button
        data-testid="referral-extension-cta"
        onClick={share}
        className="relative z-[1] shrink-0 px-3 py-1.5 rounded-lg font-sans text-[11px] font-extrabold border-[1.5px] border-jewelInk"
        style={{ background: '#FFF', color: '#15100A' }}
      >
        +7 дней бесплатно
      </button>
    )
  }

  return (
    <div data-testid="referral-extension-cta" className="jewel-tile px-4 py-3 flex items-center gap-3" style={{ background: '#FBF6EC' }}>
      <div className="relative z-[1] text-[22px] leading-none shrink-0">🎁</div>
      <div className="relative z-[1] flex-1 min-w-0">
        <div className="font-sans text-[13px] font-extrabold text-jewelInk leading-tight">
          Продли бесплатно
        </div>
        <div className="font-sans text-[11px] text-jewelInk-mid mt-0.5">
          Пригласи друга — получишь +7 дней триала когда он начнёт учиться.
        </div>
      </div>
      <button
        onClick={share}
        className="relative z-[1] shrink-0 px-3 py-1.5 rounded-lg font-sans text-[11px] font-extrabold border-[1.5px] border-jewelInk"
        style={{ background: '#F5B820', color: '#15100A' }}
      >
        пригласить
      </button>
    </div>
  )
}
