<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap, type Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { World } from '@/types/journey'
import routeSource from '@/data/worlds/maclehose-route.json'
import { createGeoRouteGeometry, type LngLat } from '@/services/journey/GeoRouteGeometry'
import { OSM_CARTO, OSM_CARTO_ZOOM_OFFSET } from '@/services/journey/OsmCartoTheme'

const props=defineProps<{world:World;distance:number;unlocked:string[];follow:boolean;travelerImage?:string|null}>()
const container=ref<any>(null)
const mapReady=ref(false)
const geometry=createGeoRouteGeometry(routeSource as any)
const progress=computed(()=>props.world.totalDistance?Math.max(0,Math.min(1,props.distance/props.world.totalDistance)):0)
let map:MapLibreMap|undefined
let avatar:Marker|undefined
const checkpointMarkers:Marker[]=[]
let cameraFrame=0
let displayedProgress=progress.value
const CAMERA_DURATION=700
const assetUrl=(path:string)=>`${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`

const lineFeature=(coordinates:LngLat[])=>({type:'Feature' as const,properties:{},geometry:{type:'LineString' as const,coordinates}})

function markerElement(className:string,label?:string){
  const element=document.createElement('div');element.className=className
  if(label)element.textContent=label
  return element
}

function checkpointLabelElement(name:string,sectionBoundary:boolean){
  const element=markerElement(`osm-checkpoint-label ${sectionBoundary?'is-section-boundary':'is-section-middle'}`,name)
  // Markers are created outside Vue's template tree. Keep the essential label
  // appearance inline so stylesheet timing/HMR cannot leave bare text behind.
  element.style.cssText=[
    'display:block',
    `padding:${sectionBoundary?'2px 4px':'1px 3px'}`,
    'border-radius:5px',
    `background-color:${sectionBoundary?'rgba(248,246,238,.96)':'rgba(248,246,238,.84)'}`,
    `color:${sectionBoundary?'#26382d':'#405145'}`,
    `font:${sectionBoundary?'700 12px':'600 11px'}/1.2 var(--font-sans,"PingFang SC","Microsoft YaHei",sans-serif)`,
    'white-space:nowrap',
    `box-shadow:${sectionBoundary?'0 2px 7px rgba(25,38,29,.2)':'0 1px 3px rgba(25,38,29,.11)'}`,
    'pointer-events:none',
    'isolation:isolate',
    'backface-visibility:hidden',
    'transform:translateZ(0)'
  ].join(';')
  return element
}

function isSectionBoundary(distance:number){
  return props.world.chapters.some(chapter=>Math.abs(chapter.startDistance-distance)<.01||Math.abs(chapter.endDistance-distance)<.01)
}

type CheckpointLabelSide='left'|'right'|'top'|'bottom'

function checkpointLabelPlacement(distance:number,index:number,sectionBoundary:boolean):{anchor:CheckpointLabelSide;offset:[number,number]}{
  // Halo radius + 1px stroke + 1px visual gap: 16px for section nodes,
  // 12px for regular nodes. Applying the same distance on every axis keeps
  // the capsule edge equally far from the node edge in all four directions.
  const gap=sectionBoundary?16:12
  if(!map)return {anchor:'left',offset:[gap,0]}
  const routeProgress=props.world.totalDistance?distance/props.world.totalDistance:0
  const sampleGap=.0025
  const before=map.project(geometry.pointAt(Math.max(0,routeProgress-sampleGap)))
  const after=map.project(geometry.pointAt(Math.min(1,routeProgress+sampleGap)))
  const point=map.project(geometry.pointAt(routeProgress))
  const horizontal=Math.abs(after.x-before.x)>Math.abs(after.y-before.y)*1.15
  const edgePadding=46
  let side:CheckpointLabelSide

  if(horizontal){
    // Keep horizontal names perpendicular to horizontal trail sections.
    side=index%2===0?'bottom':'top'
    if(point.y<edgePadding)side='top'
    else if(point.y>map.getContainer().clientHeight-edgePadding)side='bottom'
  }else{
    side=index%2===0?'left':'right'
    if(point.x<edgePadding)side='left'
    else if(point.x>map.getContainer().clientWidth-edgePadding)side='right'
  }

  const offsets:Record<CheckpointLabelSide,[number,number]>={
    left:[gap,0],right:[-gap,0],top:[0,gap],bottom:[0,-gap]
  }
  return {anchor:side,offset:offsets[side]}
}

function updateProgress(){
  if(!map)return
  if(typeof cancelAnimationFrame==='function')cancelAnimationFrame(cameraFrame)
  const from=displayedProgress,to=progress.value,started=typeof performance!=='undefined'?performance.now():Date.now()
  const animate=(now:number)=>{
    const t=Math.min(1,(now-started)/CAMERA_DURATION),eased=1-Math.pow(1-t,3)
    displayedProgress=from+(to-from)*eased
    const point=geometry.pointAt(displayedProgress)
    avatar?.setLngLat(point)
    if(props.follow)map?.jumpTo({center:point})
    if(t<1)cameraFrame=requestAnimationFrame(animate)
  }
  cameraFrame=requestAnimationFrame(animate)
  ;(map.getSource('walked-route') as GeoJSONSource|undefined)?.setData(lineFeature(geometry.sliceAt(progress.value)))
}

onMounted(async()=>{
  await nextTick()
  const mapContainer=(container.value?.$el??container.value) as HTMLElement|null
  if(!mapContainer)return
  map=new maplibregl.Map({
    container:mapContainer,
    center:geometry.pointAt(progress.value),zoom:12.5,
    fadeDuration:0,maxTileCacheZoomLevels:2,refreshExpiredTiles:false,renderWorldCopies:false,
    localIdeographFontFamily:'Noto Sans SC',
    transformRequest:(url,resourceType)=>{
      // A static SPA server commonly answers an unknown glyph range with its
      // HTML fallback. MapLibre then parses that HTML as protobuf and aborts
      // symbol preparation for the whole vector tile. CJK glyphs are rendered
      // locally; map every other unavailable range to a valid bundled PBF so a
      // missing character can degrade to null without taking down the tile.
      if(resourceType==='Glyphs'&&url.includes('/static/maps/fonts/NotoSansRegular/')&&!/(?:0-255|256-511)\.pbf(?:$|\?)/.test(url)){
        return {url:assetUrl('static/maps/fonts/NotoSansRegular/0-255.pbf')}
      }
      return {url}
    },
    attributionControl:false,
    style:{version:8,glyphs:assetUrl('static/maps/fonts/{fontstack}/{range}.pbf'),sources:{},layers:[{id:'sea',type:'background',paint:{'background-color':OSM_CARTO.background.water}}]}
  })
  map.on('error',(event:any)=>{
    if(event?.sourceId==='local-map'||String(event?.error?.message??'').includes('/static/maps/tiles/')){
      const tile=event?.tile?.tileID?.canonical
      console.warn(`[Faraway] 矢量地图瓦片加载失败：${event?.error?.message??'未知错误'}${tile?` (z${tile.z}/${tile.x}/${tile.y})`:''}`)
    }
  })
  map.on('load',async()=>{
    try{
      const [landResponse,versionResponse]=await Promise.all([
        fetch(assetUrl('static/maps/maclehose-land-v2.json')),
        fetch(assetUrl('static/maps/tiles/version.json'),{cache:'no-store'})
      ])
      if(!landResponse.ok)throw new Error(`land map ${landResponse.status}`)
      const landMap=await landResponse.json()
      const tileRevision=versionResponse.ok?String((await versionResponse.json()).revision??'unknown'):'unknown'
      const tileBase=new URL(assetUrl('static/maps/tiles/'),window.location.origin).href
      map!.addSource('local-map',{type:'vector',tiles:[`${tileBase}{z}/{x}/{y}.pbf?v=${encodeURIComponent(tileRevision)}`],minzoom:8,maxzoom:14,bounds:[113.93,22.28,114.43,22.52],attribution:'© OpenStreetMap contributors'})
      map!.addSource('coastline-land',{type:'geojson',data:landMap})
      const nativeAddLayer=map!.addLayer.bind(map!)
      const normalizeCartoZoom=(value:any):any=>{
        if(Array.isArray(value)){
          // MapLibre only permits ['zoom'] directly inside a top-level step or
          // interpolate. Shift their stop values instead of wrapping zoom.
          if(value[0]==='step'&&Array.isArray(value[1])&&value[1][0]==='zoom'){
            return value.map((item,index)=>index>=3&&index%2===1&&typeof item==='number'?item-OSM_CARTO_ZOOM_OFFSET:normalizeCartoZoom(item))
          }
          if(value[0]==='interpolate'&&Array.isArray(value[2])&&value[2][0]==='zoom'){
            return value.map((item,index)=>index>=3&&index%2===1&&typeof item==='number'?item-OSM_CARTO_ZOOM_OFFSET:normalizeCartoZoom(item))
          }
          return value.map(normalizeCartoZoom)
        }
        if(value&&typeof value==='object')Object.keys(value).forEach(key=>value[key]=normalizeCartoZoom(value[key]))
        return value
      }
      // Mapnik's z0 world is 256 px; MapLibre's is 512 px. Translate every
      // upstream-derived zoom threshold so both render at the same metres/pixel.
      map!.addLayer=((layer:any,before?:string)=>{
        if(layer.source==='local-map'&&!layer['source-layer'])layer['source-layer']='maclehose'
        if(typeof layer.minzoom==='number')layer.minzoom-=OSM_CARTO_ZOOM_OFFSET
        if(typeof layer.maxzoom==='number')layer.maxzoom-=OSM_CARTO_ZOOM_OFFSET
        return nativeAddLayer(normalizeCartoZoom(layer),before)
      }) as MapLibreMap['addLayer']
      map!.addLayer({id:'local-land-base',type:'fill',source:'coastline-land',paint:{'fill-color':OSM_CARTO.background.land,'fill-opacity':1}})
      const builtUpColor=(finalColor:string)=>['step',['zoom'],OSM_CARTO.landuse.builtUpLow,12,OSM_CARTO.landuse.builtUpZ12,13,finalColor] as any
      map!.addLayer({id:'local-landuse',type:'fill',source:'local-map',filter:['all',['==',['get','layer'],'area'],['in',['get','kind'],['literal',['residential','industrial','commercial','retail','cemetery','farmland','orchard','quarry','recreation_ground']]]],paint:{'fill-color':['match',['get','kind'],'residential',builtUpColor(OSM_CARTO.landuse.residential),'industrial',builtUpColor(OSM_CARTO.landuse.industrial),'commercial',builtUpColor(OSM_CARTO.landuse.commercial),'retail',builtUpColor(OSM_CARTO.landuse.retail),'cemetery',OSM_CARTO.landuse.cemetery,'farmland',OSM_CARTO.landuse.farmland,'orchard',OSM_CARTO.landuse.orchard,'quarry',OSM_CARTO.landuse.quarry,OSM_CARTO.landuse.grass],'fill-opacity':['match',['get','kind'],['residential','industrial','commercial','retail'],['step',['zoom'],0,8,1],['cemetery','quarry','recreation_ground'],['step',['zoom'],0,10,1],1]}})
      map!.addLayer({id:'local-forest',type:'fill',source:'local-map',filter:['all',['==',['get','layer'],'area'],['in',['get','kind'],['literal',['wood','forest','grass','meadow','grassland','scrub','heath','wetland','park','nature_reserve','golf_course','bare_rock','sand','beach']]]],paint:{'fill-color':['match',['get','kind'],['wetland'],OSM_CARTO.landuse.wetland,['grass','meadow','grassland'],OSM_CARTO.landuse.grass,['golf_course'],OSM_CARTO.landuse.leisure,['scrub'],OSM_CARTO.landuse.scrub,['heath'],OSM_CARTO.landuse.heath,['park','nature_reserve'],OSM_CARTO.landuse.park,['bare_rock'],OSM_CARTO.landuse.bareGround,['beach'],OSM_CARTO.landuse.beach,['sand'],OSM_CARTO.landuse.sand,OSM_CARTO.landuse.forest],'fill-opacity':1}})
      // Use the complete 256×256 OpenStreetMap Carto forest pattern unchanged.
      const patternPixelRatio=Math.max(1,Math.min(2,window.devicePixelRatio||1))
      const addCartoPattern=async(name:string,url:string,displaySize:number)=>{
        const image=new Image();image.src=url;await image.decode()
        const rasterSize=Math.round(displaySize*patternPixelRatio)
        const canvas=document.createElement('canvas');canvas.width=rasterSize;canvas.height=rasterSize
        const context=canvas.getContext('2d')!;context.imageSmoothingEnabled=false
        context.drawImage(image,0,0,rasterSize,rasterSize)
        map!.addImage(name,context.getImageData(0,0,rasterSize,rasterSize),{pixelRatio:patternPixelRatio})
      }
      await Promise.all([
        addCartoPattern('osm-carto-peak',assetUrl('static/maps/osm-carto-peak.svg'),8),
        addCartoPattern('osm-carto-forest-unknown',assetUrl('static/maps/osm-carto-leaftype-unknown.svg'),256),
        addCartoPattern('osm-carto-forest-broadleaved',assetUrl('static/maps/osm-carto-leaftype-broadleaved.svg'),256),
        addCartoPattern('osm-carto-forest-needleleaved',assetUrl('static/maps/osm-carto-leaftype-needleleaved.svg'),256),
        addCartoPattern('osm-carto-forest-mixed',assetUrl('static/maps/osm-carto-leaftype-mixed.svg'),256),
        addCartoPattern('osm-carto-scrub',assetUrl('static/maps/osm-carto-scrub.png'),512)
      ])
      const forestFilter=['all',['==',['get','layer'],'area'],['in',['get','kind'],['literal',['wood','forest']]]] as any
      const missingLeafType=['!', ['in',['get','leaf_type'],['literal',['broadleaved','needleleaved','mixed']]]] as any
      const addForestTexture=(id:string,pattern:string,leafType:string)=>map!.addLayer({id,type:'fill',source:'local-map',filter:['all',forestFilter,['==',['get','leaf_type'],leafType]],minzoom:13,paint:{'fill-pattern':pattern,'fill-opacity':.4}})
      // Carto draws scrub within landcover-area-symbols, then its translucent
      // wood attachment above it. Preserve that overlap order here.
      map!.addLayer({id:'local-scrub-texture',type:'fill',source:'local-map',filter:['all',['==',['get','layer'],'area'],['==',['get','kind'],'scrub']],minzoom:13,paint:{'fill-pattern':'osm-carto-scrub'}})
      // Preserve both official fallback appearances when the compact extract has no leaf_type:
      // natural=wood uses Carto's paired unknown symbol; landuse=forest uses its mixed single-tree pattern.
      map!.addLayer({id:'local-forest-texture-unknown',type:'fill',source:'local-map',filter:['all',forestFilter,missingLeafType,['==',['get','kind'],'wood']],minzoom:13,paint:{'fill-pattern':'osm-carto-forest-unknown','fill-opacity':.4}})
      map!.addLayer({id:'local-forest-texture-untyped-forest',type:'fill',source:'local-map',filter:['all',forestFilter,missingLeafType,['==',['get','kind'],'forest']],minzoom:13,paint:{'fill-pattern':'osm-carto-forest-mixed','fill-opacity':.4}})
      addForestTexture('local-forest-texture-broadleaved','osm-carto-forest-broadleaved','broadleaved')
      addForestTexture('local-forest-texture-needleleaved','osm-carto-forest-needleleaved','needleleaved')
      addForestTexture('local-forest-texture-mixed','osm-carto-forest-mixed','mixed')
      map!.addLayer({id:'local-community',type:'fill',source:'local-map',filter:['all',['==',['get','layer'],'area'],['in',['get','kind'],['literal',['school','university','hospital','place_of_worship','attraction','zoo','pitch','sports_centre','playground']]]],paint:{'fill-color':['match',['get','kind'],['pitch'],OSM_CARTO.landuse.pitch,['sports_centre'],OSM_CARTO.landuse.leisure,['playground'],OSM_CARTO.landuse.leisure,['school','university','hospital'],builtUpColor(OSM_CARTO.landuse.societal),['place_of_worship'],OSM_CARTO.landuse.builtUpLow,OSM_CARTO.background.land],'fill-opacity':['match',['get','kind'],['school','university','hospital','pitch','sports_centre'],['step',['zoom'],0,10,1],['playground','place_of_worship'],['step',['zoom'],0,13,1],1]}})
      map!.addLayer({id:'local-parking',type:'fill',source:'local-map',filter:['all',['==',['get','layer'],'area'],['==',['get','kind'],'parking']],minzoom:14,paint:{'fill-color':OSM_CARTO.landuse.parking,'fill-opacity':1}})
      map!.addLayer({id:'local-water',type:'fill',source:'local-map',filter:['all',['==',['get','layer'],'area'],['in',['get','kind'],['literal',['water','reservoir']]]],paint:{'fill-color':OSM_CARTO.water.fill,'fill-opacity':1}})
      map!.addLayer({id:'local-buildings',type:'fill',source:'local-map',filter:['==',['get','layer'],'building'],minzoom:OSM_CARTO.building.minZoom,paint:{'fill-color':['step',['zoom'],OSM_CARTO.building.lowZoomFill,OSM_CARTO.building.outlineMinZoom,OSM_CARTO.building.fill],'fill-opacity':OSM_CARTO.building.fillOpacity}})
      map!.addLayer({id:'local-buildings-outline',type:'line',source:'local-map',filter:['==',['get','layer'],'building'],minzoom:OSM_CARTO.building.outlineMinZoom,paint:{'line-color':OSM_CARTO.building.outline,'line-width':OSM_CARTO.building.outlineWidth,'line-opacity':OSM_CARTO.building.outlineOpacity}})
      const riverWidth=['step',['zoom'],.7,9,1.2,10,1.5,11,1.8,12,2.3,13,3,14,4.5,15,6,16,8,17,10,18,12] as any
      const streamWidth=['step',['zoom'],.8,13,1.4,14,2,15,2.5,16,3,17,3.5,18,4] as any
      map!.addLayer({id:'local-rivers',type:'line',source:'local-map',filter:['all',['==',['get','layer'],'waterway'],['==',['get','kind'],'river']],minzoom:8,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':OSM_CARTO.water.line,'line-width':riverWidth,'line-opacity':1}})
      map!.addLayer({id:'local-waterways-halo',type:'line',source:'local-map',filter:['all',['==',['get','layer'],'waterway'],['in',['get','kind'],['literal',['canal','stream','ditch','drain']]]],minzoom:13,maxzoom:18,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#ffffff','line-width':['case',['==',['get','kind'],'canal'],['+',.6,['*',1.4,streamWidth]],['+',.6,streamWidth]],'line-opacity':['step',['zoom'],.7,14,.85,16,.75,17,.6]}})
      map!.addLayer({id:'local-canals',type:'line',source:'local-map',filter:['all',['==',['get','layer'],'waterway'],['==',['get','kind'],'canal']],minzoom:12,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':OSM_CARTO.water.line,'line-width':['*',1.4,streamWidth],'line-opacity':1}})
      map!.addLayer({id:'local-streams',type:'line',source:'local-map',filter:['all',['==',['get','layer'],'waterway'],['==',['get','kind'],'stream']],minzoom:12,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':OSM_CARTO.water.line,'line-width':streamWidth,'line-opacity':1}})
      map!.addLayer({id:'local-minor-waterways',type:'line',source:'local-map',filter:['all',['==',['get','layer'],'waterway'],['in',['get','kind'],['literal',['ditch','drain']]]],minzoom:12,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':OSM_CARTO.water.line,'line-width':['step',['zoom'],.8,17,3],'line-opacity':1}})
      const mainRailFilter=['all',['==',['get','layer'],'railway'],['==',['get','kind'],'rail']] as any
      map!.addLayer({id:'local-railways-casing',type:'line',source:'local-map',filter:mainRailFilter,minzoom:8,layout:{'line-join':'round'},paint:{'line-color':['step',['zoom'],'#787878',12,'#707070'],'line-width':['step',['zoom'],.8,12,2,13,3,18,4],'line-opacity':OSM_CARTO.opacity.railway}})
      map!.addLayer({id:'local-railways',type:'line',source:'local-map',filter:mainRailFilter,minzoom:12,layout:{'line-join':'round'},paint:{'line-color':OSM_CARTO.railway.fill,'line-width':['step',['zoom'],.75,13,1,18,2],'line-dasharray':['step',['zoom'],['literal',[8,8]],15,['literal',[0,8,8,1]],18,['literal',[8,6]]],'line-opacity':OSM_CARTO.opacity.railway}})
      map!.addLayer({id:'local-light-railways',type:'line',source:'local-map',filter:['all',['==',['get','layer'],'railway'],['in',['get','kind'],['literal',['light_rail','subway']]]],minzoom:12,paint:{'line-color':['match',['get','kind'],'subway','#999999','#6e6e6e'],'line-width':['step',['zoom'],.75,14,1,15,1.5,17,2],'line-opacity':1}})
      const trailKinds=['path','footway','steps','track','cycleway']
      const regularRoadFilter=['all',['==',['get','layer'],'road'],['!',['in',['get','kind'],['literal',trailKinds]]]] as any
      const roadCasingColor=['step',['zoom'],['match',['get','kind'],'motorway',OSM_CARTO.road.motorway.lowCasing,'trunk',OSM_CARTO.road.trunk.lowCasing,'primary',OSM_CARTO.road.primary.lowCasing,'secondary',OSM_CARTO.road.secondary.lowCasing,'tertiary',OSM_CARTO.road.tertiary.casing,'living_street',OSM_CARTO.road.livingStreet.casing,'pedestrian',OSM_CARTO.road.pedestrian.casing,OSM_CARTO.road.minor.casing],13,['match',['get','kind'],'motorway',OSM_CARTO.road.motorway.casing,'trunk',OSM_CARTO.road.trunk.casing,'primary',OSM_CARTO.road.primary.casing,'secondary',OSM_CARTO.road.secondary.casing,'tertiary',OSM_CARTO.road.tertiary.casing,'living_street',OSM_CARTO.road.livingStreet.casing,'pedestrian',OSM_CARTO.road.pedestrian.casing,OSM_CARTO.road.minor.casing]] as any
      const roadFillColor=['step',['zoom'],['match',['get','kind'],'motorway',OSM_CARTO.road.motorway.lowFill,'trunk',OSM_CARTO.road.trunk.lowFill,'primary',OSM_CARTO.road.primary.lowFill,'secondary',OSM_CARTO.road.secondary.lowFill,'tertiary',OSM_CARTO.road.tertiary.fill,'living_street',OSM_CARTO.road.livingStreet.fill,'pedestrian',OSM_CARTO.road.pedestrian.fill,OSM_CARTO.road.minor.fill],13,['match',['get','kind'],'motorway',OSM_CARTO.road.motorway.fill,'trunk',OSM_CARTO.road.trunk.fill,'primary',OSM_CARTO.road.primary.fill,'secondary',OSM_CARTO.road.secondary.fill,'tertiary',OSM_CARTO.road.tertiary.fill,'living_street',OSM_CARTO.road.livingStreet.fill,'pedestrian',OSM_CARTO.road.pedestrian.fill,OSM_CARTO.road.minor.fill]] as any
      const roadFillWidth=['step',['zoom'],0,8,['match',['get','kind'],['motorway','trunk','primary'],1,0],9,['match',['get','kind'],['motorway','trunk','primary'],1.4,'secondary',1,0],10,['match',['get','kind'],['motorway','trunk'],1.9,'primary',1.8,'secondary',1.1,'tertiary',.7,0],12,['match',['get','kind'],['motorway','trunk','primary','secondary'],3.5,'tertiary',2.5,'residential',.5,'unclassified',.8,0],13,['match',['get','kind'],['motorway','trunk'],6,'primary',5,'secondary',5,'tertiary',4,'residential',2.5,'unclassified',2.5,'living_street',2,0],14,['match',['get','kind'],['motorway','trunk'],6,'primary',5,'secondary',5,'tertiary',5,['residential','unclassified'],3,'living_street',3,'pedestrian',3,'service',2,0],15,['match',['get','kind'],['motorway','trunk','primary'],10,'secondary',9,'tertiary',9,['residential','unclassified','living_street','pedestrian'],5,'service',3.5,0],16,['match',['get','kind'],['motorway','trunk','primary','secondary','tertiary'],10,['residential','unclassified','living_street','pedestrian'],6,'service',3.5,0]] as any
      const roadCasingWidth=['step',['zoom'],0,10,['match',['get','kind'],['motorway','trunk','primary'],2.9,'secondary',2.1,'tertiary',1.7,0],12,['match',['get','kind'],['motorway','trunk','primary'],4.5,'secondary',4.1,'tertiary',3.1,'residential',1.5,'unclassified',1.8,0],13,['match',['get','kind'],['motorway','trunk'],7,'primary',6,'secondary',5.7,'tertiary',5,['residential','unclassified'],3.5,'living_street',3,0],14,['match',['get','kind'],['motorway','trunk'],7.2,'primary',6.2,'secondary',5.7,'tertiary',5.7,['residential','unclassified','living_street'],4.1,'pedestrian',4.1,'service',3.1,0],15,['match',['get','kind'],['motorway','trunk','primary'],11.4,'secondary',10.4,'tertiary',10.2,['residential','unclassified','living_street','pedestrian'],6.2,'service',4.7,0],16,['match',['get','kind'],['motorway','trunk','primary','secondary'],11.4,'tertiary',11.2,['residential','unclassified','living_street','pedestrian'],7.2,'service',4.7,0]] as any
      map!.addLayer({id:'local-roads-shadow',type:'line',source:'local-map',filter:regularRoadFilter,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':roadCasingColor,'line-width':roadCasingWidth,'line-opacity':1}})
      map!.addLayer({id:'local-roads',type:'line',source:'local-map',filter:regularRoadFilter,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':roadFillColor,'line-width':roadFillWidth,'line-opacity':1}})
      const pathFilter=['all',['==',['get','layer'],'road'],['in',['get','kind'],['literal',['path','footway']]]] as any
      const cycleFilter=['all',['==',['get','layer'],'road'],['==',['get','kind'],'cycleway']] as any
      const trackFilter=['all',['==',['get','layer'],'road'],['==',['get','kind'],'track']] as any
      const stepsFilter=['all',['==',['get','layer'],'road'],['==',['get','kind'],'steps']] as any
      const pathWidth=['step',['zoom'],.7,15,1,16,1.3,19,1.6] as any
      map!.addLayer({id:'local-paths-halo',type:'line',source:'local-map',filter:pathFilter,minzoom:15,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':OSM_CARTO.road.pathCasing,'line-width':['step',['zoom'],3,16,3.3,19,3.6],'line-opacity':OSM_CARTO.road.pathCasingOpacity}})
      const pathDash=['step',['zoom'],['literal',[100,0]],15,['case',['in',['get','surface'],['literal',['asphalt','concrete','paving_stones','sett','cobblestone','metal','wood']]],['literal',[2,3.5]],['in',['get','surface'],['literal',['unpaved','compacted','fine_gravel','gravel','pebblestone','ground','dirt','earth','grass','mud','sand']]],['literal',[1,4]],['literal',[1,3,2,4]]],16,['case',['in',['get','surface'],['literal',['asphalt','concrete','paving_stones','sett','cobblestone','metal','wood']]],['literal',[3,3.5]],['in',['get','surface'],['literal',['unpaved','compacted','fine_gravel','gravel','pebblestone','ground','dirt','earth','grass','mud','sand']]],['literal',[1,4]],['literal',[1,4,2,3]]]] as any
      map!.addLayer({id:'local-paths',type:'line',source:'local-map',filter:pathFilter,minzoom:14,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':OSM_CARTO.road.footway,'line-width':pathWidth,'line-dasharray':pathDash,'line-opacity':OSM_CARTO.road.footwayOpacity}})
      map!.addLayer({id:'local-cycleways-halo',type:'line',source:'local-map',filter:cycleFilter,minzoom:15,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':OSM_CARTO.road.pathCasing,'line-width':3,'line-opacity':OSM_CARTO.road.pathCasingOpacity}})
      map!.addLayer({id:'local-cycleways',type:'line',source:'local-map',filter:cycleFilter,minzoom:13,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':OSM_CARTO.road.cycleway,'line-width':pathWidth,'line-dasharray':[1,3],'line-opacity':1}})
      map!.addLayer({id:'local-tracks-halo',type:'line',source:'local-map',filter:trackFilter,minzoom:15,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':OSM_CARTO.road.pathCasing,'line-width':3.5,'line-opacity':OSM_CARTO.road.pathCasingOpacity}})
      map!.addLayer({id:'local-tracks',type:'line',source:'local-map',filter:trackFilter,minzoom:13,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':OSM_CARTO.road.track,'line-width':['step',['zoom'],.5,15,1.5],'line-dasharray':[5,4,2,4],'line-opacity':OSM_CARTO.road.trackOpacity}})
      map!.addLayer({id:'local-steps',type:'line',source:'local-map',filter:stepsFilter,minzoom:14,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':OSM_CARTO.road.footway,'line-width':['step',['zoom'],.7,15,3],'line-dasharray':[1,3],'line-opacity':1}})
      const namedRoad=['all',['==',['get','layer'],'road'],['has','name']] as any
      const roadTextLayout=(minSize:number)=>(
        {'symbol-placement':'line','text-field':['get','name'],'text-font':OSM_CARTO.text.fontFamily,
          'text-size':['step',['zoom'],minSize,14,9,15,10,17,11,19,12],
          'text-padding':2,'text-letter-spacing':0,'symbol-spacing':300,
          'text-allow-overlap':false,'text-ignore-placement':false,'text-rotation-alignment':'map'} as any
      )
      const roadTextPaint=(halo:any)=>({'text-color':'#000000','text-halo-color':halo,'text-halo-width':OSM_CARTO.text.haloRadius} as any)
      map!.addLayer({id:'local-road-label-major',type:'symbol',source:'local-map',filter:['all',namedRoad,['in',['get','kind'],['literal',['motorway','trunk','primary']]]],minzoom:13,layout:roadTextLayout(8),paint:roadTextPaint(['match',['get','kind'],'motorway',OSM_CARTO.road.motorway.fill,'trunk',OSM_CARTO.road.trunk.fill,OSM_CARTO.road.primary.fill])})
      map!.addLayer({id:'local-road-label-secondary',type:'symbol',source:'local-map',filter:['all',namedRoad,['==',['get','kind'],'secondary']],minzoom:13,layout:roadTextLayout(8),paint:roadTextPaint(OSM_CARTO.road.secondary.fill)})
      map!.addLayer({id:'local-road-label-tertiary',type:'symbol',source:'local-map',filter:['all',namedRoad,['==',['get','kind'],'tertiary']],minzoom:14,layout:roadTextLayout(9),paint:roadTextPaint(OSM_CARTO.road.tertiary.fill)})
      map!.addLayer({id:'local-road-label-minor',type:'symbol',source:'local-map',filter:['all',namedRoad,['in',['get','kind'],['literal',['residential','unclassified','living_street','pedestrian']]]],minzoom:15,layout:roadTextLayout(8),paint:roadTextPaint(['match',['get','kind'],'living_street',OSM_CARTO.road.livingStreet.fill,'pedestrian',OSM_CARTO.road.pedestrian.fill,OSM_CARTO.road.minor.fill])})
      map!.addLayer({id:'local-road-label-service',type:'symbol',source:'local-map',filter:['all',namedRoad,['==',['get','kind'],'service']],minzoom:16,layout:roadTextLayout(9),paint:roadTextPaint(OSM_CARTO.road.minor.fill)})
      map!.addLayer({id:'local-path-labels',type:'symbol',source:'local-map',filter:['all',namedRoad,['in',['get','kind'],['literal',['path','footway','cycleway','steps','track']]]],minzoom:16,layout:{...roadTextLayout(9),'text-offset':[0,.7]},paint:roadTextPaint(OSM_CARTO.text.standardHalo)})
      const namedWaterway=['all',['==',['get','layer'],'waterway'],['has','name']] as any
      const waterwayTextLayout={'symbol-placement':'line','text-field':['get','name'],'text-font':OSM_CARTO.text.fontFamily,'text-padding':2,'symbol-spacing':500,'text-allow-overlap':false,'text-ignore-placement':false} as any
      map!.addLayer({id:'local-waterway-label-major',type:'symbol',source:'local-map',filter:['all',namedWaterway,['in',['get','kind'],['literal',['river','canal']]]],minzoom:13,layout:{...waterwayTextLayout,'text-size':['step',['zoom'],10,14,12]},paint:{'text-color':OSM_CARTO.water.text,'text-halo-color':OSM_CARTO.text.standardHalo,'text-halo-width':OSM_CARTO.text.haloRadius}})
      map!.addLayer({id:'local-waterway-label-minor',type:'symbol',source:'local-map',filter:['all',namedWaterway,['in',['get','kind'],['literal',['stream','ditch','drain']]]],minzoom:15,layout:{...waterwayTextLayout,'text-size':10,'text-offset':[0,.8]},paint:{'text-color':OSM_CARTO.water.text,'text-halo-color':OSM_CARTO.text.standardHalo,'text-halo-width':OSM_CARTO.text.haloRadius}})
      const namedPlace=['all',['==',['get','layer'],'place'],['has','name']] as any
      const symbolTextLayout={
        'text-field':['get','name'],'text-font':OSM_CARTO.text.fontFamily,
        'text-allow-overlap':false,'text-ignore-placement':false,
        'text-optional':false,'text-padding':OSM_CARTO.text.placeMargin,'text-max-width':5,'text-line-height':.95
      } as any
      const placePaint=(lightFrom:number,halo:any=OSM_CARTO.text.standardHalo)=>({
        'text-color':['step',['zoom'],OSM_CARTO.text.place,lightFrom,OSM_CARTO.text.placeLight],
        'text-halo-color':halo,'text-halo-width':OSM_CARTO.text.placeHaloRadius
      }) as any
      map!.addLayer({id:'local-place-city',type:'symbol',source:'local-map',filter:['all',namedPlace,['==',['get','kind'],'city']],minzoom:8,maxzoom:14,layout:{...symbolTextLayout,'text-size':['step',['zoom'],13,10,14,11,15]},paint:placePaint(99)})
      map!.addLayer({id:'local-place-suburb',type:'symbol',source:'local-map',filter:['all',namedPlace,['==',['get','kind'],'suburb']],minzoom:12,maxzoom:17,layout:{...symbolTextLayout,'text-size':['step',['zoom'],11,13,12,14,14,16,15]},paint:placePaint(14,['step',['zoom'],OSM_CARTO.text.standardHalo,14,OSM_CARTO.text.opaqueHalo])})
      map!.addLayer({id:'local-place-village',type:'symbol',source:'local-map',filter:['all',namedPlace,['==',['get','kind'],'village']],minzoom:12,maxzoom:17,layout:{...symbolTextLayout,'text-size':['step',['zoom'],10,13,11,14,13,15,14,16,15]},paint:placePaint(14,['step',['zoom'],OSM_CARTO.text.standardHalo,14,OSM_CARTO.text.opaqueHalo])})
      map!.addLayer({id:'local-place-quarter',type:'symbol',source:'local-map',filter:['all',namedPlace,['==',['get','kind'],'quarter']],minzoom:14,maxzoom:17,layout:{...symbolTextLayout,'text-size':['step',['zoom'],11,15,12,16,14]},paint:placePaint(15,OSM_CARTO.text.opaqueHalo)})
      map!.addLayer({id:'local-place-hamlet',type:'symbol',source:'local-map',filter:['all',namedPlace,['==',['get','kind'],'hamlet']],minzoom:14,maxzoom:18,layout:{...symbolTextLayout,'text-size':['step',['zoom'],10,15,11,16,12]},paint:placePaint(15,['step',['zoom'],OSM_CARTO.text.opaqueHalo,15,OSM_CARTO.text.standardHalo,16,OSM_CARTO.text.opaqueHalo])})
      map!.addLayer({id:'local-place-neighbourhood',type:'symbol',source:'local-map',filter:['all',namedPlace,['in',['get','kind'],['literal',['neighbourhood','isolated_dwelling','farm']]]],minzoom:15,maxzoom:20,layout:{...symbolTextLayout,'text-size':['step',['zoom'],10,16,12]},paint:placePaint(16,['step',['zoom'],OSM_CARTO.text.standardHalo,16,OSM_CARTO.text.opaqueHalo])})
      // Later MapLibre symbol layers win cross-layer collisions. Keep towns
      // above small places so 西貢 remains primary until its official z16 exit;
      // 西貢市中心 can then take over for the final suburb zoom interval.
      map!.addLayer({id:'local-place-town',type:'symbol',source:'local-map',filter:['all',namedPlace,['==',['get','kind'],'town']],minzoom:9,maxzoom:16,layout:{...symbolTextLayout,'text-size':['step',['zoom'],10,11,11,12,13,14,15]},paint:placePaint(99)})
      const peakIconFilter=['all',['==',['get','layer'],'place'],['==',['get','kind'],'peak']] as any
      const namedPeakFilter=['all',peakIconFilter,['has','name']] as any
      const peakSortKey=['case',['has','ele'],['-',0,['to-number',['get','ele'],0]],['to-number',['get','source_rank'],0]] as any
      const peakIconLayout={'icon-image':'osm-carto-peak','icon-size':1,'icon-allow-overlap':false,'icon-ignore-placement':true,'icon-padding':0,'symbol-sort-key':peakSortKey} as any
      // Keep the official marker pass continuous from z11 onward. The label
      // pass starts at z13 without replacing the icon bucket, so zooming across
      // the threshold cannot tear down and recreate the marker placement.
      map!.addLayer({id:'local-peak-icons',type:'symbol',source:'local-map',filter:namedPeakFilter,minzoom:11,layout:peakIconLayout})
      map!.addLayer({id:'local-peak-labels',type:'symbol',source:'local-map',filter:namedPeakFilter,minzoom:13,layout:{...symbolTextLayout,'text-field':['coalesce',['get','carto_name'],['get','name']],'symbol-sort-key':peakSortKey,'text-size':OSM_CARTO.text.peakSize,'text-offset':[0,OSM_CARTO.text.peakOffsetEm],'text-anchor':'top','text-max-width':['case',['<=',['length',['get','name']],4],OSM_CARTO.text.peakShortNameWidthEm,OSM_CARTO.text.peakMaxWidthEm],'text-line-height':OSM_CARTO.text.peakLineHeight,'text-padding':0},paint:{'text-color':OSM_CARTO.text.peak,'text-halo-color':OSM_CARTO.text.standardHalo,'text-halo-width':OSM_CARTO.text.haloRadius}})
      map!.addLayer=nativeAddLayer as MapLibreMap['addLayer']
    }catch(error){console.warn('[Faraway] 本地地图读取失败，继续显示旅程路线。',error)}
    map!.addSource('full-route',{type:'geojson',data:lineFeature(geometry.coordinates)})
    map!.addSource('walked-route',{type:'geojson',data:lineFeature(geometry.sliceAt(progress.value))})
    const checkpointData={type:'FeatureCollection' as const,features:props.world.checkpoints.map(cp=>({
      type:'Feature' as const,
      properties:{name:cp.name,walked:cp.distance<=props.distance,sectionBoundary:isSectionBoundary(cp.distance)},
      geometry:{type:'Point' as const,coordinates:geometry.pointAt(cp.distance/props.world.totalDistance)}
    }))}
    map!.addSource('journey-checkpoints',{type:'geojson',data:checkpointData})
    const roundedRouteLayout={
      'line-cap':'round' as const,
      'line-join':'round' as const,
      'line-round-limit':1.35
    }
    map!.addLayer({id:'route-shadow',type:'line',source:'full-route',layout:roundedRouteLayout,paint:{'line-color':'#f8f4e8','line-width':7,'line-opacity':.72}})
    map!.addLayer({id:'route-future',type:'line',source:'full-route',layout:roundedRouteLayout,paint:{'line-color':'#516553','line-width':4,'line-opacity':.58}})
    map!.addLayer({id:'route-walked',type:'line',source:'walked-route',layout:roundedRouteLayout,paint:{'line-color':'#d87942','line-width':5,'line-opacity':.95}})
    map!.addLayer({id:'checkpoint-halo',type:'circle',source:'journey-checkpoints',paint:{
      'circle-radius':['case',['boolean',['get','sectionBoundary'],false],14,10],
      'circle-color':'rgba(246,243,234,.9)',
      'circle-stroke-color':'rgba(30,40,25,.16)',
      'circle-stroke-width':1
    }})
    map!.addLayer({id:'checkpoint-core',type:'circle',source:'journey-checkpoints',paint:{
      'circle-radius':['case',['boolean',['get','sectionBoundary'],false],9,6],
      'circle-color':['case',['boolean',['get','walked'],false],'#e88343','#71836b']
    }})
    map!.addLayer({id:'checkpoint-dot',type:'circle',source:'journey-checkpoints',paint:{'circle-radius':2,'circle-color':'#fff'}})
    map!.jumpTo({center:geometry.pointAt(progress.value),zoom:12.5})
    props.world.checkpoints.forEach((cp,index)=>{
      const sectionBoundary=isSectionBoundary(cp.distance)
      const element=checkpointLabelElement(cp.name,sectionBoundary)
      element.title=`${cp.name} · ${cp.distance} km`
      const placement=checkpointLabelPlacement(cp.distance,index,sectionBoundary)
      element.classList.add(`placement-${placement.anchor}`)
      checkpointMarkers.push(new maplibregl.Marker({element,anchor:placement.anchor,offset:placement.offset}).setLngLat(geometry.pointAt(cp.distance/props.world.totalDistance)).addTo(map!))
    })
    const avatarElement=markerElement('osm-avatar')
    avatarElement.style.cssText='width:70px;height:74px;display:block;filter:drop-shadow(0 3px 4px rgba(28,39,30,.32));'
    const image=document.createElement('img');image.src=props.travelerImage??props.world.assets.travelerImage??assetUrl('static/worlds/traveler.png');image.alt='旅行者';image.width=70;image.height=70;image.style.cssText='display:block;width:70px;height:70px;max-width:70px;max-height:70px;object-fit:contain;';avatarElement.appendChild(image)
    avatar=new maplibregl.Marker({element:avatarElement,anchor:'bottom'}).setLngLat(geometry.pointAt(progress.value)).addTo(map!)
    // Do not keep the whole canvas transparent until every dense vector tile
    // has completed symbol placement. Reveal the map now and let MapLibre
    // progressively paint landcover, textures, and labels while panning.
    mapReady.value=true
  })
})

watch(progress,updateProgress)
watch(()=>props.follow,following=>{if(following&&map)map.easeTo({center:geometry.pointAt(displayedProgress),duration:500,easing:t=>1-Math.pow(1-t,3)})})
onUnmounted(()=>{if(typeof cancelAnimationFrame==='function')cancelAnimationFrame(cameraFrame);checkpointMarkers.forEach(marker=>marker.remove());avatar?.remove();map?.remove()})
</script>

<template><view class="osm-map-shell"><view ref="container" class="osm-map" :class="{'is-ready':mapReady}" /></view></template>

<style lang="scss">
.osm-map-shell{position:relative;width:100%;height:100%;min-height:190px;overflow:hidden;background:#d8e5e4}
.osm-map{position:absolute;inset:0;opacity:0;transition:opacity .18s ease-out}
.osm-map.is-ready{opacity:1}
.osm-map .maplibregl-canvas{outline:none}
.osm-checkpoint-label{display:block;padding:1px 3px;border-radius:5px;background-color:rgba(248,246,238,.84);color:#405145;font:600 11px/1.2 var(--font-sans,"PingFang SC","Microsoft YaHei",sans-serif);white-space:nowrap;box-shadow:0 1px 3px rgba(25,38,29,.11);pointer-events:none;isolation:isolate;backface-visibility:hidden}
.osm-checkpoint-label.is-section-boundary{z-index:2;padding:2px 4px;background:rgba(248,246,238,.96);color:#26382d;font-size:12px;font-weight:750;box-shadow:0 2px 7px rgba(25,38,29,.2)}
.osm-avatar{width:70px;height:74px;filter:drop-shadow(0 3px 4px rgba(28,39,30,.32))}
.osm-avatar img{display:block;width:100%;height:100%;object-fit:contain}
</style>
