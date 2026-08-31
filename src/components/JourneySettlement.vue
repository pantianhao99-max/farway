<script setup lang="ts">
import { Sparkles } from '@lucide/vue'
defineProps<{ distance: number }>()
defineEmits<{ 'continue': []; 'close': [] }>()
</script>

<template>
  <Teleport to="body">
    <view class="overlay">
      <view class="settlement">
        <!-- 顶部装饰条 -->

        <text class="eyebrow">今日旅程</text>
        <text class="title serif">今天走了</text>

        <view class="distance-display">
          <text class="number">{{ distance.toFixed(1) }}</text>
          <text class="unit">公里</text>
        </view>

        <view class="divider">
          <i /><Sparkles :size="16" /><i />
        </view>

        <text class="copy">每一步，都会带你去往更远的地方。</text>

        <button class="primary-button" @click="$emit('continue')">继续旅程</button>
        <button class="later" @click="$emit('close')">关闭</button>
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
  z-index: 9998;
  background: rgba(25, 33, 25, 0.45);
  backdrop-filter: blur(9px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  animation: fade-in 0.3s ease;
}

.settlement {
  width: 100%;
  padding: 16px 30px calc(26px + env(safe-area-inset-bottom));
  border-radius: 32px 32px 0 0;
  text-align: center;
  background: #f6f3ea;
  animation: rise 0.45s cubic-bezier(0.2, 0.8, 0.2, 1);
  position: relative;
}

/* 顶部把手 */
.handle {
  width: 40px;
  height: 4px;
  border-radius: 2px;
  background: #d8d3c6;
  margin: 0 auto 20px;
}

.title {
  display: block;
  font-size: 27px;
  margin: 14px 0 7px;
  color: #1c211b;
}

.distance-display {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 6px;
  margin: 8px 0;
}
.number {
  font: 500 64px/1 var(--font-sans);
  color: #e88343;
  letter-spacing: -2px;
}
.unit {
  font-size: 16px;
  letter-spacing: 3px;
  color: #8a9087;
  font-weight: 600;
}

.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 160px;
  margin: 24px auto;
  color: #c59c63;
}
.divider i {
  height: 1px;
  flex: 1;
  background: linear-gradient(90deg, transparent, #d9ceb7, transparent);
}
.divider span {
  font-size: 14px;
}

.copy {
  display: block;
  color: #6e756b;
  font-size: 14px;
  line-height: 1.8;
  margin-bottom: 28px;
}

.later {
  margin: 14px auto 0;
  color: #8a8f86;
  font-size: 12px;
  padding: 7px 16px;
  opacity: .72;
  border: 0;
  transition: opacity 0.2s;
}
.later:active { opacity: 0.6; }

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes rise {
  from { transform: translateY(100%); }
  to { transform: none; }
}
</style>
<style scoped>
.title{font-size:var(--type-section-title);font-weight:400}
.number{font:500 var(--type-metric-large)/1.2 var(--font-sans);letter-spacing:0}
.unit{font-size:var(--type-secondary);letter-spacing:0}
.copy,.later{font-size:var(--type-secondary)}
</style>
