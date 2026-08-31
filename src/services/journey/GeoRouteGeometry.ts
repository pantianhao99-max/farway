export type LngLat = [number, number]

type LineGeometry = { type:'LineString'; coordinates:LngLat[] }
type MultiLineGeometry = { type:'MultiLineString'; coordinates:LngLat[][] }
type RouteFeature = { properties?:Record<string, unknown>; geometry:LineGeometry|MultiLineGeometry }
type RouteData = { data?:{ features?:RouteFeature[] }; features?:RouteFeature[] }

const squaredDistance = (a:LngLat, b:LngLat) => (a[0]-b[0])**2 + (a[1]-b[1])**2
const reverse = (line:LngLat[]) => [...line].reverse()

// Subtle low-pass smoothing removes harsh GPS vertices without noticeably
// pulling the route away from the recorded trail.
function softenLine(line:LngLat[], passes=2, strength=.18):LngLat[] {
  let result=line.map(point=>[...point] as LngLat)
  for(let pass=0;pass<passes;pass+=1){
    result=result.map((point,index)=>{
      if(index===0||index===result.length-1)return point
      const previous=result[index-1],next=result[index+1]
      return [
        point[0]+(((previous[0]+next[0])/2)-point[0])*strength,
        point[1]+(((previous[1]+next[1])/2)-point[1])*strength
      ]
    })
  }
  return result
}

function mergeParts(parts:LngLat[][]):LngLat[] {
  const remaining=parts.filter(line=>line.length>1).map(line=>[...line] as LngLat[])
  if(!remaining.length)return []
  let route=remaining.splice(remaining.reduce((best,line,index)=>line.length>remaining[best].length?index:best,0),1)[0]
  while(remaining.length){
    let best={distance:Infinity,index:0,mode:0}
    remaining.forEach((line,index)=>{
      const choices=[
        squaredDistance(route.at(-1)!,line[0]), squaredDistance(route.at(-1)!,line.at(-1)!),
        squaredDistance(route[0],line.at(-1)!), squaredDistance(route[0],line[0])
      ]
      choices.forEach((distance,mode)=>{if(distance<best.distance)best={distance,index,mode}})
    })
    const line=remaining.splice(best.index,1)[0]
    if(best.mode===0)route.push(...line.slice(1))
    else if(best.mode===1)route.push(...reverse(line).slice(1))
    else if(best.mode===2)route=[...line.slice(0,-1),...route]
    else route=[...reverse(line).slice(0,-1),...route]
  }
  return route
}

function sectionNumber(feature:RouteFeature){
  const name=String(feature.properties?.['name:en']??feature.properties?.name??'')
  return Number(name.match(/Section\s+(\d+)/i)?.[1]??99)
}

function orientSections(sections:LngLat[][]):LngLat[][] {
  if(sections.length<2)return sections
  // Two-state dynamic programming: choose each section's direction while minimizing gaps.
  const cost=sections.map(()=>[Infinity,Infinity])
  const parent=sections.map(()=>[-1,-1])
  cost[0]=[0,0]
  for(let i=1;i<sections.length;i++)for(let direction=0;direction<2;direction++)for(let previous=0;previous<2;previous++){
    const a=previous?sections[i-1][0]:sections[i-1].at(-1)!
    const b=direction?sections[i].at(-1)!:sections[i][0]
    const next=cost[i-1][previous]+squaredDistance(a,b)
    if(next<cost[i][direction]){cost[i][direction]=next;parent[i][direction]=previous}
  }
  let direction=cost.at(-1)![0]<=cost.at(-1)![1]?0:1
  const result:Array<LngLat[]> = new Array(sections.length)
  for(let i=sections.length-1;i>=0;i--){result[i]=direction?reverse(sections[i]):sections[i];direction=parent[i][direction]}
  // The official route runs generally east to west. This also resolves a possible global reversal.
  return result[0][0][0] < result.at(-1)!.at(-1)![0] ? result.reverse().map(reverse) : result
}

function haversine(a:LngLat,b:LngLat){
  const radians=Math.PI/180, lat1=a[1]*radians, lat2=b[1]*radians
  const dLat=(b[1]-a[1])*radians,dLng=(b[0]-a[0])*radians
  const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2
  return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h))
}

export function createGeoRouteGeometry(source:RouteData){
  const features=[...(source.data?.features??source.features??[])].sort((a,b)=>sectionNumber(a)-sectionNumber(b))
  const sections=orientSections(features.map(feature=>mergeParts(feature.geometry.type==='LineString'?[feature.geometry.coordinates]:feature.geometry.coordinates)))
  const coordinates=softenLine(sections.flatMap((line,index)=>index?line.slice(1):line))
  const cumulative=[0]
  for(let i=1;i<coordinates.length;i++)cumulative.push(cumulative[i-1]+haversine(coordinates[i-1],coordinates[i]))
  const totalLength=cumulative.at(-1)??0
  const pointAt=(progress:number):LngLat=>{
    if(!coordinates.length)return [114.18,22.38]
    const target=Math.max(0,Math.min(1,progress))*totalLength
    let high=cumulative.findIndex(distance=>distance>=target)
    if(high<=0)return coordinates[0]
    const low=high-1, span=cumulative[high]-cumulative[low]||1, t=(target-cumulative[low])/span
    return [coordinates[low][0]+(coordinates[high][0]-coordinates[low][0])*t,coordinates[low][1]+(coordinates[high][1]-coordinates[low][1])*t]
  }
  const sliceAt=(progress:number)=>{
    const target=Math.max(0,Math.min(1,progress))*totalLength
    let high=cumulative.findIndex(distance=>distance>=target)
    if(high<0)high=coordinates.length-1
    return [...coordinates.slice(0,Math.max(1,high)),pointAt(progress)]
  }
  return {coordinates,totalLength,pointAt,sliceAt}
}
