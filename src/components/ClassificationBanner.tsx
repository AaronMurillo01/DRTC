// DoD-style classification banner. This is an open-source OSINT demo, so the
// marking is UNCLASSIFIED — but the banner format mirrors operational systems.
export default function ClassificationBanner({ position }: { position: 'top' | 'bottom' }) {
  return (
    <div
      className={`shrink-0 h-5 bg-[#007a33] text-white flex items-center justify-center font-mono text-[10px] font-bold tracking-[0.25em] select-none ${
        position === 'top' ? 'border-b border-black/30' : 'border-t border-black/30'
      }`}
      aria-label="classification banner"
    >
      UNCLASSIFIED // FOR DEMONSTRATION ONLY // OSINT
    </div>
  )
}
