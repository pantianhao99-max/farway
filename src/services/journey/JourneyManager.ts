import type { JourneyState, Settlement, World } from '@/types/journey'

export class JourneyManager {
  applyEvent(state: JourneyState, event: Settlement['events'][number]) {
    if (event.type === 'move') state.currentDistance = event.to
    if (event.type === 'checkpoint' && !state.unlockedCheckpointIds.includes(event.checkpoint.id)) {
      state.unlockedCheckpointIds.push(event.checkpoint.id)
      state.discoveries.push({id:event.checkpoint.id,discoveredAt:new Date().toISOString()})
      if (!state.presentedDiscoveryIds.includes(event.checkpoint.id)) state.presentedDiscoveryIds.push(event.checkpoint.id)
      if (typeof uni !== 'undefined' && typeof uni.vibrateShort === 'function') uni.vibrateShort({ type:'light' })
    }
    if (event.type === 'chapter' && !state.discoveredChapterIds.includes(event.chapter.id)) state.discoveredChapterIds.push(event.chapter.id)
    if (event.type === 'complete') state.completedAt = new Date().toISOString()
  }
  finalize(state: JourneyState, settlement: Settlement, world: World) {
    state.currentDistance = settlement.toDistance
    state.sessionDistance += settlement.addedDistance
    state.totalDistanceWalked += settlement.addedDistance
    state.settlementHistory.push({id:settlement.id,addedDistance:settlement.addedDistance,fromDistance:settlement.fromDistance,toDistance:settlement.toDistance,createdAt:new Date().toISOString()})
    if (state.currentDistance >= world.totalDistance && !state.completedAt) state.completedAt = new Date().toISOString()
  }
}
export const journeyManager = new JourneyManager()
