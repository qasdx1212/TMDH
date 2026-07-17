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

// ── 네온 이펙트 ──────────────────────────────────────────────
// border_effect 저장 형식: 'none' 또는 'neon:#RRGGBB' (색을 함께 저장 → 별도 컬럼 불필요)
// 구버전 값('neon', 'neon_green' 등)도 호환.
export const NEON_PRICE = 1000            // 네온 추가금 (색 상관없이 정액)
export const DEFAULT_NEON = '#34C759'     // 색 정보 없을 때 기본색

// 프리셋 색 (엑셀/오피스 표준 계열)
export const NEON_PRESETS: { label: string; color: string }[] = [
  { label: '레드',   color: '#FF3B30' },
  { label: '오렌지', color: '#FF9500' },
  { label: '옐로',   color: '#FFCC00' },
  { label: '라임',   color: '#A8E10C' },
  { label: '그린',   color: '#34C759' },
  { label: '민트',   color: '#00E5CC' },
  { label: '시안',   color: '#00C7FF' },
  { label: '블루',   color: '#0A84FF' },
  { label: '퍼플',   color: '#AF52DE' },
  { label: '핑크',   color: '#FF2D95' },
  { label: '화이트', color: '#FFFFFF' },
]

// 구버전 이름 → 색 매핑
const LEGACY_NEON_COLORS: Record<string, string> = {
  neon: '#39FF14', neon_green: '#39FF14', neon_pink: '#FF1B8D',
  neon_blue: '#00E5FF', neon_gold: '#FFD000', neon_purple: '#B44BFF',
}

// 굵기 단계 (1=가늘게 ~ 6=굵게). 저장 형식: 'neon:#RRGGBB:굵기'
export const NEON_MAX_WIDTH = 6

export function isNeon(effect: string | null | undefined): boolean {
  return !!effect && effect.startsWith('neon')
}
export function neonColor(effect: string | null | undefined): string {
  if (!effect) return DEFAULT_NEON
  if (effect.includes(':')) return effect.split(':')[1] || DEFAULT_NEON   // 'neon:#RRGGBB[:굵기]'
  return LEGACY_NEON_COLORS[effect] || DEFAULT_NEON                        // 구버전 이름
}
export function neonWidth(effect: string | null | undefined): number {
  if (!effect) return NEON_MAX_WIDTH
  const w = parseInt(effect.split(':')[2] ?? '', 10)
  return w >= 1 && w <= NEON_MAX_WIDTH ? w : NEON_MAX_WIDTH   // 값 없으면 최대(굵게)
}
// 굵기 단계(1~6) → 실제 픽셀 두께. 지도·미리보기가 같은 비율을 쓰도록 계수만 곱해 씀.
export function neonWidthPx(effect: string | null | undefined): number {
  return 0.4 + neonWidth(effect) * 0.55   // 1→0.95 ~ 6→3.7 (셀 좌표 기준)
}
// 색·굵기로 border_effect 문자열 생성
export function buildNeon(color: string, width: number): string {
  return `neon:${color}:${width}`
}
export function getEffectPrice(effect: string | null | undefined): number {
  return isNeon(effect) ? NEON_PRICE : 0
}
export function effectLabel(effect: string | null | undefined): string {
  return isNeon(effect) ? '네온 테두리' : '기본 (이펙트 없음)'
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
