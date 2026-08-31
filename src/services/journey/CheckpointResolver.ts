import type { Chapter, Checkpoint, World } from '@/types/journey'

export class CheckpointResolver {
  between(world: World, from: number, to: number, unlocked: string[]): Checkpoint[] {
    return world.checkpoints.filter(c => c.distance > from && c.distance <= to && !unlocked.includes(c.id)).sort((a,b) => a.distance-b.distance)
  }
  chaptersBetween(world: World, from: number, to: number, discovered: string[]): Chapter[] {
    return world.chapters.filter(c => c.startDistance > from && c.startDistance <= to && !discovered.includes(c.id)).sort((a,b) => a.startDistance-b.startDistance)
  }
  chapterAt(world: World, distance: number): Chapter { return world.chapters.find(c => distance >= c.startDistance && distance < c.endDistance) ?? world.chapters.at(-1)! }
  next(world: World, distance: number): Checkpoint | undefined { return world.checkpoints.find(c => c.distance > distance) }
}
export const checkpointResolver = new CheckpointResolver()
