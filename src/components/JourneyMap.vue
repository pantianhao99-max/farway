<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { World } from '@/types/journey'
import JourneyAvatar from './JourneyAvatar.vue'
import JourneyMapBackground from './JourneyMapBackground.vue'
import OpenStreetJourneyMap from './OpenStreetJourneyMap.vue'
import { createRouteGeometry } from '@/services/journey/RouteGeometry'
import { placeNodeLabels, type NodeLabelPlacement } from '@/services/journey/NodeLabelPlacement'
import type { Checkpoint } from '@/types/journey'
import { distanceFormatter } from '@/services/journey/DistanceFormatter'
import { travelerDirectionAt } from '@/services/journey/TravelerDirection'
import '@/styles/journey-point-marker.scss'

const props = defineProps<{ world: World; distance: number; unlocked: string[]; travelerImage?: string | null }>()
const emit = defineEmits<{ lockChange:[locked:boolean] }>()

const scrollTop = ref(0)
const scrollLeft = ref(0)
const mapShell = ref<any>(null)
const panX = ref(0)
const panY = ref(0)
const viewport = ref(uni.getWindowInfo().windowHeight)
const viewportWidth = ref(Math.min(uni.getWindowInfo().windowWidth, 430))
const zoom = ref(1)
const viewLocked = ref(false)
let pinchStartDistance = 0
let pinchStartZoom = 1
let pinchMapX = 0
let pinchMapY = 0
let pinchLocalX = 0
let pinchLocalY = 0
let dragging = false
let dragX = 0
let dragY = 0
let dragScrollLeft = 0
let dragScrollTop = 0
let touchDragging = false
let hasInitialFit = false
const MAP_BASE_WIDTH = 1086
const MAP_BASE_HEIGHT = 1448
const mapWidth = computed(() => MAP_BASE_WIDTH * zoom.value)
const mapHeight = computed(() => MAP_BASE_HEIGHT * zoom.value)
const mapTransform = computed(() => `translate3d(${panX.value}px, ${panY.value}px, 0) scale(${zoom.value})`)

const mapBottom = (y: number) => y * MAP_BASE_HEIGHT
const mapTop = (y: number) => mapHeight.value - mapBottom(y)

const routeGeometry = computed(() => createRouteGeometry(props.world.pathPoints, props.world.routeSvgSegments))
const routeProgress = computed(() => props.world.totalDistance > 0 ? Math.min(1, Math.max(0, props.distance / props.world.totalDistance)) : 0)
const avatarTarget = computed(() => routeGeometry.value.pointAt(routeProgress.value))
const avatarDirection = computed(() => travelerDirectionAt(routeProgress.value, routeGeometry.value.pointAt))
const avatar = ref(avatarTarget.value)
let followFrame = 0
const CAMERA_DURATION = 700
const routePath = computed(() => routeGeometry.value.svgPath)

const nextCheckpoint = computed(() => props.world.checkpoints.find(cp => cp.distance > props.distance))
const nextRouteProgress = computed(() => nextCheckpoint.value ? routeGeometry.value.progressAt({x:nextCheckpoint.value.mapX,y:nextCheckpoint.value.mapY}) : 1)
const exploredPath = computed(() => routeGeometry.value.pathBetween(0, routeProgress.value))
const activePath = computed(() => nextRouteProgress.value > routeProgress.value ? routeGeometry.value.pathBetween(routeProgress.value, nextRouteProgress.value) : '')
const nearFutureEnd = computed(() => Math.min(1, Math.max(nextRouteProgress.value, routeProgress.value + .18)))
const nearFuturePath = computed(() => routeGeometry.value.pathBetween(routeProgress.value, nearFutureEnd.value))
const farFuturePath = computed(() => nearFutureEnd.value < 1 ? routeGeometry.value.pathBetween(nearFutureEnd.value, 1) : '')

// 只让已探索区域与眼前一小段路线进入可读层，避免整张地图提前剧透。
const hasExplicitMapPoints = computed(() => props.world.checkpoints.some(cp => cp.mapPoint !== undefined))
const visibleCheckpoints = computed(() => props.world.checkpoints.filter(cp =>
  (!hasExplicitMapPoints.value || cp.mapPoint) &&
  (props.unlocked.includes(cp.id) || (cp.distance > props.distance && cp.distance <= props.distance + 8))
))
const currentCheckpointId = computed(() => [...props.world.checkpoints].reverse().find(cp => cp.distance <= props.distance)?.id)
const nextCheckpointId = computed(() => props.world.checkpoints.find(cp => cp.distance > props.distance)?.id)
const labelPlacements = computed(() => {
  const currentId=currentCheckpointId.value,nextId=nextCheckpointId.value
  const nearestUnlocked=[...visibleCheckpoints.value].filter(cp=>props.unlocked.includes(cp.id)&&cp.id!==currentId).sort((a,b)=>Math.abs(a.distance-props.distance)-Math.abs(b.distance-props.distance))[0]?.id
  return placeNodeLabels(visibleCheckpoints.value.map(cp=>({
    id:cp.id,x:cp.mapX*mapWidth.value,y:(1-cp.mapY)*mapHeight.value,label:cp.hiddenBeforeUnlock&&!props.unlocked.includes(cp.id)?'未知地点':cp.name,
    priority:cp.id===currentId&&Math.hypot((cp.mapX-avatar.value.x)*mapWidth.value,(cp.mapY-avatar.value.y)*mapHeight.value)<72?3:cp.id===currentId?0:cp.id===nextId?1:cp.id===nearestUnlocked?2:3,hasMeta:cp.id===nextId
  })),{x:avatar.value.x*mapWidth.value,y:(1-avatar.value.y)*mapHeight.value},{left:scrollLeft.value,top:scrollTop.value,width:viewportWidth.value,height:Math.max(220,viewport.value-150)})
})
function labelFor(cp:Checkpoint){return labelPlacements.value[cp.id]??{show:false,placement:'right' as NodeLabelPlacement}}

function center() {
  setPan(viewportWidth.value*.5-avatar.value.x*mapWidth.value,viewport.value*.5-(1-avatar.value.y)*mapHeight.value, true)
}

function measureAndCenter() {
  const element = mapShell.value?.$el ?? mapShell.value
  if (element?.clientWidth) viewportWidth.value = element.clientWidth
  if (element?.clientHeight) viewport.value = element.clientHeight
  if(!hasInitialFit&&viewportWidth.value>0&&viewport.value>0){
    zoom.value=Math.min(viewportWidth.value/MAP_BASE_WIDTH,viewport.value/MAP_BASE_HEIGHT)
    hasInitialFit=true
  }
  nextTick(center)
}

function setPan(x:number,y:number,allowOutside=false){
  const clampAxis=(value:number,content:number,available:number)=>content<=available?(available-content)/2:Math.max(available-content,Math.min(0,value))
  panX.value=allowOutside?x:clampAxis(x,mapWidth.value,viewportWidth.value)
  panY.value=allowOutside?y:clampAxis(y,mapHeight.value,viewport.value)
  scrollLeft.value=-panX.value;scrollTop.value=-panY.value
}

function zoomAt(next:number,localX:number,localY:number,mapX?:number,mapY?:number) {
  const focusX=mapX??(localX-panX.value)/zoom.value
  const focusY=mapY??(localY-panY.value)/zoom.value
  const fitZoom=Math.min(viewportWidth.value/MAP_BASE_WIDTH,viewport.value/MAP_BASE_HEIGHT)
  const nextZoom=Math.max(Math.min(.25,fitZoom),Math.min(2.4,next))
  zoom.value=nextZoom
  setPan(localX-focusX*nextZoom,localY-focusY*nextZoom)
}

function setZoom(next: number) {
  const shell=mapShell.value?.$el??mapShell.value
  if(!shell)return
  const rect=shell.getBoundingClientRect()
  zoomAt(next,rect.width/2,rect.height/2)
}

function onWheel(event: WheelEvent) {
  const handledEvent = event as WheelEvent & { __farawayZoomed?: boolean }
  if (handledEvent.__farawayZoomed) return
  handledEvent.__farawayZoomed = true
  event.preventDefault()
  event.stopPropagation()
  const shell=mapShell.value?.$el??mapShell.value
  const rect=shell.getBoundingClientRect()
  const delta=Math.max(-100,Math.min(100,event.deltaY))
  zoomAt(zoom.value*Math.exp(-delta*0.0025),event.clientX-rect.left,event.clientY-rect.top)
}

function onWindowWheel(event:WheelEvent){
  if(props.world.assets.mapMode==='osm')return
  const shell=mapShell.value?.$el??mapShell.value
  if(!shell)return
  const rect=shell.getBoundingClientRect()
  if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)return
  onWheel(event)
}

function touchDistance(touches: TouchList) {
  const [a, b] = [touches[0], touches[1]]
  return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY)
}

function onTouchStart(event: TouchEvent) {
  if(event.touches.length===1){
    const touch=event.touches[0]
    touchDragging=true;dragX=touch.clientX;dragY=touch.clientY
    dragScrollLeft=panX.value;dragScrollTop=panY.value
    return
  }
  if (event.touches.length !== 2) return
  touchDragging=false
  pinchStartDistance = touchDistance(event.touches)
  pinchStartZoom = zoom.value
  const shell=mapShell.value?.$el??mapShell.value
  if(shell){
    const rect=shell.getBoundingClientRect(),a=event.touches[0],b=event.touches[1]
    pinchLocalX=(a.clientX+b.clientX)/2-rect.left;pinchLocalY=(a.clientY+b.clientY)/2-rect.top
    pinchMapX=(pinchLocalX-panX.value)/zoom.value;pinchMapY=(pinchLocalY-panY.value)/zoom.value
  }
}

function onTouchMove(event: TouchEvent) {
  if(event.touches.length===1&&touchDragging){event.preventDefault();const touch=event.touches[0];setPan(dragScrollLeft+touch.clientX-dragX,dragScrollTop+touch.clientY-dragY);return}
  if (event.touches.length !== 2 || pinchStartDistance <= 0) return
  event.preventDefault()
  const next = pinchStartZoom * touchDistance(event.touches) / pinchStartDistance
  zoomAt(next,pinchLocalX,pinchLocalY,pinchMapX,pinchMapY)
}

function onTouchEnd(event: TouchEvent) {
  if (event.touches.length < 2) pinchStartDistance = 0
  if(!event.touches.length)touchDragging=false
}
function onScroll(event:any){
  const detail=event?.detail
  if(!detail)return
  if(typeof detail.scrollLeft==='number')scrollLeft.value=detail.scrollLeft
  if(typeof detail.scrollTop==='number')scrollTop.value=detail.scrollTop
}

function scrollElement(): HTMLElement | null {
  return mapShell.value?.$el??mapShell.value??null
}

function onPointerDown(event: PointerEvent) {
  if (event.pointerType !== 'mouse' || event.button !== 0) return
  dragging = true
  dragX = event.clientX
  dragY = event.clientY
  dragScrollLeft = panX.value
  dragScrollTop = panY.value
  mapShell.value?.setPointerCapture?.(event.pointerId)
}

function onPointerMove(event: PointerEvent) {
  if (!dragging) return
  event.preventDefault()
  setPan(dragScrollLeft+event.clientX-dragX,dragScrollTop+event.clientY-dragY)
}

function onPointerUp(event: PointerEvent) {
  if (!dragging) return
  dragging = false
  mapShell.value?.releasePointerCapture?.(event.pointerId)
}

function toggleViewLock(){
  viewLocked.value=!viewLocked.value
  emit('lockChange',viewLocked.value)
  if(viewLocked.value)nextTick(center)
}
defineExpose({ toggleViewLock })

watch(avatarTarget, target => {
  if(typeof cancelAnimationFrame==='function')cancelAnimationFrame(followFrame)
  const start={...avatar.value},started=typeof performance!=='undefined'?performance.now():Date.now()
  const animate=(now:number)=>{
    const t=Math.min(1,(now-started)/CAMERA_DURATION)
    const eased=1-Math.pow(1-t,3)
    avatar.value={x:start.x+(target.x-start.x)*eased,y:start.y+(target.y-start.y)*eased}
    if(viewLocked.value)center()
    if(t<1)followFrame=requestAnimationFrame(animate)
  }
  followFrame=requestAnimationFrame(animate)
})
onMounted(() => {
  measureAndCenter()
  // uni-app 直达页面时，scroll-view 会晚于组件 mounted 完成尺寸布局。
  setTimeout(measureAndCenter, 120)
  if(typeof window!=='undefined')window.addEventListener('wheel',onWindowWheel,{passive:false,capture:true})
})
onUnmounted(() => {
  if(typeof cancelAnimationFrame==='function')cancelAnimationFrame(followFrame)
  if(typeof window!=='undefined')window.removeEventListener('wheel',onWindowWheel,true)
})
</script>

<template>
  <view
    v-if="world.assets.mapMode !== 'osm'"
    ref="mapShell"
    class="map-shell"
    @touchstart="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
    @touchcancel="onTouchEnd"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
      <view class="map" :style="{ width: MAP_BASE_WIDTH + 'px', height: MAP_BASE_HEIGHT + 'px', transform: mapTransform }">
      <!-- Layer 1: 纯环境静态底图，不承载任何路线或交互信息。 -->
      <JourneyMapBackground :image-asset="world.assets.mapImage" />

      <!-- Layer 2: normalized coordinates 动态路线。 -->
      <svg class="road" viewBox="0 0 100 100" preserveAspectRatio="none">
        <!-- 全程低权重轮廓 -->
        <path
          :d="routePath"
          fill="none"
          stroke="rgba(226, 224, 211, 0.34)"
          stroke-width="2.6"
          stroke-linecap="round"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
        />
        <!-- 很远的未探索路线 -->
        <path
          v-if="farFuturePath"
          :d="farFuturePath"
          fill="none"
          stroke="rgba(67, 82, 64, 0.2)"
          stroke-width="1.2"
          stroke-linecap="round"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
        />
        <!-- 人物附近的未来路线 -->
        <path
          :d="nearFuturePath"
          fill="none"
          stroke="rgba(70, 87, 67, 0.4)"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
        />
        <!-- 已走路线 -->
        <path :d="exploredPath" fill="none" stroke="rgba(62, 82, 62, 0.66)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
        <!-- 唯一暖橙色：当前位置至下一目标 -->
        <path v-if="activePath" :d="activePath" fill="none" stroke="rgba(214, 119, 65, 0.82)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
      </svg>

      <!-- Layer 3: 动态节点与名称。 -->
      <view
        v-for="cp in visibleCheckpoints"
        :key="cp.id"
        class="checkpoint"
        :class="{
          unlocked: unlocked.includes(cp.id),
          future: cp.distance > distance,
          current: cp.id === currentCheckpointId,
          next: cp.id === nextCheckpointId,
          secret: cp.hiddenBeforeUnlock && !unlocked.includes(cp.id)
        }"
        :style="{ left: (cp.mapX * 100) + '%', bottom: mapBottom(cp.mapY) + 'px' }"
      >
        <view class="marker journey-point-marker" :class="{ 'is-unlocked': unlocked.includes(cp.id) }">
          <view class="marker-ring journey-point-marker__ring" />
          <view class="marker-core journey-point-marker__core">
            <text v-if="unlocked.includes(cp.id)" class="marker-dot journey-point-marker__dot" />
            <text v-else class="marker-query">?</text>
          </view>
          <view v-if="unlocked.includes(cp.id)" class="marker-pulse journey-point-marker__pulse" />
        </view>
        <view v-if="labelFor(cp).show" class="label" :class="[`placement-${labelFor(cp).placement}`, { secret: cp.hiddenBeforeUnlock && !unlocked.includes(cp.id) }]">
          <text class="name">{{ cp.hiddenBeforeUnlock && !unlocked.includes(cp.id) ? '未知地点' : cp.name }}</text>
          <text v-if="cp.id===nextCheckpointId" class="km">{{ distanceFormatter.natural(Math.max(0,cp.distance-distance)) }}</text>
        </view>
      </view>

      <!-- Layer 4: travelledDistance 沿 pathPoints 插值得到人物位置。 -->
      <view
        class="avatar"
        :style="{ left: (avatar.x * 100) + '%', bottom: mapBottom(avatar.y) + 'px' }"
      >
        <view class="avatar-position-dot" aria-hidden="true" />
        <JourneyAvatar :image-asset="travelerImage ?? world.assets.travelerImage" :direction="avatarDirection" />
      </view>
      </view>
    <view class="zoom-controls">
      <button aria-label="放大地图" @click="setZoom(zoom + 0.2)">＋</button>
      <button aria-label="恢复地图缩放" @click="setZoom(1)">{{ Math.round(zoom * 100) }}%</button>
      <button aria-label="缩小地图" @click="setZoom(zoom - 0.2)">−</button>
    </view>
  </view>
  <OpenStreetJourneyMap v-else :world="world" :distance="distance" :unlocked="unlocked" :follow="viewLocked" :traveler-image="travelerImage" />
</template>

<style scoped lang="scss">
.map-shell {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #738b74;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
}
.map-shell:active { cursor: grabbing; }
.map-scroll {
  width: auto;
  height: auto;
  min-height: 190px;
  max-height: 330px;
  flex: 1 1 280px;
  margin: 0 16px;
  border: 1px solid rgba(255, 255, 255, .34);
  border-radius: 24px;
  overflow: hidden;
  background: #64745c;
  background-clip: padding-box;
  box-shadow: 0 8px 24px rgba(31,48,34,.13);
  isolation: isolate;
}
.map {
  position: relative;
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
  will-change: transform;
  overflow: hidden;
  background: #d9ddd4;
}

/* —— 路径 —— */
.road {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
}

/* —— 地点标记 —— */
.checkpoint {
  position: absolute;
  transform: translate(-50%, 50%);
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: opacity 0.3s ease;
  max-width: calc(100% - 24px);
}
.marker-query {
  color: white;
  font-size: 11px;
  font-weight: 700;
  font-family: var(--font-sans);
}
.future {
  opacity: 0.65;
}
.checkpoint.current .marker-ring{box-shadow:0 0 0 4px rgba(232,131,67,.18),0 2px 10px rgba(30,40,25,.18)}
.checkpoint.next{opacity:1}.checkpoint.next .marker-core{background:#f3efe4;border:2px solid #d77c45}.checkpoint.next .marker-query{color:#d77c45}
.secret .marker-core {
  background: #5a6a58;
}

/* —— 标签 —— */
.label {
  display: flex;
  flex-direction: column;
  padding: 6px 10px;
  background: rgba(246, 243, 234, 0.92);
  border-radius: 10px;
  box-shadow: 0 3px 12px rgba(40, 50, 35, 0.1);
  white-space: nowrap;
  backdrop-filter: blur(4px);
  max-width: min(150px, calc(100vw - 96px));
}
.name {
  font: 700 11px/1.3 var(--font-sans);
  color: #1c211b;
  overflow: hidden;
  text-overflow: ellipsis;
}
.km {
  font-size: 8px;
  letter-spacing: 1px;
  color: #8a9087;
  margin-top: 2px;
}
.label.secret {
  background: rgba(61, 75, 60, 0.82);
  color: white;
}
.label.secret .name { color: #e8ede5; }
.label.secret .km { color: #b8c0b4; }

/* —— 旅行者 —— */
.avatar {
  position: absolute;
  z-index: 8;
  transform: translate(-50%, 0);
  transition: left 0.08s linear, bottom 0.08s linear;
}
.avatar-position-dot {
  position: absolute;
  left: 50%;
  bottom: 0;
  z-index: 1;
  width: 10px;
  height: 10px;
  transform: translate(-50%, 50%);
  border: 2px solid rgba(255, 255, 255, .92);
  border-radius: 50%;
  background: #e88343;
  box-shadow: 0 2px 7px rgba(30, 43, 31, .42);
}
.avatar :deep(.traveler) { position: relative; z-index: 2; }
.you {
  position: absolute;
  left: 50%;
  top: 58px;
  transform: translateX(-50%);
  white-space: nowrap;
  background: rgba(36, 52, 38, 0.92);
  color: white;
  padding: 5px 10px;
  border-radius: 12px;
  font-size: 9px;
  letter-spacing: 1px;
  display: flex;
  align-items: center;
  gap: 5px;
  backdrop-filter: blur(4px);
}
.you-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #e88343;
  animation: you-blink 1.5s ease-in-out infinite;
}
@keyframes you-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* —— 雾效 —— */
/* Full-screen map */
.map-shell > .map-scroll {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  min-height: 0;
  max-height: none;
  margin: 0;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}
.checkpoint { gap: 7px; }
.label { padding: 6px 9px; border-radius: 10px; }
.name { font-size: 11px; }
.km { font-size: 8px; }

/* Keep the route marker on the path; place its label on the open side. */
.checkpoint {
  width: 0;
  height: 0;
  max-width: none;
  display: block;
  transform: none;
}
.checkpoint .marker {
  position: absolute;
  left: 0;
  top: 0;
  transform: translate(-50%, -50%);
}
.checkpoint .label {
  position: absolute;
  left: 19px;
  top: 0;
  transform: translateY(-50%);
}
.checkpoint.label-left .label {
  left: auto;
  right: 19px;
  text-align: right;
}

.checkpoint .label,
.checkpoint .label.secret {
  max-width: min(150px, calc(100vw - 92px));
  padding: 0;
  display: flex;
  flex-direction: row;
  align-items: baseline;
  gap: 5px;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  white-space: normal;
  text-shadow: 0 1px 3px rgba(24, 38, 26, .32);
}
.checkpoint .label .name,
.checkpoint .label .km {
  width: auto;
  margin: 0;
  overflow: hidden;
  color: #f7f5ed;
  text-overflow: clip;
  white-space: normal;
  line-height: 1.3;
  overflow-wrap: normal;
}
.checkpoint .label .name { font-family: var(--font-sans); font-weight: 650; }

/* Collision-aware label placements. Chinese labels stay horizontal and use at most two lines. */
.checkpoint .label,
.checkpoint .label.secret {
  width: max-content;
  min-width: 52px;
  max-width: 138px;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  text-align: left;
  white-space: normal;
}
.checkpoint .label .name {
  display: -webkit-box;
  max-width: 138px;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  white-space: normal;
  word-break: normal;
  overflow-wrap: normal;
  line-break: strict;
}
.checkpoint .label .km { white-space: nowrap; word-break: keep-all; overflow: visible; }
.checkpoint .label.placement-right { left: 18px; right: auto; top: 0; transform: translateY(-50%); }
.checkpoint .label.placement-left { left: auto; right: 18px; top: 0; transform: translateY(-50%); align-items: flex-end; text-align: right; }
.checkpoint .label.placement-top { left: 0; right: auto; top: -18px; transform: translate(-50%,-100%); align-items: center; text-align: center; }
.checkpoint .label.placement-bottom { left: 0; right: auto; top: 18px; transform: translateX(-50%); align-items: center; text-align: center; }
.checkpoint.current .marker { width: 16px; height: 16px; }
.checkpoint.current .marker-pulse { display: none; }
.checkpoint.current .marker-ring { box-shadow: 0 1px 5px rgba(30,40,25,.15); }

.map-shell,
.map-scroll { overscroll-behavior: none; }
.map-scroll { touch-action: pan-x pan-y; }
.map-scroll { scrollbar-width: none; }
.map-scroll::-webkit-scrollbar,
.map-scroll :deep(.uni-scroll-view::-webkit-scrollbar) { display: none; }

.zoom-controls {
  position: absolute;
  z-index: 15;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  display: none;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, .5);
  border-radius: 18px;
  background: rgba(246, 243, 234, .88);
  box-shadow: 0 8px 24px rgba(27, 42, 29, .16);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
.zoom-controls button {
  width: 42px;
  height: 40px;
  border-radius: 0;
  color: #344637;
  font-size: 20px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.zoom-controls button + button { border-top: 1px solid rgba(66, 86, 68, .14); }
.zoom-controls button:nth-child(2) { height: 32px; font-size: 8px; font-weight: 700; }

</style>
<style scoped>
.checkpoint .label .name{font-size:12px;letter-spacing:0}
.checkpoint .label .km{font-size:12px;letter-spacing:0}
.zoom-controls button:nth-child(2){font-size:12px}
</style>
