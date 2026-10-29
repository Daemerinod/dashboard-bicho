import { useCallback, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Normal-operation endpoint (PRD 2.1). Same-origin path proxied by Vite to the
 * backend on :8000 (see vite.config.ts). Override with `VITE_COMMAND_URL`.
 */
export const COMMAND_URL: string =
  import.meta.env.VITE_COMMAND_URL ?? '/command'

/**
 * Critical emergency endpoint (PRD 2.2): forces `E-STOPPED`, bypassing the
 * regular state machine. Override with `VITE_ESTOP_URL`.
 */
export const ESTOP_URL: string =
  import.meta.env.VITE_ESTOP_URL ?? '/api/plc/parada'

/** A command that takes longer than this is reported as "status unknown". */
export const COMMAND_TIMEOUT_MS = 5000
/** The e-stop contract is an immediate HTTP 200, so it gets a tighter budget. */
export const ESTOP_TIMEOUT_MS = 3000

/** `source` field required by `POST /api/plc/parada` (PRD 2.2). */
const ESTOP_SOURCE = 'HMI_Operator'
/** Value of `CommandResponse.command` for the emergency stop. */
export const EMERGENCY_STOP_COMMAND = 'emergency_stop'
/** `CommandResponse.state` when the server did not report one. */
export const UNKNOWN_STATE = 'UNKNOWN'

/**
 * Command identifiers sent in `CommandPayload.command` (single source of truth).
 * `power_on`, `arm`, `set_state`, `start_cutterhead` and `inflate_bladder` come
 * from the PRD. `stop_cutterhead`, `deflate_bladder` and `interlock_override`
 * are the symmetric / implied counterparts: the PRD does not name them, so
 * confirm them against the backend contract here and only here.
 *
 * `reset_estop` is the backend's mandatory first step of the Safe Restart when
 * the machine is `E-STOPPED`: the backend rejects `power_on` in that state, so
 * the sequence is `reset_estop` -> `power_on` -> `arm`.
 */
export const COMMANDS = {
  RESET_ESTOP: 'reset_estop',
  POWER_ON: 'power_on',
  ARM: 'arm',
  SET_STATE: 'set_state',
  START_CUTTERHEAD: 'start_cutterhead',
  STOP_CUTTERHEAD: 'stop_cutterhead',
  INFLATE_BLADDER: 'inflate_bladder',
  DEFLATE_BLADDER: 'deflate_bladder',
  INTERLOCK_OVERRIDE: 'interlock_override',
} as const

// ---------------------------------------------------------------------------
// Public types (PRD 2.1)
// ---------------------------------------------------------------------------

/** Union of every identifier in `COMMANDS` (e.g. `'reset_estop' | 'power_on' | ...`). */
export type CommandName = (typeof COMMANDS)[keyof typeof COMMANDS]

export interface CommandPayload {
  /** Only identifiers declared in `COMMANDS` compile. */
  command: CommandName
  /** e.g. `{ target: "READY" }` for `set_state`. */
  params?: Record<string, unknown>
}

export interface CommandResponse {
  /** true: accepted. false: rejected by an interlock (or the call failed). */
  ok: boolean
  /** Rejection reason or success confirmation, as worded by the server. */
  message: string
  command: string
  /** Resulting machine state (e.g. "IDLE"), or `UNKNOWN_STATE`. */
  state: string
}

export interface UseCommandResult {
  /** True while at least one request is in flight. */
  isPending: boolean
  /**
   * `POST /command`. Never throws: network failures, timeouts and malformed
   * replies resolve to `{ ok: false, message }` so the UI has a single path.
   * Resolves `ok: false` without sending if another request is in flight.
   */
  sendCommand: (payload: CommandPayload) => Promise<CommandResponse>
  /**
   * `POST /api/plc/parada`. Never throws and is never blocked by a pending
   * request: the emergency stop must always be sendable.
   */
  sendEmergencyStop: () => Promise<CommandResponse>
}

// ---------------------------------------------------------------------------
// Infrastructure: fetch + response/error mapping
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** `command` stays `string` here: it may be the e-stop id or echoed by the server. */
function failure(command: string, message: string): CommandResponse {
  return { ok: false, message, command, state: UNKNOWN_STATE }
}

function postJson(
  url: string,
  body: unknown,
  timeoutMs: number,
): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  })
}

/** Body as JSON, or `undefined` when it is empty / not JSON. Aborts propagate. */
async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch (error) {
    if (error instanceof SyntaxError) return undefined
    throw error
  }
}

function describeNetworkError(error: unknown, timeoutMs: number): string {
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return `NO RESPONSE > ${timeoutMs / 1000} s: COMMAND STATUS UNKNOWN`
  }
  // fetch() rejects with TypeError on network failure (refused, DNS, CORS...).
  if (error instanceof TypeError) return 'NETWORK ERROR: COMMAND NOT CONFIRMED'
  if (error instanceof Error) return error.message.toUpperCase()
  return 'UNKNOWN ERROR: COMMAND NOT CONFIRMED'
}

/**
 * Maps a `/command` reply to `CommandResponse`. A server-side rejection can
 * arrive as HTTP 200 or as 4xx with the same JSON body, so the body is read
 * either way. Anything that is not a recognizable reply is `ok: false`: an
 * unreadable answer must never be presented as an accepted command.
 */
function toCommandResponse(
  body: unknown,
  command: string,
  response: Response,
): CommandResponse {
  if (isRecord(body) && typeof body.ok === 'boolean') {
    const ok = body.ok && response.ok
    const message =
      typeof body.message === 'string' && body.message.trim() !== ''
        ? body.message
        : ok
          ? 'COMMAND ACCEPTED'
          : 'COMMAND REJECTED (NO REASON GIVEN)'
    return {
      ok,
      message,
      command: typeof body.command === 'string' ? body.command : command,
      state: typeof body.state === 'string' ? body.state : UNKNOWN_STATE,
    }
  }

  if (!response.ok) {
    const detail =
      isRecord(body) && typeof body.detail === 'string' ? `: ${body.detail}` : ''
    return failure(command, `HTTP ${response.status}${detail}`)
  }
  return failure(command, 'INVALID SERVER RESPONSE: COMMAND STATUS UNKNOWN')
}

/**
 * Maps the e-stop reply. The contract is "HTTP 200 = confirmed"; the body is
 * optional. A body that explicitly says `ok: false` still counts as failure.
 */
function toEmergencyStopResponse(
  body: unknown,
  response: Response,
): CommandResponse {
  if (!response.ok) {
    return failure(
      EMERGENCY_STOP_COMMAND,
      `HTTP ${response.status}: E-STOP NOT CONFIRMED`,
    )
  }
  const record = isRecord(body) ? body : {}
  if (record.ok === false) {
    return failure(
      EMERGENCY_STOP_COMMAND,
      typeof record.message === 'string' && record.message.trim() !== ''
        ? record.message
        : 'E-STOP NOT CONFIRMED',
    )
  }
  return {
    ok: true,
    message:
      typeof record.message === 'string' && record.message.trim() !== ''
        ? record.message
        : 'E-STOP ENGAGED',
    command: EMERGENCY_STOP_COMMAND,
    state: typeof record.state === 'string' ? record.state : 'E-STOPPED',
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Command channel to the backend (write side of the HMI; `useTelemetry` is the
 * read side and is deliberately independent of it).
 *
 * - Normal commands are serialized: one at a time, so a double tap can never
 *   deliver the same command twice.
 * - The emergency stop skips that gate and is always sent immediately.
 */
export function useCommand(): UseCommandResult {
  const [inFlight, setInFlight] = useState(0)
  // Mirror of `inFlight` readable synchronously from event handlers: state
  // would still hold the old value between two taps in the same frame.
  const inFlightRef = useRef(0)

  const track = useCallback(async <T>(task: () => Promise<T>): Promise<T> => {
    inFlightRef.current += 1
    setInFlight(inFlightRef.current)
    try {
      return await task()
    } finally {
      inFlightRef.current -= 1
      setInFlight(inFlightRef.current)
    }
  }, [])

  const sendCommand = useCallback(
    async (payload: CommandPayload): Promise<CommandResponse> => {
      if (inFlightRef.current > 0) {
        return failure(payload.command, 'ANOTHER COMMAND IS IN PROGRESS')
      }
      return track(async () => {
        try {
          const response = await postJson(
            COMMAND_URL,
            payload,
            COMMAND_TIMEOUT_MS,
          )
          return toCommandResponse(
            await readJson(response),
            payload.command,
            response,
          )
        } catch (error) {
          return failure(
            payload.command,
            describeNetworkError(error, COMMAND_TIMEOUT_MS),
          )
        }
      })
    },
    [track],
  )

  const sendEmergencyStop = useCallback(
    (): Promise<CommandResponse> =>
      track(async () => {
        try {
          const response = await postJson(
            ESTOP_URL,
            { source: ESTOP_SOURCE },
            ESTOP_TIMEOUT_MS,
          )
          return toEmergencyStopResponse(await readJson(response), response)
        } catch (error) {
          return failure(
            EMERGENCY_STOP_COMMAND,
            describeNetworkError(error, ESTOP_TIMEOUT_MS),
          )
        }
      }),
    [track],
  )

  return { isPending: inFlight > 0, sendCommand, sendEmergencyStop }
}
