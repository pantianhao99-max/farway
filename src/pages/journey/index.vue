<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { ArrowLeft, Clock3, Flag, Flame, Footprints, Info, LocateFixed, MapPin, Pause, Play, Route } from '@lucide/vue'
import { useJourneyStore } from '@/stores/journey'
import JourneyMap from '@/components/JourneyMap.vue'
import JourneySettlement from '@/components/JourneySettlement.vue'
import EventOverlay from '@/components/EventOverlay.vue'
import ArtworkPlaceholderView from '@/components/ArtworkPlaceholderView.vue'
import { healthDataProvider } from '@/services/health/provider'
import { healthSyncStorage } from '@/services/health/sync-storage'

const journey = useJourneyStore()
const journeyMap = ref<InstanceType<typeof JourneyMap> | null>(null)
const mapViewLocked = ref(false)
const devOpen = ref(false)
const welcomeStep = ref(0)
const sessionStartedAt = ref(Date.now())
const clock = ref(Date.now())
let clockTimer: ReturnType<typeof setInterval> | undefined
let devWalkTimer: ReturnType<typeof setInterval> | undefined
const devWalking = ref(false)
const healthAvailable = ref(false)
const healthSyncing = ref(false)
const healthConnected = ref(false)
const pendingHealthConsumption = ref(0)
const paused = ref(false)
const restDrawerOpen = ref(false)
const pausedAt = ref<number | null>(null)
const totalPausedMs = ref(0)

const debugEnabled = import.meta.env.DEV

const nextLabel = computed(() => {
  const n = journey.nextCheckpoint
  if (!n) return '旅程终点'
  return n.hiddenBeforeUnlock && !journey.state.unlockedCheckpointIds.includes(n.id)
    ? '下一处未知地点'
    : n.name
})

const nextDistance = computed(() =>
  Math.max(0, (journey.nextCheckpoint?.distance ?? 100) - journey.state.currentDistance)
)

const walkMinutes = computed(() => Math.max(1, Math.round(nextDistance.value / 4.8 * 60)))
const nextLegProgress = computed(() => {
  const next = journey.nextCheckpoint
  if (!next) return 100
  const index = journey.world.checkpoints.findIndex(checkpoint => checkpoint.id === next.id)
  const start = index > 0 ? journey.world.checkpoints[index - 1].distance : 0
  const span = Math.max(0.01, next.distance - start)
  return Math.max(0, Math.min(100, (journey.state.currentDistance - start) / span * 100))
})

const progressPct = computed(() => Math.min(100, Math.round(journey.progress)))
const chapterLabel = computed(() => journey.chapter.number <= 10 ? `第${['一','二','三','四','五','六','七','八','九','十'][journey.chapter.number - 1]}段` : `第 ${journey.chapter.number} 段`)
const chapterDistance = computed(() => journey.chapter.endDistance - journey.chapter.startDistance)
const chapterEndpoints = computed(() => {
  const checkpoints = journey.world.checkpoints
  const nearest = (distance: number) => checkpoints.reduce((best, checkpoint) =>
    Math.abs(checkpoint.distance - distance) < Math.abs(best.distance - distance) ? checkpoint : best
  )
  return { from: nearest(journey.chapter.startDistance).name, to: nearest(journey.chapter.endDistance).name }
})
const chapterRouteLabel = computed(() => `${chapterLabel.value} · ${chapterEndpoints.value.from} → ${chapterEndpoints.value.to}`)
const elapsedSeconds = computed(() => {
  const end = pausedAt.value ?? clock.value
  return Math.max(0, Math.floor((end - sessionStartedAt.value - totalPausedMs.value) / 1000))
})
const elapsed = computed(() => {
  const h = Math.floor(elapsedSeconds.value / 3600)
  const m = Math.floor(elapsedSeconds.value % 3600 / 60)
  const s = elapsedSeconds.value % 60
  return [h, m, s].map(value => String(value).padStart(2, '0')).join(':')
})
const pace = computed(() => '12:30')
const chapterWalked = computed(() => Math.max(0, Math.min(chapterDistance.value, journey.displayDistance - journey.chapter.startDistance)))
const calories = computed(() => Math.round(Math.max(0, journey.displayDistance) * 64))
const steps = computed(() => Math.round(Math.max(0, journey.displayDistance) * 1000 / 0.75).toLocaleString())
function openRestDrawer() {
  paused.value = true
  pausedAt.value = Date.now()
  restDrawerOpen.value = true
}
function resumeJourney() {
  if (pausedAt.value !== null) totalPausedMs.value += Date.now() - pausedAt.value
  pausedAt.value = null
  restDrawerOpen.value = false
  paused.value = false
}
function finishSession() {
  restDrawerOpen.value = false
  paused.value = false
  pausedAt.value = null
  goBack()
}

onMounted(() => {
  journey.hydrate()
  welcomeStep.value = journey.state.welcomed ? 2 : 0
  sessionStartedAt.value = Date.now()
  clockTimer = setInterval(() => { clock.value = Date.now() }, 1000)
  healthDataProvider.isAvailable().then(value => { healthAvailable.value = value })
})
onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
  stopDevWalk()
})
onShow(() => {
  journey.hydrate()
  uni.hideTabBar({ animation: false })
})

function start() {
  if (welcomeStep.value === 0) welcomeStep.value = 1
  else { journey.setWelcomed(); welcomeStep.value = 2 }
}
function settle(km: number) { devOpen.value = false; journey.prepareSettlement(km) }
function stopDevWalk() {
  if (devWalkTimer) clearInterval(devWalkTimer)
  devWalkTimer = undefined
  devWalking.value = false
}
function toggleDevWalk() {
  if (devWalking.value) {
    stopDevWalk()
    return
  }
  devWalking.value = true
  devWalkTimer = setInterval(() => {
    if (journey.state.currentDistance >= journey.world.totalDistance) {
      stopDevWalk()
      return
    }
    if (journey.pendingSettlement || journey.isAnimating) return
    journey.prepareSettlement(0.08)
    void journey.play()
  }, 320)
}
function resetDevJourney() {
  stopDevWalk()
  journey.reset()
}
async function syncHealth() {
  if (healthSyncing.value) return
  if (!healthAvailable.value) {
    uni.showToast({ title: '健康数据同步仅支持苹果手机应用', icon: 'none' })
    return
  }
  healthSyncing.value = true
  try {
    await healthDataProvider.requestAuthorization()
    healthConnected.value = true
    const window = healthSyncStorage.pendingWindow()
    const totalKm = await healthDataProvider.getPendingDistance(window.windowStartAt)
    const pendingKm = Math.max(0, totalKm - window.consumedKm)
    if (pendingKm < 0.01) {
      uni.showToast({ title: '暂无新的步行距离', icon: 'none' })
      return
    }
    journey.prepareSettlement(pendingKm)
    pendingHealthConsumption.value = journey.pendingSettlement?.addedDistance ?? 0
  } catch (error) {
    const message = error instanceof Error ? error.message : '读取健康数据失败'
    uni.showToast({ title: message, icon: 'none' })
  } finally {
    healthSyncing.value = false
  }
}
function consumeHealthDistance() {
  if (pendingHealthConsumption.value <= 0) return
  healthSyncStorage.consume(pendingHealthConsumption.value)
  pendingHealthConsumption.value = 0
}
async function play() { await journey.play(); consumeHealthDistance() }
function skipJourney() { journey.skipJourney(); consumeHealthDistance() }
function closeSettlement() { journey.pendingSettlement = null; pendingHealthConsumption.value = 0 }
function lockedToast() { uni.showToast({ title: '这片区域还没有开放。', icon: 'none' }) }
function showMapAttribution() {
  uni.showModal({
    title: '地图数据来源',
    content: '地图数据 © OpenStreetMap contributors\n采用 Open Database License（ODbL）许可\nopenstreetmap.org/copyright',
    showCancel: false,
    confirmText: '知道了'
  })
}
function goBack() {
  const pages = getCurrentPages()
  if (pages.length > 1) uni.navigateBack()
  else uni.switchTab({ url: '/pages/worlds/index' })
}
</script>

<template>
  <view class="safe-page journey-page">
    <!-- 主界面 -->
    <template v-if="welcomeStep === 2">
      <header class="walk-header">
        <button class="back-button" @click="goBack" aria-label="返回">
          <ArrowLeft :size="20" :stroke-width="1.8" />
        </button>
        <view class="header-left">
          <view class="world-title-row">
            <text class="world serif">{{ journey.world.name }}</text>
            <button v-if="journey.world.assets.mapMode === 'osm'" class="map-attribution-button" aria-label="地图数据来源" @click="showMapAttribution">
              <Info :size="14" :stroke-width="1.8" />
            </button>
          </view>
          <text class="chapter-route">{{ chapterRouteLabel }}</text>
        </view>
        <view class="header-right">
          <view class="distance-ring">
            <view class="ring-progress" :style="{ '--pct': progressPct + '%' }" />
            <view class="ring-inner">
              <b>{{ progressPct }}%</b>
              <span>全程进度</span>
            </view>
          </view>
        </view>
      </header>

      <!-- 地图 -->
      <JourneyMap
        :traveler-image="journey.selectedTraveler.image"
        ref="journeyMap"
        class="immersive-map"
        :world="journey.world"
        :distance="journey.displayDistance"
        :unlocked="journey.state.unlockedCheckpointIds"
        @lock-change="mapViewLocked = $event"
      />

      <view class="journey-bottom-card">
        <button v-if="debugEnabled" class="bottom-side-button debug" :class="{ active: devOpen }" @click="devOpen = !devOpen">调试</button>
        <button class="bottom-pause-button" aria-label="休息一下" @click="openRestDrawer">
          <Pause :size="27" :stroke-width="2.8" fill="currentColor" />
        </button>
        <button class="bottom-side-button locate" :class="{ active: mapViewLocked }" aria-label="定位锁定" @click="journeyMap?.toggleViewLock()">
          <LocateFixed :size="20" :stroke-width="2.2" />
        </button>

        <text class="bottom-distance-label">今日行走</text>
        <view class="bottom-distance-reading">
          <text>{{ journey.displayDistance.toFixed(2) }}</text><small>km</small>
        </view>
        <view class="bottom-route-pill">
          <view class="route-pill-item">
            <Flag :size="15" :stroke-width="2.2" />
            <text>本段</text>
            <b>{{ chapterWalked.toFixed(1) }} / {{ chapterDistance.toFixed(1) }} km</b>
          </view>
          <view class="route-pill-divider" />
          <view class="route-pill-item">
            <MapPin :size="15" :stroke-width="2.2" />
            <text>距下一个节点</text>
            <b>{{ nextDistance.toFixed(1) }} km</b>
          </view>
        </view>
        <view class="bottom-metrics">
          <view>
            <view class="bottom-metric-label"><Footprints :size="13" :stroke-width="2" />步数</view>
            <view><b>{{ steps }}</b><small>步</small></view>
          </view>
          <view>
            <view class="bottom-metric-label"><Route :size="13" :stroke-width="2" />距离</view>
            <view><b>{{ journey.displayDistance.toFixed(2) }}</b><small>km</small></view>
          </view>
          <view>
            <view class="bottom-metric-label"><Clock3 :size="13" :stroke-width="2" />活动时长</view>
            <view><b>{{ elapsed }}</b></view>
          </view>
          <view>
            <view class="bottom-metric-label"><Flame :size="13" :stroke-width="2" />消耗</view>
            <view><b>{{ calories }}</b><small>kcal</small></view>
          </view>
        </view>
      </view>

      <view class="session-panel">
        <view class="metric primary-metric">
          <view class="metric-reading"><text class="metric-value">4.8</text><text class="metric-unit">公里/时</text></view>
          <text class="metric-label">当前速度</text>
        </view>
        <view class="metric">
          <view class="metric-reading"><text class="metric-value">{{ pace }}</text><text class="metric-unit">分/公里</text></view>
          <text class="metric-label">平均配速</text>
        </view>
        <view class="metric">
          <view class="metric-reading"><text class="metric-value">{{ journey.sessionDistance.toFixed(2) }}</text><text class="metric-unit">km</text></view>
          <text class="metric-label">本次距离</text>
        </view>
      </view>

      <view class="walk-actions">
        <button v-if="debugEnabled" class="action-debug" :class="{ active: devOpen }" @click="devOpen = !devOpen">调试</button>
        <view v-else class="action-spacer" />
        <button
          class="map-lock-button"
          :class="{ active: mapViewLocked }"
          :aria-label="mapViewLocked ? '解除视图跟随' : '跟随当前位置'"
          @click="journeyMap?.toggleViewLock()"
        >
          <LocateFixed :size="18" :stroke-width="2.2" />
        </button>
        <button class="pause-button" @click="openRestDrawer">
          <Pause :size="17" :stroke-width="2.4" />
          <text>休息一下</text>
        </button>
      </view>

      <view v-if="restDrawerOpen" class="rest-overlay" @click.self="resumeJourney">
        <view class="rest-drawer">
          <view class="drawer-handle" />
          <view class="rest-scene" aria-hidden="true">
            <view class="rest-sun" />
            <view class="rest-mountain back" />
            <view class="rest-mountain front" />
            <image :src="journey.selectedTraveler.image" mode="contain" />
          </view>
          <text class="rest-title">在这里歇一会儿。</text>
          <text class="rest-subtitle">你已经走了很棒的路程！</text>
          <view class="rest-distance"><b>{{ journey.sessionDistance.toFixed(2) }}</b><text>km</text></view>
          <text class="rest-distance-label">本次已行走</text>
          <view class="rest-metrics">
            <view><b>{{ elapsed }}</b><text>本次用时</text></view>
            <view><b>4.8 <small>km/h</small></b><text>平均速度</text></view>
            <view><b>{{ pace }}<small>/km</small></b><text>平均配速</text></view>
          </view>
          <button class="resume-button" @click="resumeJourney"><Play :size="16" fill="currentColor" />继续旅程</button>
          <button class="finish-button" @click="finishSession">结束本次</button>
        </view>
      </view>

      <!-- DEV 按钮 -->
      <button v-if="false" class="dev-toggle" :class="{ open: devOpen }" @click="devOpen = !devOpen">
        <text>调试</text>
      </button>

      <!-- DEV 面板 -->
      <view v-if="debugEnabled && devOpen" class="dev-panel">
        <text class="dev-title">模拟步行</text>
        <view class="dev-buttons">
          <button v-for="n in [1, 3, 5, 10]" :key="n" @click="settle(n)">+{{ n }}</button>
        </view>
        <button class="dev-walk" :class="{ active: devWalking }" @click="toggleDevWalk">
          {{ devWalking ? '停止持续行走' : '开始持续行走' }}
        </button>
        <button class="dev-reset" @click="resetDevJourney">重置旅程</button>
      </view>

      <!-- 结算弹窗 -->
      <JourneySettlement
        v-if="journey.pendingSettlement && !journey.isAnimating"
        :distance="journey.pendingSettlement.addedDistance"
        @continue="play"
        @close="closeSettlement"
      />

      <!-- 事件弹窗 -->
      <EventOverlay
        v-if="journey.isAnimating && journey.activeEvent && journey.activeEvent.type !== 'move'"
        :event="journey.activeEvent"
        @continue="journey.continueJourney"
      />

      <button v-if="journey.isAnimating && journey.activeEvent?.type === 'checkpoint'" class="skip-btn" @click="journey.continueJourney">
        稍后查看
      </button>
      <button v-else-if="journey.isAnimating" class="skip-btn" @click="skipJourney">
        跳过动画
      </button>
    </template>

    <!-- 欢迎页 -->
    <view v-else class="welcome" :class="{ worldIntro: welcomeStep === 1 }">
      <view class="welcome-art"><ArtworkPlaceholderView /></view>

      <view class="welcome-copy" v-if="welcomeStep === 0">
        <text class="eyebrow">远方</text>
        <text class="welcome-title serif">走着走着，<br />就到了很远的地方。</text>
        <text class="welcome-desc">你现实中走过的每一步，都会推动另一个世界里的旅程。</text>
        <button class="primary-button" @click="start">开始旅程</button>
      </view>

      <view class="welcome-copy" v-else>
        <text class="eyebrow">第一站</text>
        <text class="welcome-title serif">{{ journey.world.name }}</text>
        <text class="welcome-desc">{{ journey.world.description }}</text>
        <button class="primary-button" @click="start">出发</button>
        <button class="preview-link" @click="lockedToast">一张地图，等待展开</button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.journey-page {
  position: relative;
  overflow: hidden;
  height: 100vh;
  width: 100%;
  max-width: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* ===== Header ===== */
header {
  padding: 20px 20px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  gap: 12px;
}
.header-left { flex: 1; min-width: 0; }
.world {
  display: block;
  font-size: 26px;
  line-height: 1.15;
  margin: 6px 0 4px;
  color: #1c211b;
}
.chapter {
  font-size: 12px;
  color: #697166;
  letter-spacing: 0.5px;
}

/* 距离圆环 */
.distance-ring {
  position: relative;
  width: 64px;
  height: 64px;
  flex-shrink: 0;
}
.ring-progress {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: conic-gradient(#e88343 var(--pct, 0%), #e0dccf 0%);
  mask: radial-gradient(transparent 58%, black 60%);
  -webkit-mask: radial-gradient(transparent 58%, black 60%);
}
.ring-inner {
  position: absolute;
  inset: 6px;
  border-radius: 50%;
  background: #f6f3ea;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.ring-inner b {
  font: 500 15px/1 var(--font-sans);
  color: #1c211b;
}
.ring-inner span {
  font-size: 7px;
  color: #899087;
  letter-spacing: 0.5px;
  margin-top: 1px;
}

/* ===== 下一站卡片 ===== */
.next-card {
  margin: 0 16px 12px;
  padding: 14px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0.3));
  border: 1px solid rgba(221, 214, 198, 0.6);
  border-radius: 16px;
  flex-shrink: 0;
  backdrop-filter: blur(8px);
}
.next-info { flex: 1; min-width: 0; }
.next-name {
  display: block;
  font-size: 17px;
  margin-top: 5px;
  color: #1c211b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.next-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}
.distance-badge {
  display: flex;
  align-items: baseline;
  gap: 3px;
  background: rgba(232, 131, 67, 0.1);
  padding: 4px 10px;
  border-radius: 10px;
}
.distance-badge b {
  font: 600 16px/1 var(--font-sans);
  color: #d06f38;
}
.distance-badge text {
  font-size: 9px;
  color: #d06f38;
  letter-spacing: 1px;
}
.walk-time {
  font-size: 10px;
  color: #7d847a;
}

/* ===== DEV 面板 ===== */
.dev-toggle {
  position: fixed;
  right: max(13px, calc((100vw - var(--mobile-width)) / 2 + 13px));
  bottom: calc(16px + env(safe-area-inset-bottom));
  z-index: 20;
  background: #273328;
  color: white;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  font-size: 9px;
  letter-spacing: 1px;
  font-weight: 700;
  box-shadow: 0 5px 15px rgba(51, 67, 52, 0.35);
  transition: transform 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
}
.metric-value,.pause-time{font-variant-numeric:tabular-nums lining-nums}
.dev-toggle text { white-space: nowrap; line-height: 1; letter-spacing: 0; }
.dev-toggle:active { transform: scale(0.92); }
.dev-toggle.open { background: #e88343; }

.dev-panel {
  position: fixed;
  right: max(13px, calc((100vw - var(--mobile-width)) / 2 + 13px));
  bottom: calc(68px + env(safe-area-inset-bottom));
  z-index: 21;
  width: 210px;
  background: #243126;
  color: white;
  padding: 16px;
  border-radius: 18px;
  box-shadow: 0 12px 35px rgba(27, 40, 27, 0.4);
  animation: dev-pop 0.25s ease;
}
@keyframes dev-pop {
  from { opacity: 0; transform: translateY(10px) scale(0.95); }
  to { opacity: 1; transform: none; }
}
.dev-title {
  display: block;
  font-size: 10px;
  letter-spacing: 2px;
  margin-bottom: 12px;
  color: #a8b0a0;
}
.dev-buttons {
  display: flex;
  gap: 6px;
}
.dev-buttons button {
  flex: 1;
  height: 34px;
  background: #3d5240;
  color: white;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  transition: background 0.15s;
}
.dev-buttons button:active { background: #4d6550; }
.dev-reset {
  display: block;
  color: #e9a37c;
  font-size: 11px;
  margin: 14px auto 0;
  padding: 6px 12px;
}

/* 跳过按钮 */
.skip-btn {
  position: fixed;
  z-index: 10001;
  top: calc(13px + env(safe-area-inset-top));
  right: max(14px, calc((100vw - var(--mobile-width)) / 2 + 14px));
  background: rgba(36, 49, 38, 0.85);
  color: white;
  font-size: 11px;
  padding: 8px 14px;
  border-radius: 18px;
  backdrop-filter: blur(6px);
}

/* ===== 欢迎页 ===== */
.welcome {
  height: auto;
  min-height: 0;
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: #f6f3ea;
}

/* 欢迎页插画 */
.welcome-art {
  height: 49%;
  min-height: 280px;
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
  background: linear-gradient(180deg, #c8ddb8 0%, #e8d8a8 60%, #d8c898 100%);
}
.sky-gradient {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, transparent 50%);
}
.sun-glow {
  position: absolute;
  width: 140px;
  height: 140px;
  border-radius: 50%;
  right: 12%;
  top: 8%;
  background: radial-gradient(circle, rgba(245, 214, 138, 0.5), transparent 70%);
  filter: blur(10px);
}
.sun {
  position: absolute;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  right: 16%;
  top: 12%;
  background: radial-gradient(circle at 35% 35%, #fbe6a8, #f0c86a);
  box-shadow: 0 0 40px rgba(245, 214, 138, 0.6);
  animation: sun-pulse 4s ease-in-out infinite;
}
@keyframes sun-pulse {
  0%, 100% { box-shadow: 0 0 40px rgba(245, 214, 138, 0.6); }
  50% { box-shadow: 0 0 60px rgba(245, 214, 138, 0.8); }
}
.cloud {
  position: absolute;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 50px;
}
@supports (height: 100dvh) { .journey-page { height: 100dvh; } }
.walk-header { padding: 14px 18px 8px; }
.back-button { width: 38px; height: 38px; margin-right: 0; flex: 0 0 38px; border-radius: 50%; background: #fff; color: #263027; box-shadow: 0 4px 16px rgba(25,38,28,.1); display: flex; align-items: center; justify-content: center; }
.hero-stats { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; padding: 2px 22px 12px; }
.hero-stats > view { min-width: 0; }
.stats-label { display: block; color: #818a7f; font-size: 10px; letter-spacing: 2px; }
.elapsed-value { display: block; margin-top: 3px; color: #182019; font: 500 34px/1.1 var(--font-serif); letter-spacing: 2px; }
.live-pill { padding: 7px 10px; border-radius: 20px; background: #e8eee5; color: #4b6550; font-size: 10px; }
.live-pill i { display: inline-block; width: 6px; height: 6px; margin-right: 5px; border-radius: 50%; background: #59a165; box-shadow: 0 0 0 4px rgba(89,161,101,.12); }
.health-sync { min-width: 112px; max-width: 46%; padding: 8px 12px; border-radius: 20px; background: #e8eee5; color: #4b6550; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.health-sync[disabled] { opacity: .6; }
.session-panel { display: grid; grid-template-columns: 1.15fr 1fr 1fr; margin: 12px 16px 8px; padding: 16px 8px; border-radius: 22px; background: #fff; box-shadow: 0 9px 28px rgba(28,42,30,.09); }
.metric { position: relative; min-width: 0; display: flex; align-items: baseline; justify-content: center; flex-wrap: wrap; padding: 0 8px; }
.metric + .metric::before { content: ''; position: absolute; left: 0; top: 4px; bottom: 4px; width: 1px; background: #e9ede7; }
.metric-value { color: #27312a; font: 600 22px/1 var(--font-serif); }
.primary-metric .metric-value { color: #d66f36; font-size: 29px; }
.metric-unit { margin-left: 3px; color: #92998f; font-size: 8px; letter-spacing: .6px; }
.metric-label { width: 100%; margin-top: 7px; text-align: center; color: #7a8378; font-size: 10px; }
.walk-actions { display: grid; grid-template-columns: 48px 132px 48px; align-items: center; justify-content: center; gap: 22px; padding: 8px 0 calc(14px + env(safe-area-inset-bottom)); }
.action-debug,.action-spacer { grid-column: 1; grid-row: 1; width: 48px; height: 48px; }
.action-debug { padding: 0; border-radius: 50%; color: white; background: #273328; font-size: 11px; box-shadow: 0 6px 18px rgba(34,49,36,.2); }
.action-debug.active { background: #e88343; }
.pause-button { grid-column: 2; grid-row: 1; }
.map-lock-button {
  grid-column: 3;
  grid-row: 1;
  width: 48px;
  height: 48px;
  flex: 0 0 48px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(71,91,73,.2);
  border-radius: 50%;
  color: #435746;
  background: rgba(246,243,234,.94);
  box-shadow: 0 6px 18px rgba(34,49,36,.15);
}
.map-lock-button.active { color: white; background: #e88343; border-color: #e88343; }
.pause-button { width: 78px; height: 58px; border-radius: 30px; background: #e77f41; color: white; box-shadow: 0 8px 22px rgba(210,103,45,.28); display: flex; align-items: center; justify-content: center; gap: 7px; }
.pause-button span { font-size: 13px; font-weight: 700; }

/* ===== Immersive walking HUD ===== */
.immersive-map {
  position: absolute !important;
  inset: 0 !important;
  z-index: 0;
  width: 100% !important;
  height: 100% !important;
  min-height: 0 !important;
  max-height: none !important;
  margin: 0 !important;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}

.walk-header,
.hero-stats,
.next-card,
.session-panel,
.walk-actions {
  position: relative;
  z-index: 2;
}

.walk-header {
  background: rgba(246, 243, 234, .86);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.back-button {
  border: 1px solid rgba(75, 91, 74, .2);
  background: rgba(250, 248, 242, .88);
  line-height: 0;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
.back-button svg { display: block; flex: 0 0 auto; }

.health-sync {
  height: 36px;
  border: 1px solid rgba(80, 106, 75, .42);
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.next-card {
  background: rgba(250, 248, 242, .78);
  border-color: rgba(255, 255, 255, .62);
  box-shadow: 0 10px 28px rgba(30, 43, 31, .12);
  backdrop-filter: blur(16px) saturate(1.1);
  -webkit-backdrop-filter: blur(16px) saturate(1.1);
}

.session-panel {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: calc(108px + env(safe-area-inset-bottom));
  margin: 0;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  padding: 14px 6px;
  background: rgba(250, 248, 242, .84);
  border: 1px solid rgba(255, 255, 255, .62);
  box-shadow: 0 12px 34px rgba(25, 39, 27, .18);
  backdrop-filter: blur(18px) saturate(1.08);
  -webkit-backdrop-filter: blur(18px) saturate(1.08);
}

.metric {
  height: 58px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 6px;
}
.metric-reading {
  height: 28px;
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 3px;
  white-space: nowrap;
}
.metric-value,
.metric-unit,
.metric-label { white-space: nowrap; }
.metric-value,
.primary-metric .metric-value {
  align-self: baseline;
  font-size: 22px;
  line-height: 28px;
}
.metric-unit { align-self: baseline; margin: 0; line-height: 1; }
.metric-label {
  display: block;
  width: 100%;
  height: 12px;
  margin: 0;
  color: #7a8378;
  font-size: 10px;
  font-weight: 400;
  line-height: 12px;
  text-align: center;
}

.walk-actions {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(20px + env(safe-area-inset-bottom));
  padding: 0;
}
.pause-button {
  width: 132px;
  height: 58px;
  border: 1px solid rgba(255, 255, 255, .45);
  white-space: nowrap;
}
.pause-button span { display: block; white-space: nowrap; flex: 0 0 auto; }
.pause-copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 0;
  line-height: 1;
}
.pause-copy span { font-size: 13px; line-height: 15px; }
.pause-copy span { width: 76px; text-align: left; }
.pause-copy text,
.pause-copy .pause-time {
  color: rgba(255, 255, 255, .78);
  font: 600 14px/18px var(--font-sans);
  letter-spacing: .8px;
  white-space: nowrap;
}
.back-button { width: 44px; height: 44px; min-width: 44px; flex-basis: 44px; }

/* Keep the HUD concise: world, route progress, next stop and live metrics. */
.walk-header .eyebrow,
.walk-header .chapter,
.hero-stats > view { display: none; }

.walk-header {
  align-items: center;
  gap: 10px;
  padding-bottom: 10px;
}
.header-left { flex: 0 1 auto; }
.header-right { flex: 0 0 50px; min-width: 50px; }
.world { margin: 0; font-size: 22px; white-space: nowrap; }
.distance-ring { width: 50px; height: 50px; }
.ring-progress {
  inset: 0;
  height: auto;
  border-radius: 50%;
  background: conic-gradient(#e88343 var(--pct, 0%), rgba(71, 88, 70, .18) 0%);
  mask: radial-gradient(transparent 57%, #000 60%);
  -webkit-mask: radial-gradient(transparent 57%, #000 60%);
}
.ring-inner {
  inset: 5px;
  flex-direction: column;
  justify-content: center;
  gap: 1px;
  background: rgba(246, 243, 234, .82);
}
.ring-inner b { font-size: 12px; }
.ring-inner span { margin: 0; font-size: 6px; letter-spacing: 0; }

.health-sync {
  flex: 0 0 36px;
  width: 36px;
  min-width: 0;
  max-width: none;
  height: 36px;
  padding: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
}
.health-sync svg { display: block; flex: 0 0 auto; }
.health-sync .spinning { animation: sync-spin .9s linear infinite; }
@keyframes sync-spin { to { transform: rotate(360deg); } }

.dev-walk {
  width: 100%;
  height: 36px;
  margin-top: 10px;
  border: 1px solid rgba(255, 255, 255, .2);
  border-radius: 9px;
  background: #4a624d;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}
.dev-walk.active {
  border-color: rgba(255, 205, 174, .5);
  background: #b85f35;
}

/* Final HUD alignment and typography pass. */
.walk-header {
  width: 100%;
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 52px;
  align-items: center;
  justify-content: initial;
  column-gap: 12px;
  padding: 12px 16px 13px;
}
.back-button {
  grid-column: 1;
  justify-self: start;
  width: 40px;
  height: 40px;
  flex-basis: auto;
  margin: 0;
}
.header-left {
  grid-column: 2;
  width: 100%;
  min-width: 0;
  overflow: hidden;
}
.world {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 23px;
  line-height: 1.15;
}
.header-right {
  grid-column: 3;
  width: 52px;
  min-width: 52px;
  justify-self: end;
}
.distance-ring { width: 52px; height: 52px; }

.next-card {
  position: relative;
  margin: 16px 16px 0;
  min-height: 84px;
  padding: 15px 16px 15px 19px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, .72);
  border-radius: 20px;
  background: rgba(250, 248, 242, .9);
  box-shadow: 0 12px 30px rgba(25, 39, 27, .16);
}
.next-card::before {
  content: '';
  position: absolute;
  top: 14px;
  bottom: 14px;
  left: 0;
  width: 4px;
  border-radius: 0 4px 4px 0;
  background: #e88343;
}
.next-kicker {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #71806f;
}
.next-kicker text {
  font-size: 10px;
  font-weight: 700;
  line-height: 13px;
  letter-spacing: 1.5px;
}
.next-name {
  margin-top: 6px;
  font-size: 19px;
  line-height: 23px;
}
.next-meta { gap: 6px; }
.distance-badge {
  padding: 6px 10px;
  border: 1px solid rgba(232, 131, 67, .14);
  border-radius: 12px;
}
.walk-time { font-size: 10px; line-height: 12px; }

.session-panel { padding-block: 10px; }
.metric { height: 49px; gap: 4px; }
.metric-reading { height: 24px; }
.metric-value,
.primary-metric .metric-value {
  color: #27312a;
  font-family: var(--font-sans);
  font-size: 20px;
  font-weight: 650;
  line-height: 24px;
  letter-spacing: -.3px;
  font-variant-numeric: tabular-nums;
  text-align: left;
}
.primary-metric .metric-value { color: #d66f36; }
.metric-unit {
  color: #818a80;
  font-size: 8px;
  font-weight: 700;
  line-height: 10px;
  letter-spacing: .35px;
}
.metric-label {
  height: 12px;
  color: #687267;
  font-size: 10px;
  font-weight: 500;
  line-height: 12px;
  letter-spacing: .2px;
}

@media (max-width: 359px) {
  .walk-header { grid-template-columns: 36px minmax(0, 1fr) 46px; padding-inline: 12px; column-gap: 9px; }
  .back-button { width: 34px; height: 34px; flex-basis: 34px; }
  .world { font-size: 20px; }
  .distance-ring { width: 46px; height: 46px; }
  .hero-stats { padding-inline: 14px; }
  .elapsed-value { font-size: 29px; letter-spacing: 1px; }
  .next-card { margin-inline: 12px; padding-inline: 14px; }
  .session-panel { left: 12px; right: 12px; margin-inline: 0; padding-inline: 4px; }
  .metric { padding-inline: 4px; }
  .metric-value { font-size: 19px; }
  .primary-metric .metric-value { font-size: 25px; }
}

@media (max-height: 700px) {
  .walk-header { padding-top: 8px; padding-bottom: 5px; }
  .world { margin-block: 3px 2px; font-size: 22px; }
  .distance-ring { width: 54px; height: 54px; }
  .hero-stats { padding-bottom: 7px; }
  .elapsed-value { font-size: 28px; }
  .next-card { margin-bottom: 8px; padding-block: 10px; }
  .session-panel { bottom: calc(92px + env(safe-area-inset-bottom)); padding-block: 10px; }
  .metric-label { margin-top: 4px; }
  .walk-actions { bottom: calc(14px + env(safe-area-inset-bottom)); padding: 0; }
  .pause-button { height: 48px; }
}

/* Hard bounds for compact screens. */
.walk-header {
  width: 100%;
  max-width: 100%;
  grid-template-columns: 38px minmax(0, 1fr) 48px;
  column-gap: 10px;
  padding: 11px 12px 12px;
  overflow: hidden;
  box-sizing: border-box;
  margin: 0;
  left: 0;
  right: 0;
  border: 0;
  outline: 0;
  box-shadow: none;
}
.walk-header::before,
.walk-header::after { display: none; }
.walk-header > * { min-width: 0; max-width: 100%; }
.back-button { width: 38px; height: 38px; }
.header-right { width: 48px; min-width: 48px; }
.distance-ring { width: 48px; height: 48px; }

.next-card {
  width: calc(100% - 68px);
  max-width: 300px;
  min-height: 72px;
  margin: 14px auto 0;
  padding: 12px 13px 12px 17px;
}
.next-name { margin-top: 4px; font-size: 17px; line-height: 21px; }
.next-card {
  display: block;
  min-height: 0;
  padding: 13px 15px 12px;
}
.next-card::before { display: none; }
.next-row {
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.next-kicker {
  display: block;
  flex: 0 0 auto;
  color: #71806f;
  font-size: 10px;
  font-weight: 700;
  line-height: 20px;
  letter-spacing: 1px;
  white-space: nowrap;
}
.next-name {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 16px;
  line-height: 20px;
}
.next-distance {
  flex: 0 0 auto;
  display: flex;
  align-items: baseline;
  gap: 2px;
  color: #d66f36;
  white-space: nowrap;
}
.next-distance b { font: 700 14px/20px var(--font-sans); }
.next-distance text { font-size: 8px; font-weight: 600; }
.next-progress {
  width: 100%;
  height: 4px;
  margin-top: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(73, 91, 73, .14);
}
.next-progress > view {
  height: 100%;
  border-radius: inherit;
  background: #e88343;
  transition: width .25s ease;
}
.next-progress-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}
.next-progress-row .next-progress {
  flex: 1 1 auto;
  width: auto;
  min-width: 0;
  margin-top: 0;
}
.next-eta {
  flex: 0 0 auto;
  color: #71806f;
  font-size: 9px;
  font-weight: 500;
  line-height: 11px;
  white-space: nowrap;
}

.pause-button {
  width: 132px;
  min-width: 132px;
  max-width: 132px;
  flex: 0 0 132px;
}
.pause-button > svg { width: 22px; height: 22px; flex: 0 0 22px; }
.pause-copy { width: 78px; flex: 0 0 78px; }
.pause-copy text,
.pause-copy .pause-time {
  display: block;
  width: 76px;
  font-variant-numeric: tabular-nums;
}
.cloud.c1 { width: 70px; height: 16px; top: 15%; left: 8%; animation: cloud-drift 20s linear infinite; }
.cloud.c2 { width: 50px; height: 12px; top: 25%; right: 30%; opacity: 0.6; animation: cloud-drift 25s linear infinite reverse; }
.cloud.c3 { width: 40px; height: 10px; top: 10%; left: 45%; opacity: 0.4; }
@keyframes cloud-drift {
  from { transform: translateX(-20px); }
  to { transform: translateX(20px); }
}

/* 远山 */
.mountains {
  position: absolute;
  bottom: 35%;
  left: 0;
  right: 0;
  height: 30%;
}
.mountain {
  position: absolute;
  bottom: 0;
  transform: rotate(45deg);
  border-radius: 12%;
}
.mountain.m1 { width: 55%; height: 90%; left: -10%; background: rgba(120, 145, 119, 0.5); }
.mountain.m2 { width: 45%; height: 75%; right: -5%; background: rgba(140, 160, 130, 0.45); }
.mountain.m3 { width: 35%; height: 60%; left: 35%; background: rgba(130, 155, 125, 0.35); }

/* 中景 */
.midground {
  position: absolute;
  bottom: 20%;
  left: 0;
  right: 0;
  height: 25%;
}
.hill {
  position: absolute;
  width: 130%;
  height: 100%;
  border-radius: 50%;
  bottom: -50%;
}
.hill.h1 { left: -50%; background: #6d8967; transform: rotate(-3deg); }
.hill.h2 { right: -70%; bottom: -40%; background: #8aa07d; transform: rotate(2deg); }
.tree {
  position: absolute;
  bottom: 5%;
  width: 0;
  height: 0;
  border-left: 10px solid transparent;
  border-right: 10px solid transparent;
  border-bottom: 35px solid #4a6b47;
}
.tree.t1 { left: 12%; }
.tree.t2 { left: 22%; transform: scale(0.75); bottom: 3%; }
.tree.t3 { right: 18%; transform: scale(0.85); }

/* 小路 */
.trail {
  position: absolute;
  width: 50px;
  height: 75%;
  left: 46%;
  bottom: -15%;
  background: linear-gradient(180deg, rgba(236, 214, 168, 0.3), #ecd6a8);
  clip-path: polygon(35% 0, 65% 0, 100% 100%, 0 100%);
  transform: rotate(-4deg);
}
.trail-dashes {
  position: absolute;
  width: 30px;
  height: 60%;
  left: 48%;
  bottom: 5%;
  background: repeating-linear-gradient(
    180deg,
    rgba(180, 150, 100, 0.4) 0,
    rgba(180, 150, 100, 0.4) 8px,
    transparent 8px,
    transparent 16px
  );
  transform: rotate(-4deg);
}

/* 旅人 */
.traveler-scene {
  position: absolute;
  left: 47%;
  bottom: 28%;
  width: 30px;
  height: 44px;
  animation: traveler-walk 2s ease-in-out infinite;
}
@keyframes traveler-walk {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}
.traveler-shadow {
  position: absolute;
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
  width: 22px;
  height: 5px;
  background: radial-gradient(ellipse, rgba(30, 40, 25, 0.3), transparent 70%);
  border-radius: 50%;
}
.traveler-body { position: relative; width: 100%; height: 100%; }
.t-hat {
  position: absolute;
  left: 4px;
  top: 0;
  width: 22px;
  height: 7px;
  background: #c3723e;
  border-radius: 50%;
  z-index: 4;
  &::after {
    content: '';
    position: absolute;
    left: 5px;
    top: -4px;
    width: 12px;
    height: 7px;
    background: #e18a4b;
    border-radius: 6px 6px 2px 2px;
  }
}
.t-head {
  position: absolute;
  left: 8px;
  top: 6px;
  width: 14px;
  height: 14px;
  border-radius: 48%;
  background: #e6c39d;
  z-index: 3;
}
.t-torso {
  position: absolute;
  left: 6px;
  top: 18px;
  width: 18px;
  height: 18px;
  background: #d56f39;
  border-radius: 8px 8px 4px 4px;
  z-index: 2;
}
.t-pack {
  position: absolute;
  right: 10px;
  top: 20px;
  width: 11px;
  height: 15px;
  background: #435945;
  border-radius: 4px;
  z-index: 1;
}
.t-legs {
  position: absolute;
  left: 9px;
  top: 34px;
  width: 14px;
  height: 10px;
  border-left: 4px solid #394337;
  border-right: 4px solid #394337;
  transform: skew(-6deg);
}

/* 飞鸟 */
.birds {
  position: absolute;
  top: 20%;
  left: 20%;
  width: 100px;
  height: 30px;
}
.bird {
  position: absolute;
  width: 10px;
  height: 5px;
  border-top: 2px solid #4a5a4a;
  border-radius: 50%;
}
.bird.b1 { left: 0; top: 0; animation: bird-fly 3s ease-in-out infinite; }
.bird.b2 { left: 20px; top: 8px; transform: scale(0.7); animation: bird-fly 3.5s ease-in-out infinite 0.5s; }
.bird.b3 { left: 40px; top: 3px; transform: scale(0.6); animation: bird-fly 4s ease-in-out infinite 1s; }
@keyframes bird-fly {
  0%, 100% { transform: translateY(0) translateX(0); }
  50% { transform: translateY(-5px) translateX(8px); }
}

/* 欢迎页文案 */
.welcome-copy {
  flex: 1;
  padding: 32px 28px calc(24px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
}
.welcome-title {
  font-size: 36px;
  line-height: 1.3;
  margin: 12px 0 15px;
  color: #1c211b;
}
.welcome-desc {
  font-size: 14px;
  line-height: 1.9;
  color: #687067;
  margin-bottom: auto;
}
.welcome-copy .primary-button { margin-top: 24px; }
.preview-link {
  font-size: 11px;
  color: #899086;
  margin: 14px auto 0;
  padding: 6px 12px;
}

.worldIntro .welcome-art {
  background: linear-gradient(180deg, #769079 0%, #9aa888 50%, #ccd3aa 100%);
}

/* Route title fades into the full-screen map beneath it. */
.walk-header {
  min-height: 106px;
  align-items: start;
  padding-bottom: 20px;
  background: linear-gradient(180deg, rgba(246, 243, 234, .58) 0%, rgba(246, 243, 234, .22) 72%, rgba(246, 243, 234, 0) 100%);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  overflow: visible;
}
.header-left { padding-top: 1px; overflow: visible; }
.world-title-row { display: flex; align-items: center; gap: 7px; min-width: 0; }
.world { font-size: 25px; }
.map-attribution-button { flex: 0 0 24px; width: 24px; height: 24px; min-height: 24px; margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(83, 97, 82, .18); border-radius: 50%; color: #657164; background: rgba(255, 255, 255, .42); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
.map-attribution-button::after { display: none; }
.chapter-route {
  display: inline-flex;
  max-width: 100%;
  margin-top: 7px;
  padding: 5px 10px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, .42);
  border-radius: 999px;
  background: rgba(255, 255, 255, .38);
  color: #5e695d;
  font-size: 12px;
  line-height: 17px;
  text-overflow: ellipsis;
  white-space: nowrap;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.header-right { display: flex; flex-direction: column; align-items: center; padding-top: 0; }
.header-right .ring-inner { background: rgba(250, 249, 244, .96); box-shadow: 0 2px 8px rgba(42, 55, 43, .12); }
.header-right .ring-inner b { font-size: 13px; }
.header-right .ring-inner span { color: #747d73; font-size: 7px; line-height: 9px; white-space: nowrap; }

.rest-overlay {
  position: fixed;
  z-index: 10020;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(28, 35, 28, .34);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  animation: rest-fade .2s ease-out;
}
.rest-drawer {
  position: relative;
  width: min(100%, var(--mobile-width, 430px));
  padding: 12px 18px calc(18px + env(safe-area-inset-bottom));
  border-radius: 28px 28px 0 0;
  background: #faf8f2;
  text-align: center;
  box-shadow: 0 -14px 40px rgba(26, 35, 27, .16);
  animation: rest-up .32s var(--ease-out);
}
.drawer-handle { width: 38px; height: 4px; margin: 0 auto 13px; border-radius: 999px; background: #d9d6cc; }
.rest-scene { position: relative; width: 190px; height: 58px; margin: 0 auto 7px; overflow: hidden; }
.rest-scene image { position: absolute; z-index: 3; bottom: -2px; left: 50%; width: 48px; height: 54px; transform: translateX(-50%); }
.rest-sun { position: absolute; top: 7px; left: 44px; width: 10px; height: 10px; border-radius: 50%; background: #e2b768; }
.rest-mountain { position: absolute; right: 10px; bottom: 6px; left: 10px; height: 30px; background: #bbc6a5; clip-path: polygon(0 78%, 17% 26%, 31% 68%, 48% 16%, 67% 70%, 82% 34%, 100% 78%, 100% 100%, 0 100%); }
.rest-mountain.front { bottom: 1px; height: 22px; background: #8fa27e; opacity: .8; clip-path: polygon(0 82%, 21% 46%, 37% 82%, 57% 34%, 73% 78%, 90% 51%, 100% 74%, 100% 100%, 0 100%); }
.rest-title { display: block; color: #222922; font-size: 22px; font-weight: 700; line-height: 1.35; }
.rest-subtitle { display: block; margin-top: 4px; color: #858c82; font-size: 11px; }
.rest-distance { display: flex; align-items: baseline; justify-content: center; gap: 5px; margin-top: 12px; color: #171d18; }
.rest-distance b { font: 700 38px/1 var(--font-sans); }
.rest-distance text { font-size: 11px; font-weight: 700; }
.rest-distance-label { display: block; margin-top: 5px; color: #92978f; font-size: 9px; }
.rest-metrics { display: grid; grid-template-columns: repeat(3, 1fr); margin-top: 14px; padding: 13px 4px; border-radius: 16px; background: #f2f0e9; }
.rest-metrics > view { position: relative; display: flex; flex-direction: column; gap: 5px; }
.rest-metrics > view + view::before { content: ''; position: absolute; top: 2px; bottom: 2px; left: 0; width: 1px; background: #dddcd5; }
.rest-metrics b { color: #30372f; font-size: 13px; font-weight: 650; }
.rest-metrics small { font-size: 8px; font-weight: 500; }
.rest-metrics text { color: #858b82; font-size: 9px; }
.resume-button, .finish-button { width: 100%; height: 50px; border-radius: 25px; font-size: 13px; font-weight: 700; }
.resume-button { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 15px; background: #f17a32; color: #fff; box-shadow: 0 8px 20px rgba(226, 103, 37, .22); }
.finish-button { margin-top: 9px; border: 1px solid #deddd7; background: transparent; color: #555c54; }
@keyframes rest-fade { from { opacity: 0; } }
@keyframes rest-up { from { opacity: .7; transform: translateY(36px); } }
@media (max-width: 359px) {
  .walk-header { min-height: 102px; padding-inline: 10px; }
}
</style>
<style scoped>
.world{font-size:var(--type-section-title);font-weight:400}
.walk-header .eyebrow,.stats-label,.live-pill,.health-sync,.dev-title{font-size:var(--type-caption);letter-spacing:0}
.elapsed-value{font:500 var(--type-metric-large)/1.2 var(--font-sans);letter-spacing:0}
.metric-value,.primary-metric .metric-value{font:500 var(--type-metric)/1.2 var(--font-sans)}
.metric-unit,.metric-label,.walk-time,.next-distance text{font-size:var(--type-caption);letter-spacing:0}
.next-name{font-size:var(--type-card-title);font-weight:400}
.pause-copy span{font-size:var(--type-secondary)}
.welcome-title{font-size:var(--type-display-title);font-weight:400}
.welcome-desc{font-size:var(--type-secondary)}

/* Bottom journey card inspired by the illustrated map HUD. */
.journey-page { background: #f4f2ec; }
.immersive-map {
  inset: 0 0 278px !important;
  height: auto !important;
  padding-bottom: 0 !important;
}
.journey-page > .session-panel,
.journey-page > .walk-actions { display: none !important; }
.journey-bottom-card {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 12;
  height: 314px;
  padding: 50px 20px calc(16px + env(safe-area-inset-bottom));
  overflow: visible;
  color: #203525;
  background: linear-gradient(180deg,rgba(255,251,242,.985),rgba(250,246,236,.99));
  border: 1px solid rgba(255,255,255,.86);
  border-bottom: 0;
  border-radius: 50% 50% 0 0 / 42px 42px 0 0;
  box-shadow: 0 -10px 30px rgba(43,57,43,.08);
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
}
.bottom-pause-button {
  position: absolute;
  top: -31px;
  left: 50%;
  width: 64px;
  height: 64px;
  padding: 0;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 4px solid rgba(255,255,255,.9);
  border-radius: 50%;
  color: white;
  background: linear-gradient(145deg,#ffa449,#ed741e);
  box-shadow: 0 8px 20px rgba(224,107,31,.34), inset 0 1px 5px rgba(255,255,255,.46);
}
.bottom-side-button {
  position: absolute;
  top: -55px;
  width: 46px;
  height: 46px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #506451;
  background: rgba(255,252,245,.96);
  box-shadow: 0 5px 15px rgba(39,52,40,.16);
}
.bottom-side-button.debug { left: 20px; font-size: 10px; }
.bottom-side-button.locate { right: 20px; }
.bottom-side-button.active { color: white; background: #e88343; }
.bottom-distance-label { display: block; text-align: center; color: #767b74; font-size: 12px; }
.bottom-distance-reading { height: 78px; display: flex; align-items: baseline; justify-content: center; gap: 9px; }
.bottom-distance-reading > text { font: 600 68px/.98 var(--font-sans); letter-spacing: .5px; color: #133b2a; }
.bottom-distance-reading small { font-size: 13px; font-weight: 600; }
.bottom-route-pill { max-width: 380px; min-height: 44px; margin: 0 auto 15px; padding: 0 14px; display: grid; grid-template-columns: 1fr 1px 1.2fr; align-items: center; border: 1px solid #ebe3d3; border-radius: 24px; background: rgba(249,245,235,.78); box-shadow: inset 0 1px 2px rgba(255,255,255,.7); }
.route-pill-item { min-width: 0; display: flex; align-items: center; justify-content: center; gap: 5px; color: #70776f; white-space: nowrap; font-size: 10px; }
.route-pill-item:first-child :deep(svg) { color: #f28a31; fill: rgba(242,138,49,.16); }
.route-pill-item:last-child :deep(svg) { color: #6c9a72; }
.route-pill-item b { color: #394b3d; font-size: 11px; font-weight: 600; }
.route-pill-divider { width: 1px; height: 17px; background: #ded8cc; }
.bottom-metrics { max-width: 400px; height: 77px; margin: 0 auto; padding: 16px 0 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-top: 1px solid #eee9df; }
.bottom-metrics > view { min-width: 0; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding: 0 6px; text-align: center; }
.bottom-metrics > view + view { position: relative; }
.bottom-metrics > view + view::before { content: ''; position: absolute; left: 0; top: 3px; width: 1px; height: 36px; background: #ebe6dc; }
.bottom-metric-label { min-height: 16px; margin-bottom: 5px; display: flex; align-items: center; justify-content: center; gap: 4px; color: #777d76; font-size: 10px; }
.bottom-metrics > view:nth-child(1) .bottom-metric-label { color: #63906d; }
.bottom-metrics > view:nth-child(2) .bottom-metric-label { color: #ef7c29; }
.bottom-metrics > view:nth-child(3) .bottom-metric-label { color: #4f88b8; }
.bottom-metrics > view:nth-child(4) .bottom-metric-label { color: #9a7650; }
.bottom-metrics b { font: 500 17px/1.1 var(--font-sans); color: #28422f; white-space: nowrap; }
.bottom-metrics > view:first-child b { display: inline-block; text-align: center; font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1; }
.bottom-metrics small { margin-left: 5px; color: #81877f; font-size: 9px; }
.dev-panel { bottom: calc(318px + env(safe-area-inset-bottom)); }
@media (max-height: 720px) {
  .immersive-map { bottom: 250px !important; }
  .journey-bottom-card { height: 286px; padding-top: 44px; }
  .bottom-distance-reading { height: 66px; }
  .bottom-distance-reading > text { font-size: 58px; }
  .bottom-route-pill { margin-bottom: 10px; min-height: 40px; }
  .bottom-metrics { height: 65px; padding-top: 11px; }
}
</style>
