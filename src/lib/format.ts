/** bytes -> "840 KB" / "6.19 MB" (1 MB = 1,000,000, like the R2 dashboard) */
export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1000
  let unit = 0
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000
    unit++
  }
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2
  return `${Number(value.toFixed(digits))} ${units[unit]}`
}
