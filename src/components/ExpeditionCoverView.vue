<script setup lang="ts">
import ArtworkView from './ArtworkView.vue'
defineProps<{ imageAsset?: string | null; muted?: boolean }>()
</script>
<template><view class="cover"><ArtworkView :image-asset="imageAsset" :muted="muted" /></view></template>
<style scoped>.cover{width:100%;aspect-ratio:16/9;overflow:hidden}</style>
