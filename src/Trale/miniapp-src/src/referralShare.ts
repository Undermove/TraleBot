// Открыть в Telegram окно «переслать другу» со своей ссылкой-приглашением и готовым текстом.
export function shareReferral(link: string, text: string) {
  const tg = (window as any).Telegram?.WebApp
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`
  if (tg?.openTelegramLink) {
    tg.openTelegramLink(shareUrl)
  } else {
    window.open(shareUrl, '_blank', 'noopener')
  }
}
