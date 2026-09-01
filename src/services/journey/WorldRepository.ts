import type { World } from '@/types/journey'
import maclehoseTrail from '@/data/worlds/maclehose-trail.json'

export class WorldRepository {
  private worlds = new Map<string, World>([
    [maclehoseTrail.id, maclehoseTrail as World]
  ])
  get(id: string): World { const world = this.worlds.get(id); if (!world) throw new Error(`World not found: ${id}`); return world }
  getAll(): World[] { return [...this.worlds.values()] }
}
export const worldRepository = new WorldRepository()
