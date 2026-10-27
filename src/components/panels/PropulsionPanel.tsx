import type { TBMTelemetry } from '../../domain/telemetry'
import { limitSeverity, type Severity } from '../../lib/severity'
import { Panel } from '../ui/Panel'
import { Readout } from '../ui/Readout'

interface PropulsionPanelProps {
  telemetry: TBMTelemetry | null
  stale: boolean
}

/**
 * Bladder pressure against the band reported by the machine:
 *  - above p_max_bar                          -> alarm (overpressure interlock)
 *  - below p_min_bar while propulsion enabled -> warning (at rest 0 bar is normal)
 */
function bladderSeverity(telemetry: TBMTelemetry | null): Severity {
  if (telemetry === null) return 'neutral'
  const { bladder_pressure_bar: pressure } = telemetry.extra
  const { p_min_bar, p_max_bar } = telemetry.extra.bladder
  if (pressure > p_max_bar) return 'alarm'
  if (telemetry.extra.propulsion.enabled && pressure < p_min_bar) return 'warn'
  return 'neutral'
}

export function PropulsionPanel({ telemetry, stale }: PropulsionPanelProps) {
  const propulsion = telemetry?.extra.propulsion

  return (
    <Panel title="Propulsion" stale={stale}>
      <dl>
        <Readout label="Speed" value={propulsion?.speed_mm_min} unit="mm/min" decimals={1} />
        <Readout label="Thrust" value={propulsion?.thrust_force_kn} unit="kN" decimals={1} />
        <Readout
          label="Current"
          value={propulsion?.current_a}
          unit="A"
          decimals={2}
          severity={limitSeverity(propulsion?.current_a, propulsion?.current_limit_a)}
        />
        <Readout label="Slip" value={propulsion?.slip_percent} unit="%" decimals={1} />
        <Readout label="Traction" value={propulsion?.traction_status} />
        <Readout
          label="Bladder pressure"
          value={telemetry?.extra.bladder_pressure_bar}
          unit="bar"
          decimals={2}
          severity={bladderSeverity(telemetry)}
        />
      </dl>
    </Panel>
  )
}
