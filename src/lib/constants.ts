export const GRID_COLS = 200
export const GRID_ROWS = 100
export const CELL_PX = 10 // 1칸 = 10px (표시용)

export const ZONES = {
  neon:        { label: '집.zip', colMin: 0,   colMax: 99,  rowMin: 0,  rowMax: 49, color: '#c8a96e', bg: '#3a2510', gridColor: '#4a3018' },
  riverside:   { label: '집.zip', colMin: 100, colMax: 199, rowMin: 0,  rowMax: 49, color: '#c8a96e', bg: '#3a2510', gridColor: '#4a3018' },
  oldtown:     { label: '집.zip', colMin: 0,   colMax: 99,  rowMin: 50, rowMax: 99, color: '#c8a96e', bg: '#3a2510', gridColor: '#4a3018' },
  artdistrict: { label: '집.zip', colMin: 100, colMax: 199, rowMin: 50, rowMax: 99, color: '#c8a96e', bg: '#3a2510', gridColor: '#4a3018' },
} as const

export const ZONE_PRICES: Record<string, number> = {
  neon: 1000,
  riverside: 1000,
  oldtown: 1000,
  artdistrict: 1000,
}

export const PERMANENT_MULTIPLIER = 1 // 영구제: 기준가 × 1 (= 칸당 기준가 그대로)

export const DURATIONS = [
  { days: 30,  label: '1개월',  multiplier: 1 },
  { days: 90,  label: '3개월',  multiplier: 2.7 },
  { days: 180, label: '6개월',  multiplier: 5 },
  { days: 365, label: '1년',    multiplier: 9 },
] as const

export const PERMANENT_DAYS = -1

export function getZone(col: number, row: number): keyof typeof ZONES {
  if (col < 100 && row < 50) return 'neon'
  if (col >= 100 && row < 50) return 'riverside'
  if (col < 100 && row >= 50) return 'oldtown'
  return 'artdistrict'
}

export function getAddress(col: number, row: number): string {
  const zone = getZone(col, row)
  const prefix = { neon: 'N', riverside: 'R', oldtown: 'O', artdistrict: 'A' }[zone]
  return `${prefix}-${String(row * 200 + col).padStart(5, '0')}`
}

export function calcPrice(zone: keyof typeof ZONES, cellCount: number, days: number): number {
  const base = ZONE_PRICES[zone] * cellCount
  if (days === PERMANENT_DAYS) return base * PERMANENT_MULTIPLIER
  const dur = DURATIONS.find(d => d.days === days)
  return Math.round(base * (dur?.multiplier ?? 1))
}

export function formatKRW(n: number): string {
  return n.toLocaleString('ko-KR') + '원'
}
