import type { World } from '@/types/journey'
import maclehoseTrail from '@/data/worlds/maclehose-trail.json'
import { publicAssetUrl } from '@/services/presentation/publicAsset'

const withPublicAssets=(world:World):World=>({
  ...world,
  assets:{
    ...world.assets,
    mapImage:world.assets.mapImage?publicAssetUrl(world.assets.mapImage):null,
    coverImage:world.assets.coverImage?publicAssetUrl(world.assets.coverImage):null,
    travelerImage:world.assets.travelerImage?publicAssetUrl(world.assets.travelerImage):null
  }
})

export class WorldRepository {
  private worlds = new Map<string, World>([
    [maclehoseTrail.id, withPublicAssets(maclehoseTrail as World)]
  ])
  get(id: string): World { const world = this.worlds.get(id); if (!world) throw new Error(`World not found: ${id}`); return world }
  getAll(): World[] { return [...this.worlds.values()] }
}
export const worldRepository = new WorldRepository()
