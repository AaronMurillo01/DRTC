import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** label shown in the fallback, e.g. the failing subsystem */
  label?: string
  fallback?: ReactNode
}
interface State {
  error: Error | null
}

// Defensive boundary so a single failing widget can't black out the whole COP.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[DRTC] ${this.props.label ?? 'component'} crashed:`, error, info.componentStack)
  }

  reset = () => this.setState({ error: null })

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="h-full w-full flex flex-col items-center justify-center gap-2 p-4 text-center">
          <div className="font-mono text-[11px] text-cmd-red tracking-widest">
            ⚠ {this.props.label ?? 'SUBSYSTEM'} FAULT
          </div>
          <div className="font-mono text-[10px] text-cmd-dim max-w-xs truncate">
            {this.state.error.message}
          </div>
          <button
            onClick={this.reset}
            className="mt-1 px-3 py-1 rounded border border-cmd-border hover:border-cmd-accent/60 font-mono text-[10px] text-cmd-accent"
          >
            RE-INITIALIZE
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
