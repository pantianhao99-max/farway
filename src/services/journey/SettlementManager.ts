import type { JourneyState, Settlement, World } from '@/types/journey'
import { journeyProgressCalculator } from './JourneyProgressCalculator'

export class SettlementManager {
  prepare(world: World, state: JourneyState, distanceAdded: number): Settlement {
    return journeyProgressCalculator.createSettlement(world,state.currentDistance,distanceAdded,state.unlockedCheckpointIds,state.discoveredChapterIds)
  }
}
export const settlementManager = new SettlementManager()
