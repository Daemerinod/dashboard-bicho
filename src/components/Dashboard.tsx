import { useTelemetry } from '../services/useTelemetry'
import { ActionDeck } from './panels/ActionDeck'
import { ExcavationPanel } from './panels/ExcavationPanel'
import { HeaderBar } from './panels/HeaderBar'
import { LinkAlarmBanner } from './panels/LinkAlarmBanner'
import { NavigationPanel } from './panels/NavigationPanel'
import { PropulsionPanel } from './panels/PropulsionPanel'
import { SafetyPanel } from './panels/SafetyPanel'
import { SteeringPanel } from './panels/SteeringPanel'

/**
 * Presentation layer. Reads the state provided by `useTelemetry`; commands are
 * issued by `ActionDeck` through `useCommand`, an independent channel.
 */
export function Dashboard() {
  const { telemetry, link } = useTelemetry()
  const lost = link.status === 'LOST'

  return (
    <div
      className={`flex min-h-screen flex-col gap-2 border-4 bg-scada-bg p-2 text-zinc-100 ${
        lost ? 'border-red-500' : 'border-transparent'
      }`}
    >
      <HeaderBar telemetry={telemetry} link={link} />

      {lost && (
        <LinkAlarmBanner
          link={link}
          lastSampleIso={telemetry?.extra.timestamp_iso}
        />
      )}

      <main className="grid flex-1 grid-cols-1 content-start gap-2 md:grid-cols-2 wide:grid-cols-4">
        <NavigationPanel telemetry={telemetry} stale={link.stale} />
        <ExcavationPanel telemetry={telemetry} stale={link.stale} />
        <PropulsionPanel telemetry={telemetry} stale={link.stale} />
        <SteeringPanel telemetry={telemetry} stale={link.stale} />
        <SafetyPanel telemetry={telemetry} stale={link.stale} />
        <ActionDeck telemetry={telemetry} stale={link.stale} />
      </main>
    </div>
  )
}
