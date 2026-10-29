import { useEffect, useState } from 'react'
import type { TBMTelemetry } from '../domain/telemetry'
import { getTelemetryIssues } from '../domain/telemetryGuard'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Telemetry endpoint. Defaults to the same-origin path `/telemetry`, which the
 * Vite dev/preview server proxies to `http://localhost:8000/telemetry`
 * (see vite.config.ts), so no CORS setup is needed on the backend.
 * Override with `VITE_TELEMETRY_URL` to hit another host directly.
 */
export const TELEMETRY_URL: string =
  import.meta.env.VITE_TELEMETRY_URL ?? '/telemetry'

/** Nominal sampling period: 10 Hz. */
export const POLL_INTERVAL_MS = 100
/** Retry period while the endpoint is failing (avoids flooding the console). */
export const RETRY_INTERVAL_MS = 1000
/** A request that takes longer than this is treated as a failed fetch. */
export const REQUEST_TIMEOUT_MS = 2000
/** PRD 3.2 "10-Second Rule": no new sample for longer than this => link lost. */
export const STALL_THRESHOLD_MS = 10_000
/** How often the watchdog re-evaluates, independently of the polling loop. */
const WATCHDOG_TICK_MS = 250

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type LinkStatus = 'CONNECTING' | 'LIVE' | 'LOST'

/** Why the link is considered lost. Several can be true at the same time. */
export type LinkLossReason =
  | 'FETCH_FAILED'
  | 'POWER_LOSS_DETECTED'
  | 'DATA_STALLED'

export interface LinkState {
  /**
   * - CONNECTING: no response (or failure) observed yet.
   * - LIVE: data is arriving, advancing, and no loss condition holds.
   * - LOST: at least one entry in `reasons` holds => "COMMS LINK LOST" alarm.
   */
  status: LinkStatus
  reasons: readonly LinkLossReason[]
  /**
   * True when the values being displayed can no longer be trusted as current
   * (fetch failing or data stalled). A pure POWER_LOSS_DETECTED keeps this
   * false: sensors run on an isolated DC bus and are still live (PRD 3.1).
   */
  stale: boolean
  /** Transport/validation error of the latest failed fetch, if any. */
  lastError: string | null
  /** Seconds since a NEW sample was last received. Only set while `stale`. */
  silenceS: number | null
}

export interface UseTelemetryResult {
  /** Most recent valid payload (kept while stale), or null before the first one. */
  telemetry: TBMTelemetry | null
  link: LinkState
}

const INITIAL_LINK: LinkState = {
  status: 'CONNECTING',
  reasons: [],
  stale: false,
  lastError: null,
  silenceS: null,
}

// ---------------------------------------------------------------------------
// Infrastructure: fetch + error mapping
// ---------------------------------------------------------------------------

async function fetchTelemetry(signal: AbortSignal): Promise<TBMTelemetry> {
  const response = await fetch(TELEMETRY_URL, {
    signal,
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  const payload: unknown = await response.json()
  const issues = getTelemetryIssues(payload)
  if (issues.length > 0) {
    reportInvalidPayload(payload, issues)
    throw new Error(`INVALID PAYLOAD: ${issues[0]}`)
  }
  lastReportedIssues = null

  // Defensive normalization: the backend omits (or nulls) the re-arm lists
  // when no restart is in progress (e.g. IDLE). Guarantee arrays for the UI.
  const telemetry = payload as TBMTelemetry
  if (telemetry.extra?.safety?.safe_restart) {
    telemetry.extra.safety.safe_restart.sequence ??= []
    telemetry.extra.safety.safe_restart.completed ??= []
    telemetry.extra.safety.safe_restart.pending ??= []
  }
  return telemetry
}

/**
 * Signature of the last violation set that was logged. While the backend keeps
 * returning the same invalid shape (retry every second) the console is not
 * flooded: it logs again only when the set of violations changes.
 */
let lastReportedIssues: string | null = null

/** Makes a silently rejected payload visible in the browser console. */
function reportInvalidPayload(payload: unknown, issues: readonly string[]) {
  const signature = issues.join('\n')
  if (signature === lastReportedIssues) return
  lastReportedIssues = signature

  const state =
    typeof payload === 'object' && payload !== null && 'extra' in payload
      ? (payload as { extra?: { state?: unknown } }).extra?.state
      : undefined
  console.error(
    `Validation failed at payload (state: ${String(state ?? 'unknown')}):`,
    payload,
    `\n${issues.length} issue(s):\n - ${issues.join('\n - ')}`,
  )
}

function describeError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return `TIMEOUT > ${REQUEST_TIMEOUT_MS} ms`
  }
  if (error instanceof SyntaxError) return 'MALFORMED JSON'
  // fetch() rejects with TypeError on network failure (refused, DNS, CORS...).
  if (error instanceof TypeError) return 'NETWORK ERROR'
  if (error instanceof Error) return error.message.toUpperCase()
  return 'UNKNOWN ERROR'
}

function isSameLink(a: LinkState, b: LinkState): boolean {
  return (
    a.status === b.status &&
    a.stale === b.stale &&
    a.lastError === b.lastError &&
    a.silenceS === b.silenceS &&
    a.reasons.join() === b.reasons.join()
  )
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Polls `/telemetry` at 10 Hz and runs the Watchdog Protocol.
 *
 * The link is declared LOST (=> "COMMS LINK LOST" alarm) immediately when ANY of
 * these holds:
 *   1. the latest fetch failed (network error, timeout, HTTP error, bad payload);
 *   2. `extra.safety.power_loss_detected` is true;
 *   3. no NEW sample (`sample_index` / `timestamp_unix_ms`) was seen for more
 *      than 10 s, even if the fetches themselves keep succeeding.
 *
 * Polling never stops, so the link recovers by itself (PRD 3.1: reconnect on
 * reboot) as soon as the conditions clear.
 */
export function useTelemetry(): UseTelemetryResult {
  const [telemetry, setTelemetry] = useState<TBMTelemetry | null>(null)
  const [link, setLink] = useState<LinkState>(INITIAL_LINK)

  useEffect(() => {
    // All mutable watchdog state lives in this closure (one set per effect run),
    // so React StrictMode's mount/unmount/mount cycle cannot leak a poll loop.
    const lifecycle = new AbortController()
    let pollTimer: number | undefined
    let latest: TBMTelemetry | null = null
    let lastSampleKey: string | null = null
    /** performance.now() when a sample different from the previous one arrived. */
    let lastFreshAt: number | null = null
    let fetchError: string | null = null
    /** performance.now() at which the next poll is due (absolute schedule). */
    let nextDue = performance.now()

    const evaluate = () => {
      const now = performance.now()
      const silenceMs = lastFreshAt === null ? null : now - lastFreshAt

      const reasons: LinkLossReason[] = []
      if (fetchError !== null) reasons.push('FETCH_FAILED')
      if (latest?.extra.safety.power_loss_detected === true) {
        reasons.push('POWER_LOSS_DETECTED')
      }
      if (silenceMs !== null && silenceMs > STALL_THRESHOLD_MS) {
        reasons.push('DATA_STALLED')
      }

      const stale =
        reasons.includes('FETCH_FAILED') || reasons.includes('DATA_STALLED')
      const status: LinkStatus =
        reasons.length > 0 ? 'LOST' : latest !== null ? 'LIVE' : 'CONNECTING'

      const next: LinkState = {
        status,
        reasons,
        stale,
        lastError: fetchError,
        silenceS:
          stale && silenceMs !== null ? Math.round(silenceMs / 100) / 10 : null,
      }
      setLink((previous) => (isSameLink(previous, next) ? previous : next))
    }

    const poll = async () => {
      try {
        const signal = AbortSignal.any([
          lifecycle.signal,
          AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        ])
        const sample = await fetchTelemetry(signal)
        if (lifecycle.signal.aborted) return

        fetchError = null
        latest = sample
        const sampleKey = `${sample.extra.sample_index}:${sample.extra.timestamp_unix_ms}`
        if (sampleKey !== lastSampleKey) {
          // A different identity (also after a backend reboot, when the index
          // restarts) counts as fresh data. An identical one is a stalled feed.
          lastSampleKey = sampleKey
          lastFreshAt = performance.now()
        }
        setTelemetry(sample)
      } catch (error) {
        if (lifecycle.signal.aborted) return
        fetchError = describeError(error)
      }

      evaluate()

      // Absolute schedule: the average rate stays exactly 1/period instead of
      // drifting by fetch + render time. Never schedules in the past, so a slow
      // response delays the next poll but cannot cause a burst of requests.
      const period = fetchError === null ? POLL_INTERVAL_MS : RETRY_INTERVAL_MS
      const now = performance.now()
      nextDue = Math.max(nextDue + period, now)
      pollTimer = window.setTimeout(poll, nextDue - now)
    }

    // The stall condition must trigger even when no fetch completes (hung or
    // identical responses), so it cannot depend on the polling loop alone.
    const watchdogTimer = window.setInterval(evaluate, WATCHDOG_TICK_MS)
    void poll()

    return () => {
      lifecycle.abort()
      window.clearTimeout(pollTimer)
      window.clearInterval(watchdogTimer)
    }
  }, [])

  return { telemetry, link }
}
