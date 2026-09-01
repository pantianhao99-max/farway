import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const load = name => JSON.parse(readFileSync(new URL(`../src/data/worlds/${name}`, import.meta.url), 'utf8'))
const worlds = [load('maclehose-trail.json')]

function crossed(world, from, to, unlocked = []) {
  return world.checkpoints
    .filter(point => point.distance > from && point.distance <= to && !unlocked.includes(point.id))
    .sort((a, b) => a.distance - b.distance)
}

for (const world of worlds) {
  assert.equal(world.totalDistance, 100, `${world.id}: total distance`)
  assert.ok(world.chapters.length >= 5, `${world.id}: chapters`)
  assert.ok(world.checkpoints.length >= 25, `${world.id}: checkpoints`)
  assert.equal(world.checkpoints[0].distance, 0, `${world.id}: starts at zero`)
  assert.equal(world.checkpoints.at(-1).distance, 100, `${world.id}: ends at 100`)
  assert.equal(world.pathPoints.length, world.checkpoints.length, `${world.id}: path/checkpoint parity`)
  assert.ok(world.assets && 'mapImage' in world.assets && 'coverImage' in world.assets && 'travelerImage' in world.assets, `${world.id}: replaceable image asset contract`)
  assert.ok(world.assets.mapAspectRatio > 0, `${world.id}: valid map aspect ratio`)
  world.pathPoints.forEach((point, index) => {
    assert.ok(point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1, `${world.id}: normalized route point ${index}`)
    assert.equal(world.checkpoints[index].mapX, point.x, `${world.id}: node/route x alignment ${index}`)
    assert.equal(world.checkpoints[index].mapY, point.y, `${world.id}: node/route y alignment ${index}`)
  })
  assert.deepEqual([...world.checkpoints].sort((a,b) => a.distance-b.distance), world.checkpoints, `${world.id}: checkpoint order`)
  assert.deepEqual([...world.chapters].sort((a,b) => a.startDistance-b.startDistance), world.chapters, `${world.id}: chapter order`)
  assert.equal(new Set(world.checkpoints.map(point => point.id)).size, world.checkpoints.length, `${world.id}: unique checkpoint ids`)
  assert.equal(crossed(world, 0, 100).length, world.checkpoints.length - 1, `${world.id}: full settlement`)
  const sample = world.checkpoints.slice(1, 4)
  assert.deepEqual(crossed(world, 0, sample.at(-1).distance, [sample[0].id]).map(p => p.id), sample.slice(1).map(p => p.id), `${world.id}: no duplicate unlock`)
  assert.equal(Math.min(world.totalDistance, 98 + 10), 100, `${world.id}: completion cap`)
}

const mac = worlds[0]
assert.equal(mac.chapters.length, 10, 'MacLehose has ten sections')
assert.deepEqual(crossed(mac, 8, 18).map(p => p.distance), [8.8, 10, 14.1, 17], 'MacLehose multi-checkpoint order')

console.log(`Verified ${worlds.length} worlds, ${worlds.reduce((sum, world) => sum + world.checkpoints.length, 0)} checkpoints and boundary rules.`)
