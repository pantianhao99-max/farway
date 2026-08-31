<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Smartphone, X } from '@lucide/vue'

const props = defineProps<{
  minDuration?: number
}>()

const emit = defineEmits<{ finish: [] }>()

const progress = ref(0)
const isDesktop = ref(false)
const showHint = ref(false)

const isMobile = computed(() => {
  if (typeof navigator === 'undefined') return true
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || window.innerWidth <= 430
})

onMounted(() => {
  isDesktop.value = !isMobile.value
  showHint.value = isDesktop.value

  // 模拟加载进度
  const minTime = props.minDuration ?? 1200
  const startTime = Date.now()
  const interval = setInterval(() => {
    const elapsed = Date.now() - startTime
    const targetProgress = Math.min(100, (elapsed / minTime) * 100)
    // 加一点随机波动，让进度更自然
    progress.value = Math.min(100, targetProgress + Math.random() * 3)

    if (elapsed >= minTime && progress.value >= 95) {
      clearInterval(interval)
      progress.value = 100
      setTimeout(() => {
        emit('finish')
      }, 300)
    }
  }, 50)
})

function dismissHint() {
  showHint.value = false
}
</script>

<template>
  <view class="splash-screen">
    <!-- 背景层 -->
    <view class="splash-bg">
      <view class="bg-sky" />
      <view class="bg-mountains">
        <view class="mountain m1" />
        <view class="mountain m2" />
        <view class="mountain m3" />
      </view>
      <view class="bg-ground" />
      <view class="bg-sun" />
      <view class="bg-cloud c1" />
      <view class="bg-cloud c2" />
    </view>

    <!-- 品牌内容 -->
    <view class="splash-content">
      <view class="brand-logo">
        <view class="logo-scene">
          <view class="logo-sun" />
          <view class="logo-mountain lm1" />
          <view class="logo-mountain lm2" />
          <view class="logo-traveler">
            <view class="lt-hat" />
            <view class="lt-head" />
            <view class="lt-body" />
            <view class="lt-legs" />
          </view>
          <view class="logo-path" />
        </view>
      </view>

      <view class="brand-text">
        <text class="brand-name serif">远方</text>
        <text class="brand-sub">步履不停，远方不远</text>
        <text class="brand-tagline">走着走着，就到了很远的地方</text>
      </view>

      <!-- 加载进度 -->
      <view class="loading-area">
        <view class="progress-track">
          <view class="progress-fill" :style="{ width: progress + '%' }" />
        </view>
        <text class="loading-text">{{ Math.round(progress) }}%</text>
      </view>
    </view>

    <!-- 电脑端提示 -->
    <view v-if="showHint" class="desktop-hint" @click="dismissHint">
      <view class="hint-icon"><Smartphone :size="22" /></view>
      <view class="hint-content">
        <text class="hint-title">这是手机端应用</text>
        <text class="hint-desc">按 F12 打开开发者工具，切换到手机模式可获得最佳体验</text>
      </view>
      <view class="hint-close"><X :size="18" /></view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.splash-screen {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #f6f3ea;
}

/* 背景层 */
.splash-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.bg-sky {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, #c8ddb8 0%, #e0d8a8 50%, #e8d8a0 100%);
}
.bg-sun {
  position: absolute;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #fbe6a8, #f0c86a);
  top: 15%;
  right: 20%;
  box-shadow: 0 0 60px rgba(245, 214, 138, 0.6);
  animation: sun-glow 3s ease-in-out infinite;
}
@keyframes sun-glow {
  0%, 100% { box-shadow: 0 0 60px rgba(245, 214, 138, 0.6); }
  50% { box-shadow: 0 0 80px rgba(245, 214, 138, 0.8); }
}
.bg-cloud {
  position: absolute;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 50px;
}
.bg-cloud.c1 {
  width: 80px;
  height: 18px;
  top: 18%;
  left: 10%;
  animation: cloud-drift 25s linear infinite;
}
.bg-cloud.c2 {
  width: 60px;
  height: 14px;
  top: 28%;
  right: 15%;
  opacity: 0.6;
  animation: cloud-drift 30s linear infinite reverse;
}
@keyframes cloud-drift {
  from { transform: translateX(-20px); }
  to { transform: translateX(20px); }
}
.bg-mountains {
  position: absolute;
  bottom: 25%;
  left: 0;
  right: 0;
  height: 35%;
}
.mountain {
  position: absolute;
  bottom: 0;
  transform: rotate(45deg);
  border-radius: 12%;
}
.mountain.m1 {
  width: 55%;
  height: 90%;
  left: -10%;
  background: linear-gradient(135deg, #6d8967, #5a7555);
}
.mountain.m2 {
  width: 45%;
  height: 75%;
  right: -5%;
  background: linear-gradient(135deg, #8aa07d, #7a9070);
}
.mountain.m3 {
  width: 35%;
  height: 60%;
  left: 35%;
  background: linear-gradient(135deg, #9aaa88, #8a9a78);
  opacity: 0.7;
}
.bg-ground {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 28%;
  background: linear-gradient(180deg, #a8b890 0%, #8a9a78 100%);
}

/* 品牌内容 */
.splash-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 40px;
}

/* Logo */
.brand-logo {
  width: 140px;
  height: 140px;
  margin-bottom: 24px;
}
.logo-scene {
  position: relative;
  width: 100%;
  height: 100%;
  background: linear-gradient(180deg, #c8ddb8, #e0d8a8);
  border-radius: 50%;
  overflow: hidden;
  box-shadow:
    0 8px 30px rgba(80, 106, 75, 0.2),
    inset 0 0 0 3px rgba(255, 255, 255, 0.5);
}
.logo-sun {
  position: absolute;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #fbe6a8, #f0c86a);
  top: 22%;
  right: 22%;
  box-shadow: 0 0 20px rgba(245, 214, 138, 0.6);
}
.logo-mountain {
  position: absolute;
  bottom: 20%;
  transform: rotate(45deg);
  border-radius: 10%;
}
.logo-mountain.lm1 {
  width: 50%;
  height: 50%;
  left: -10%;
  background: #6d8967;
}
.logo-mountain.lm2 {
  width: 40%;
  height: 40%;
  right: -5%;
  background: #8aa07d;
}
.logo-path {
  position: absolute;
  bottom: 15%;
  left: 45%;
  width: 16px;
  height: 35%;
  background: rgba(236, 214, 168, 0.8);
  clip-path: polygon(35% 0, 65% 0, 100% 100%, 0 100%);
  transform: rotate(-3deg);
}
.logo-traveler {
  position: absolute;
  bottom: 32%;
  left: 48%;
  width: 16px;
  height: 24px;
  animation: traveler-bob 1.5s ease-in-out infinite;
}
@keyframes traveler-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
}
.lt-hat {
  position: absolute;
  left: 2px;
  top: 0;
  width: 12px;
  height: 4px;
  background: #c3723e;
  border-radius: 50%;
}
.lt-hat::after {
  content: '';
  position: absolute;
  left: 3px;
  top: -3px;
  width: 6px;
  height: 4px;
  background: #e18a4b;
  border-radius: 3px 3px 1px 1px;
}
.lt-head {
  position: absolute;
  left: 4px;
  top: 4px;
  width: 8px;
  height: 8px;
  border-radius: 48%;
  background: #e6c39d;
}
.lt-body {
  position: absolute;
  left: 3px;
  top: 11px;
  width: 10px;
  height: 10px;
  background: #d56f39;
  border-radius: 4px 4px 2px 2px;
}
.lt-legs {
  position: absolute;
  left: 4px;
  top: 20px;
  width: 8px;
  height: 5px;
  border-left: 3px solid #394337;
  border-right: 3px solid #394337;
}

/* 品牌文字 */
.brand-text {
  text-align: center;
  margin-bottom: 32px;
}
.brand-name {
  display: block;
  font-size: 42px;
  font-weight: 600;
  color: #1c211b;
  letter-spacing: 2px;
  line-height: 1.1;
}
.brand-sub {
  display: block;
  font-size: 20px;
  color: #506a4b;
  letter-spacing: 8px;
  margin-top: 4px;
  margin-left: 8px;
}
.brand-tagline {
  display: block;
  font-size: 13px;
  color: #8a9087;
  margin-top: 14px;
  letter-spacing: 1px;
}

/* 加载区域 */
.loading-area {
  width: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.progress-track {
  width: 100%;
  height: 4px;
  background: rgba(80, 106, 75, 0.15);
  border-radius: 2px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #e88343, #f0a876);
  border-radius: 2px;
  transition: width 0.1s ease;
  box-shadow: 0 0 8px rgba(232, 131, 67, 0.4);
}
.loading-text {
  font-size: 11px;
  color: #8a9087;
  letter-spacing: 2px;
}

/* 电脑端提示 */
.desktop-hint {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  width: min(320px, 80%);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-radius: 14px;
  box-shadow: 0 8px 30px rgba(31, 43, 31, 0.12);
  z-index: 10;
  animation: hint-up 0.5s ease;
}
@keyframes hint-up {
  from { opacity: 0; transform: translateX(-50%) translateY(10px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
.hint-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: rgba(80, 106, 75, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 18px;
}
.hint-content {
  flex: 1;
  min-width: 0;
}
.hint-title {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #1c211b;
  margin-bottom: 2px;
}
.hint-desc {
  display: block;
  font-size: 11px;
  color: #6e756b;
  line-height: 1.5;
}
.hint-close {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #8a9087;
  font-size: 16px;
}
</style>
