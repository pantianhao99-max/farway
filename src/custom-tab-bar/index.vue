<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { Mountain, UserRound, type LucideIcon } from '@lucide/vue'
import { useAppLocale } from '@/services/presentation/AppLocale'
const props=defineProps<{current?:string}>(),routeKey=ref('worlds')
const { t } = useAppLocale()
const tabs=computed<{key:string;text:string;path:string;icon:LucideIcon}[]>(()=>[{key:'worlds',text:t('worldTab'),path:'/pages/worlds/index',icon:Mountain},{key:'profile',text:t('profileTab'),path:'/pages/profile/index',icon:UserRound}])
const activeIndex=computed(()=>Math.max(0,tabs.value.findIndex(t=>t.key===(props.current||routeKey.value))))
function sync(){const route=getCurrentPages().at(-1)?.route||'';routeKey.value=tabs.value.find(t=>route.includes(`pages/${t.key}/`))?.key||'worlds'}
function switchTab(path:string){uni.switchTab({url:path})}
function hideNativeH5TabBar(){
  // #ifdef H5
  document.querySelector<HTMLElement>('uni-tabbar.uni-tabbar-bottom')?.style.setProperty('display','none','important')
  // #endif
}
onMounted(()=>{sync();hideNativeH5TabBar()});onShow(()=>{sync();hideNativeH5TabBar()})
</script>
<template><view class="bar"><view v-for="(tab,i) in tabs" :key="tab.key" class="item" :class="{active:activeIndex===i}" @click="switchTab(tab.path)"><component :is="tab.icon" :size="23" :stroke-width="1.7"/><text>{{tab.text}}</text><i v-if="activeIndex===i"/></view></view></template>
<style scoped>:global(uni-tabbar.uni-tabbar-bottom){display:none!important}.bar{position:fixed;z-index:1000;bottom:0;left:50%;display:flex;width:min(100%,var(--mobile-width,430px));height:58px;padding-bottom:env(safe-area-inset-bottom);transform:translateX(-50%);border-top:1px solid rgba(221,214,198,.6);background:rgba(246,243,234,.94);backdrop-filter:blur(20px)}.item{position:relative;display:flex;flex:1;flex-direction:column;align-items:center;justify-content:center;gap:3px;color:var(--text-tertiary);font-family:var(--font-sans);font-weight:500}.item text{font-size:var(--type-caption)}.item.active{color:var(--brand-primary)}.item i{position:absolute;bottom:4px;width:4px;height:4px;border-radius:50%;background:var(--brand-accent)}</style>
