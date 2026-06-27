import { useEffect } from 'react'
import { useFeeds } from './hooks/useFeeds'
import { useStore } from './store'
import Header from './components/Header'
import GlobeView from './components/GlobeView'
import IntelFeed from './components/IntelFeed'
import ThreatPanel from './components/ThreatPanel'
import InstabilityPanel from './components/InstabilityPanel'
import MarketTicker from './components/MarketTicker'
import SourceStatus from './components/SourceStatus'
import StatusBar from './components/StatusBar'
import CommandPalette from './components/CommandPalette'
import EventDetail from './components/EventDetail'

export default function App() {
  useFeeds()
  const setCommandOpen = useStore((s) => s.setCommandOpen)
  const togglePause = useStore((s) => s.togglePause)

  // Global hotkeys: ⌘K / Ctrl-K command palette, Space pause.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandOpen(true)
      }
      if (e.key === 'Escape') setCommandOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setCommandOpen, togglePause])

  return (
    <div className="h-full w-full flex flex-col bg-cmd-bg text-cmd-text overflow-hidden">
      <Header />
      <main className="flex-1 min-h-0 grid grid-cols-[330px_1fr_340px] gap-2 p-2">
        {/* Left column — live intel stream + source health */}
        <div className="flex flex-col gap-2 min-h-0">
          <IntelFeed />
          <SourceStatus />
        </div>

        {/* Center — tactical globe */}
        <div className="relative min-h-0 panel overflow-hidden cmd-grid">
          <GlobeView />
          <EventDetail />
        </div>

        {/* Right column — threat + instability + markets */}
        <div className="flex flex-col gap-2 min-h-0">
          <ThreatPanel />
          <InstabilityPanel />
          <MarketTicker />
        </div>
      </main>
      <StatusBar />
      <CommandPalette />
    </div>
  )
}
