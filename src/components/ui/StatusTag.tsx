import type { ReactNode } from 'react'
import { OUTLINE_CLASS, SOLID_CLASS, type Severity } from '../../lib/severity'

interface StatusTagProps {
  severity: Severity
  /** Solid fill for states that demand attention; outline for passive ones. */
  solid?: boolean
  size?: 'md' | 'lg'
  children: ReactNode
}

/** Flat, square semantic badge (state, energized, e-stop, link...). */
export function StatusTag({
  severity,
  solid = false,
  size = 'md',
  children,
}: StatusTagProps) {
  const sizing =
    size === 'lg' ? 'px-3 py-1 text-xl tracking-widest' : 'px-2 py-0.5 text-sm'
  return (
    <span
      className={`inline-flex items-center rounded-none border font-mono font-bold uppercase ${sizing} ${
        solid ? SOLID_CLASS[severity] : OUTLINE_CLASS[severity]
      }`}
    >
      {children}
    </span>
  )
}
