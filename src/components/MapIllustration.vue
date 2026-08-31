<script setup lang="ts">
import { computed } from 'vue'
import { House, Sprout, BrickWall, Landmark, Trees, TrainFront, Waves, TentTree, TowerControl, MapPinned, Mountain, Castle, Telescope, type LucideIcon } from '@lucide/vue'
const props=defineProps<{type:string;locked?:boolean}>()
const icons:Record<string,LucideIcon>={home:House,field:Sprout,bridge:BrickWall,monument:Landmark,forest:Trees,station:TrainFront,lake:Waves,camp:TentTree,tower:TowerControl,village:House,river:Waves,pass:MapPinned,ruin:Castle,summit:Mountain,view:Telescope}
const icon=computed(()=>icons[props.type]||MapPinned)
const colors:Record<string,string>={home:'#C78368',field:'#98A868',bridge:'#728FA2',monument:'#A58C75',forest:'#63806A',station:'#B07165',lake:'#6D91A4',camp:'#B98A59',tower:'#817F9D',village:'#BE8D6E',river:'#6596A0',pass:'#8B9270',ruin:'#9A796A',summit:'#7B8792',view:'#718F83'}
const color=computed(()=>props.locked?'#A8AAA5':(colors[props.type]||'#7B8D78'))
</script>
<template><view class="placeholder" :style="{backgroundColor:color}"><component :is="icon" :size="34" :stroke-width="1.6"/><text>{{ locked?'未发现':type.toUpperCase() }}</text></view></template>
<style scoped>.placeholder{display:flex;width:100%;height:100%;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:rgba(255,255,255,.9)}text{font-size:8px;letter-spacing:1.4px}</style>
