import fs from 'node:fs/promises'

const inputUrl=new URL('./data/maclehose-local-map.json',import.meta.url)
const document=JSON.parse(await fs.readFile(inputUrl,'utf8'))
const query='[out:json][timeout:60];node["natural"="peak"]["ele"](22.28,113.93,22.52,114.43);out;'
const response=await fetch(`https://overpass.kumi.systems/api/interpreter?data=${encodeURIComponent(query)}`)
if(!response.ok)throw new Error(`Overpass ${response.status}`)
const osm=await response.json()
const key=(lon,lat)=>`${Number(lon).toFixed(6)},${Number(lat).toFixed(6)}`
const elevations=new Map(osm.elements.map(node=>[key(node.lon,node.lat),node.tags.ele]))
let updated=0
for(const feature of document.features){
  if(feature.properties?.kind!=='peak'||feature.geometry?.type!=='Point')continue
  const elevation=elevations.get(key(...feature.geometry.coordinates))
  if(elevation==null)continue
  feature.properties.ele=elevation
  updated++
}
await fs.writeFile(inputUrl,JSON.stringify(document))
console.log(`added elevation to ${updated} peaks (${elevations.size} OSM peaks with ele in bounds)`)
