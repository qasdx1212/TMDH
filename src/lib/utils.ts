import { GRID_COLS, GRID_ROWS, ZONE_PRICES, PERMANENT_PRICES, DURATIONS, PERMANENT_DAYS } from './constants'
import type { Zone, CellData } from '@/types/cell'

export function getZone(col: number, row: number): Zone {
  const dx = Math.abs(col - GRID_COLS / 2) / (GRID_COLS / 2)
  const dy = Math.abs(row - GRID_ROWS / 2) / (GRID_ROWS / 2)
  const d = Math.sqrt(dx * dx + dy * dy)
  if (d < 0.22) return 'a'
  if (d < 0.55) return 'b'
  return 'c'
}

export function getLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return 0.299 * r + 0.587 * g + 0.114 * b
}

export function getFgColor(bgHex: string): string {
  return getLuminance(bgHex) < 128 ? '#ffffff' : '#000000'
}

export function countByZone(selectedIds: number[], cells: CellData[]): Record<Zone, number> {
  const counts: Record<Zone, number> = { a: 0, b: 0, c: 0 }
  for (const id of selectedIds) {
    const zone = cells[id]?.zone
    if (zone) counts[zone]++
  }
  return counts
}

export function calcPrice(zoneCounts: Record<Zone, number>, days: number): number {
  if (days === PERMANENT_DAYS) {
    return (
      zoneCounts.a * PERMANENT_PRICES.a +
      zoneCounts.b * PERMANENT_PRICES.b +
      zoneCounts.c * PERMANENT_PRICES.c
    )
  }
  const base = zoneCounts.a * ZONE_PRICES.a + zoneCounts.b * ZONE_PRICES.b + zoneCounts.c * ZONE_PRICES.c
  const duration = DURATIONS.find(d => d.days === days) ?? DURATIONS[2]
  return Math.round(base * duration.multiplier)
}

export function formatKRW(n: number): string {
  return n.toLocaleString('ko-KR') + '원'
}
