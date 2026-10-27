import type { TBMTelemetry } from '../../domain/telemetry'
import { formatNumber } from '../../lib/format'
import { Panel } from '../ui/Panel'
import { Readout } from '../ui/Readout'

interface NavigationPanelProps {
  telemetry: TBMTelemetry | null
  stale: boolean
}

export function NavigationPanel({ telemetry, stale }: NavigationPanelProps) {
  // Breakthrough error lives in the safety block of the payload.
  const breakthroughError = telemetry?.extra.safety.target_breakthrough_error_m

  return (
    <Panel title="Navigation" stale={stale}>
      <dl>
        <Readout label="Chainage" value={telemetry?.chainage} unit="m" decimals={3} />
        <Readout label="Easting" value={telemetry?.easting} unit="m" decimals={3} />
        <Readout label="Northing" value={telemetry?.northing} unit="m" decimals={3} />
        <Readout label="Elevation" value={telemetry?.elevation} unit="m" decimals={3} />
        <Readout label="Roll" value={telemetry?.roll} unit="°" decimals={3} />
        <Readout label="Pitch" value={telemetry?.pitch} unit="°" decimals={3} />
        <Readout label="Heading" value={telemetry?.heading} unit="°" decimals={3} />
      </dl>

      <div className="mt-3 border border-zinc-600 px-3 py-2">
        <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
          Target breakthrough error
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-mono text-3xl font-bold tabular-nums text-zinc-100">
            {formatNumber(breakthroughError, 3)}
          </span>
          <span className="font-mono text-sm text-zinc-400">m</span>
        </div>
      </div>
    </Panel>
  )
}
