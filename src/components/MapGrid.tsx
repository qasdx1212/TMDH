'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { GRID_COLS, GRID_ROWS, ZONES, getZone } from '@/lib/constants'
import type { CellData } from '@/types/cell'

interface Selection {
  col: number
  row: number
  width: number
  height: number
}

interface MapGridProps {
  houses: CellData[]
  onCellClick: (cell: CellData) => void
  onAreaSelect: (sel: Selection) => void
  myHouseIds?: Set<string>
  activeZone?: string | null
}

const CELL = 10
const W = GRID_COLS * CELL
const H = GRID_ROWS * CELL
const DRAG_THRESHOLD = 4
const RS = 3 // 내부 렌더 배율 — 캔버스를 3배 해상도로 그려 확대 시 선명도 유지

export default function MapGrid({ houses, onCellClick, onAreaSelect, myHouseIds, activeZone }: MapGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })
  const lastOffset = useRef({ x: 0, y: 0 })
  const [cursor, setCursor] = useState<'default' | 'grabbing' | 'crosshair'>('default')

  const isSelecting = useRef(false)
  const selectStart = useRef<{ col: number; row: number } | null>(null)
  const selectEnd = useRef<{ col: number; row: number } | null>(null)
  const mouseDownPos = useRef({ x: 0, y: 0 })
  const isMouseDown = useRef(false)
  const [selection, setSelection] = useState<{ c1: number; r1: number; c2: number; r2: number } | null>(null)
  const [blockMsg, setBlockMsg] = useState('')

  const houseMap = useRef<Map<string, CellData>>(new Map())
  useEffect(() => {
    const m = new Map<string, CellData>()
    houses.forEach(h => m.set(`${h.col},${h.row}`, h))
    houseMap.current = m
  }, [houses])

  const toGrid = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    // rect는 CSS transform 이후 viewport 크기 — 그리드 비율로 나눠 좌표 계산
    const col = Math.floor((clientX - rect.left) * GRID_COLS / rect.width)
    const row = Math.floor((clientY - rect.top) * GRID_ROWS / rect.height)
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return null
    return { col, row }
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, W * RS, H * RS)
    ctx.save()
    ctx.scale(RS, RS)

    ctx.fillStyle = '#2a1a0a'
    ctx.fillRect(0, 0, W, H)

    Object.entries(ZONES).forEach(([, zone]) => {
      ctx.fillStyle = zone.bg
      ctx.fillRect(zone.colMin * CELL, zone.rowMin * CELL, (zone.colMax - zone.colMin + 1) * CELL, (zone.rowMax - zone.rowMin + 1) * CELL)
    })

    // 그리드 선
    Object.entries(ZONES).forEach(([, zone]) => {
      ctx.strokeStyle = zone.gridColor
      ctx.lineWidth = 0.5
      for (let c = zone.colMin; c <= zone.colMax + 1; c++) {
        ctx.beginPath(); ctx.moveTo(c * CELL, zone.rowMin * CELL); ctx.lineTo(c * CELL, (zone.rowMax + 1) * CELL); ctx.stroke()
      }
      for (let r = zone.rowMin; r <= zone.rowMax + 1; r++) {
        ctx.beginPath(); ctx.moveTo(zone.colMin * CELL, r * CELL); ctx.lineTo((zone.colMax + 1) * CELL, r * CELL); ctx.stroke()
      }
    })

    // 구역 경계선
    ctx.strokeStyle = '#6b4c2a'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(50 * CELL, 0); ctx.lineTo(50 * CELL, H); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, 50 * CELL); ctx.lineTo(W, 50 * CELL); ctx.stroke()

    // 구역 레이블
    Object.entries(ZONES).forEach(([, zone]) => {
      const cx = (zone.colMin + zone.colMax + 1) / 2 * CELL
      const cy = (zone.rowMin + zone.rowMax + 1) / 2 * CELL
      ctx.font = 'bold 13px sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillStyle = '#00000066'; ctx.fillText(zone.label, cx + 1, cy + 1)
      ctx.fillStyle = zone.color + 'aa'; ctx.fillText(zone.label, cx, cy)
    })

    // 입주된 집 (위성 칸 제외 — 대표 칸만 렌더링)
    houses.filter(h => !h.parent_address).forEach(h => {
      const x = h.col * CELL, y = h.row * CELL
      const w = (h.width ?? 1) * CELL, ht = (h.height ?? 1) * CELL
      const zone = ZONES[h.zone]

      // 핫플 하이라이트 (방문 5+)
      if (h.visit_count >= 5) {
        ctx.shadowColor = zone.color
        ctx.shadowBlur = 10
      }

      ctx.fillStyle = zone.color + 'cc'
      ctx.fillRect(x + 1, y + 1, w - 2, ht - 2)
      ctx.shadowBlur = 0

      if (h.border_effect === 'neon') {
        ctx.shadowColor = zone.color; ctx.shadowBlur = 6
        ctx.strokeStyle = zone.color; ctx.lineWidth = 1.5
        ctx.strokeRect(x + 1, y + 1, w - 2, ht - 2)
        ctx.shadowBlur = 0
      }

      if (myHouseIds?.has(h.id)) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2
        ctx.strokeRect(x, y, w, ht)
      }

      if (h.nickname && w >= 20) {
        ctx.fillStyle = '#fff'
        ctx.font = `bold ${Math.min(8, w / h.nickname.length)}px sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(h.nickname, x + w / 2, y + ht / 2)
      }
    })

    // 활성 구역 필터 — 나머지 구역 어둡게
    if (activeZone) {
      Object.entries(ZONES).forEach(([key, zone]) => {
        if (key === activeZone) return
        ctx.fillStyle = 'rgba(0,0,0,0.55)'
        ctx.fillRect(zone.colMin * CELL, zone.rowMin * CELL, (zone.colMax - zone.colMin + 1) * CELL, (zone.rowMax - zone.rowMin + 1) * CELL)
      })
    }

    // 드래그 선택 영역
    if (selection) {
      const { c1, r1, c2, r2 } = selection
      const sx = Math.min(c1, c2) * CELL
      const sy = Math.min(r1, r2) * CELL
      const sw = (Math.abs(c2 - c1) + 1) * CELL
      const sh = (Math.abs(r2 - r1) + 1) * CELL
      ctx.fillStyle = '#ffffff22'
      ctx.fillRect(sx, sy, sw, sh)
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1.5
      ctx.setLineDash([4, 3])
      ctx.strokeRect(sx, sy, sw, sh)
      ctx.setLineDash([])

      const w = Math.abs(c2 - c1) + 1
      const h = Math.abs(r2 - r1) + 1
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 9px sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(`${w}×${h}`, sx + sw / 2, sy + sh / 2)
    }

    ctx.restore()
  }, [houses, myHouseIds, selection, activeZone])

  useEffect(() => { draw() }, [draw])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    mouseDownPos.current = { x: e.clientX, y: e.clientY }
    isMouseDown.current = true

    if (e.button === 1 || e.altKey) {
      isPanning.current = true
      setCursor('grabbing')
      panStart.current = { x: e.clientX - lastOffset.current.x, y: e.clientY - lastOffset.current.y }
      return
    }

    const grid = toGrid(e.clientX, e.clientY)
    if (grid) {
      selectStart.current = grid
      selectEnd.current = grid
    }
  }, [toGrid])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning.current) {
      const nx = e.clientX - panStart.current.x
      const ny = e.clientY - panStart.current.y
      lastOffset.current = { x: nx, y: ny }
      setOffset({ x: nx, y: ny })
      return
    }

    if (!isMouseDown.current) return

    const dx = Math.abs(e.clientX - mouseDownPos.current.x)
    const dy = Math.abs(e.clientY - mouseDownPos.current.y)
    if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
      isSelecting.current = true
      setCursor('crosshair')
    }

    if (isSelecting.current && selectStart.current) {
      const grid = toGrid(e.clientX, e.clientY)
      if (grid) {
        selectEnd.current = grid
        setSelection({ c1: selectStart.current.col, r1: selectStart.current.row, c2: grid.col, r2: grid.row })
      }
    }
  }, [toGrid])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    isPanning.current = false
    isMouseDown.current = false
    setCursor('default')

    const dx = Math.abs(e.clientX - mouseDownPos.current.x)
    const dy = Math.abs(e.clientY - mouseDownPos.current.y)
    const wasClick = dx <= DRAG_THRESHOLD && dy <= DRAG_THRESHOLD

    if (wasClick) {
      isSelecting.current = false
      setSelection(null)
      const grid = toGrid(e.clientX, e.clientY)
      if (!grid) return
      const existing = houseMap.current.get(`${grid.col},${grid.row}`)
      if (existing) {
        onCellClick(existing)
      } else {
        const zone = getZone(grid.col, grid.row)
        const prefix = { neon: 'N', riverside: 'R', oldtown: 'O', artdistrict: 'A' }[zone]
        onCellClick({
          id: '', address: `${prefix}-${String(grid.row * 100 + grid.col).padStart(4, '0')}`,
          col: grid.col, row: grid.row, zone, status: 'available',
          name: null, nickname: null, description: null, link_url: null,
          exterior_image_url: null, border_effect: 'none',
          like_count: 0, visit_count: 0, occupied_at: null, expires_at: null, is_permanent: false,
        })
      }
    } else if (isSelecting.current && selectStart.current && selectEnd.current) {
      const c1 = Math.min(selectStart.current.col, selectEnd.current.col)
      const c2 = Math.max(selectStart.current.col, selectEnd.current.col)
      const r1 = Math.min(selectStart.current.row, selectEnd.current.row)
      const r2 = Math.max(selectStart.current.row, selectEnd.current.row)

      // 겹침 방지: 이미 입주된 칸 체크
      let hasOccupied = false
      outer: for (let c = c1; c <= c2; c++) {
        for (let r = r1; r <= r2; r++) {
          if (houseMap.current.has(`${c},${r}`)) { hasOccupied = true; break outer }
        }
      }

      setSelection(null)
      isSelecting.current = false

      if (hasOccupied) {
        setBlockMsg('선택 영역에 이미 입주된 칸이 있어요 🏠')
        setTimeout(() => setBlockMsg(''), 2500)
      } else {
        onAreaSelect({ col: c1, row: r1, width: c2 - c1 + 1, height: r2 - r1 + 1 })
      }
    }

    selectStart.current = null
    selectEnd.current = null
  }, [toGrid, onCellClick, onAreaSelect])

  // non-passive wheel listener — React onWheel은 passive라 preventDefault 불가
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      setScale(s => Math.max(0.5, Math.min(6, s - e.deltaY * 0.002)))
    }
    canvas.addEventListener('wheel', handler, { passive: false })
    return () => canvas.removeEventListener('wheel', handler)
  }, [])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', overflow: 'hidden', cursor, background: '#1a0f05', userSelect: 'none', position: 'relative' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { isPanning.current = false; isMouseDown.current = false; isSelecting.current = false; setSelection(null); setCursor('default') }}
    >
      <div style={{
        transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
        transformOrigin: '0 0',
      }}>
        <canvas
          ref={canvasRef}
          width={W * RS}
          height={H * RS}
          style={{ display: 'block', width: W, height: H }}
        />
      </div>

      {/* 겹침 경고 토스트 */}
      {blockMsg && (
        <div style={{
          position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(239,68,68,0.92)', color: '#fff',
          padding: '10px 20px', borderRadius: 10,
          fontSize: 13, fontWeight: 600, fontFamily: '"Noto Sans KR", sans-serif',
          pointerEvents: 'none', whiteSpace: 'nowrap',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}>
          {blockMsg}
        </div>
      )}
    </div>
  )
}
