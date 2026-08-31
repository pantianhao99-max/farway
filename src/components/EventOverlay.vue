<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { JourneyEvent } from '@/types/journey'
import DiscoveryArtworkView from './DiscoveryArtworkView.vue'
import { useJourneyStore } from '@/stores/journey'
import { Sparkles } from '@lucide/vue'
import { formatNodeDistance } from '@/services/journey/NodeDistanceFormatter'

const props = defineProps<{ event: JourneyEvent }>()
const journey = useJourneyStore()
defineEmits<{ continue: [] }>()

const revealed = ref(false)

watch(() => props.event, () => {
  revealed.value = false
  if (props.event.type === 'checkpoint' && props.event.checkpoint.hiddenBeforeUnlock) {
    setTimeout(() => { revealed.value = true }, 800)
  } else {
    revealed.value = true
  }
}, { immediate: true })

const checkpoint = computed(() =>
  props.event.type === 'checkpoint' ? props.event.checkpoint : null
)
const routePoints = computed(() => journey.world.pathPoints.map(point => `${point.x * 100},${(1 - point.y) * 100}`).join(' '))
</script>

<template>
  <Teleport to="body">
    <view v-if="event.type !== 'move'" class="overlay">
      <!-- 发现新地点 -->
      <view v-if="event.type === 'checkpoint' && checkpoint" class="discovery card-panel">
      <view class="panel-header">
        <view class="sparkle" />
        <text class="eyebrow">发现新地点</text>
        <view class="sparkle" />
      </view>

      <view class="art">
        <DiscoveryArtworkView :image-asset="checkpoint.artworkImage" />
        <view v-if="!revealed" class="mystery">
          <text class="mystery-text">???</text>
          <view class="mystery-glow" />
        </view>
      </view>

      <view :class="['reveal', { shown: revealed }]">
        <text class="distance">{{ formatNodeDistance(checkpoint.distance) }}</text>
        <text class="name serif">{{ checkpoint.name }}</text>
        <text class="desc">{{ checkpoint.shortDescription }}</text>
      </view>

      <button class="primary-button" @click="$emit('continue')">收下这片风景</button>
    </view>

    <!-- 章节切换 -->
    <view v-else-if="event.type === 'chapter'" class="chapter card-panel">
      <view class="chapter-ornament">
        <view class="ornament-line" />
        <text class="eyebrow">第 {{ event.chapter.number }} 章</text>
        <view class="ornament-line" />
      </view>

      <text class="chapter-title serif">第{{ ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][event.chapter.number - 1] }}段</text>
      <text class="chapter-name serif">{{ event.chapter.name }}</text>

      <view class="chapter-divider">
        <view class="diamond" />
      </view>

      <text class="atmosphere">{{ event.chapter.atmosphere }}</text>

      <button class="primary-button" @click="$emit('continue')">走进新篇章</button>
    </view>

    <!-- 旅程完成 -->
    <view v-else class="complete card-panel">
      <view class="complete-glow" />
      <text class="eyebrow">{{ journey.world.name }}</text>
      <text class="complete-title serif">旅程完成</text>

      <view class="hundred-display">
        <text class="hundred">{{ journey.world.totalDistance }}</text>
        <text class="km">公里</text>
      </view>

      <view class="divider">
        <i /><Sparkles :size="16" /><i />
      </view>

      <text class="ending">你终于走到了<br /><b class="serif">{{ journey.world.checkpoints.at(-1)?.name }}</b></text>

      <view class="route-miniature">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <polyline :points="routePoints" fill="none" stroke="#d87942" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
        </svg>
      </view>

      <view class="complete-stats">
        <text>发现 {{ journey.state.unlockedCheckpointIds.length }} 处地点</text>
        <text>{{ new Date(journey.state.startedAt).toLocaleDateString('zh-CN') }} 出发</text>
        <text>{{ new Date().toLocaleDateString('zh-CN') }} 完成</text>
      </view>

      <button class="primary-button" @click="$emit('continue')">回顾旅程</button>
    </view>
    </view>
  </Teleport>
</template>

<style scoped lang="scss">
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
  background: rgba(29, 38, 29, 0.64);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 22px;
  animation: fade-in 0.3s ease;
}

.card-panel {
  width: 100%;
  max-width: 390px;
  background: #f6f3ea;
  border-radius: 28px;
  padding: 24px;
  text-align: center;
  box-shadow: 0 28px 70px rgba(20, 28, 20, 0.3);
  animation: pop 0.45s cubic-bezier(0.2, 0.8, 0.2, 1);
  position: relative;
  overflow: hidden;
}

/* —— 发现新地点 —— */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 4px;
}
.sparkle {
  width: 6px;
  height: 6px;
  background: #e88343;
  border-radius: 50%;
  animation: sparkle 1.5s ease-in-out infinite;
}
.sparkle:last-child { animation-delay: 0.75s; }
@keyframes sparkle {
  0%, 100% { transform: scale(1); opacity: 0.6; }
  50% { transform: scale(1.4); opacity: 1; }
}

.art {
  height: 230px;
  border-radius: 20px;
  overflow: hidden;
  margin: 16px 0;
  position: relative;
  box-shadow: inset 0 0 30px rgba(0, 0, 0, 0.05);
}
.mystery {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(40, 54, 41, 0.75);
  backdrop-filter: blur(6px);
}
.mystery-text {
  color: white;
  font: 700 48px var(--font-sans);
  letter-spacing: 12px;
  position: relative;
  z-index: 1;
  animation: mystery-pulse 2s ease-in-out infinite;
}
@keyframes mystery-pulse {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}
.mystery-glow {
  position: absolute;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(232, 131, 67, 0.3), transparent 70%);
  animation: glow-pulse 3s ease-in-out infinite;
}
@keyframes glow-pulse {
  0%, 100% { transform: scale(0.8); opacity: 0.5; }
  50% { transform: scale(1.2); opacity: 0.8; }
}

.reveal {
  opacity: 0;
  transform: translateY(7px);
  transition: all 0.5s ease;
}
.reveal.shown {
  opacity: 1;
  transform: none;
}
.distance {
  display: block;
  color: #a36c43;
  font-size: 10px;
  letter-spacing: .5px;
  font-weight: 600;
}
.name {
  display: block;
  font-size: 30px;
  margin: 7px;
  color: #1c211b;
}
.desc {
  display: block;
  color: #697067;
  font-size: 13px;
  line-height: 1.8;
  width: min(100%, 280px);
  margin: 0 auto 19px;
  letter-spacing: 0;
  text-align: center;
  word-break: normal;
  overflow-wrap: break-word;
}

/* —— 章节切换 —— */
.chapter {
  padding: 48px 28px;
}
.chapter-ornament {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 8px;
}
.ornament-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, #c59c63, transparent);
}
.chapter-title {
  display: block;
  font-size: 18px;
  margin: 23px 0 5px;
  color: #8a9087;
  letter-spacing: 4px;
}
.chapter-name {
  display: block;
  font-size: 36px;
  color: #1c211b;
  letter-spacing: 2px;
}
.chapter-divider {
  display: flex;
  justify-content: center;
  margin: 22px 0;
}
.diamond {
  width: 8px;
  height: 8px;
  background: #c59c63;
  transform: rotate(45deg);
  box-shadow: 0 0 12px rgba(197, 156, 99, 0.4);
}
.atmosphere {
  display: block;
  color: #677065;
  font-size: 14px;
  line-height: 2;
  margin-bottom: 34px;
  font-style: italic;
}

/* —— 旅程完成 —— */
.complete {
  padding: 44px 28px;
}
.complete-glow {
  position: absolute;
  top: -60px;
  left: 50%;
  transform: translateX(-50%);
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(232, 131, 67, 0.15), transparent 70%);
  pointer-events: none;
}
.complete-title {
  display: block;
  font-size: 34px;
  margin: 18px 0 10px;
  color: #1c211b;
}
.route-miniature {
  height: 86px;
  width: 150px;
  margin: 14px auto;
  padding: 8px 34px;
  border-radius: 16px;
  background: linear-gradient(180deg, #dce4d0, #f0dfb8);
}
.route-miniature svg { width: 100%; height: 100%; }
.complete-stats {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 6px 12px;
  margin: 10px 0 18px;
  color: #737b70;
  font-size: 11px;
}
.hundred-display {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 8px;
  margin: 10px 0;
}
.hundred {
  font: 500 72px/1 var(--font-sans);
  color: #e88343;
  letter-spacing: -3px;
}
.km {
  font-size: 18px;
  letter-spacing: 4px;
  color: #8a9087;
  font-weight: 600;
}
.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 140px;
  margin: 22px auto;
  color: #c59c63;
}
.divider i {
  height: 1px;
  flex: 1;
  background: linear-gradient(90deg, transparent, #d9ceb7, transparent);
}
.ending {
  display: block;
  margin: 20px 0 32px;
  color: #667064;
  line-height: 2.2;
  font-size: 15px;
}
.ending b {
  font-size: 26px;
  color: #283329;
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes pop {
  from {
    opacity: 0;
    transform: scale(0.92) translateY(15px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
</style>
<style scoped>
.discovery-title,.complete-title{font-size:var(--type-page-title);font-weight:400;letter-spacing:0}
.chapter-title{font-size:var(--type-card-title);font-weight:400;letter-spacing:0}
.description,.complete-copy{font-size:var(--type-secondary);letter-spacing:0}
.distance-number{font:500 var(--type-metric-large)/1.2 var(--font-sans);letter-spacing:0}
.km{font-size:var(--type-secondary);letter-spacing:0}
</style>
