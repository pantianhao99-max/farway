import type { JourneyState } from '@/types/journey'
const KEY='faraway:journey:v1'
export const journeyStorage = {
  load():JourneyState|null { try { return uni.getStorageSync(KEY) || null } catch { return null } },
  save(state:JourneyState) { uni.setStorageSync(KEY, JSON.parse(JSON.stringify(state))) },
  clear() { uni.removeStorageSync(KEY) }
}
