import { NO_VALUE, formatNumber } from '../../lib/format'
import { TEXT_CLASS, type Severity } from '../../lib/severity'

interface ReadoutProps {
  label: string
  /** Numbers are formatted with `decimals`; strings are shown verbatim. */
  value: number | string | null | undefined
  unit?: string
  decimals?: number
  severity?: Severity
}

/** One `label ........ value unit` row. Must be rendered inside a <dl>. */
export function Readout({
  label,
  value,
  unit,
  decimals = 1,
  severity = 'neutral',
}: ReadoutProps) {
  const text =
    typeof value === 'string'
      ? value.trim() === ''
        ? NO_VALUE
        : value
      : formatNumber(value, decimals)
  const missing = text === NO_VALUE

  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-zinc-800 py-1.5 last:border-b-0">
      <dt className="text-xs uppercase tracking-wider text-zinc-400">{label}</dt>
      <dd className="flex items-baseline gap-1.5">
        <span
          className={`break-all text-right font-mono text-lg font-semibold tabular-nums ${
            missing ? 'text-zinc-500' : TEXT_CLASS[severity]
          }`}
        >
          {text}
        </span>
        {unit !== undefined && (
          <span className="w-14 font-mono text-xs text-zinc-400">{unit}</span>
        )}
      </dd>
    </div>
  )
}
