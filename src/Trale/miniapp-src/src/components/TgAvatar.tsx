import React, { useEffect, useState } from 'react'
import { getInitData } from '../api'

// Фото человека из Telegram в кружке профиля. Сначала — ссылка, которую Telegram сам отдаёт мини-аппу (photo_url);
// нет её или не загрузилась — фото через наш сервер (Bot API); нет и там — значок человечка, как раньше.

let cached: string | null | undefined // undefined — ещё не узнавали, null — фото нет

async function serverPhoto(): Promise<string | null> {
  try {
    const r = await fetch('/api/miniapp/me/photo', { headers: { 'X-Telegram-Init-Data': getInitData() } })
    if (!r.ok) return null
    return URL.createObjectURL(await r.blob())
  } catch {
    return null
  }
}

function telegramPhotoUrl(): string | null {
  const url = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.photo_url
  return typeof url === 'string' && url.startsWith('https://') ? url : null
}

const Fallback = ({ size }: { size: number }) => (
  <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="#15100A" strokeWidth={1.9} strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="8.5" r="3.8" fill="#F5B820" />
    <path d="M4.5 20c1.2-3.800 4.200-5.800 7.500-5.800s6.300 2 7.500 5.800" />
  </svg>
)

export default function TgAvatar({ size = 44 }: { size?: number }) {
  const [src, setSrc] = useState<string | null | undefined>(() => (cached !== undefined ? cached : telegramPhotoUrl() ?? undefined))

  useEffect(() => {
    if (src !== undefined) return
    let alive = true
    serverPhoto().then(u => { cached = u; if (alive) setSrc(u) })
    return () => { alive = false }
  }, [src])

  if (!src) return <Fallback size={size} />
  return (
    <img
      src={src} alt="" width={size} height={size} draggable={false} data-testid="tg-avatar"
      className="h-full w-full rounded-full object-cover"
      onLoad={() => { cached = src }}
      // Ссылка Telegram не открылась — пробуем через сервер, потом значок.
      onError={() => { if (src === telegramPhotoUrl()) setSrc(undefined); else { cached = null; setSrc(null) } }}
    />
  )
}
