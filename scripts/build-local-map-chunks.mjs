import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import geojsonvt from 'geojson-vt'
import { fromGeojsonVt } from '@maplibre/vt-pbf'

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const input=JSON.parse(await fs.readFile(path.join(root,'scripts/data/maclehose-local-map.json'),'utf8'))
const minZoom=10,maxZoom=14,extent=4096
const bounds={west:113.93,south:22.28,east:114.43,north:22.52}
const outputRoot=path.join(root,'src/static/maps/tiles')
const legacyRoot=path.join(root,'src/static/maps/chunks')
const index=geojsonvt(input,{maxZoom,indexMaxZoom:maxZoom,indexMaxPoints:0,tolerance:1,extent,buffer:64})
const lonToX=(lon,zoom)=>Math.floor((lon+180)/360*2**zoom)
const latToY=(lat,zoom)=>Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*2**zoom)

await fs.rm(outputRoot,{recursive:true,force:true})
await fs.mkdir(outputRoot,{recursive:true})
let count=0,total=0
for(let zoom=minZoom;zoom<=maxZoom;zoom++){
  const zoomRoot=path.join(outputRoot,`z${zoom}`)
  await fs.mkdir(zoomRoot,{recursive:true})
  for(let x=lonToX(bounds.west,zoom);x<=lonToX(bounds.east,zoom);x++)for(let y=latToY(bounds.north,zoom);y<=latToY(bounds.south,zoom);y++){
    const tile=index.getTile(zoom,x,y)
    if(!tile?.features.length)continue
    const body=fromGeojsonVt({maclehose:tile},{version:2,extent})
    await fs.writeFile(path.join(zoomRoot,`${x}-${y}.pbf`),body)
    count++;total+=body.byteLength
  }
}
await fs.rm(legacyRoot,{recursive:true,force:true})
console.log(`wrote ${count} vector tiles, z${minZoom}-z${maxZoom} (${(total/1024/1024).toFixed(1)} MB total)`)
