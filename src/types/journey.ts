export type CheckpointType = 'home'|'field'|'bridge'|'monument'|'forest'|'station'|'lake'|'camp'|'tower'|'village'|'river'|'pass'|'ruin'|'summit'|'view'
export interface PathPoint { x:number; y:number }
export interface SvgRouteSegment { d:string; reverse?:boolean }
export interface Chapter { id:string; number:number; name:string; startDistance:number; endDistance:number; elevationChange:number; atmosphere:string; colors:[string,string] }
export interface WorldAssets { mapImage:string|null; coverImage:string|null; travelerImage:string|null; mapAspectRatio:number; mapMode?:'illustrated'|'osm' }
export interface Checkpoint { id:string; name:string; distance:number; type:CheckpointType; hiddenBeforeUnlock:boolean; shortDescription:string; chapterId:string; mapX:number; mapY:number; illustration:string; artworkImage?:string|null; mapPoint?:boolean }
export interface World { id:string; name:string; subtitle:string; description:string; totalDistance:number; assets:WorldAssets; chapters:Chapter[]; checkpoints:Checkpoint[]; pathPoints:PathPoint[]; routeSvgSegments?:SvgRouteSegment[]; theme:{ paper:string; ink:string; forest:string; accent:string } }
export interface WorldProgress { currentDistance:number; unlockedCheckpointIds:string[]; discoveries:DiscoveryRecord[]; presentedDiscoveryIds:string[]; discoveredChapterIds:string[]; totalDistanceWalked:number; settlementHistory:SettlementRecord[]; startedAt:string; completedAt?:string }
export interface DiscoveryRecord { id:string; discoveredAt:string }
export interface SettlementRecord { id:string; addedDistance:number; fromDistance:number; toDistance:number; createdAt:string }
export interface JourneyState extends WorldProgress { activeWorldId:string; welcomed:boolean; sessionDistance:number; progressByWorld:Record<string,WorldProgress>; travelerId:string }
export type JourneyEvent = { type:'move'; to:number } | { type:'checkpoint'; checkpoint:Checkpoint } | { type:'chapter'; chapter:Chapter } | { type:'complete' }
export interface Settlement { id:string; addedDistance:number; fromDistance:number; toDistance:number; events:JourneyEvent[] }
