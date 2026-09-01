import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import geojsonvt from 'geojson-vt'
import { fromGeojsonVt } from '@maplibre/vt-pbf'

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const sourceInput=JSON.parse(await fs.readFile(path.join(root,'scripts/data/maclehose-local-map.json'),'utf8'))
// geojson-vt rebuilds feature order independently at every zoom. Preserve a
// stable cross-zoom rank so dense symbol collision decisions do not vary by
// tile level, especially for peaks without ele values.
const cartoPeakName=properties=>{
  const elevation=String(properties?.ele??'')
  if(properties?.kind!=='peak'||!properties?.name||!/^\-?\d{1,4}(\.\d+)?$/.test(elevation))return properties?.name
  const rounded=String(Math.round(Number(elevation))).replace('-', '\u2212')
  return `${properties.name}\n${rounded}\u00a0m`
}
const normalizeMapText=value=>typeof value==='string'
  ? value.normalize('NFKC').replace(/[\u200B-\u200D\u2060\uFE00-\uFE0F\uFEFF]/g,'')
  : value
const input={...sourceInput,features:sourceInput.features.filter(feature=>
  feature.properties?.kind!=='peak'||Boolean(feature.properties?.name)
).map((feature,sourceRank)=>{
  const properties=Object.fromEntries(
    Object.entries(feature.properties??{}).map(([key,value])=>[key,normalizeMapText(value)])
  )
  return {
    ...feature,
    properties:{...properties,source_rank:sourceRank,carto_name:cartoPeakName(properties)}
  }
})}
const minZoom=8,maxZoom=14,extent=4096
const bounds={west:113.93,south:22.28,east:114.43,north:22.52}
const outputRoot=path.join(root,'src/static/maps/tiles')
const legacyRoot=path.join(root,'src/static/maps/chunks')
const lonToX=(lon,zoom)=>Math.floor((lon+180)/360*2**zoom)
const latToY=(lat,zoom)=>Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*2**zoom)
const ringAreaM2=ring=>{
  if(!Array.isArray(ring)||ring.length<3)return 0
  const latitude=ring.reduce((sum,point)=>sum+point[1],0)/ring.length
  const xScale=111320*Math.cos(latitude*Math.PI/180),yScale=111320
  let twiceArea=0
  for(let index=0,previous=ring.length-1;index<ring.length;previous=index++){
    twiceArea+=(ring[previous][0]*xScale)*(ring[index][1]*yScale)-(ring[index][0]*xScale)*(ring[previous][1]*yScale)
  }
  return Math.abs(twiceArea)/2
}
const geometryAreaM2=geometry=>{
  const polygonArea=rings=>Math.max(0,ringAreaM2(rings[0])-rings.slice(1).reduce((sum,ring)=>sum+ringAreaM2(ring),0))
  if(geometry?.type==='Polygon')return polygonArea(geometry.coordinates)
  if(geometry?.type==='MultiPolygon')return geometry.coordinates.reduce((sum,rings)=>sum+polygonArea(rings),0)
  return 0
}
const areaMinimumZoom=feature=>{
  const area=geometryAreaM2(feature.geometry)
  // Carto filters landcover by way_area > one rendered pixel. Its z0 uses
  // 256 px while MapLibre uses 512 px, hence official zoom = local zoom + 1.
  for(let zoom=8;zoom<=14;zoom++){
    const metresPerPixel=40075016.686/(256*2**(zoom+1))
    if(area>metresPerPixel**2)return zoom
  }
  return 14
}
const minimumZoomFor=feature=>{
  const {layer,kind}=feature.properties??{}
  if(layer==='building')return 13
  if(layer==='road'){
    if(['path','footway','steps'].includes(kind))return 13
    if(['track','cycleway'].includes(kind))return 12
    if(kind==='service')return 13
    if(['residential','unclassified','living_street','pedestrian'].includes(kind))return 11
    if(['motorway','trunk','primary'].includes(kind))return 8
    if(kind==='secondary')return 9
    return 10
  }
  if(layer==='waterway'){
    if(['ditch','drain'].includes(kind))return 11
    if(kind==='stream')return 11
    if(kind==='canal')return 11
    return kind==='river'?10:99
  }
  if(layer==='railway')return 8
  if(layer==='place'){
    if(['city','town'].includes(kind))return 8
    if(kind==='peak')return 10
    if(['suburb','village'].includes(kind))return 11
    if(['quarter','hamlet'].includes(kind))return 13
    if(['neighbourhood','isolated_dwelling','farm'].includes(kind))return 14
    return 99
  }
  if(layer==='area'){
    const styleMinimum=kind==='parking'?13:
      ['playground','place_of_worship'].includes(kind)?12:
      ['school','university','hospital','pitch','sports_centre','cemetery','quarry','recreation_ground'].includes(kind)?9:8
    return Math.max(styleMinimum,areaMinimumZoom(feature))
  }
  return 99
}

await fs.rm(outputRoot,{recursive:true,force:true})
await fs.mkdir(outputRoot,{recursive:true})
let count=0,total=0
const contentHash=createHash('sha256')
for(let zoom=minZoom;zoom<=maxZoom;zoom++){
  const zoomInput={...input,features:input.features.filter(feature=>minimumZoomFor(feature)<=zoom)}
  // Use one fixed simplification precision for every output zoom. Tying
  // maxZoom to `zoom` independently re-simplified narrow landcover polygons
  // at each level, so a wood/scrub area could collapse and then reappear.
  const index=geojsonvt(zoomInput,{maxZoom,indexMaxZoom:zoom,indexMaxPoints:0,tolerance:1,extent,buffer:64})
  const zoomRoot=path.join(outputRoot,String(zoom))
  await fs.mkdir(zoomRoot,{recursive:true})
  for(let x=lonToX(bounds.west,zoom);x<=lonToX(bounds.east,zoom);x++)for(let y=latToY(bounds.north,zoom);y<=latToY(bounds.south,zoom);y++){
    const tile=index.getTile(zoom,x,y)??{features:[]}
    const body=fromGeojsonVt({maclehose:tile},{version:2,extent})
    const xRoot=path.join(zoomRoot,String(x))
    await fs.mkdir(xRoot,{recursive:true})
    await fs.writeFile(path.join(xRoot,`${y}.pbf`),body)
    contentHash.update(body)
    count++;total+=body.byteLength
  }
}
const revision=contentHash.digest('hex').slice(0,12)
await fs.writeFile(path.join(outputRoot,'version.json'),JSON.stringify({revision,minZoom,maxZoom,extent}))
await fs.rm(legacyRoot,{recursive:true,force:true})
console.log(`wrote ${count} vector tiles, z${minZoom}-z${maxZoom} (${(total/1024/1024).toFixed(1)} MB total, ${revision})`)
