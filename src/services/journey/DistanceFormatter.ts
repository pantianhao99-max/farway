export const distanceFormatter = {
  km(value: number, digits = 1) {
    const safe = Number.isFinite(value) ? Math.max(0, value) : 0
    return `${safe.toFixed(digits)} km`
  },
  progress(current: number, total: number, digits = 1) {
    return `${Math.max(0, current).toFixed(digits)} / ${Math.max(0, total).toFixed(0)} km`
  },
  percent(current: number, total: number) {
    return total > 0 ? Math.min(100, Math.max(0, current / total * 100)) : 0
  },
  natural(value: number, prefix = '还差') {
    const safe = Number.isFinite(value) ? Math.max(0, value) : 0
    return `${prefix} ${safe.toFixed(1)} 公里`
  }
}
