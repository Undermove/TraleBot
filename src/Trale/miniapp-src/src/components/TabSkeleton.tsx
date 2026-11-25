import React from 'react'

// Заглушка вкладки, пока данные едут: силуэт будущего экрана вместо большой буквы по центру.
// Мерцает только прозрачность, это дёшево для телефона.

export default function TabSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3 px-4 pt-3" data-testid="tab-skeleton" aria-label="Загружаем" role="status">
      <div className="tab-skel h-[84px] rounded-2xl" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl border-[1.5px] border-jewelInk/10 bg-cream-tile/60 p-3">
          <div className="tab-skel h-11 w-11 shrink-0 rounded-xl" style={{ animationDelay: `${i * 70}ms` }} />
          <div className="flex flex-1 flex-col gap-2">
            <div className="tab-skel h-3.5 rounded-full" style={{ width: `${72 - i * 7}%`, animationDelay: `${i * 70}ms` }} />
            <div className="tab-skel h-2.5 rounded-full" style={{ width: `${46 + i * 5}%`, animationDelay: `${i * 70}ms` }} />
          </div>
        </div>
      ))}
    </div>
  )
}
