import { publicAssetUrl } from '@/services/presentation/publicAsset'

export type TravelerDirection =
  | 'right' | 'up-right' | 'up' | 'up-left'
  | 'left' | 'down-left' | 'down' | 'down-right'

const DIRECTIONS: TravelerDirection[] = [
  'right', 'up-right', 'up', 'up-left',
  'left', 'down-left', 'down', 'down-right'
]

/** Quantize a route tangent into the closest of the eight supplied poses. */
export function travelerDirection(dx: number, dy: number): TravelerDirection {
  if (Math.abs(dx) + Math.abs(dy) < 1e-9) return 'down'
  const octant = Math.round(Math.atan2(dy, dx) / (Math.PI / 4))
  return DIRECTIONS[(octant + 8) % 8]
}

export function travelerDirectionAt(
  progress: number,
  pointAt: (progress: number) => { x: number; y: number },
  sampleGap = .003
): TravelerDirection {
  const current = pointAt(progress)
  const sampleProgress = progress < 1
    ? Math.min(1, progress + sampleGap)
    : Math.max(0, progress - sampleGap)
  const next = pointAt(sampleProgress)
  const sign = progress < 1 ? 1 : -1
  return travelerDirection((next.x - current.x) * sign, (next.y - current.y) * sign)
}

export function travelerDirectionAsset(direction: TravelerDirection): string {
  return publicAssetUrl(`static/worlds/traveler-directions/${direction}.png`)
}
