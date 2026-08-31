import fs from 'node:fs/promises'

// Fetch a much wider section of the mainland coast. The open ends of that
// chain must sit well outside the map viewport; otherwise their synthetic
// connectors appear as diagonal land/sea cuts near Sai Kung.
const queryBounds=[22.00,113.50,23.00,115.50]
// Close the one mainland coastline far outside the Hong Kong viewport so the
// synthetic edge can never appear as a rectangular map boundary.
const outerBounds=[100,0,130,40]
const endpointKey=way=>[way.nodes[0],way.nodes[way.nodes.length-1]]

const query=`[out:json][timeout:120];way["natural"="coastline"](${queryBounds.join(',')});out geom;`
const response=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded;charset=UTF-8','accept':'application/json','user-agent':'Faraway-map-builder/0.1'},body:new URLSearchParams({data:query}).toString()})
if(!response.ok)throw new Error(`Overpass ${response.status}: ${await response.text()}`)
const document=await response.json()
const ways=document.elements.filter(element=>element.type==='way'&&element.geometry?.length>1).map(element=>({nodes:element.nodes,coordinates:element.geometry.map(point=>[point.lon,point.lat])}))

const starts=new Map(),ends=new Map(),used=new Set(),chains=[]
ways.forEach((way,index)=>{const [start,end]=endpointKey(way);starts.set(start,index);ends.set(end,index)})
ways.forEach((way,index)=>{
  if(used.has(index))return
  const nodes=[...way.nodes],coordinates=[...way.coordinates];used.add(index)
  while(true){const next=starts.get(nodes[nodes.length-1]);if(next===undefined||used.has(next))break;nodes.push(...ways[next].nodes.slice(1));coordinates.push(...ways[next].coordinates.slice(1));used.add(next)}
  while(true){const previous=ends.get(nodes[0]);if(previous===undefined||used.has(previous))break;nodes.unshift(...ways[previous].nodes.slice(0,-1));coordinates.unshift(...ways[previous].coordinates.slice(0,-1));used.add(previous)}
  chains.push({nodes,coordinates})
})

const signedArea=ring=>ring.reduce((sum,point,index)=>{const next=ring[(index+1)%ring.length];return sum+point[0]*next[1]-next[0]*point[1]},0)/2
const contains=(point,ring)=>{let inside=false;for(let index=0,previous=ring.length-1;index<ring.length;previous=index++){const a=ring[index],b=ring[previous];if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside}return inside}
const route=JSON.parse(await fs.readFile(new URL('../src/data/worlds/maclehose-route.json',import.meta.url),'utf8'))
const routePoints=route.data.features.flatMap(feature=>feature.geometry.type==='LineString'?feature.geometry.coordinates:feature.geometry.coordinates.flat()).filter((_,index)=>index%20===0)
const [west,south,east,north]=outerBounds,width=east-west,height=north-south,perimeter=2*(width+height)
const boundaryPoint=point=>[[Math.abs(point[1]-south),[Math.min(east,Math.max(west,point[0])),south]],[Math.abs(point[0]-east),[east,Math.min(north,Math.max(south,point[1]))]],[Math.abs(point[1]-north),[Math.min(east,Math.max(west,point[0])),north]],[Math.abs(point[0]-west),[west,Math.min(north,Math.max(south,point[1]))]]].sort((a,b)=>a[0]-b[0])[0][1]
const boundaryPosition=point=>point[1]===south?point[0]-west:point[0]===east?width+point[1]-south:point[1]===north?width+height+east-point[0]:2*width+height+north-point[1]
const corners=[[0,[west,south]],[width,[east,south]],[width+height,[east,north]],[2*width+height,[west,north]],[perimeter,[west,south]]]
const clockwiseBoundary=(from,to)=>{const start=boundaryPosition(from),end=boundaryPosition(to),target=end<start?end+perimeter:end,points=[from];for(const [position,corner] of corners){const adjusted=position<=start?position+perimeter:position;if(adjusted>start&&adjusted<target)points.push(corner)}points.push(to);return points}

const rings=chains.flatMap(chain=>{
  if(chain.nodes[0]===chain.nodes[chain.nodes.length-1])return [chain.coordinates]
  const end=boundaryPoint(chain.coordinates[chain.coordinates.length-1]),start=boundaryPoint(chain.coordinates[0])
  const clockwise=[...chain.coordinates,end,...clockwiseBoundary(end,start).slice(1)]
  const counterclockwise=[...chain.coordinates,end,...clockwiseBoundary(start,end).reverse().slice(1)]
  const score=ring=>routePoints.filter(point=>contains(point,ring)).length
  const clockwiseScore=score(clockwise),counterclockwiseScore=score(counterclockwise)
  if(clockwiseScore===0&&counterclockwiseScore===0)return []
  return [clockwiseScore>counterclockwiseScore?clockwise:counterclockwise]
}).map(ring=>[...ring.slice(0,-1),ring[0]]).filter(ring=>ring.length>=4&&Math.abs(signedArea(ring))>1e-8)

const output={type:'FeatureCollection',attribution:'© OpenStreetMap contributors',features:rings.map(coordinates=>({type:'Feature',properties:{kind:'land'},geometry:{type:'Polygon',coordinates:[coordinates]}}))}
const outputPath=new URL('../src/static/maps/maclehose-land-v2.json',import.meta.url)
await fs.writeFile(outputPath,JSON.stringify(output))
console.log(`wrote ${rings.length} land polygons from ${ways.length} coastline ways (${(JSON.stringify(output).length/1024/1024).toFixed(1)} MB)`)
