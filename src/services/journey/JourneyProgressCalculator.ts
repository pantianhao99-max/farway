import type { JourneyEvent, Settlement, World } from '@/types/journey'
import { checkpointResolver } from './CheckpointResolver'

export class JourneyProgressCalculator {
  createSettlement(world: World, current: number, added: number, unlocked: string[], chapters: string[]): Settlement {
    const target = Math.min(world.totalDistance, Math.max(current, current + added))
    const checkpoints = checkpointResolver.between(world, current, target, unlocked)
    const chapterEvents = checkpointResolver.chaptersBetween(world, current, target, chapters)
    const moments: { distance:number; event:JourneyEvent }[] = []
    checkpoints.forEach(checkpoint => moments.push({ distance:checkpoint.distance, event:{ type:'checkpoint', checkpoint } }))
    chapterEvents.forEach(chapter => moments.push({ distance:chapter.startDistance, event:{ type:'chapter', chapter } }))
    moments.sort((a,b) => a.distance-b.distance || (a.event.type === 'chapter' ? -1 : 1))
    const events: JourneyEvent[] = []
    let last = current
    moments.forEach(({distance,event}) => { if (distance > last) events.push({type:'move',to:distance}); events.push(event); last=distance })
    if (target > last) events.push({type:'move',to:target})
    if (target >= world.totalDistance && current < world.totalDistance) events.push({type:'complete'})
    return { id:`settlement-${Date.now()}`, addedDistance:target-current, fromDistance:current, toDistance:target, events }
  }
}
export const journeyProgressCalculator = new JourneyProgressCalculator()
