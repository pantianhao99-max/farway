import { readFileSync } from 'node:fs'

const source = readFileSync(process.argv[2], 'utf8')
const paths = [...source.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map(match => match[1])
if (!paths.length) throw new Error('No SVG paths found')

function parsePath(d) {
  const values = [...d.matchAll(/[MC]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi)].map(match => match[0])
  if (values.shift().toUpperCase() !== 'M') throw new Error('Only absolute M/C paths are supported')
  let point = { x: +values.shift(), y: +values.shift() }
  const segments = []
  while (values.length) {
    if (values.shift().toUpperCase() !== 'C') throw new Error('Only cubic paths are supported')
    const segment = { p0: point, p1: { x: +values.shift(), y: +values.shift() }, p2: { x: +values.shift(), y: +values.shift() }, p3: { x: +values.shift(), y: +values.shift() } }
    segments.push(segment)
    point = segment.p3
  }
  return segments
}

const cubic = (segment, t) => {
  const u = 1 - t
  return {
    x: u ** 3 * segment.p0.x + 3 * u ** 2 * t * segment.p1.x + 3 * u * t ** 2 * segment.p2.x + t ** 3 * segment.p3.x,
    y: u ** 3 * segment.p0.y + 3 * u ** 2 * t * segment.p1.y + 3 * u * t ** 2 * segment.p2.y + t ** 3 * segment.p3.y,
  }
}

// The supplied artwork is split into six connected pieces. Join them from the
// journey's bottom start to its top finish.
const samples = []
const order = [[0, true], [1, false], [2, true], [3, true], [4, false], [5, true]]
for (const [pathIndex, reverse] of order) {
  let segments = parsePath(paths[pathIndex])
  if (reverse) segments = segments.toReversed().map(({ p0, p1, p2, p3 }) => ({ p0: p3, p1: p2, p2: p1, p3: p0 }))
  for (const segment of segments) {
    for (let step = samples.length ? 1 : 0; step <= 100; step += 1) samples.push(cubic(segment, step / 100))
  }
}

let length = 0
const measured = samples.map((point, index) => {
  if (index) length += Math.hypot(point.x - samples[index - 1].x, point.y - samples[index - 1].y)
  return { ...point, length }
})
const distances = process.argv.slice(3).map(Number)
const points = distances.map(distance => {
  const target = length * distance / 100
  const foundIndex = measured.findIndex(point => point.length >= target)
  const upperIndex = foundIndex < 0 ? measured.length - 1 : Math.max(1, foundIndex)
  const lower = measured[upperIndex - 1], upper = measured[upperIndex]
  const ratio = (target - lower.length) / (upper.length - lower.length || 1)
  const x = lower.x + (upper.x - lower.x) * ratio
  const y = lower.y + (upper.y - lower.y) * ratio
  return { x: +(x / 1086).toFixed(6), y: +(1 - y / 1448).toFixed(6) }
})
console.log(JSON.stringify(points, null, 2))
