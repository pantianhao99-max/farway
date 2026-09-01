<script setup lang="ts">
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { Map, Footprints } from '@lucide/vue'
import { useJourneyStore } from '@/stores/journey'
import { worldRepository } from '@/services/journey/WorldRepository'
import type { World,WorldProgress } from '@/types/journey'
import { useAppLocale } from '@/services/presentation/AppLocale'
import { travelerOptions } from '@/data/travelers'
const j=useJourneyStore();onShow(()=>uni.showTabBar({animation:false}))
const { localeClass, t } = useAppLocale()
function progressFor(w:World):WorldProgress{return w.id===j.state.activeWorldId?j.state:(j.state.progressByWorld[w.id]??{currentDistance:0,unlockedCheckpointIds:[w.checkpoints[0].id],discoveries:[],presentedDiscoveryIds:[],discoveredChapterIds:[w.chapters[0].id],totalDistanceWalked:0,settlementHistory:[],startedAt:''})}
const maps=computed(()=>worldRepository.getAll().map(world=>{const p=progressFor(world),collected=world.checkpoints.filter(c=>p.unlockedCheckpointIds.includes(c.id)).length;return{world,p,collected,percent:Math.min(100,Math.round(p.currentDistance/world.totalDistance*100))}}))
const totalCollected=computed(()=>j.allUnlockedNodeCount),totalEntries=computed(()=>j.allNodeCount),completed=computed(()=>maps.value.filter(m=>m.p.currentDistance>=m.world.totalDistance).length)
function open(id:string){uni.navigateTo({url:`/pages/atlas/index?worldId=${encodeURIComponent(id)}`})}
function selectTraveler(id:string){j.selectTraveler(id);uni.showToast({title:'已设为行走形象',icon:'none'})}
</script>
<template><view class="safe-page profile page-enter" :class="localeClass">
  <header><text class="eyebrow">{{ t('myJourney') }}</text><text class="title serif">我的旅途</text><text class="subtitle">记录每一步走过的风景</text></header>
  <view class="stats"><view class="stat"><text>累计前进</text><b>{{j.lifetimeDistance.toFixed(1)}}</b><small>km</small></view><i/><view class="stat"><text>收集图鉴</text><b>{{totalCollected}}</b><small>/ {{totalEntries}}</small></view><i/><view class="stat"><text>完成远征</text><b>{{completed}}</b><small>次</small></view></view>
  <view class="traveler-settings">
    <view class="traveler-heading"><view><text class="section-title serif">行走形象</text><text class="section-subtitle">选择陪你走过远方的旅人</text></view><text class="traveler-count">{{ travelerOptions.length }} 个可选</text></view>
    <scroll-view class="traveler-list" scroll-x :show-scrollbar="false"><view class="traveler-list-inner">
      <button v-for="item in travelerOptions" :key="item.id" class="traveler-option" :class="{'is-selected':j.state.travelerId===item.id}" @click="selectTraveler(item.id)">
        <view class="traveler-preview"><image :src="item.image" mode="aspectFit"/><text v-if="j.state.travelerId===item.id" class="selected-mark">✓</text></view>
        <text class="traveler-name serif">{{item.name}}</text><text class="traveler-description">{{item.description}}</text>
      </button>
    </view></scroll-view>
  </view>
  <view class="section-head"><view><text class="section-title serif">远征记录</text><text class="section-subtitle">每一条走过的路，都在这里留下刻度</text></view><Footprints :size="20" :stroke-width="1.5"/></view>
  <view v-if="!maps.length" class="empty"><Map :size="20"/><text class="serif">还没有开始远征</text><text>选择一片远方，迈出第一步。</text></view>
  <view v-else class="journeys"><view v-for="m in maps" :key="m.world.id" class="journey-card pressable" @click="open(m.world.id)">
    <view class="card-top"><view class="icon"><Map :size="19" :stroke-width="1.6"/></view><view class="copy"><view class="name-row"><text class="name serif">{{m.world.name}}</text><text v-if="m.world.id===j.state.activeWorldId" class="status-pill">远征中</text><text v-else-if="m.p.completedAt" class="status-pill">已完成</text></view><text class="desc">{{m.world.subtitle}}</text></view></view>
    <view class="meta"><text>已前进 {{m.p.currentDistance.toFixed(1)}} / {{m.world.totalDistance}} km</text><text>{{m.percent}}%</text></view><view class="track"><view :style="{width:m.percent+'%'}"/></view><view class="collection"><text>沿途图鉴</text><text>{{m.collected}} / {{m.world.checkpoints.length}}</text></view>
  </view></view>
</view></template>
<style scoped lang="scss">
.profile{padding:36px var(--space-page) calc(88px + env(safe-area-inset-bottom));background:var(--surface-page)}header{padding:0 2px}.title{display:block;margin-top:8px;font-size:34px}.subtitle{display:block;margin-top:7px;font-size:13px;color:var(--text-secondary)}.stats{display:flex;align-items:center;margin-top:26px;padding:21px 8px;border:1px solid var(--card-border);border-radius:22px;background:var(--surface-card);box-shadow:var(--shadow-card)}.stats>i{width:1px;height:42px;background:var(--line-soft)}.stat{flex:1;text-align:center}.stat>text{display:block;font-size:9px;color:var(--text-tertiary)}.stat b{display:inline-block;margin-top:7px;font:500 23px var(--font-serif);color:var(--text-primary)}.stat small{margin-left:3px;font-size:9px;color:var(--text-tertiary)}.section-head{display:flex;align-items:center;justify-content:space-between;margin:34px 2px 16px;color:var(--text-tertiary)}.section-title{display:block;font-size:21px;color:var(--text-primary)}.section-subtitle{display:block;margin-top:5px;font-size:10px}.journeys{display:grid;gap:14px}.journey-card{padding:17px;border:1px solid var(--card-border);border-radius:21px;background:var(--surface-card);box-shadow:0 7px 24px rgba(46,58,44,.055)}.card-top{display:flex;gap:13px}.icon{display:flex;width:42px;height:42px;flex-shrink:0;align-items:center;justify-content:center;border-radius:13px;background:#e4e9e0;color:var(--brand-primary)}.copy{min-width:0;flex:1}.name-row{display:flex;align-items:center;justify-content:space-between;gap:8px}.name{font-size:18px;font-weight:650}.desc{display:block;overflow:hidden;margin-top:5px;color:var(--text-tertiary);font-size:10px;text-overflow:ellipsis;white-space:nowrap}.meta,.collection{display:flex;justify-content:space-between;margin-top:17px;font-size:10px;color:var(--text-secondary)}.track{height:5px;margin-top:7px;overflow:hidden;border-radius:999px;background:var(--surface-subtle)}.track view{height:100%;border-radius:inherit;background:var(--brand-accent);transition:width .5s var(--ease-out)}.collection{margin-top:12px;padding-top:11px;border-top:1px solid var(--line-soft);color:var(--text-tertiary)}.empty{display:flex;min-height:220px;flex-direction:column;align-items:center;justify-content:center;gap:9px;border:1px dashed var(--line);border-radius:22px;color:var(--text-tertiary);font-size:11px}.empty .serif{font-size:17px;color:var(--text-secondary)}
</style>
<style scoped>
.traveler-settings{margin-top:28px}.traveler-heading{display:flex;align-items:center;justify-content:space-between;margin:0 2px 14px}.traveler-count{padding:5px 9px;border-radius:999px;background:var(--surface-subtle);color:var(--text-tertiary);font-size:10px}.traveler-list{width:100%;white-space:nowrap}.traveler-list-inner{display:flex;gap:12px}.traveler-option{box-sizing:border-box;width:152px;margin:0;padding:12px;text-align:left;border:1px solid var(--card-border);border-radius:20px;background:var(--surface-card);box-shadow:none;line-height:normal}.traveler-option::after{display:none}.traveler-option.is-selected{border-color:var(--brand-primary);box-shadow:0 0 0 2px rgba(73,91,65,.1)}.traveler-preview{position:relative;height:112px;border-radius:15px;background:var(--surface-subtle)}.traveler-preview image{width:100%;height:100%}.selected-mark{position:absolute;top:8px;right:8px;display:flex;width:22px;height:22px;align-items:center;justify-content:center;border-radius:50%;background:var(--brand-primary);color:white;font-size:13px}.traveler-name{display:block;margin-top:10px;color:var(--text-primary);font-size:16px}.traveler-description{display:block;overflow:hidden;margin-top:5px;color:var(--text-tertiary);font-size:9px;text-overflow:ellipsis;white-space:nowrap}
.title{font-size:var(--type-display-title);font-weight:400;line-height:var(--leading-title)}
.subtitle{font-size:var(--type-secondary)}
.stat>text,.stat small,.section-subtitle,.desc,.meta,.collection,.empty{font-size:var(--type-caption)}
.stat b{font:500 var(--type-metric-large)/1.2 var(--font-sans)}
.section-title{font-size:var(--type-section-title);font-weight:400}
.name{font-size:var(--type-card-title);font-weight:400}
</style>
