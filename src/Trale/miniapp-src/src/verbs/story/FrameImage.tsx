import React, { useState } from 'react'

interface Props {
  images: { placeholder: string; small: string; large: string }
  alt: string
  /** Под замком грузится только заглушка в 32 px; полный кадр не запрашивается, пока замок не снят. */
  locked: boolean
  children?: React.ReactNode
}

/**
 * Кадр комикса. Квадрат фиксирован, поэтому страница не прыгает, пока картинка едет по сети;
 * под ней лежит размытая заглушка, полный кадр проявляется поверх, когда загрузится.
 */
export default function FrameImage({ images, alt, locked, children }: Props) {
  const [shown, setShown] = useState(false)
  return (
    <div className="relative aspect-square overflow-hidden bg-cream-deep">
      <img
        src={images.placeholder}
        alt=""
        aria-hidden
        width={32}
        height={32}
        className={`absolute inset-0 w-full h-full object-cover blur-xl scale-125 transition-opacity duration-500 ${locked ? 'opacity-70' : 'opacity-100'}`}
      />
      {!locked && (
        <img
          src={images.small}
          srcSet={`${images.small} 480w, ${images.large} 800w`}
          sizes="(min-width: 480px) 440px, calc(100vw - 43px)"
          alt={alt}
          width={800}
          height={800}
          loading="lazy"
          decoding="async"
          data-testid="story-frame-picture"
          data-shown={shown}
          ref={img => { if (img?.complete && img.naturalWidth > 0) setShown(true) }}
          onLoad={() => setShown(true)}
          className="story-pic absolute inset-0 w-full h-full object-cover"
        />
      )}
      {children}
    </div>
  )
}
