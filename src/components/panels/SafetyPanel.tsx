import type { Interlock, Interlocks, TBMTelemetry } from '../../domain/telemetry'
import { NO_VALUE } from '../../lib/format'
import { limitSeverity } from '../../lib/severity'
import { Panel } from '../ui/Panel'
import { Readout } from '../ui/Readout'
import { StatusTag } from '../ui/StatusTag'

interface SafetyPanelProps {
  telemetry: TBMTelemetry | null
  stale: boolean
}

/** "bladder_overpressure" -> "BLADDER OVERPRESSURE" */
function humanize(identifier: string): string {
  return identifier.replaceAll('_', ' ').toUpperCase()
}

/** Safe lookup: the backend may report an id this UI version does not know. */
function findInterlock(
  interlocks: Interlocks | undefined,
  id: string,
): Interlock | undefined {
  if (interlocks === undefined || !Object.hasOwn(interlocks, id)) {
    return undefined
  }
  return interlocks[id as keyof Interlocks]
}

const SECTION_TITLE =
  'mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400'

export function SafetyPanel({ telemetry, stale }: SafetyPanelProps) {
  const safety = telemetry?.extra.safety
  const comms = telemetry?.extra.comms
  // `undefined` means "no data yet", which must never read as "all clear".
  const activeInterlocks = safety?.active_interlocks
  const pendingActions = safety?.safe_restart.pending

  return (
    <Panel title="Safety & Interlocks" stale={stale} className="md:col-span-2 wide:col-span-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]">
        {/* E-stop + unresponsive IO */}
        <section aria-label="Emergency stop">
          <h3 className={SECTION_TITLE}>Emergency stop</h3>
          {safety === undefined ? (
            <StatusTag severity="neutral" size="lg">
              {NO_VALUE}
            </StatusTag>
          ) : safety.estop_engaged ? (
            <StatusTag severity="alarm" solid size="lg">
              E-STOP ENGAGED
            </StatusTag>
          ) : (
            <StatusTag severity="ok" size="lg">
              E-STOP RELEASED
            </StatusTag>
          )}

          <h3 className={`${SECTION_TITLE} mt-4`}>Critical IO</h3>
          <dl>
            <div className="flex items-baseline justify-between gap-3 border-b border-zinc-800 py-1.5">
              <dt className="text-xs uppercase tracking-wider text-zinc-400">IO status</dt>
              <dd>
                {comms === undefined ? (
                  <span className="font-mono text-lg font-semibold text-zinc-500">{NO_VALUE}</span>
                ) : (
                  <StatusTag severity={comms.io_ok ? 'ok' : 'alarm'} solid={!comms.io_ok}>
                    {comms.io_ok ? 'OK' : 'UNRESPONSIVE'}
                  </StatusTag>
                )}
              </dd>
            </div>
            <Readout
              label="Watchdog silence"
              value={comms?.watchdog_silence_s}
              unit="s"
              decimals={1}
              severity={limitSeverity(comms?.watchdog_silence_s, comms?.timeout_s)}
            />
          </dl>
        </section>

        {/* Active interlocks: the most prominent element of the panel */}
        <section aria-label="Active interlocks">
          <h3 className={SECTION_TITLE}>
            Active interlocks{' '}
            <span className="font-mono text-sm text-zinc-100">
              {activeInterlocks === undefined ? NO_VALUE : activeInterlocks.length}
            </span>
          </h3>
          {activeInterlocks === undefined ? (
            <p className="border border-zinc-700 px-3 py-4 font-mono text-sm text-zinc-500">
              {NO_VALUE}
            </p>
          ) : activeInterlocks.length === 0 ? (
            <p className="border border-emerald-500 px-3 py-4 font-mono text-sm font-bold uppercase text-emerald-500">
              No active interlocks
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {activeInterlocks.map((id) => {
                const detail = findInterlock(safety?.interlocks, id)
                return (
                  <li key={id} className="border border-red-500">
                    <div className="flex items-center justify-between gap-3 bg-red-500 px-3 py-1.5 font-mono text-base font-bold uppercase text-black">
                      <span>{humanize(id)}</span>
                      {detail?.forces_fault && (
                        <span className="text-xs tracking-widest">FORCES FAULT</span>
                      )}
                    </div>
                    {detail !== undefined && (
                      <div className="px-3 py-1.5 text-sm text-zinc-100">
                        <p>{detail.description}</p>
                        <p className="mt-1 flex flex-wrap gap-x-6 text-xs uppercase tracking-wider text-zinc-400">
                          <span>
                            Inhibits:{' '}
                            <span className="font-mono text-zinc-100">
                              {detail.inhibits.length > 0
                                ? detail.inhibits.join(', ')
                                : NO_VALUE}
                            </span>
                          </span>
                          <span>
                            Trips:{' '}
                            <span className="font-mono text-zinc-100">
                              {detail.trip_count}
                            </span>
                          </span>
                        </p>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Safe restart. The interlock override command lives in ActionDeck. */}
        <section aria-label="Safe restart">
          <h3 className={SECTION_TITLE}>Safe restart: pending actions</h3>
          {pendingActions === undefined ? (
            <p className="border border-zinc-700 px-3 py-2 font-mono text-sm text-zinc-500">
              {NO_VALUE}
            </p>
          ) : pendingActions.length === 0 ? (
            <StatusTag severity="ok" size="lg">
              NO PENDING ACTIONS
            </StatusTag>
          ) : (
            <ol className="flex flex-col gap-1.5">
              {pendingActions.map((action, index) => (
                <li
                  key={action}
                  className="flex items-center gap-3 border border-amber-500 px-3 py-1.5 font-mono text-sm font-bold uppercase text-amber-500"
                >
                  <span>{index + 1}.</span>
                  <span>{humanize(action)}</span>
                </li>
              ))}
            </ol>
          )}
          {safety !== undefined && (
            <p className="mt-1.5 text-xs uppercase tracking-wider text-zinc-400">
              Completed{' '}
              <span className="font-mono text-zinc-100">
                {safety.safe_restart.completed?.length ?? 0}/
                {safety.safe_restart.sequence?.length ?? 0}
              </span>
            </p>
          )}
        </section>
      </div>
    </Panel>
  )
}
