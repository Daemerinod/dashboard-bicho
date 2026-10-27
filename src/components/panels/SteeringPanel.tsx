import type { TBMTelemetry } from '../../domain/telemetry'
import { limitSeverity } from '../../lib/severity'
import { Panel } from '../ui/Panel'
import { Readout } from '../ui/Readout'

interface SteeringPanelProps {
  telemetry: TBMTelemetry | null
  stale: boolean
}

export function SteeringPanel({ telemetry, stale }: SteeringPanelProps) {
  const steering = telemetry?.extra.steering

  return (
    <Panel title="Steering" stale={stale}>
      <dl>
        <Readout
          label="Motor A"
          value={steering?.motor_a_mm}
          unit="mm"
          decimals={2}
          severity={limitSeverity(steering?.motor_a_mm, steering?.stroke_limit_mm)}
        />
        <Readout
          label="Motor B"
          value={steering?.motor_b_mm}
          unit="mm"
          decimals={2}
          severity={limitSeverity(steering?.motor_b_mm, steering?.stroke_limit_mm)}
        />
        <Readout label="Angle error" value={steering?.angle_error_deg} unit="°" decimals={3} />
        <Readout label="Actuator torque" value={steering?.actuator_torque_nm} unit="N·m" decimals={1} />
        <Readout label="Ring loads" value={steering?.ring_loads_kn} unit="kN" decimals={1} />
        <Readout label="Est. pitch" value={steering?.estimated_pitch} unit="°" decimals={3} />
        <Readout label="Est. yaw" value={steering?.estimated_yaw} unit="°" decimals={3} />
      </dl>
    </Panel>
  )
}
