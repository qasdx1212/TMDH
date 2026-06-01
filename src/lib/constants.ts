export const GRID_COLS = 96
export const GRID_ROWS = 51
export const CELL_SIZE = 44

export const ZONE_PRICES = { a: 5000, b: 2000, c: 1000 } as const
export const PERMANENT_PRICES = { a: 199000, b: 79000, c: 39000 } as const

export const DURATIONS = [
  { days: 1,  label: '1일',  multiplier: 0.2 },
  { days: 3,  label: '3일',  multiplier: 0.5 },
  { days: 7,  label: '7일',  multiplier: 1   },
  { days: 14, label: '14일', multiplier: 1.8 },
  { days: 30, label: '30일', multiplier: 3.5 },
  { days: 90, label: '90일', multiplier: 9   },
] as const

export const PERMANENT_DAYS = -1

export const PALETTE = [
  '#ff0000', '#ff4400', '#ff8800', '#ffcc00',
  '#88cc00', '#00aa44', '#0077cc', '#2244cc',
  '#6600cc', '#cc00aa', '#ff0066', '#000000',
  '#444444', '#888888', '#cccccc', '#ffffff',
]
