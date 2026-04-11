import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Apply Telegram safe-area insets as CSS variables so content doesn't overlap
// with the device notch or Telegram's close/reload buttons in fullscreen mode.
function applySafeAreaInsets() {
  const tg = (window as any).Telegram?.WebApp
  if (!tg) return

  const root = document.documentElement
  const device = tg.safeAreaInset || {}
  const content = tg.contentSafeAreaInset || {}

  const safeTop = (device.top || 0) + (content.top || 0)
  const safeBottom = (device.bottom || 0) + (content.bottom || 0)

  root.style.setProperty('--safe-t', `${safeTop}px`)
  root.style.setProperty('--safe-b', `${safeBottom}px`)
}

const tg = (window as any).Telegram?.WebApp
if (tg) {
  try {
    tg.ready?.()
  } catch {}
  try {
    tg.expand?.()
  } catch {}

  // Fullscreen only on mobile — desktop Telegram has its own chrome
  const isMobile = ['ios', 'android'].includes(tg.platform || '')
  if (isMobile) {
    try {
      tg.requestFullscreen?.()
    } catch {}
  }

  // Prevent accidental mini-app closure when scrolling lesson content
  try {
    tg.disableVerticalSwipes?.()
  } catch {}

  // Match app palette
  try {
    tg.setHeaderColor?.('#FFF6E5')
  } catch {}
  try {
    tg.setBackgroundColor?.('#FFF6E5')
  } catch {}
  try {
    tg.setBottomBarColor?.('#FFF6E5')
  } catch {}

  applySafeAreaInsets()
  try {
    tg.onEvent?.('safeAreaChanged', applySafeAreaInsets)
    tg.onEvent?.('contentSafeAreaChanged', applySafeAreaInsets)
    tg.onEvent?.('viewportChanged', applySafeAreaInsets)
    tg.onEvent?.('fullscreenChanged', applySafeAreaInsets)
  } catch {}
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
