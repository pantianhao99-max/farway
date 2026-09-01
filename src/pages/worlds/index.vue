<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useJourneyStore } from '@/stores/journey'
import { worldRepository } from '@/services/journey/WorldRepository'
import ExpeditionCoverView from '@/components/ExpeditionCoverView.vue'
import type { World } from '@/types/journey'
import { distanceFormatter } from '@/services/journey/DistanceFormatter'
import { useAppLocale } from '@/services/presentation/AppLocale'

const journey = useJourneyStore()
const { localeClass, t } = useAppLocale()
const loading = ref(false)
onShow(() => uni.showTabBar({ animation: false }))
const worlds = computed(() => worldRepository.getAll().sort((a,b) => Number(b.id === journey.state.activeWorldId) - Number(a.id === journey.state.activeWorldId)))
const lockedWorlds = [{ id:'arctic', name:'极北之地', subtitle:'冰原尽头，即将开放', distance:180 }, { id:'desert', name:'沙海古道', subtitle:'穿越沙丘，即将开放', distance:240 }]
function progressFor(world:World){const p=world.id===journey.state.activeWorldId?journey.state:journey.state.progressByWorld[world.id];return p?Math.min(100,Math.round(p.currentDistance/world.totalDistance*100)):0}
function distanceFor(world:World){const p=world.id===journey.state.activeWorldId?journey.state:journey.state.progressByWorld[world.id];return p?.currentDistance??0}
function choose(id:string){journey.selectWorld(id);uni.navigateTo({url:'/pages/journey/index'})}
function locked(){uni.showToast({title:'这片远方还在准备中',icon:'none'})}
</script>

<template><view class="safe-page worlds page-enter" :class="localeClass">
  <header><text class="eyebrow">{{ t('expeditions') }}</text><text class="title serif">选择一片远方</text><text class="subtitle">每一段现实里的路，都通往一处尚未见过的风景。</text></header>
  <view class="section-head"><text class="section-title serif">可以出发</text><text class="section-count">{{ worlds.length }} 条路线</text></view>
  <view v-if="loading" class="loading-state"><view class="loading-dot"/><text>正在展开地图</text></view>
  <view v-else-if="!worlds.length" class="empty-state"><text class="serif">远方还没有寄来新的路线</text><text>过一会儿再来看看。</text></view>
  <view v-else class="list">
    <view v-for="world in worlds" :key="world.id" class="expedition-card pressable" @click="choose(world.id)">
      <view class="cover-shell"><ExpeditionCoverView :image-asset="world.assets.coverImage"/><view class="cover-top"><text class="distance">{{ distanceFormatter.km(world.totalDistance,0) }}</text><text v-if="world.id===journey.state.activeWorldId" class="status-pill">远征中</text></view></view>
      <view class="card-body"><view class="name-row"><view><text class="name serif">{{ world.name }}</text><text class="description">{{ world.subtitle }}</text></view><text class="percent">{{ progressFor(world) }}%</text></view>
        <view class="progress-track"><view :style="{width:progressFor(world)+'%'}"/></view><view class="progress-copy"><text>已前进 {{ distanceFormatter.km(distanceFor(world)) }}</text><text>全程 {{ distanceFormatter.km(world.totalDistance,0) }}</text></view>
      </view>
    </view>
  </view>
  <view class="section-head upcoming"><text class="section-title serif">尚未开放</text><text class="section-count">{{ lockedWorlds.length }} 条路线</text></view>
  <view class="list locked-list"><view v-for="world in lockedWorlds" :key="world.id" class="expedition-card locked-card pressable" @click="locked">
    <view class="cover-shell"><ExpeditionCoverView :image-asset="null" muted/><view class="cover-top"><text class="distance">{{distanceFormatter.km(world.distance,0)}}</text><text class="status-pill locked">未开放</text></view></view>
    <view class="card-body"><text class="name serif">{{world.name}}</text><text class="description">{{world.subtitle}}</text></view>
  </view></view>
</view></template>

<style scoped lang="scss">
.worlds{padding:36px var(--space-page) calc(88px + env(safe-area-inset-bottom));background:var(--surface-page)}header{padding:0 2px 10px}.title{display:block;margin-top:8px;font-size:34px;line-height:1.25;color:var(--text-primary)}.subtitle{display:block;max-width:330px;margin-top:10px;font-size:13px;line-height:1.75;color:var(--text-secondary)}.section-head{display:flex;align-items:baseline;justify-content:space-between;margin:28px 2px 14px}.section-title{font-size:21px}.section-count{font-size:11px;color:var(--text-tertiary)}.upcoming{margin-top:36px}.list{display:grid;gap:18px}.locked-list{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.expedition-card{overflow:hidden;border:1px solid var(--card-border);border-radius:24px;background:var(--surface-card);box-shadow:var(--shadow-card)}.cover-shell{position:relative}.cover-top{position:absolute;top:14px;right:14px;left:14px;display:flex;justify-content:space-between}.distance{display:flex;align-items:center;min-height:24px;padding:0 10px;border-radius:999px;background:rgba(250,249,244,.8);color:#566157;font-size:9px;font-weight:700;letter-spacing:1px;backdrop-filter:blur(8px)}.card-body{padding:19px 19px 20px}.name-row{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.name{display:block;font-size:23px;line-height:1.25;color:var(--text-primary)}.description{display:block;margin-top:6px;font-size:12px;line-height:1.55;color:var(--text-secondary)}.percent{padding-top:3px;font:600 17px var(--font-serif);color:var(--brand-accent)}.progress-track{height:5px;margin-top:18px;overflow:hidden;border-radius:999px;background:var(--surface-subtle)}.progress-track view{height:100%;border-radius:inherit;background:var(--brand-primary);transition:width .5s var(--ease-out)}.progress-copy{display:flex;justify-content:space-between;margin-top:8px;color:var(--text-tertiary);font-size:9px}.locked-card{box-shadow:0 6px 20px rgba(46,58,44,.045)}.locked-card .cover-top{top:10px;right:10px;left:10px}.locked-card .distance{min-height:22px;padding:0 7px}.locked-card .card-body{padding:14px 14px 16px}.locked-card .name,.locked-card .description{color:var(--text-tertiary)}.loading-state,.empty-state{display:flex;min-height:180px;flex-direction:column;align-items:center;justify-content:center;gap:10px;border:1px dashed var(--line);border-radius:22px;color:var(--text-tertiary);font-size:12px}.empty-state .serif{font-size:17px;color:var(--text-secondary)}.loading-dot{width:8px;height:8px;border-radius:50%;background:var(--brand-primary);animation:pulse 1.3s ease-in-out infinite}@keyframes pulse{50%{opacity:.25;transform:scale(.7)}}
</style>
<style scoped>
.title{font-size:var(--type-display-title);font-weight:400;line-height:var(--leading-title)}
.subtitle{font-size:var(--type-secondary)}
.section-title{font-size:var(--type-section-title);font-weight:400}
.section-count,.description,.progress-copy,.loading-state,.empty-state{font-size:var(--type-caption)}
.name{font-size:var(--type-card-title);font-weight:400}
.distance{font-size:var(--type-caption);letter-spacing:0}
.percent{font:500 var(--type-metric)/1.2 var(--font-sans)}
</style>
