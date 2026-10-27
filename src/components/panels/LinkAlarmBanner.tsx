import { NO_VALUE, formatNumber } from '../../lib/format'
import {
  STALL_THRESHOLD_MS,
  type LinkLossReason,
  type LinkState,
} from '../../services/useTelemetry'

interface LinkAlarmBannerProps {
  link: LinkState
  /** `extra.timestamp_iso` of the last payload received, if any. */
  lastSampleIso: string | undefined
}

function describeReason(reason: LinkLossReason, link: LinkState): string {
  switch (reason) {
    case 'FETCH_FAILED':
      return link.lastError === null
        ? 'Fetch failed'
        : `Fetch failed: ${link.lastError}`
    case 'POWER_LOSS_DETECTED':
      return 'Machine power loss detected'
    case 'DATA_STALLED':
      return `Telemetry stalled > ${STALL_THRESHOLD_MS / 1000} s`
  }
}

/** Full-width alarm shown the moment the watchdog declares the link lost. */
export function LinkAlarmBanner({ link, lastSampleIso }: LinkAlarmBannerProps) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-x-8 gap-y-2 rounded-none border border-red-500 bg-red-500 px-4 py-3 text-black"
    >
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="size-4 bg-black motion-safe:animate-pulse" />
        <strong className="text-2xl font-black uppercase tracking-widest">
          COMMS LINK LOST
        </strong>
      </div>

      <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm font-bold uppercase tracking-wider">
        {link.reasons.map((reason) => (
          <li key={reason}>{describeReason(reason, link)}</li>
        ))}
      </ul>

      <div className="ml-auto text-right text-xs font-bold uppercase tracking-wider">
        {link.silenceS !== null && (
          <div>
            No new data for{' '}
            <span className="font-mono text-sm tabular-nums">
              {formatNumber(link.silenceS, 1)} s
            </span>
          </div>
        )}
        <div>
          Last sample{' '}
          <span className="font-mono text-sm tabular-nums">
            {lastSampleIso ?? NO_VALUE}
          </span>
        </div>
      </div>
    </div>
  )
}
