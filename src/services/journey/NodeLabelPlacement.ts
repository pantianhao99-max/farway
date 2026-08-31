export type NodeLabelPlacement = 'right' | 'left' | 'top' | 'bottom'

export interface LabelNode { id:string; x:number; y:number; label:string; priority:number; hasMeta?:boolean }
export interface LabelPlacementResult { show:boolean; placement:NodeLabelPlacement }
interface Rect { left:number; top:number; right:number; bottom:number }

const overlaps = (a:Rect,b:Rect,padding=4) => !(a.right+padding<b.left||a.left-padding>b.right||a.bottom+padding<b.top||a.top-padding>b.bottom)
const overlapArea = (a:Rect,b:Rect) => Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top))

export function placeNodeLabels(nodes:LabelNode[], avatar:{x:number;y:number}, viewport:{left:number;top:number;width:number;height:number}):Record<string,LabelPlacementResult>{
  const occupied:Rect[]=[]
  const safe:Rect={left:avatar.x-48,top:avatar.y-58,right:avatar.x+48,bottom:avatar.y+42}
  const bounds:Rect={left:viewport.left+10,top:viewport.top+10,right:viewport.left+viewport.width-10,bottom:viewport.top+viewport.height-10}
  const result:Record<string,LabelPlacementResult>={}
  for(const node of [...nodes].sort((a,b)=>a.priority-b.priority)){
    if(node.priority>2){result[node.id]={show:false,placement:'right'};continue}
    const chars=[...node.label].length
    const width=Math.min(138,Math.max(52,chars*12+8))
    const lines=Math.min(2,Math.ceil((chars*12)/132))
    const height=lines*16+(node.hasMeta?13:0)
    const gap=18
    const candidates:Record<NodeLabelPlacement,Rect>={
      right:{left:node.x+gap,top:node.y-height/2,right:node.x+gap+width,bottom:node.y+height/2},
      left:{left:node.x-gap-width,top:node.y-height/2,right:node.x-gap,bottom:node.y+height/2},
      top:{left:node.x-width/2,top:node.y-gap-height,right:node.x+width/2,bottom:node.y-gap},
      bottom:{left:node.x-width/2,top:node.y+gap,right:node.x+width/2,bottom:node.y+gap+height}
    }
    const order:NodeLabelPlacement[]=node.x>bounds.left+viewport.width*.62?['left','top','bottom','right']:node.x<bounds.left+viewport.width*.38?['right','top','bottom','left']:['right','left','top','bottom']
    const valid=order.find(side=>{const r=candidates[side];return r.left>=bounds.left&&r.right<=bounds.right&&r.top>=bounds.top&&r.bottom<=bounds.bottom&&!overlaps(r,safe,8)&&!occupied.some(o=>overlaps(r,o,5))})
    const chosen=valid??(node.priority<=1?order.sort((a,b)=>overlapArea(candidates[a],safe)-overlapArea(candidates[b],safe))[0]:null)
    if(!chosen){result[node.id]={show:false,placement:'right'};continue}
    occupied.push(candidates[chosen]);result[node.id]={show:true,placement:chosen}
  }
  return result
}
