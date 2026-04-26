import React, { useEffect, useRef, useState } from 'react'

type PlayerState = 'idle' | 'loading' | 'playing' | 'played' | 'error'

interface AudioPlayerProps {
  url: string
  onPlayed?: () => void
  onError?: () => void
}

export default function AudioPlayer({ url, onPlayed, onError }: AudioPlayerProps) {
  const [state, setState] = useState<PlayerState>('idle')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const playedOnceRef = useRef(false)

  useEffect(() => {
    playedOnceRef.current = false
    setState('idle')

    const audio = new Audio()
    audioRef.current = audio

    const onEnded = () => {
      setState('played')
      if (!playedOnceRef.current) {
        playedOnceRef.current = true
        onPlayed?.()
      }
    }
    const handleError = () => {
      setState('error')
      onError?.()
    }

    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', handleError)
    audio.src = url
    audio.preload = 'none'

    return () => {
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', handleError)
      audio.pause()
      audio.src = ''
    }
  }, [url])

  function handlePress() {
    const audio = audioRef.current
    if (!audio) return

    if (state === 'idle' || state === 'played') {
      setState('loading')
      audio.currentTime = 0
      audio
        .play()
        .then(() => setState('playing'))
        .catch(() => setState('error'))
    } else if (state === 'playing') {
      audio.pause()
      audio.currentTime = 0
      setState('idle')
    }
    // loading and error: no-op on tap
  }

  const isIdle = state === 'idle' || state === 'played'
  const ariaLabel =
    state === 'playing'
      ? 'Остановить'
      : state === 'played'
        ? 'Воспроизвести снова'
        : 'Воспроизвести грузинское слово'

  return (
    <button
      onClick={handlePress}
      aria-label={ariaLabel}
      title={state === 'error' ? 'Аудио недоступно' : undefined}
      disabled={state === 'loading'}
      style={{
        width: 62,
        height: 62,
        borderRadius: '50%',
        border: state === 'played' ? '1.5px solid #1B5FB0' : '1.5px solid #15100A',
        boxShadow: state === 'played' ? 'none' : '3px 3px 0 #15100A',
        background:
          state === 'played' ? '#FBF6EC'
          : state === 'playing' ? '#E01A3C'
          : '#1B5FB0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        cursor: state === 'loading' ? 'default' : 'pointer',
        transition: 'transform 80ms ease-out, box-shadow 80ms ease-out',
        WebkitTapHighlightColor: 'transparent',
      }}
      className="jewel-pressable"
    >
      {state === 'loading' && <SpinnerIcon />}
      {state === 'playing' && <StopIcon />}
      {state === 'error' && <ErrorIcon />}
      {(state === 'idle' || state === 'played') && (
        <PlayIcon color={state === 'played' ? '#1B5FB0' : '#FBF6EC'} />
      )}
    </button>
  )
}

function PlayIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <polygon points="6,3 19,11 6,19" fill={color} />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <rect x="3" y="3" width="12" height="12" rx="1.5" fill="#FBF6EC" />
    </svg>
  )
}

function ErrorIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <line x1="5" y1="5" x2="15" y2="15" stroke="#FBF6EC" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="15" y1="5" x2="5" y2="15" stroke="#FBF6EC" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className="anim-spin"
    >
      <circle cx="10" cy="10" r="7" stroke="rgba(251,246,236,0.3)" strokeWidth="2.5" />
      <path
        d="M10 3 A7 7 0 0 1 17 10"
        stroke="#FBF6EC"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
