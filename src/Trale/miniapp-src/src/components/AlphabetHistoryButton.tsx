import { Screen } from '../types'

interface AlphabetHistoryButtonProps {
  moduleId: string
  navigate: (s: Screen) => void
}

export default function AlphabetHistoryButton({ moduleId, navigate }: AlphabetHistoryButtonProps) {
  return (
    <button
      className="jewel-tile w-full text-left"
      style={{ minHeight: 56 }}
      onClick={() => navigate({ kind: 'alphabet-history', moduleId })}
    >
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Georgian letter ა in navy circle */}
        <div className="rounded-full bg-navy flex items-center justify-center shrink-0" style={{ width: 40, height: 40 }}>
          <span className="font-geo text-[20px] font-bold text-cream leading-none">ა</span>
        </div>

        {/* Text block */}
        <div className="flex-1 min-w-0">
          <div className="font-sans text-[15px] font-bold text-jewelInk">История алфавита</div>
          <div className="font-sans text-[11px] text-jewelInk/60 mt-0.5">V в. · три стиля · ქართული</div>
        </div>

        {/* Arrow */}
        <span className="text-jewelInk/40 text-[18px] ml-auto shrink-0 leading-none">›</span>
      </div>
    </button>
  )
}
