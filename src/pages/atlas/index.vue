<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { ArrowLeft, LockKeyhole, X } from '@lucide/vue'
import { useJourneyStore } from '@/stores/journey'
import { worldRepository } from '@/services/journey/WorldRepository'
import CollectionArtworkView from '@/components/CollectionArtworkView.vue'
import DiscoveryArtworkView from '@/components/DiscoveryArtworkView.vue'
import type { Checkpoint, WorldProgress } from '@/types/journey'
import { formatNodeDistance, formatCollectedNodeDistance } from '@/services/journey/NodeDistanceFormatter'
import { useAppLocale } from '@/services/presentation/AppLocale'

const j=useJourneyStore(),worldId=ref(j.state.activeWorldId),selected=ref<Checkpoint|null>(null)
const { localeClass, t } = useAppLocale()
onLoad((q:any)=>{if(q?.worldId)worldId.value=decodeURIComponent(q.worldId)})
const world=computed(()=>worldRepository.get(worldId.value))
const progress=computed<WorldProgress>(()=>worldId.value===j.state.activeWorldId?j.state:(j.state.progressByWorld[worldId.value]??{currentDistance:0,unlockedCheckpointIds:[world.value.checkpoints[0].id],discoveries:[],presentedDiscoveryIds:[],discoveredChapterIds:[world.value.chapters[0].id],totalDistanceWalked:0,settlementHistory:[],startedAt:''}))
const unlocked=(cp:Checkpoint)=>progress.value.unlockedCheckpointIds.includes(cp.id)
const collected=computed(()=>world.value.checkpoints.filter(unlocked).length)
const percent=computed(()=>Math.round(collected.value/world.value.checkpoints.length*100))
function date(id:string){const raw=progress.value.discoveries.find(x=>x.id===id)?.discoveredAt;return raw?new Date(raw).toLocaleDateString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit'}).replaceAll('/','.'):''}
function goBack(){uni.navigateBack()}
</script>

<template><view class="safe-page atlas page-enter" :class="localeClass">
  <header><button class="back" aria-label="返回" @click="goBack"><ArrowLeft :size="20"/></button><view><text class="eyebrow">{{ t('atlas') }}</text><text class="title serif">旅途图鉴</text></view></header>
  <view class="intro"><view><text class="world-name serif">{{world.name}}</text><text class="hint">沿途收下的风景与记忆</text></view><view class="count"><b>{{collected}}</b><text>/ {{world.checkpoints.length}}</text></view></view>
  <view class="progress"><view :style="{width:percent+'%'}"/></view>
  <view v-if="!world.checkpoints.length" class="empty"><text class="serif">图鉴还是空白的</text><text>继续前进，第一片风景会出现在这里。</text></view>
  <view v-else class="grid"><view v-for="cp in world.checkpoints" :key="cp.id" class="entry pressable" :class="{locked:!unlocked(cp)}" @click="unlocked(cp)&&(selected=cp)">
    <view class="art"><CollectionArtworkView :image-asset="cp.artworkImage" :muted="!unlocked(cp)"/><view v-if="!unlocked(cp)" class="lock"><LockKeyhole :size="15"/></view></view>
    <view class="entry-copy"><text class="entry-name serif">{{unlocked(cp)?cp.name:'？？？'}}</text><template v-if="unlocked(cp)"><text class="distance">{{formatNodeDistance(cp.distance)}}</text><text class="date">{{date(cp.id)}}</text></template><text v-else class="distance">继续远征以解锁</text></view>
  </view></view>
  <Teleport to="body"><view v-if="selected" class="overlay" @click.self="selected=null"><view class="discovery"><button class="close" aria-label="关闭" @click="selected=null"><X :size="19"/></button><DiscoveryArtworkView :image-asset="selected.artworkImage"/><view class="discovery-copy"><text class="detail-eyebrow">{{formatCollectedNodeDistance(selected.distance)}}</text><text class="discovery-name serif">{{selected.name}}</text><text class="discovery-desc">{{selected.shortDescription}}</text></view></view></view></Teleport>
</view></template>

<style scoped lang="scss">
.atlas{padding:calc(12px + env(safe-area-inset-top)) var(--space-page) 42px;background:var(--surface-page)}header{display:flex;align-items:flex-start;gap:14px}.back,.close{display:flex;width:44px;height:44px;align-items:center;justify-content:center;border:1px solid var(--card-border);border-radius:50%;background:var(--surface-card);color:var(--text-primary)}.title{display:block;margin-top:4px;font-size:29px}.intro{display:flex;align-items:flex-end;justify-content:space-between;margin-top:29px}.world-name{display:block;font-size:20px}.hint{display:block;margin-top:5px;font-size:11px;color:var(--text-tertiary)}.count{display:flex;align-items:baseline;gap:3px;color:var(--text-tertiary)}.count b{font:500 28px var(--font-serif);color:var(--brand-accent)}.count text{font-size:11px}.progress{height:5px;margin:14px 0 24px;overflow:hidden;border-radius:999px;background:var(--surface-subtle)}.progress view{height:100%;border-radius:inherit;background:var(--brand-primary)}.grid{display:grid;grid-template-columns:1fr 1fr;gap:22px 12px}.entry{overflow:hidden;border:1px solid var(--card-border);border-radius:18px;background:var(--surface-card);box-shadow:0 7px 20px rgba(46,58,44,.05)}.art{position:relative}.lock{position:absolute;top:10px;right:10px;display:flex;width:28px;height:28px;align-items:center;justify-content:center;border-radius:50%;background:rgba(247,246,241,.82);color:var(--status-locked-fg)}.entry-copy{min-height:96px;padding:12px 12px 14px}.entry-name{display:block;font-size:15px;font-weight:650;color:var(--text-primary)}.distance,.date{display:block;margin-top:5px;font-size:9px;color:var(--text-tertiary)}.date{margin-top:3px}.locked{box-shadow:none}.locked .entry-name{color:var(--text-tertiary);letter-spacing:2px}.empty{display:flex;min-height:260px;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:var(--text-tertiary);font-size:11px}.empty .serif{font-size:18px;color:var(--text-secondary)}.overlay{position:fixed;z-index:9999;inset:0;display:flex;align-items:flex-end;justify-content:center;padding-top:40px;background:rgba(28,35,28,.48);backdrop-filter:blur(8px);animation:fade-in .25s ease}.discovery{position:relative;width:min(100%,430px);overflow:hidden;border-radius:28px 28px 0 0;background:var(--surface-page);animation:sheet-up .38s var(--ease-out)}.close{position:absolute;z-index:2;top:14px;right:14px;background:rgba(250,249,245,.88)}.discovery-copy{padding:25px 24px calc(28px + env(safe-area-inset-bottom));text-align:center}.detail-eyebrow{display:block;color:var(--brand-primary);font-size:10px;font-weight:650;letter-spacing:.4px}.discovery-name{display:block;margin-top:8px;font-size:31px}.discovery-desc{display:block;margin:12px auto 6px;max-width:280px;color:var(--text-secondary);font-size:13px;line-height:1.85;letter-spacing:0;text-align:center;word-break:normal;overflow-wrap:break-word}@keyframes fade-in{from{opacity:0}}@keyframes sheet-up{from{transform:translateY(24px);opacity:0}}
.atlas{padding-bottom:calc(42px + env(safe-area-inset-bottom))}.back,.close{width:44px;height:44px;min-width:44px;min-height:44px}
</style>
<style scoped>
.title{font-size:var(--type-display-title);font-weight:400;line-height:var(--leading-title)}
.world-name{font-size:var(--type-section-title);font-weight:400}
.hint,.count text,.distance,.date,.detail-eyebrow,.empty{font-size:var(--type-caption)}
.count b{font:500 var(--type-metric-large)/1.2 var(--font-sans)}
.entry-name{font-size:var(--type-card-title);font-weight:400;letter-spacing:0}
.discovery-name{font-size:var(--type-page-title);font-weight:400}
.discovery-desc{font-size:var(--type-secondary)}
</style>
