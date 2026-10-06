import { useEffect, useState } from 'react'
import { api } from '../api'
import { shareReferral } from '../referralShare'

interface Props {
  /** Visual style — compact button for inline use inside the trial banner,
   * full block for the standalone "trial expired" banner. */
  variant: 'inline' | 'block'
}

/**
 * "Позови друга — получишь дни бесплатно" CTA.
 *
 * Visible when User.ShouldShowReferralExtensionCta = true (trial about to end
 * or already ended; not Lifetime, not active Pro). Tapping shares the user's
 * referral deep-link via Telegram. What is promised (`inviteLine`,
 * `bonusShortLabel`) comes ready from /api/miniapp/referral, which picks it by
 * the user's state — so the banner never promises anything the activator
 * (TryActivateReferralService) does not give. No offer from the server
 * (Lifetime, yearly cap) → nothing is shown.
 */
export default function ReferralExtensionCta({ variant }: Props) {
  const [data, setData] = useState<{ link: string; shareText: string; bonusShortLabel: string; inviteLine: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    api.referral()
      .then((r) => {
        if (!cancelled && r.inviteLine && r.bonusShortLabel && !r.capReached) {
          setData({
            link: r.link,
            shareText: r.shareText,
            bonusShortLabel: r.bonusShortLabel,
            inviteLine: r.inviteLine,
          })
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  if (!data) return null

  function share() {
    if (data) shareReferral(data.link, data.shareText)
  }

  if (variant === 'inline') {
    return (
      <button
        data-testid="referral-extension-cta"
        onClick={share}
        className="relative z-[1] shrink-0 px-3 py-1.5 rounded-lg font-sans text-[11px] font-extrabold border-[1.5px] border-jewelInk"
        style={{ background: '#FFF', color: '#15100A' }}
      >
        {data.bonusShortLabel}
      </button>
    )
  }

  return (
    <div data-testid="referral-extension-cta" className="jewel-tile px-4 py-3 flex items-center gap-3" style={{ background: '#FBF6EC' }}>
      <div className="relative z-[1] text-[22px] leading-none shrink-0">🎁</div>
      <div className="relative z-[1] flex-1 min-w-0">
        <div className="font-sans text-[13px] font-extrabold text-jewelInk leading-tight">
          {data.bonusShortLabel.charAt(0).toUpperCase() + data.bonusShortLabel.slice(1)} — бесплатно
        </div>
        <div className="font-sans text-[11px] text-jewelInk-mid mt-0.5">
          {data.inviteLine}, когда он начнёт заниматься: пройдёт первый урок, добавит 5 слов или купит подписку.
        </div>
      </div>
      <button
        onClick={share}
        className="relative z-[1] shrink-0 px-3 py-1.5 rounded-lg font-sans text-[11px] font-extrabold border-[1.5px] border-jewelInk"
        style={{ background: '#F5B820', color: '#15100A' }}
      >
        позвать
      </button>
    </div>
  )
}
