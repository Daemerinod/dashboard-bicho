import type { ReactNode } from 'react'

interface PanelProps {
  title: string
  /** Displayed values are not live: dim them and flag the panel. */
  stale?: boolean
  className?: string
  children: ReactNode
}

/** Square-cornered, flat panel frame shared by every dashboard widget. */
export function Panel({
  title,
  stale = false,
  className = '',
  children,
}: PanelProps) {
  return (
    <section
      aria-label={title}
      className={`flex flex-col rounded-none border border-zinc-700 bg-scada-panel ${className}`}
    >
      <header className="flex items-center justify-between border-b border-zinc-700 px-3 py-1.5">
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-300">
          {title}
        </h2>
        {stale && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500">
            Stale
          </span>
        )}
      </header>
      <div className={`flex-1 p-3 ${stale ? 'opacity-40' : ''}`}>{children}</div>
    </section>
  )
}
