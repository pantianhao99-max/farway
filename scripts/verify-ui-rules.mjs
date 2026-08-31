import assert from 'node:assert/strict'
import { formatNodeDistance,formatCollectedNodeDistance } from '../src/services/journey/NodeDistanceFormatter.ts'
import { placeNodeLabels } from '../src/services/journey/NodeLabelPlacement.ts'
import { createRouteGeometry } from '../src/services/journey/RouteGeometry.ts'

assert.equal(formatNodeDistance(0),'起点')
assert.equal(formatNodeDistance(.01),'起点')
assert.equal(formatNodeDistance(2.8),'第 2.8 公里')
assert.equal(formatCollectedNodeDistance(11.6),'收录于第 11.6 公里')

const edge=placeNodeLabels([
  {id:'left',x:12,y:120,label:'左边缘节点',priority:0},
  {id:'right',x:308,y:220,label:'右边缘节点名称',priority:1}
],{x:160,y:340},{left:0,top:0,width:320,height:480})
assert.equal(edge.left.placement,'right')
assert.equal(edge.right.placement,'left')

const dense=placeNodeLabels([
  {id:'current',x:160,y:220,label:'当前经过的节点',priority:0},
  {id:'next',x:166,y:226,label:'下一目标节点名称',priority:1,hasMeta:true},
  {id:'near',x:170,y:230,label:'最近解锁节点',priority:2},
  {id:'ordinary',x:174,y:234,label:'普通节点不显示',priority:3}
],{x:162,y:224},{left:0,top:0,width:320,height:480})
assert.equal(dense.current.show,true)
assert.equal(dense.next.show,true)
assert.equal(dense.ordinary.show,false)
assert.ok(Object.values(dense).filter(item=>item.show).length<=3)

const geometry=createRouteGeometry([{x:0,y:0},{x:0,y:1},{x:1,y:1}])
const ten=geometry.pointAt(.1),half=geometry.pointAt(.5),ninety=geometry.pointAt(.9)
assert.ok(ten.y>0&&ten.y<.35,'10% advances along physical route')
assert.ok(half.y>.8,'50% reaches the bend by physical length')
assert.ok(ninety.x>.65,'90% reaches the final segment')
assert.ok(geometry.pathBetween(.1,.2).startsWith('M '))

console.log('Verified node distance formatting, edge/dense label placement, and physical route interpolation at 10/50/90%.')
