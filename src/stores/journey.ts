import { computed, reactive, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Chapter, Checkpoint, JourneyEvent, JourneyState, Settlement, World, WorldProgress } from '@/types/journey'
import { worldRepository } from '@/services/journey/WorldRepository'
import { settlementManager } from '@/services/journey/SettlementManager'
import { journeyManager } from '@/services/journey/JourneyManager'
import { checkpointResolver } from '@/services/journey/CheckpointResolver'
import { journeyStorage } from '@/services/storage'
import { DEFAULT_TRAVELER_ID, travelerById } from '@/data/travelers'

const initialProgress=(world:World):WorldProgress=>({currentDistance:0,unlockedCheckpointIds:[world.checkpoints[0].id],discoveries:[{id:world.checkpoints[0].id,discoveredAt:new Date().toISOString()}],presentedDiscoveryIds:[world.checkpoints[0].id],discoveredChapterIds:[world.chapters[0].id],totalDistanceWalked:0,settlementHistory:[],startedAt:new Date().toISOString()})
const initialState=():JourneyState=>({activeWorldId:'misty-journey',...initialProgress(worldRepository.get('misty-journey')),welcomed:false,sessionDistance:0,progressByWorld:{},travelerId:DEFAULT_TRAVELER_ID})

export const useJourneyStore=defineStore('journey',()=>{
  const state=reactive<JourneyState>(initialState())
  const pendingSettlement=ref<Settlement|null>(null)
  const activeEvent=ref<JourneyEvent|null>(null)
  const displayDistance=ref(0)
  const isAnimating=ref(false)
  const world=computed(()=>worldRepository.get(state.activeWorldId))
  const chapter=computed(()=>checkpointResolver.chapterAt(world.value,displayDistance.value))
  const nextCheckpoint=computed(()=>checkpointResolver.next(world.value,state.currentDistance))
  const unlockedCheckpoints=computed(()=>world.value.checkpoints.filter(c=>state.unlockedCheckpointIds.includes(c.id)))
  const progress=computed(()=>Math.min(100,(state.currentDistance/world.value.totalDistance)*100))
  const sessionDistance=computed(()=>state.sessionDistance)
  const lifetimeDistance=computed(()=>state.currentDistance+Object.entries(state.progressByWorld).reduce((sum,[id,item])=>id===state.activeWorldId?sum:sum+item.currentDistance,0))
  const allUnlockedNodeCount=computed(()=>worldRepository.getAll().reduce((sum,item)=>{const itemProgress=item.id===state.activeWorldId?state:state.progressByWorld[item.id];return sum+(itemProgress?.unlockedCheckpointIds.length??0)},0))
  const allNodeCount=computed(()=>worldRepository.getAll().reduce((sum,item)=>sum+item.checkpoints.length,0))
  const selectedTraveler=computed(()=>travelerById(state.travelerId))

  function normalizeProgress(progress:WorldProgress, itemWorld:World):WorldProgress { const fallback=initialProgress(itemWorld); return {...fallback,...progress,unlockedCheckpointIds:[...new Set(progress.unlockedCheckpointIds??fallback.unlockedCheckpointIds)],discoveries:progress.discoveries??[],presentedDiscoveryIds:progress.presentedDiscoveryIds??(progress.discoveries??[]).map(item=>item.id),discoveredChapterIds:progress.discoveredChapterIds??fallback.discoveredChapterIds,settlementHistory:progress.settlementHistory??[]} }
  function hydrate(){ const saved=journeyStorage.load(); if(saved){const activeWorld=worldRepository.get(saved.activeWorldId);const normalized=normalizeProgress(saved,activeWorld);const progressByWorld=Object.fromEntries(Object.entries(saved.progressByWorld??{}).map(([id,item])=>[id,normalizeProgress(item,worldRepository.get(id))]));Object.assign(state,normalized,{welcomed:saved.welcomed??false,activeWorldId:saved.activeWorldId,sessionDistance:saved.sessionDistance??0,progressByWorld,travelerId:travelerById(saved.travelerId).id})} displayDistance.value=state.currentDistance }
  function persist(){ journeyStorage.save(state) }
  function setWelcomed(){state.welcomed=true;persist()}
  function selectTraveler(id:string){state.travelerId=travelerById(id).id;persist()}
  function prepareSettlement(km:number){if(isAnimating.value||state.currentDistance>=world.value.totalDistance)return; pendingSettlement.value=settlementManager.prepare(world.value,state,km)}
  function animateTo(target:number,duration:number){return new Promise<void>(resolve=>{const start=displayDistance.value,started=Date.now();const tick=()=>{const p=Math.min(1,(Date.now()-started)/duration);const ease=1-Math.pow(1-p,3);displayDistance.value=start+(target-start)*ease;if(p<1)setTimeout(tick,16);else resolve()};tick()})}
  async function play(){const settlement=pendingSettlement.value;if(!settlement)return;isAnimating.value=true;for(const event of settlement.events){activeEvent.value=event;if(event.type==='move'){const span=Math.abs(event.to-displayDistance.value);await animateTo(event.to,Math.max(450,Math.min(1500,span*180)));journeyManager.applyEvent(state,event)}else if(event.type==='checkpoint'||event.type==='chapter'||event.type==='complete'){journeyManager.applyEvent(state,event);persist();await waitForContinue()} }journeyManager.finalize(state,settlement,world.value);persist();pendingSettlement.value=null;activeEvent.value=null;isAnimating.value=false}
  let continueResolve:(()=>void)|null=null
  function waitForContinue(){return new Promise<void>(resolve=>{continueResolve=resolve})}
  function continueJourney(){continueResolve?.();continueResolve=null}
  function skipJourney(){const settlement=pendingSettlement.value;if(!settlement)return;for(const event of settlement.events)journeyManager.applyEvent(state,event);displayDistance.value=settlement.toDistance;journeyManager.finalize(state,settlement,world.value);persist();pendingSettlement.value=null;activeEvent.value=null;isAnimating.value=false;continueResolve?.();continueResolve=null}
  function snapshot():WorldProgress { return {currentDistance:state.currentDistance,unlockedCheckpointIds:[...state.unlockedCheckpointIds],discoveries:[...state.discoveries],presentedDiscoveryIds:[...state.presentedDiscoveryIds],discoveredChapterIds:[...state.discoveredChapterIds],totalDistanceWalked:state.totalDistanceWalked,settlementHistory:[...state.settlementHistory],startedAt:state.startedAt,completedAt:state.completedAt} }
  function selectWorld(id:string){if(id===state.activeWorldId)return;state.progressByWorld[state.activeWorldId]=snapshot();const next=state.progressByWorld[id] ?? initialProgress(worldRepository.get(id));state.activeWorldId=id;delete state.completedAt;Object.assign(state,next);displayDistance.value=state.currentDistance;pendingSettlement.value=null;activeEvent.value=null;isAnimating.value=false;persist()}
  function reset(){const fresh=initialProgress(world.value);Object.assign(state,fresh);delete state.completedAt;delete state.progressByWorld[state.activeWorldId];displayDistance.value=0;pendingSettlement.value=null;activeEvent.value=null;isAnimating.value=false;persist()}
  function checkpointById(id:string):Checkpoint|undefined{return world.value.checkpoints.find(c=>c.id===id)}
  function chapterById(id:string):Chapter|undefined{return world.value.chapters.find(c=>c.id===id)}
  return{state,world,chapter,nextCheckpoint,unlockedCheckpoints,progress,sessionDistance,lifetimeDistance,allUnlockedNodeCount,allNodeCount,selectedTraveler,pendingSettlement,activeEvent,displayDistance,isAnimating,hydrate,persist,setWelcomed,selectTraveler,prepareSettlement,play,continueJourney,skipJourney,reset,selectWorld,checkpointById,chapterById}
})
