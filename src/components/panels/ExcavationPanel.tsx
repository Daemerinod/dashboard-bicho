import type { TBMTelemetry } from '../../domain/telemetry'
import { limitSeverity } from '../../lib/severity'
import { Panel } from '../ui/Panel'
import { Readout } from '../ui/Readout'

interface ExcavationPanelProps {
  telemetry: TBMTelemetry | null
  stale: boolean
}

export function ExcavationPanel({ telemetry, stale }: ExcavationPanelProps) {
  const cutterhead = telemetry?.extra.cutterhead

  return (
    <Panel title="Excavation" stale={stale}>
      <dl>
        <Readout label="Cutterhead" value={cutterhead?.rpm} unit="rpm" decimals={1} />
        <Readout
          label="Load"
          value={cutterhead?.load_percent}
          unit="%"
          decimals={1}
          severity={limitSeverity(
            cutterhead?.load_percent,
            cutterhead?.load_limit_percent,
          )}
        />
        <Readout
          label="Current"
          value={cutterhead?.current_a}
          unit="A"
          decimals={2}
          severity={limitSeverity(
            cutterhead?.current_a,
            cutterhead?.current_limit_a,
          )}
        />
        <Readout
          label="Hydroshield"
          value={telemetry?.extra.hydroshield_pressure_bar}
          unit="bar"
          decimals={3}
        />
        <Readout label="Muck removal" value={cutterhead?.muck_removal_status} />
      </dl>
    </Panel>
  )
}
