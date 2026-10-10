/**
 * Human file size in the units the Cloudflare R2 dashboard uses
 * (1 MB = 1,000,000 bytes), so numbers in the admin match what the client
 * sees there: a 6,193,036 byte file is "6.19 MB" in both.
 * @param bytes - a non-negative byte count
 * @returns e.g. "840 KB", "6.19 MB", "1.04 GB"
 */
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
