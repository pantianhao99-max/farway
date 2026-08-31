<script setup lang="ts">
import ArtworkView from './ArtworkView.vue'
defineProps<{ imageAsset?: string | null }>()
</script>
<template><view class="art"><ArtworkView :image-asset="imageAsset" /></view></template>
<style scoped>.art{width:100%;aspect-ratio:16/10;overflow:hidden}</style>
