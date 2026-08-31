<script setup lang="ts">
import ArtworkPlaceholderView from './ArtworkPlaceholderView.vue'

withDefaults(defineProps<{
  imageAsset?: string | null
  muted?: boolean
  mode?: 'aspectFill' | 'aspectFit'
}>(), { imageAsset: null, muted: false, mode: 'aspectFill' })
</script>

<template>
  <image v-if="imageAsset" class="artwork-image" :src="imageAsset" :mode="mode" />
  <ArtworkPlaceholderView v-else :muted="muted" />
</template>

<style scoped>
.artwork-image { display: block; width: 100%; height: 100%; }
</style>
