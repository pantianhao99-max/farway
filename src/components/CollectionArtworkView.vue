<script setup lang="ts">
import ArtworkView from './ArtworkView.vue'
defineProps<{ imageAsset?: string | null; muted?: boolean }>()
</script>
<template><view class="art"><ArtworkView :image-asset="imageAsset" :muted="muted" /></view></template>
<style scoped>.art{width:100%;aspect-ratio:4/3;overflow:hidden}</style>
