import type { ReactNode } from 'react'
import type { TBMTelemetry } from '../../domain/telemetry'
import { NO_VALUE } from '../../lib/format'
import { stateSeverity, type Severity } from '../../lib/severity'
import type { LinkState, LinkStatus } from '../../services/useTelemetry'
import { StatusTag } from '../ui/StatusTag'

interface HeaderBarProps {
  telemetry: TBMTelemetry | null
  link: LinkState
}

const LINK_SEVERITY: Record<LinkStatus, Severity> = {
  CONNECTING: 'warn',
  LIVE: 'ok',
  LOST: 'alarm',
}

function Cell({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
        {caption}
      </span>
      {children}
    </div>
  )
}

export function HeaderBar({ telemetry, link }: HeaderBarProps) {
  const state = telemetry?.extra.state
  const energized = telemetry?.extra.safety.machine_energized
  const networkOk = telemetry?.extra.comms.ok

  return (
    <header className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-none border border-zinc-700 bg-scada-panel px-4 py-3">
      <div className="mr-auto">
        <h1 className="text-lg font-bold uppercase tracking-widest text-zinc-100">
          B.I.C.H.O. TBM Operator Station
        </h1>
        <p className="text-xs uppercase tracking-wider text-zinc-400">
          {telemetry?.team ?? NO_VALUE}
        </p>
      </div>

      {/* Machine status: dimmed whenever the values are not live. */}
      <div
        className={`flex flex-wrap items-end gap-x-8 gap-y-3 ${
          link.stale ? 'opacity-40' : ''
        }`}
      >
        <Cell caption="State">
          <StatusTag
            severity={stateSeverity(state)}
            solid={stateSeverity(state) !== 'neutral'}
            size="lg"
          >
            {state ?? NO_VALUE}
          </StatusTag>
        </Cell>

        <Cell caption="Mining">
          {telemetry === null ? (
            <StatusTag severity="neutral">{NO_VALUE}</StatusTag>
          ) : (
            <StatusTag severity={telemetry.mining ? 'ok' : 'neutral'} solid={telemetry.mining}>
              {telemetry.mining ? 'YES' : 'NO'}
            </StatusTag>
          )}
        </Cell>

        <Cell caption="Machine power">
          {energized === undefined ? (
            <StatusTag severity="neutral">{NO_VALUE}</StatusTag>
          ) : (
            <StatusTag severity={energized ? 'ok' : 'neutral'} solid={energized}>
              {energized ? 'ENERGIZED' : 'DE-ENERGIZED'}
            </StatusTag>
          )}
        </Cell>

        <Cell caption="Network">
          {networkOk === undefined ? (
            <StatusTag severity="neutral">{NO_VALUE}</StatusTag>
          ) : (
            <StatusTag severity={networkOk ? 'ok' : 'alarm'} solid={!networkOk}>
              {networkOk ? 'OK' : 'FAULT'}
            </StatusTag>
          )}
        </Cell>
      </div>

      {/* Dashboard <-> backend link: driven by the watchdog, never dimmed. */}
      <Cell caption="Telemetry link">
        <StatusTag severity={LINK_SEVERITY[link.status]} solid={link.status !== 'LIVE'}>
          {link.status}
        </StatusTag>
      </Cell>

      <div className="text-right">
        <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
          Last sample (UTC)
        </div>
        <div className="font-mono text-sm tabular-nums text-zinc-100">
          {telemetry?.extra.timestamp_iso ?? NO_VALUE}
        </div>
      </div>
    </header>
  )
}
