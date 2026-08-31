<script setup lang="ts">
import ArtworkPlaceholderView from './ArtworkPlaceholderView.vue'
defineProps<{ imageAsset?: string | null }>()
</script>

<template>
  <view class="map-background" aria-hidden="true">
    <image v-if="imageAsset" class="map-image" :src="imageAsset" mode="scaleToFill" />
    <ArtworkPlaceholderView v-else />
  </view>
</template>

<style scoped>
.map-background,.map-image{position:absolute;inset:0;width:100%;height:100%}.map-background{pointer-events:none}.map-image{display:block}
</style>
