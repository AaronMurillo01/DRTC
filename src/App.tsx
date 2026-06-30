import { lazy, Suspense, useEffect, useRef } from 'react'
import { useFeeds } from './hooks/useFeeds'
import { useLive } from './hooks/useLive'
import { useHistory } from './hooks/useHistory'
import { useStore } from './store'
import ReplayBar from './components/ReplayBar'

// Live-backend mode is on when a gateway URL is configured at build time.
const LIVE = !!import.meta.env.VITE_DRTC_API
import Header from './components/Header'
import TimeRange from './components/TimeRange'
import IntelFeed from './components/IntelFeed'
import ThreatPanel from './components/ThreatPanel'
import GroundSegment from './components/GroundSegment'
import ConjunctionWatch from './components/ConjunctionWatch'
import InstabilityPanel from './components/InstabilityPanel'
import MarketTicker from './components/MarketTicker'
import NeoPanel from './components/NeoPanel'
import SourceStatus from './components/SourceStatus'
import StatusBar from './components/StatusBar'
import CommandPalette from './components/CommandPalette'
import EventDetail from './components/EventDetail'
import BriefOverlay from './components/BriefOverlay'
import AlertsOverlay from './components/AlertsOverlay'
import LayerLegend from './components/LayerLegend'
import ErrorBoundary from './components/ErrorBoundary'
import KeyboardHelp from './components/KeyboardHelp'

// Lazy-loaded so the heavy three.js / maplibre bundles load only when needed.
const GlobeView = lazy(() => import('./components/GlobeView'))
const MapView = lazy(() => import('./components/MapView'))

export default function App() {
  // Standalone polling when no backend is configured; otherwise the websocket
  // drives the store and the client pollers stay off.
  useFeeds(!LIVE)
  useLive(LIVE)
  useHistory()
  const setCommandOpen = useStore((s) => s.setCommandOpen)
  const setHelpOpen = useStore((s) => s.setHelpOpen)
  const togglePause = useStore((s) => s.togglePause)
  const setViewMode = useStore((s) => s.setViewMode)
  const select = useStore((s) => s.select)
  const viewMode = useStore((s) => s.viewMode)
  const alertCount = useStore((s) => s.alerts.length)
  const audioAlerts = useStore((s) => s.audioAlerts)
  const prevAlerts = useRef(alertCount)
  const audioCtxRef = useRef<AudioContext | null>(null)

  // Sonar ping when a new critical alert arrives (if audio is enabled).
  useEffect(() => {
    if (audioAlerts && alertCount > prevAlerts.current) {
      try {
        if (!audioCtxRef.current) {
          const Ctx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
          audioCtxRef.current = new Ctx()
        }
        const ctx = audioCtxRef.current
        if (ctx.state === 'suspended') void ctx.resume()
        const t = ctx.currentTime
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(880, t)
        osc.frequency.exponentialRampToValueAtTime(440, t + 0.18)
        gain.gain.setValueAtTime(0.0001, t)
        gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
        osc.connect(gain).connect(ctx.destination)
        osc.start(t)
        osc.stop(t + 0.36)
      } catch {
        /* audio not available */
      }
    }
    prevAlerts.current = alertCount
  }, [alertCount, audioAlerts])

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
      } else if (e.key.toLowerCase() === 'g') {
        setViewMode('globe')
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
    <div className="h-full w-full flex flex-col bg-cmd-bg text-cmd-text overflow-y-auto xl:overflow-hidden">
      <Header />
      <main className="flex flex-col gap-2.5 p-2.5 xl:flex-1 xl:min-h-0 xl:grid xl:grid-cols-[336px_1fr_344px]">
        {/* Left column — live intel stream + system health */}
        <div className="order-2 xl:order-none flex flex-col gap-2.5 min-h-0 xl:overflow-y-auto">
          <ErrorBoundary label="INTEL FEED">
            <IntelFeed />
          </ErrorBoundary>
          <ErrorBoundary label="BIT">
            <SourceStatus />
          </ErrorBoundary>
        </div>

        {/* Center — tactical map / globe + replay timeline */}
        <div className="order-1 xl:order-none flex flex-col gap-2.5 min-h-0">
          <div className="relative h-[58vh] min-h-[380px] xl:h-auto xl:flex-1 xl:min-h-0 panel overflow-hidden cmd-grid">
            <ErrorBoundary label="MAP ENGINE">
              <Suspense
                fallback={
                  <div className="absolute inset-0 flex items-center justify-center font-mono text-[11px] text-cmd-dim animate-flicker">
                    ░ INITIALIZING {viewMode === 'globe' ? 'GLOBE' : 'MAP'} ENGINE ░
                  </div>
                }
              >
                {viewMode === 'globe' ? <GlobeView /> : <MapView />}
              </Suspense>
            </ErrorBoundary>
            <TimeRange />
            <LayerLegend />
            <BriefOverlay />
            <EventDetail />
          </div>
          <ErrorBoundary label="REPLAY">
            <ReplayBar />
          </ErrorBoundary>
        </div>

        {/* Right column — threat + instability + markets */}
        <div className="order-3 xl:order-none flex flex-col gap-2.5 min-h-0 xl:overflow-y-auto">
          <ErrorBoundary label="THREAT">
            <ThreatPanel />
          </ErrorBoundary>
          <ErrorBoundary label="GROUND SEGMENT">
            <GroundSegment />
          </ErrorBoundary>
          <ErrorBoundary label="CONJUNCTIONS">
            <ConjunctionWatch />
          </ErrorBoundary>
          <ErrorBoundary label="CII">
            <InstabilityPanel />
          </ErrorBoundary>
          <ErrorBoundary label="MARKETS">
            <MarketTicker />
          </ErrorBoundary>
          <ErrorBoundary label="NEO">
            <NeoPanel />
          </ErrorBoundary>
        </div>
      </main>
      <StatusBar />
      <AlertsOverlay />
      <CommandPalette />
      <KeyboardHelp />
    </div>
  )
}
