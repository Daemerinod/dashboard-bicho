import { useEffect, useState } from 'react'
import type { TBMTelemetry } from '../../domain/telemetry'
import {
  COMMANDS,
  UNKNOWN_STATE,
  useCommand,
  type CommandPayload,
  type CommandResponse,
} from '../../services/useCommand'
import { Panel } from '../ui/Panel'

interface ActionDeckProps {
  telemetry: TBMTelemetry | null
  /**
   * Telemetry is no longer current (fetch failing or data stalled). Commands
   * are locked because their enabling logic depends on the machine state, but
   * the emergency stop never is. The `Panel` `stale` dimming is intentionally
   * not used: it would fade the E-STOP button.
   */
  stale: boolean
}

/**
 * PRD 4: a rejection message must stay visible for 3-5 s. 4 s sits in the
 * middle of the window, so timer + render latency can never push it past 5 s.
 */
const ALERT_DURATION_MS = 4000

interface DeckAlert {
  response: CommandResponse
  /** Stays until acknowledged. Used when the e-stop could not be confirmed. */
  sticky: boolean
}

// ---------------------------------------------------------------------------
// Presentation helpers
// ---------------------------------------------------------------------------

type ButtonTone = 'neutral' | 'start' | 'warning' | 'caution' | 'estop'
type ButtonSize = 'md' | 'xl'

/** Class names are written out in full so Tailwind can detect them. */
const TONE_CLASS: Record<ButtonTone, string> = {
  neutral:
    'border-zinc-500 bg-transparent text-zinc-100 hover:bg-zinc-100 hover:text-black active:bg-zinc-300 active:text-black focus-visible:outline-zinc-100',
  start:
    'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-500 active:bg-emerald-700 focus-visible:outline-emerald-500',
  warning:
    'border-amber-500 bg-transparent text-amber-500 hover:bg-amber-500 hover:text-black active:bg-amber-400 active:text-black focus-visible:outline-amber-500',
  caution:
    'border-amber-500 bg-amber-500 text-black hover:bg-amber-400 active:bg-amber-300 focus-visible:outline-amber-500',
  estop:
    'border-red-600 bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus-visible:outline-white',
}

/** Disabled look mandated by the PRD, shared by every tone. */
const DISABLED_CLASS =
  'cursor-not-allowed border-neutral-700 bg-neutral-800 text-zinc-400 opacity-50'

const SIZE_CLASS: Record<ButtonSize, string> = {
  md: 'min-h-12 text-sm font-bold',
  xl: 'min-h-28 text-2xl font-black',
}

const SECTION_TITLE =
  'mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400'

/** "start_cutterhead" -> "START CUTTERHEAD" */
function humanize(identifier: string): string {
  return identifier.replaceAll('_', ' ').toUpperCase()
}

interface CommandButtonProps {
  label: string
  /** Optional second line (current state / what the press will do). */
  caption?: string
  tone: ButtonTone
  size?: ButtonSize
  disabled?: boolean
  className?: string
  onClick: () => void
}

/** Flat, square, mono button. No shadow, gradient or transition. */
function CommandButton({
  label,
  caption,
  tone,
  size = 'md',
  disabled = false,
  className = '',
  onClick,
}: CommandButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full flex-col items-center justify-center gap-0.5 rounded-none border px-3 py-2 text-center font-mono uppercase tracking-widest focus-visible:outline-2 focus-visible:outline-offset-2 ${
        SIZE_CLASS[size]
      } ${disabled ? DISABLED_CLASS : `cursor-pointer ${TONE_CLASS[tone]}`} ${className}`}
    >
      <span>{label}</span>
      {caption !== undefined && (
        <span className="text-[10px] font-normal tracking-wider">{caption}</span>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

/**
 * Command panel (PRD ActionDeck): the write side of the HMI. Reads only the
 * telemetry it is given (never fetches it) and talks to the backend through
 * `useCommand`.
 */
export function ActionDeck({ telemetry, stale }: ActionDeckProps) {
  const { isPending, sendCommand, sendEmergencyStop } = useCommand()
  const [alert, setAlert] = useState<DeckAlert | null>(null)
  const [confirmingOverride, setConfirmingOverride] = useState(false)

  const state = telemetry?.extra.state
  const pendingRestart = telemetry?.extra.safety.safe_restart.pending
  const cutterheadRunning = telemetry?.extra.cutterhead.running

  // --- Enabling logic -------------------------------------------------------

  const estopped = state === 'E-STOPPED'
  /** Safe Restart rule: only the restart sequence is allowed in these states. */
  const restartLocked = estopped || state === 'POWER OFF'
  /** No telemetry, or telemetry that is no longer current: state unknown. */
  const telemetryTrusted = telemetry !== null && !stale
  const canSend = telemetryTrusted && !isPending
  const operationsEnabled = canSend && !restartLocked

  // Safe Restart buttons are driven STRICTLY by the backend's `pending` list:
  // the head of the list is the only step the machine accepts right now. No
  // local state (E-STOPPED, acknowledged commands...) can enable or block them,
  // so the UI can never disagree with the backend about the sequence.
  const nextRestartStep: string | undefined = pendingRestart?.[0]
  const firstIsResetEstop = nextRestartStep === COMMANDS.RESET_ESTOP
  /** First button: RESET ESTOP or POWER ON, whichever the backend asks for. */
  const firstStepEnabled =
    canSend && (firstIsResetEstop || nextRestartStep === COMMANDS.POWER_ON)
  /** ARM: enabled exactly when it is the head of the pending list. */
  const armEnabled = canSend && nextRestartStep === COMMANDS.ARM

  // The override confirmation must not survive the button being locked.
  if (confirmingOverride && !operationsEnabled) setConfirmingOverride(false)

  // --- Feedback loop (PRD 4): auto-clear the alert --------------------------

  useEffect(() => {
    if (alert === null || alert.sticky) return
    // A new alert is a new object: the previous timer is cleaned up and the
    // full duration restarts.
    const timer = window.setTimeout(() => setAlert(null), ALERT_DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [alert])

  // --- Actions --------------------------------------------------------------

  /** Sends a normal command and surfaces the server's reason if rejected. */
  const execute = async (payload: CommandPayload): Promise<CommandResponse> => {
    const response = await sendCommand(payload)
    if (!response.ok) setAlert({ response, sticky: false })
    return response
  }

  const handleResetEstop = () => {
    void execute({ command: COMMANDS.RESET_ESTOP })
  }

  const handlePowerOn = () => {
    void execute({ command: COMMANDS.POWER_ON })
  }

  const handleArm = () => {
    void execute({ command: COMMANDS.ARM })
  }

  const handleSetState = (target: 'IDLE' | 'READY' | 'MINING') => {
    void execute({ command: COMMANDS.SET_STATE, params: { target } })
  }

  const handleToggleCutterhead = () => {
    if (cutterheadRunning === undefined) return
    void execute({
      command: cutterheadRunning
        ? COMMANDS.STOP_CUTTERHEAD
        : COMMANDS.START_CUTTERHEAD,
    })
  }

  const handleEmergencyStop = async () => {
    setConfirmingOverride(false)
    const response = await sendEmergencyStop()
    if (!response.ok) {
      setAlert({ response, sticky: true })
    } else {
      // Confirmed: a previous "could not confirm" alarm is no longer true.
      setAlert((current) => (current?.sticky === true ? null : current))
    }
  }

  const handleConfirmOverride = () => {
    setConfirmingOverride(false)
    void execute({ command: COMMANDS.INTERLOCK_OVERRIDE })
  }

  // --- Status line (fixed height: nothing below it moves when it changes) ---

  let statusText = 'Manual / engineering mode'
  let statusClass = 'border-zinc-700 text-zinc-400'
  if (telemetry === null) {
    statusText = 'No telemetry: commands locked. E-STOP remains available'
    statusClass = 'border-amber-500 text-amber-500'
  } else if (stale) {
    statusText = 'Telemetry stale: commands locked. E-STOP remains available'
    statusClass = 'border-amber-500 text-amber-500'
  } else if (isPending) {
    statusText = 'Sending command...'
    statusClass = 'border-zinc-500 text-zinc-100'
  } else if (restartLocked) {
    statusText =
      pendingRestart !== undefined && pendingRestart.length > 0
        ? `${state}: operations locked. Complete safe restart (${pendingRestart
            .map((step, index) => `${index + 1} ${humanize(step)}`)
            .join(', ')})`
        : `${state}: operations locked. Waiting for the backend restart sequence`
    statusClass = 'border-amber-500 text-amber-500'
  }

  return (
    <Panel title="Action Deck" className="md:col-span-2 wide:col-span-4">
      <div className="flex flex-col gap-3">
        {alert !== null ? (
          <div
            role="alert"
            className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-1 rounded-none border border-red-500 bg-red-500 px-3 py-2 font-mono text-black"
          >
            <strong className="text-sm font-black uppercase tracking-widest">
              {humanize(alert.response.command)}
            </strong>
            <span className="text-sm font-bold">{alert.response.message}</span>
            {alert.response.state !== UNKNOWN_STATE && (
              <span className="text-xs font-bold uppercase tracking-wider">
                State {alert.response.state}
              </span>
            )}
            {alert.sticky && (
              <button
                type="button"
                onClick={() => setAlert(null)}
                className="ml-auto cursor-pointer rounded-none border border-black bg-transparent px-3 py-1 text-xs font-bold uppercase tracking-widest text-black hover:bg-black hover:text-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
              >
                Acknowledge
              </button>
            )}
          </div>
        ) : (
          <p
            role="status"
            className={`flex min-h-14 items-center rounded-none border px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider ${statusClass}`}
          >
            {statusText}
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-2 wide:grid-cols-4">
          {/* 1. Safe restart */}
          <section aria-label="Safe restart commands">
            <h3 className={SECTION_TITLE}>1 · Safe restart</h3>
            <div className="grid grid-cols-2 gap-2">
              <CommandButton
                label={firstIsResetEstop ? 'Reset estop' : 'Power on'}
                tone="start"
                disabled={!firstStepEnabled}
                onClick={firstIsResetEstop ? handleResetEstop : handlePowerOn}
              />
              <CommandButton
                label="Arm"
                tone="start"
                disabled={!armEnabled}
                onClick={handleArm}
              />
            </div>
            {restartLocked && (
              <p className="mt-1.5 font-mono text-xs uppercase tracking-wider text-amber-500">
                {nextRestartStep !== undefined
                  ? `Next step: press ${humanize(nextRestartStep)}`
                  : 'Waiting for the backend restart sequence'}
              </p>
            )}
          </section>

          {/* 2. State machine */}
          <section aria-label="State transitions">
            <h3 className={SECTION_TITLE}>2 · State machine</h3>
            <div className="grid grid-cols-2 gap-2">
              <CommandButton
                label="Set idle"
                tone="neutral"
                disabled={!operationsEnabled}
                onClick={() => handleSetState('IDLE')}
              />
              <CommandButton
                label="Set ready"
                tone="neutral"
                disabled={!operationsEnabled}
                onClick={() => handleSetState('READY')}
              />
              <CommandButton
                label="Set mining"
                tone="neutral"
                disabled={!operationsEnabled}
                onClick={() => handleSetState('MINING')}
              />
            </div>
          </section>

          {/* 3. Subsystems */}
          <section aria-label="Manual subsystem control">
            <h3 className={SECTION_TITLE}>3 · Subsystems</h3>
            <div className="grid grid-cols-2 gap-2">
              <CommandButton
                className="col-span-2"
                label="Toggle cutterhead"
                caption={
                  cutterheadRunning === undefined
                    ? undefined
                    : cutterheadRunning
                      ? 'Running: press to stop'
                      : 'Stopped: press to start'
                }
                tone="neutral"
                disabled={!operationsEnabled || cutterheadRunning === undefined}
                onClick={handleToggleCutterhead}
              />
              <CommandButton
                label="Inflate bladder"
                tone="neutral"
                disabled={!operationsEnabled}
                onClick={() =>
                  void execute({ command: COMMANDS.INFLATE_BLADDER })
                }
              />
              <CommandButton
                label="Deflate bladder"
                tone="neutral"
                disabled={!operationsEnabled}
                onClick={() =>
                  void execute({ command: COMMANDS.DEFLATE_BLADDER })
                }
              />
            </div>
          </section>

          {/* 4. Critical safety */}
          <section aria-label="Critical safety">
            <h3 className={SECTION_TITLE}>4 · Critical safety</h3>
            <div className="flex flex-col gap-2">
              {/* Never disabled: not gated by telemetry, lock state or pending. */}
              <CommandButton
                label="Engage E-STOP"
                tone="estop"
                size="xl"
                onClick={() => void handleEmergencyStop()}
              />
              {confirmingOverride ? (
                <div
                  role="alertdialog"
                  aria-label="Confirm interlock override"
                  className="rounded-none border border-amber-500 p-2"
                >
                  <p className="font-mono text-xs font-bold uppercase tracking-wider text-amber-500">
                    Bypass safety interlocks? Requires approval from TBC
                    competition inspectors.
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <CommandButton
                      label="Confirm bypass"
                      tone="caution"
                      onClick={handleConfirmOverride}
                    />
                    <CommandButton
                      label="Cancel"
                      tone="neutral"
                      onClick={() => setConfirmingOverride(false)}
                    />
                  </div>
                </div>
              ) : (
                <CommandButton
                  label="Interlock override"
                  tone="warning"
                  disabled={!operationsEnabled}
                  onClick={() => setConfirmingOverride(true)}
                />
              )}
            </div>
          </section>
        </div>
      </div>
    </Panel>
  )
}
