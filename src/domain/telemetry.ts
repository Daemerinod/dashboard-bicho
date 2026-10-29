/**
 * Domain model: TBM telemetry payload served by `GET /telemetry`.
 *
 * Every key mirrors the reference JSON one-to-one (snake_case is preserved on
 * purpose so the payload can be consumed without any mapping layer).
 *
 * IMPORTANT: the subsystem blocks (`cutterhead`, `propulsion`, `bladder`,
 * `steering`, `navigation`, `safety`, `comms`, `sim`) are nested INSIDE `extra`,
 * not at the root. Example: `telemetry.extra.cutterhead.rpm`.
 *
 * Values that only ever appear as `null` / `[]` in the reference payload (so
 * their real shape cannot be inferred) are typed `unknown` instead of guessed.
 */

/** Machine states reported in `extra.state`. */
export const MACHINE_STATES = [
  'POWER OFF',
  'E-STOPPED',
  'IDLE',
  'READY',
  'MINING',
  'FAULT',
] as const

export type MachineState = (typeof MACHINE_STATES)[number]

// ---------------------------------------------------------------------------
// extra.cutterhead
// ---------------------------------------------------------------------------

export interface Cutterhead {
  running: boolean
  rpm: number
  rpm_setpoint: number
  load_percent: number
  current_a: number
  torque_nm: number
  motor_temp_c: number
  load_limit_percent: number
  current_limit_a: number
  inhibited: boolean
  muck_removal_status: string
}

// ---------------------------------------------------------------------------
// extra.propulsion
// ---------------------------------------------------------------------------

export interface Propulsion {
  enabled: boolean
  speed_mm_min: number
  speed_setpoint_mm_min: number
  track_left_mm_min: number
  track_right_mm_min: number
  thrust_force_kn: number
  motor_temp_c: number
  load_percent: number
  current_a: number
  load_limit_percent: number
  current_limit_a: number
  inhibited: boolean
  slip_percent: number
  traction_status: string
}

// ---------------------------------------------------------------------------
// extra.bladder
// ---------------------------------------------------------------------------

export interface WirelessSensor {
  battery_percent: number
  signal_ms: number
  link_ok: boolean
  battery_critical_percent: number
  signal_lost_ms: number
}

export interface Bladder {
  pressure_bar: number
  setpoint_bar: number
  p_min_bar: number
  p_max_bar: number
  inflating: boolean
  relief_valve_open: boolean
  gripped: boolean
  wireless_sensor: WirelessSensor
}

// ---------------------------------------------------------------------------
// extra.steering
// ---------------------------------------------------------------------------

export interface Steering {
  motor_a_mm: number
  motor_b_mm: number
  motor_a_setpoint_mm: number
  motor_b_setpoint_mm: number
  stroke_limit_mm: number
  yaw_rate_deg_s: number
  inhibited: boolean
  angle_error_deg: number
  actuator_torque_nm: number
  ring_loads_kn: number
  estimated_pitch: number
  estimated_yaw: number
}

// ---------------------------------------------------------------------------
// extra.navigation
// ---------------------------------------------------------------------------

export interface Navigation {
  advance_rate_mm_min: number
  chainage_m: number
  mined_length_m: number
  mining_time_s: number
  ground_hardness_index: number
}

// ---------------------------------------------------------------------------
// extra.safety
// ---------------------------------------------------------------------------

export interface Interlock {
  description: string
  active: boolean
  latched: boolean
  /** Subsystems inhibited while this interlock is active (e.g. "propulsion"). */
  inhibits: string[]
  forces_fault: boolean
  trip_count: number
  /** Observed only as `null` in the reference payload; shape unconfirmed. */
  triggered_at: unknown
}

/** The six interlocks present in the reference payload, keyed by interlock id. */
export interface Interlocks {
  cutterhead_overload: Interlock
  propulsion_overload: Interlock
  bladder_underpressure: Interlock
  bladder_overpressure: Interlock
  comms_loss: Interlock
  bladder_sensor: Interlock
}

export type InterlockId = keyof Interlocks

export interface SafeRestart {
  required: boolean
  independent_actions_required: number
  /**
   * `sequence`, `completed` and `pending` are omitted by the backend when
   * there is no re-arm in progress, e.g. in the IDLE state.
   */
  /** Ordered restart actions, e.g. ["power_on", "arm"]. */
  sequence?: string[]
  completed?: string[]
  /** Actions still missing to re-arm the machine. */
  pending?: string[]
}

export interface Safety {
  estop_engaged: boolean
  hardware_estop: boolean
  /** Ids of the interlocks currently active (keys of `interlocks`). */
  active_interlocks: string[]
  latched_interlocks: string[]
  interlocks: Interlocks
  safe_restart: SafeRestart
  allowed_transitions: MachineState[]
  machine_energized: boolean
  power_loss_detected: boolean
  target_breakthrough_error_m: number
}

// ---------------------------------------------------------------------------
// extra.comms
// ---------------------------------------------------------------------------

export interface Comms {
  ok: boolean
  seconds_since_last_contact: number
  timeout_s: number
  uplink_ok: boolean
  uplink_failures: number
  uplink_sent: number
  network_healthy: boolean
  io_ok: boolean
  /** Observed only as `[]` in the reference payload; element type unconfirmed. */
  watchdog_armed_links: unknown[]
  watchdog_silence_s: number
}

// ---------------------------------------------------------------------------
// extra.sim
// ---------------------------------------------------------------------------

export interface Sim {
  version: string
  adapter: string
  tick_hz: number
  uptime_s: number
  commands_received: number
  /** Observed only as `null` in the reference payload; shape unconfirmed. */
  last_command: unknown
  /** Observed only as `[]` in the reference payload; element type unconfirmed. */
  injected_faults: unknown[]
}

// ---------------------------------------------------------------------------
// extra
// ---------------------------------------------------------------------------

export interface TBMTelemetryExtra {
  cutterhead_rpm: number
  cutterhead_load_percent: number
  bladder_pressure_bar: number
  hydroshield_pressure_bar: number
  propulsion_speed_mm_min: number
  bladder_sensor_battery_percent: number
  bladder_sensor_signal_ms: number
  state: MachineState
  previous_state: MachineState
  state_elapsed_s: number
  timestamp_iso: string
  timestamp_unix_ms: number
  sample_hz: number
  sample_index: number
  cutterhead: Cutterhead
  propulsion: Propulsion
  bladder: Bladder
  steering: Steering
  navigation: Navigation
  safety: Safety
  comms: Comms
  sim: Sim
}

// ---------------------------------------------------------------------------
// Root payload
// ---------------------------------------------------------------------------

export interface TBMTelemetry {
  team: string
  /** Unix time in SECONDS (see `extra.timestamp_unix_ms` for milliseconds). */
  timestamp: number
  mining: boolean
  chainage: number
  easting: number
  northing: number
  elevation: number
  roll: number
  pitch: number
  heading: number
  extra: TBMTelemetryExtra
}
