<script setup lang="ts">
withDefaults(defineProps<{ muted?: boolean }>(), { muted: false })
</script>

<template>
  <view class="artwork-placeholder" :class="{ muted }" aria-hidden="true" />
</template>

<style scoped>
.artwork-placeholder {
  width: 100%;
  height: 100%;
  background:
    radial-gradient(circle at 22% 18%, rgba(255,255,255,.22), transparent 38%),
    linear-gradient(145deg, #dce1d8, #d6d9cf);
}
.artwork-placeholder.muted {
  filter: saturate(.35);
  opacity: .7;
  background: linear-gradient(145deg, #e2e1da, #d8d9d2);
}
</style>
