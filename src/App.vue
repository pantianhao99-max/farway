<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onLaunch } from '@dcloudio/uni-app'
import { useJourneyStore } from '@/stores/journey'
import SplashScreen from '@/components/SplashScreen.vue'

const journey = useJourneyStore()
const showSplash = ref(true)

onLaunch(() => {
  journey.hydrate()
})

function onSplashFinish() {
  showSplash.value = false
}
</script>

<template>
  <view class="app-root">
    <!-- 启动加载页 -->
    <SplashScreen v-if="showSplash" :min-duration="1400" @finish="onSplashFinish" />
  </view>
</template>

<style scoped lang="scss">
.app-root {
  position: fixed;
  z-index: 9999;
  inset: 0;
  width: 0;
  height: 0;
  overflow: visible;
}
</style>
