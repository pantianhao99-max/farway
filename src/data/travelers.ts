export interface TravelerOption {
  id: string
  name: string
  description: string
  image: string
}

export const DEFAULT_TRAVELER_ID = 'faraway-traveler'

export const travelerOptions: TravelerOption[] = [
  { id: DEFAULT_TRAVELER_ID, name: '远方旅人', description: '背起行囊，一起走向远方', image: '/static/worlds/traveler.png' }
]

export function travelerById(id?: string): TravelerOption {
  return travelerOptions.find(item => item.id === id) ?? travelerOptions[0]
}
