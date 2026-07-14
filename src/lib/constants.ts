export const GRID_COLS = 400
export const GRID_ROWS = 200
export const CELL_PX = 5 // 1칸 = 5 CSS px (레티나 2배 → 실제 10×10 픽셀)

export const ZONES = {
  neon:        { label: '집.zip', colMin: 0,   colMax: 199, rowMin: 0,   rowMax: 99,  color: '#a1834a', bg: '#eceae6', gridColor: '#e0ddd9' },
  riverside:   { label: '집.zip', colMin: 200, colMax: 399, rowMin: 0,   rowMax: 99,  color: '#a1834a', bg: '#eceae6', gridColor: '#e0ddd9' },
  oldtown:     { label: '집.zip', colMin: 0,   colMax: 199, rowMin: 100, rowMax: 199, color: '#a1834a', bg: '#eceae6', gridColor: '#e0ddd9' },
  artdistrict: { label: '집.zip', colMin: 200, colMax: 399, rowMin: 100, rowMax: 199, color: '#a1834a', bg: '#eceae6', gridColor: '#e0ddd9' },
} as const

export const ZONE_PRICES: Record<string, number> = {
  neon: 1000,
  riverside: 1000,
  oldtown: 1000,
  artdistrict: 1000,
}

export const PERMANENT_MULTIPLIER = 1 // 영구제: 기준가 × 1 (= 칸당 기준가 그대로)

// 이펙트 추가금 (정액). 금액은 여기서만 고치면 전체 반영됨.
export const EFFECT_PRICES: Record<string, number> = {
  none: 0,
  neon: 1000,
}
export const EFFECT_LABELS: Record<string, string> = {
  none: '기본 (이펙트 없음)',
  neon: '네온 테두리',
}

export const DURATIONS = [
  { days: 30,  label: '1개월',  multiplier: 1 },
  { days: 90,  label: '3개월',  multiplier: 2.7 },
  { days: 180, label: '6개월',  multiplier: 5 },
  { days: 365, label: '1년',    multiplier: 9 },
] as const

export const PERMANENT_DAYS = -1

export function getZone(col: number, row: number): keyof typeof ZONES {
  if (col < 200 && row < 100) return 'neon'
  if (col >= 200 && row < 100) return 'riverside'
  if (col < 200 && row >= 100) return 'oldtown'
  return 'artdistrict'
}

export function getAddress(col: number, row: number): string {
  const zone = getZone(col, row)
  const prefix = { neon: 'N', riverside: 'R', oldtown: 'O', artdistrict: 'A' }[zone]
  return `${prefix}-${String(row * GRID_COLS + col).padStart(5, '0')}`
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
