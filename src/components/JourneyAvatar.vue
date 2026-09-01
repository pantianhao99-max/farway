<script setup lang="ts">
import { computed } from 'vue'
import { travelerDirectionAsset, type TravelerDirection } from '@/services/journey/TravelerDirection'

const props = defineProps<{ imageAsset: string | null; direction?: TravelerDirection }>()
const displayedAsset = computed(() => props.direction ? travelerDirectionAsset(props.direction) : props.imageAsset)
</script>

<template>
  <view class="traveler" aria-label="当前人物">
    <image v-if="displayedAsset" class="traveler-image" :src="displayedAsset" mode="aspectFit" />
    <view v-else class="traveler-fallback" aria-hidden="true" />
  </view>
</template>

<style scoped>
.traveler {
  width: 70px;
  height: 70px;
  animation: traveler-bob 1.8s ease-in-out infinite;
  filter: drop-shadow(0 7px 5px rgba(35, 43, 31, .2));
}
.traveler-image { display: block; width: 100%; height: 100%; }
.traveler-fallback { width: 22px; height: 22px; margin: 32px; border: 4px solid white; border-radius: 50%; background: #e88343; box-shadow: 0 3px 10px rgba(35,43,31,.3); }
@keyframes traveler-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}
</style>
