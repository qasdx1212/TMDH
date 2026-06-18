export function getLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return 0.299 * r + 0.587 * g + 0.114 * b
}

export function getFgColor(bgHex: string): string {
  return getLuminance(bgHex) < 128 ? '#ffffff' : '#000000'
}
