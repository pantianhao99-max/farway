import type { PathPoint, SvgRouteSegment } from '@/types/journey'

export interface RouteSample extends PathPoint { length: number }

function catmullRom(points: PathPoint[], samplesPerSegment = 18): RouteSample[] {
  if (!points.length) return []
  if (points.length === 1) return [{ ...points[0], length: 0 }]
  const result: RouteSample[] = [{ ...points[0], length: 0 }]
  let length = 0
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i]
    const p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)]
    for (let step = 1; step <= samplesPerSegment; step += 1) {
      const t = step / samplesPerSegment, t2 = t * t, t3 = t2 * t
      const x = 0.5 * ((2*p1.x)+(-p0.x+p2.x)*t+(2*p0.x-5*p1.x+4*p2.x-p3.x)*t2+(-p0.x+3*p1.x-3*p2.x+p3.x)*t3)
      const y = 0.5 * ((2*p1.y)+(-p0.y+p2.y)*t+(2*p0.y-5*p1.y+4*p2.y-p3.y)*t2+(-p0.y+3*p1.y-3*p2.y+p3.y)*t3)
      const previous = result[result.length - 1]
      length += Math.hypot(x - previous.x, y - previous.y)
      result.push({ x, y, length })
    }
  }
  return result
}

interface CubicSegment { p0:PathPoint; p1:PathPoint; p2:PathPoint; p3:PathPoint }

function parseCubicPath(d:string):CubicSegment[] {
  const tokens=[...d.matchAll(/[MC]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi)].map(match=>match[0])
  if(tokens.shift()?.toUpperCase()!=='M')return []
  let point={x:Number(tokens.shift()),y:Number(tokens.shift())}
  const segments:CubicSegment[]=[]
  while(tokens.length){
    if(tokens.shift()?.toUpperCase()!=='C')break
    const segment={p0:point,p1:{x:Number(tokens.shift()),y:Number(tokens.shift())},p2:{x:Number(tokens.shift()),y:Number(tokens.shift())},p3:{x:Number(tokens.shift()),y:Number(tokens.shift())}}
    segments.push(segment);point=segment.p3
  }
  return segments
}

function svgRouteSamples(route:SvgRouteSegment[]):RouteSample[]{
  const points:PathPoint[]=[]
  for(const piece of route){
    let segments=parseCubicPath(piece.d)
    if(piece.reverse)segments=segments.reverse().map(({p0,p1,p2,p3})=>({p0:p3,p1:p2,p2:p1,p3:p0}))
    for(const segment of segments){
      for(let step=points.length?1:0;step<=60;step+=1){
        const t=step/60,u=1-t
        const px=u**3*segment.p0.x+3*u**2*t*segment.p1.x+3*u*t**2*segment.p2.x+t**3*segment.p3.x
        const py=u**3*segment.p0.y+3*u**2*t*segment.p1.y+3*u*t**2*segment.p2.y+t**3*segment.p3.y
        points.push({x:px/1086,y:1-py/1448})
      }
    }
  }
  let length=0
  return points.map((point,index)=>{
    if(index)length+=Math.hypot(point.x-points[index-1].x,point.y-points[index-1].y)
    return {...point,length}
  })
}

export function createRouteGeometry(points: PathPoint[], routeSvgSegments?:SvgRouteSegment[]) {
  const samples = routeSvgSegments?.length ? svgRouteSamples(routeSvgSegments) : catmullRom(points)
  const totalLength = samples.at(-1)?.length ?? 0
  function pointAt(progress: number): PathPoint {
    if (!samples.length) return { x: 0.5, y: 0 }
    const target = Math.min(1, Math.max(0, progress)) * totalLength
    const upperIndex = samples.findIndex(sample => sample.length >= target)
    if (upperIndex <= 0) return { x: samples[0].x, y: samples[0].y }
    const lower = samples[upperIndex - 1], upper = samples[upperIndex]
    const span = upper.length - lower.length
    const ratio = span > 0 ? (target - lower.length) / span : 0
    return { x: lower.x + (upper.x-lower.x)*ratio, y: lower.y + (upper.y-lower.y)*ratio }
  }
  function progressAt(point:PathPoint):number{
    if(!samples.length||totalLength<=0)return 0
    let closest=samples[0],distance=Infinity
    for(const sample of samples){const next=Math.hypot(sample.x-point.x,sample.y-point.y);if(next<distance){distance=next;closest=sample}}
    return closest.length/totalLength
  }
  function pathBetween(start:number,end:number):string{
    if(!samples.length)return ''
    const low=Math.max(0,Math.min(start,end)),high=Math.min(1,Math.max(start,end))
    const selected=[pointAt(low),...samples.filter(sample=>sample.length/totalLength>low&&sample.length/totalLength<high),pointAt(high)]
    return selected.map((point,index)=>`${index?'L':'M'} ${point.x*100} ${(1-point.y)*100}`).join(' ')
  }
  const svgPath = samples.length
    ? samples.map((point, index) => `${index ? 'L' : 'M'} ${point.x*100} ${(1-point.y)*100}`).join(' ')
    : ''
  return { samples, totalLength, pointAt, progressAt, pathBetween, svgPath }
}
