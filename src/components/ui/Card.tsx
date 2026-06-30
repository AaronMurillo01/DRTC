import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface CardProps {
  title?: ReactNode
  /** right-aligned content in the header (status, counts, controls) */
  meta?: ReactNode
  icon?: LucideIcon
  className?: string
  /** override the default body padding/layout */
  bodyClassName?: string
  headerTitle?: string
  children: ReactNode
}

/**
 * Modular card shell. One place for the surface, hairline border and header
 * row, so feature components stay focused on their data instead of chrome.
 */
export function Card({
  title,
  meta,
  icon: Icon,
  className,
  bodyClassName = 'p-2',
  headerTitle,
  children,
}: CardProps) {
  return (
    <section className={`panel shrink-0 ${className ?? ''}`}>
      {(title || meta) && (
        <header className="panel-header" title={headerTitle}>
          <span className="flex items-center gap-2">
            {Icon && <Icon size={11} />}
            {title}
          </span>
          {meta && <span className="normal-case tracking-normal">{meta}</span>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}
