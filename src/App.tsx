import { lazy, Suspense, useEffect } from 'react'
import { useFeeds } from './hooks/useFeeds'
import { useStore } from './store'
import Header from './components/Header'
import TimeRange from './components/TimeRange'
import IntelFeed from './components/IntelFeed'
import ThreatPanel from './components/ThreatPanel'
import InstabilityPanel from './components/InstabilityPanel'
import MarketTicker from './components/MarketTicker'
import SourceStatus from './components/SourceStatus'
import StatusBar from './components/StatusBar'
import CommandPalette from './components/CommandPalette'
import EventDetail from './components/EventDetail'
import BriefOverlay from './components/BriefOverlay'
import AlertsOverlay from './components/AlertsOverlay'
import LayerLegend from './components/LayerLegend'
import ClassificationBanner from './components/ClassificationBanner'
import ErrorBoundary from './components/ErrorBoundary'
import KeyboardHelp from './components/KeyboardHelp'

// Lazy-loaded so the heavy three.js / maplibre bundles load only when needed.
const GlobeView = lazy(() => import('./components/GlobeView'))
const MapView = lazy(() => import('./components/MapView'))

export default function App() {
  useFeeds()
  const setCommandOpen = useStore((s) => s.setCommandOpen)
  const setHelpOpen = useStore((s) => s.setHelpOpen)
  const togglePause = useStore((s) => s.togglePause)
  const setViewMode = useStore((s) => s.setViewMode)
  const select = useStore((s) => s.select)
  const viewMode = useStore((s) => s.viewMode)

  // Global hotkeys. Ignored while typing in an input/textarea.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandOpen(true)
        return
      }
      if (typing) return
      if (e.key === ' ') {
        e.preventDefault()
        togglePause()
      } else if (e.key === '2') {
        setViewMode('2d')
      } else if (e.key === '3') {
        setViewMode('3d')
      } else if (e.key === '?') {
        setHelpOpen(!useStore.getState().helpOpen)
      } else if (e.key === 'Escape') {
        setCommandOpen(false)
        setHelpOpen(false)
        select(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setCommandOpen, setHelpOpen, togglePause, setViewMode, select])

  return (
    <div className="h-full w-full flex flex-col bg-cmd-bg text-cmd-text overflow-hidden">
      <ClassificationBanner position="top" />
      <Header />
      <main className="flex-1 min-h-0 grid grid-cols-[330px_1fr_340px] gap-2 p-2">
        {/* Left column — live intel stream + system health */}
        <div className="flex flex-col gap-2 min-h-0">
          <ErrorBoundary label="INTEL FEED">
            <IntelFeed />
          </ErrorBoundary>
          <ErrorBoundary label="BIT">
            <SourceStatus />
          </ErrorBoundary>
        </div>

        {/* Center — tactical map / globe */}
        <div className="relative min-h-0 panel overflow-hidden cmd-grid">
          <ErrorBoundary label="MAP ENGINE">
            <Suspense
              fallback={
                <div className="absolute inset-0 flex items-center justify-center font-mono text-[11px] text-cmd-dim animate-flicker">
                  ░ INITIALIZING {viewMode === '2d' ? 'MAP' : 'GLOBE'} ENGINE ░
                </div>
              }
            >
              {viewMode === '2d' ? <MapView /> : <GlobeView />}
            </Suspense>
          </ErrorBoundary>
          <TimeRange />
          <LayerLegend />
          <BriefOverlay />
          <EventDetail />
        </div>

        {/* Right column — threat + instability + markets */}
        <div className="flex flex-col gap-2 min-h-0">
          <ErrorBoundary label="THREAT">
            <ThreatPanel />
          </ErrorBoundary>
          <ErrorBoundary label="CII">
            <InstabilityPanel />
          </ErrorBoundary>
          <ErrorBoundary label="MARKETS">
            <MarketTicker />
          </ErrorBoundary>
        </div>
      </main>
      <StatusBar />
      <ClassificationBanner position="bottom" />
      <AlertsOverlay />
      <CommandPalette />
      <KeyboardHelp />
    </div>
  )
}
