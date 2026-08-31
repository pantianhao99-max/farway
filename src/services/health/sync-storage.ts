const KEY='faraway:health-sync:v1'
type HealthSyncState={windowStartAt:string;consumedKm:number}

function todayStart(){const date=new Date();date.setHours(0,0,0,0);return date}

function fresh():HealthSyncState{return{windowStartAt:todayStart().toISOString(),consumedKm:0}}

function load():HealthSyncState {
  try {
    const saved=uni.getStorageSync(KEY) as HealthSyncState|undefined
    if(!saved)return fresh()
    const start=new Date(saved.windowStartAt)
    if(start.getTime()!==todayStart().getTime())return fresh()
    return saved
  } catch { return fresh() }
}

export const healthSyncStorage={
  pendingWindow(){return load()},
  consume(distanceKm:number){const state=load();state.consumedKm+=Math.max(0,distanceKm);uni.setStorageSync(KEY,state)},
  reset(){uni.removeStorageSync(KEY)}
}
