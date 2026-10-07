import { useEffect, useState } from 'react'
import { api } from '../../api'
import { shareReferral } from '../../referralShare'

// Одна тихая строка под кнопками финиша: человек доволен — самое время позвать друга.
// Что именно он получит, решает сервер (пробный период идёт / доступ закончился / подписка),
// поэтому текст берём готовым из /api/miniapp/referral. Тем, кому бонус не положен
// (подписка навсегда, годовой лимит), и пока ответа нет — строки нет вовсе.

export default function InviteFriendLine() {
  const [offer, setOffer] = useState<{ link: string; shareText: string; inviteLine: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.resolve()
      .then(() => api.referral())
      .then(r => {
        if (!cancelled && r?.link && r.inviteLine && !r.capReached) {
          setOffer({ link: r.link, shareText: r.shareText, inviteLine: r.inviteLine })
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  if (!offer) return null

  return (
    <button
      type="button"
      data-testid="invite-friend-line"
      onClick={() => shareReferral(offer.link, offer.shareText)}
      className="min-h-[44px] w-full text-center text-[13px] text-jewelInk-mid underline underline-offset-2 decoration-jewelInk/30"
    >
      {offer.inviteLine}
    </button>
  )
}
