export function formatNodeDistance(distance:number, locale='zh-Hans'):string{
  if(distance<=0.01) return locale.startsWith('en')?'Start':'起点'
  return locale.startsWith('en')?`At ${distance.toFixed(1)} km`:`第 ${distance.toFixed(1)} 公里`
}
export function formatCollectedNodeDistance(distance:number, locale='zh-Hans'):string{
  if(distance<=0.01) return locale.startsWith('en')?'Start':'起点'
  return locale.startsWith('en')?`Collected at ${distance.toFixed(1)} km`:`收录于第 ${distance.toFixed(1)} 公里`
}
