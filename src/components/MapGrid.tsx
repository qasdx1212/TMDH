'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { GRID_COLS, GRID_ROWS, ZONES, getZone } from '@/lib/constants'
import type { CellData, Zone } from '@/types/cell'

interface Selection { col: number; row: number; width: number; height: number; zone: Zone }

interface MapGridProps {
  houses: CellData[]
  onCellClick: (cell: CellData) => void
  onAreaSelect: (sel: Selection) => void
  myHouseIds?: Set<string>
  activeZone?: string | null
  centerTarget?: { col: number; row: number } | null
  zoomInRef?: React.MutableRefObject<(() => void) | null>
  zoomOutRef?: React.MutableRefObject<(() => void) | null>
  fitViewRef?: React.MutableRefObject<(() => void) | null>
  userId?: string
  isAdmin?: boolean
  onViewCell?: (cell: CellData) => void
  onEditCell?: (cell: CellData) => void
  onVacateCell?: (cell: CellData) => void
  onViewportChange?: (info: { scale: number; offset: { x: number; y: number }; containerW: number; containerH: number; mapW: number }) => void
}

const CELL = 5
const HALF = GRID_COLS / 2  // 200 — fixed horizontal zone boundary
const W = GRID_COLS * CELL  // 2000px canvas width
const H = GRID_ROWS * CELL  // 1000px canvas height
const RS = 2                // 레티나 2배 → 1칸 실제 10×10 픽셀
const DRAG_THRESHOLD = 4

const ZONE_PREFIX: Record<string, string> = { neon:'N', riverside:'R', oldtown:'O', artdistrict:'A' }

const rng = (x: number, y: number, s = 0) => {
  const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.3) * 43758.5453
  return n - Math.floor(n)
}

function buildTerrainCanvas(): HTMLCanvasElement {
  const tc = document.createElement('canvas')
  tc.width = W * RS
  tc.height = H * RS
  const ctx = tc.getContext('2d')!
  ctx.save(); ctx.scale(RS, RS)

  // 통합 지도 — 밝은 중립 지형
  for (let c = 0; c < GRID_COLS; c++) {
    for (let r = 0; r < GRID_ROWS; r++) {
      const bn = rng(Math.floor(c / 6), Math.floor(r / 6), 1)
      const color = bn < 0.35 ? '#eceae6' : bn < 0.7 ? '#e7e5e1' : '#f0eeea'
      ctx.fillStyle = color
      ctx.fillRect(c * CELL, r * CELL, CELL, CELL)
    }
  }

  // 그리드 라인 (전체 동일)
  ctx.lineWidth = 0.4
  ctx.strokeStyle = ZONES.neon.gridColor
  for (let c = 0; c <= GRID_COLS; c++) { ctx.beginPath(); ctx.moveTo(c*CELL,0); ctx.lineTo(c*CELL,H); ctx.stroke() }
  for (let r = 0; r <= GRID_ROWS; r++) { ctx.beginPath(); ctx.moveTo(0,r*CELL); ctx.lineTo(GRID_COLS*CELL,r*CELL); ctx.stroke() }

  ctx.restore()
  return tc
}

export default function MapGrid({ houses, onCellClick, onAreaSelect, myHouseIds, activeZone, centerTarget, zoomInRef, zoomOutRef, fitViewRef, isAdmin, onViewCell, onEditCell, onVacateCell, onViewportChange }: MapGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const scaleRef = useRef(1)

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
  const [terrainReady, setTerrainReady] = useState(false)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; cell: CellData } | null>(null)

  const houseMap = useRef<Map<string, CellData>>(new Map())
  const addressMap = useRef<Map<string, CellData>>(new Map())
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map())
  const terrainCanvas = useRef<HTMLCanvasElement | null>(null)

  const lastPinchDist = useRef<number | null>(null)
  const touchStartPos = useRef<{ x: number; y: number } | null>(null)
  const touchStartTime = useRef(0)

  useEffect(() => { scaleRef.current = scale }, [scale])

  const onViewportChangeRef = useRef(onViewportChange)
  useEffect(() => { onViewportChangeRef.current = onViewportChange }, [onViewportChange])
  useEffect(() => {
    const c = containerRef.current
    if (!c) return
    const { width: cw, height: ch } = c.getBoundingClientRect()
    onViewportChangeRef.current?.({ scale, offset, containerW: cw, containerH: ch, mapW: W })
  }, [scale, offset])

  const clampOffset = useCallback((x: number, y: number, s: number) => {
    const c = containerRef.current
    if (!c) return { x, y }
    const { width: cw, height: ch } = c.getBoundingClientRect()
    const mapW = W * s, mapH = H * s
    const minS = Math.max(cw / W, ch / H)
    // 최소 스케일에서는 패닝 불가 — 항상 중앙 고정
    if (s <= minS + 0.001) return { x: (cw - mapW) / 2, y: (ch - mapH) / 2 }
    const cx = mapW <= cw ? (cw - mapW) / 2 : Math.min(0, Math.max(cw - mapW, x))
    const cy = mapH <= ch ? (ch - mapH) / 2 : Math.min(0, Math.max(ch - mapH, y))
    return { x: cx, y: cy }
  }, [])

  useEffect(() => {
    const zoomTo = (newScale: number) => {
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const cx = rect.width / 2, cy = rect.height / 2
      const wx = (cx - lastOffset.current.x) / scaleRef.current
      const wy = (cy - lastOffset.current.y) / scaleRef.current
      const raw = { x: cx - wx * newScale, y: cy - wy * newScale }
      const clamped = clampOffset(raw.x, raw.y, newScale)
      scaleRef.current = newScale; lastOffset.current = clamped
      setScale(newScale); setOffset(clamped)
    }
    const minScale = () => {
      const c = containerRef.current
      if (!c) return 1
      const r = c.getBoundingClientRect()
      return Math.max(r.width / W, r.height / H)
    }
    const resetToFit = () => {
      const c = containerRef.current
      if (!c) return
      const r = c.getBoundingClientRect()
      const s = Math.max(r.width / W, r.height / H)
      const nx = (r.width - W * s) / 2
      const ny = (r.height - H * s) / 2
      scaleRef.current = s; lastOffset.current = { x: nx, y: ny }
      setScale(s); setOffset({ x: nx, y: ny })
    }
    if (zoomInRef) zoomInRef.current = () => zoomTo(Math.min(6, scaleRef.current + 0.5))
    if (zoomOutRef) zoomOutRef.current = () => zoomTo(Math.max(minScale(), scaleRef.current - 0.5))
    if (fitViewRef) fitViewRef.current = resetToFit
  }, [zoomInRef, zoomOutRef, fitViewRef, clampOffset])

  useEffect(() => {
    if (!centerTarget) return
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const s = Math.max(scaleRef.current, 2)
    const cellCx = (centerTarget.col + 0.5) * CELL
    const cellCy = (centerTarget.row + 0.5) * CELL
    const raw = { x: rect.width / 2 - cellCx * s, y: rect.height / 2 - cellCy * s }
    const clamped = clampOffset(raw.x, raw.y, s)
    scaleRef.current = s; lastOffset.current = clamped
    setScale(s); setOffset(clamped)
  }, [centerTarget, clampOffset])

  useEffect(() => {
    const m = new Map<string, CellData>()
    const am = new Map<string, CellData>()
    houses.forEach(h => { m.set(`${h.col},${h.row}`, h); am.set(h.address, h) })
    houseMap.current = m; addressMap.current = am
  }, [houses])

  // Mount: fixed W=2000, cover-fit scale, build terrain
  useEffect(() => {
    const cont = containerRef.current
    if (!cont) return
    const { width: cw, height: ch } = cont.getBoundingClientRect()
    const s = Math.max(cw / W, ch / H)
    const nx = (cw - W * s) / 2
    const ny = (ch - H * s) / 2
    scaleRef.current = s; lastOffset.current = { x: nx, y: ny }
    setScale(s); setOffset({ x: nx, y: ny })
    terrainCanvas.current = buildTerrainCanvas()
    setTerrainReady(true)
  }, [])

  const toGrid = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
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
    if (terrainCanvas.current) ctx.drawImage(terrainCanvas.current, 0, 0)
    else { ctx.fillStyle = '#eceae6'; ctx.fillRect(0, 0, W*RS, H*RS) }
    ctx.save(); ctx.scale(RS, RS)

    houses.filter(h => !h.parent_address).forEach(h => {
      const x = h.col*CELL, y = h.row*CELL
      const w = (h.width??1)*CELL, ht = (h.height??1)*CELL
      const zone = ZONES[h.zone]
      const cachedImg = imageCache.current.get(h.address)
      const hasImage = !!(cachedImg && cachedImg.naturalWidth > 0)
      if (hasImage) {
        ctx.save(); ctx.beginPath(); ctx.rect(x+1,y+1,w-2,ht-2); ctx.clip()
        ctx.drawImage(cachedImg!, x+1, y+1, w-2, ht-2); ctx.restore()
        if (h.visit_count >= 5) { ctx.shadowColor=zone.color; ctx.shadowBlur=10; ctx.strokeStyle=zone.color; ctx.lineWidth=2; ctx.strokeRect(x+1,y+1,w-2,ht-2); ctx.shadowBlur=0 }
      } else {
        if (h.visit_count >= 5) { ctx.shadowColor=zone.color; ctx.shadowBlur=10 }
        ctx.fillStyle=zone.color+'cc'; ctx.fillRect(x+1,y+1,w-2,ht-2); ctx.shadowBlur=0
      }
      if (h.border_effect==='neon') { ctx.shadowColor=zone.color; ctx.shadowBlur=6; ctx.strokeStyle=zone.color; ctx.lineWidth=1.5; ctx.strokeRect(x+1,y+1,w-2,ht-2); ctx.shadowBlur=0 }
      if (myHouseIds?.has(h.id)) { ctx.strokeStyle='#1a1a1a'; ctx.lineWidth=2; ctx.strokeRect(x,y,w,ht) }
      if (h.nickname && w >= 20) {
        // 이미지 위엔 흰 글씨+그림자, 밝은 지형 위엔 진한 글씨
        ctx.fillStyle = hasImage ? '#fff' : '#1a1a1a'
        ctx.font=`bold ${Math.min(8,w/h.nickname.length)}px sans-serif`
        ctx.textAlign='center'; ctx.textBaseline='middle'
        if (hasImage) { ctx.shadowColor='rgba(0,0,0,0.8)'; ctx.shadowBlur=3 }
        ctx.fillText(h.nickname, x+w/2, y+ht/2); ctx.shadowBlur=0
      }
    })

    if (activeZone) {
      const HALF_R = GRID_ROWS / 2  // 100
      const zoneBounds: Record<string, [number,number,number,number]> = {
        neon:        [0,    HALF-1,     0,      HALF_R-1],
        riverside:   [HALF, GRID_COLS-1,0,      HALF_R-1],
        oldtown:     [0,    HALF-1,     HALF_R, GRID_ROWS-1],
        artdistrict: [HALF, GRID_COLS-1,HALF_R, GRID_ROWS-1],
      }
      Object.entries(zoneBounds).forEach(([key, [cMin, cMax, rMin, rMax]]) => {
        if (key === activeZone) return
        ctx.fillStyle = 'rgba(255,255,255,0.68)'
        ctx.fillRect(cMin*CELL, rMin*CELL, (cMax-cMin+1)*CELL, (rMax-rMin+1)*CELL)
      })
    }

    if (selection) {
      const { c1,r1,c2,r2 } = selection
      const sx=Math.min(c1,c2)*CELL, sy=Math.min(r1,r2)*CELL
      const sw=(Math.abs(c2-c1)+1)*CELL, sh=(Math.abs(r2-r1)+1)*CELL
      ctx.fillStyle='rgba(28,28,30,0.12)'; ctx.fillRect(sx,sy,sw,sh)
      ctx.strokeStyle='#1a1a1a'; ctx.lineWidth=1.5; ctx.setLineDash([4,3]); ctx.strokeRect(sx,sy,sw,sh); ctx.setLineDash([])
      ctx.fillStyle='#1a1a1a'; ctx.font='bold 9px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'
      ctx.fillText(`${Math.abs(c2-c1)+1}×${Math.abs(r2-r1)+1}`, sx+sw/2, sy+sh/2)
    }
    ctx.restore()
  }, [houses, myHouseIds, selection, activeZone, terrainReady])

  useEffect(() => {
    houses.forEach(h => {
      const imgUrl = h.exterior_image_url || h.interior_image_url
      if (!imgUrl || h.parent_address) return
      if (imageCache.current.has(h.address)) return
      const img = new Image(); img.crossOrigin = 'anonymous'
      img.onload = () => { imageCache.current.set(h.address, img); draw() }
      img.onerror = () => { imageCache.current.set(h.address, img) }
      img.src = imgUrl
    })
  }, [houses, draw])

  useEffect(() => { draw() }, [draw])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const minSc = Math.max(rect.width / W, rect.height / H)
      const newScale = Math.max(minSc, Math.min(6, scaleRef.current - e.deltaY * 0.002))
      // 최소 스케일 근처에서는 화면 중앙 기준 줌 — 마우스 위치 기준이면 offset 흔들림 발생
      const atMin = scaleRef.current <= minSc + 0.001
      const mx = atMin ? rect.width / 2 : e.clientX - rect.left
      const my = atMin ? rect.height / 2 : e.clientY - rect.top
      const wx = (mx - lastOffset.current.x) / scaleRef.current
      const wy = (my - lastOffset.current.y) / scaleRef.current
      const clamped = clampOffset(mx - wx * newScale, my - wy * newScale, newScale)
      scaleRef.current = newScale; lastOffset.current = clamped
      setScale(newScale); setOffset(clamped)
    }
    canvas.addEventListener('wheel', handler, { passive: false })
    return () => canvas.removeEventListener('wheel', handler)
  }, [clampOffset])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
        touchStartTime.current = Date.now()
        panStart.current = { x: e.touches[0].clientX - lastOffset.current.x, y: e.touches[0].clientY - lastOffset.current.y }
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        lastPinchDist.current = Math.sqrt(dx*dx + dy*dy)
        touchStartPos.current = null
      }
    }
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      if (e.touches.length === 1) {
        const raw = { x: e.touches[0].clientX - panStart.current.x, y: e.touches[0].clientY - panStart.current.y }
        const clamped = clampOffset(raw.x, raw.y, scaleRef.current)
        lastOffset.current = clamped; setOffset(clamped)
      } else if (e.touches.length === 2 && lastPinchDist.current !== null) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const dist = Math.sqrt(dx*dx + dy*dy)
        const minSc = Math.max(el.clientWidth / W, el.clientHeight / H)
        const newScale = Math.max(minSc, Math.min(6, scaleRef.current * (dist / lastPinchDist.current)))
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2
        const rect = el.getBoundingClientRect()
        const mx = cx - rect.left, my = cy - rect.top
        const wx = (mx - lastOffset.current.x) / scaleRef.current
        const wy = (my - lastOffset.current.y) / scaleRef.current
        const clamped = clampOffset(mx - wx * newScale, my - wy * newScale, newScale)
        scaleRef.current = newScale; lastOffset.current = clamped
        setScale(newScale); setOffset(clamped)
        lastPinchDist.current = dist
      }
    }
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0 && touchStartPos.current) {
        const t = e.changedTouches[0]
        const elapsed = Date.now() - touchStartTime.current
        const dx = Math.abs(t.clientX - touchStartPos.current.x)
        const dy = Math.abs(t.clientY - touchStartPos.current.y)
        if (elapsed < 300 && dx < 12 && dy < 12) {
          const grid = toGrid(t.clientX, t.clientY)
          if (grid) {
            const existing = houseMap.current.get(`${grid.col},${grid.row}`)
            if (existing) {
              const cell = existing.parent_address ? (addressMap.current.get(existing.parent_address) ?? existing) : existing
              onCellClick(cell)
            } else {
              const zone = getZone(grid.col, grid.row)
              const prefix = ZONE_PREFIX[zone]
              onCellClick({ id:'', address:`${prefix}-${String(grid.row*GRID_COLS+grid.col).padStart(5,'0')}`, col:grid.col, row:grid.row, zone, status:'available', name:null, nickname:null, description:null, link_url:null, exterior_image_url:null, border_effect:'none', like_count:0, visit_count:0, occupied_at:null, expires_at:null, is_permanent:false })
            }
          }
        }
      }
      if (e.touches.length < 2) lastPinchDist.current = null
      if (e.touches.length === 0) touchStartPos.current = null
    }
    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [toGrid, onCellClick, clampOffset])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) return
    mouseDownPos.current = { x: e.clientX, y: e.clientY }
    isMouseDown.current = true; setTooltip(null)
    if (e.button === 1 || e.altKey) {
      isPanning.current = true; setCursor('grabbing')
      panStart.current = { x: e.clientX - lastOffset.current.x, y: e.clientY - lastOffset.current.y }
      return
    }
    const grid = toGrid(e.clientX, e.clientY)
    if (grid) { selectStart.current = grid; selectEnd.current = grid }
  }, [toGrid])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning.current) {
      const raw = { x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y }
      const clamped = clampOffset(raw.x, raw.y, scaleRef.current)
      lastOffset.current = clamped; setOffset(clamped); return
    }
    if (!isMouseDown.current) {
      const grid = toGrid(e.clientX, e.clientY)
      if (grid) {
        const existing = houseMap.current.get(`${grid.col},${grid.row}`)
        const primary = existing?.parent_address ? (addressMap.current.get(existing.parent_address) ?? existing) : existing
        if (primary?.status === 'occupied') setTooltip({ x: e.clientX, y: e.clientY, text: primary.nickname ?? primary.name ?? '이름 없음' })
        else setTooltip(null)
      } else setTooltip(null)
    }
    if (!isMouseDown.current) return
    const dx = Math.abs(e.clientX - mouseDownPos.current.x)
    const dy = Math.abs(e.clientY - mouseDownPos.current.y)
    if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) { isSelecting.current = true; setCursor('crosshair') }
    if (isSelecting.current && selectStart.current) {
      const grid = toGrid(e.clientX, e.clientY)
      if (grid) { selectEnd.current = grid; setSelection({ c1: selectStart.current.col, r1: selectStart.current.row, c2: grid.col, r2: grid.row }) }
    }
  }, [toGrid, clampOffset])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) return
    const hadMouseDown = isMouseDown.current
    isPanning.current = false; isMouseDown.current = false; setCursor('default')
    if (!hadMouseDown) return
    const dx = Math.abs(e.clientX - mouseDownPos.current.x)
    const dy = Math.abs(e.clientY - mouseDownPos.current.y)
    const wasClick = dx <= DRAG_THRESHOLD && dy <= DRAG_THRESHOLD
    if (wasClick) {
      isSelecting.current = false; setSelection(null)
      const grid = toGrid(e.clientX, e.clientY)
      if (!grid) return
      const existing = houseMap.current.get(`${grid.col},${grid.row}`)
      if (existing) {
        const cell = existing.parent_address ? (addressMap.current.get(existing.parent_address) ?? existing) : existing
        onCellClick(cell)
      } else {
        const zone = getZone(grid.col, grid.row)
        const prefix = ZONE_PREFIX[zone]
        onCellClick({ id:'', address:`${prefix}-${String(grid.row*GRID_COLS+grid.col).padStart(5,'0')}`, col:grid.col, row:grid.row, zone, status:'available', name:null, nickname:null, description:null, link_url:null, exterior_image_url:null, border_effect:'none', like_count:0, visit_count:0, occupied_at:null, expires_at:null, is_permanent:false })
      }
    } else if (isSelecting.current && selectStart.current && selectEnd.current) {
      const c1=Math.min(selectStart.current.col,selectEnd.current.col)
      const c2=Math.max(selectStart.current.col,selectEnd.current.col)
      const r1=Math.min(selectStart.current.row,selectEnd.current.row)
      const r2=Math.max(selectStart.current.row,selectEnd.current.row)
      setSelection(null); isSelecting.current = false
      let hasOccupied = false
      outer: for (let c=c1;c<=c2;c++) for (let r=r1;r<=r2;r++) if (houseMap.current.has(`${c},${r}`)) { hasOccupied=true; break outer }
      if (hasOccupied) { setBlockMsg('선택 영역에 이미 입주된 칸이 있어요 🏠'); setTimeout(()=>setBlockMsg(''),2500) }
      else {
        const zone = getZone(c1, r1)
        onAreaSelect({ col:c1, row:r1, width:c2-c1+1, height:r2-r1+1, zone })
      }
    }
    selectStart.current = null; selectEnd.current = null
  }, [toGrid, onCellClick, onAreaSelect])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); setTooltip(null)
    const grid = toGrid(e.clientX, e.clientY)
    if (!grid) { setContextMenu(null); return }
    const existing = houseMap.current.get(`${grid.col},${grid.row}`)
    const primary = existing ? (existing.parent_address ? (addressMap.current.get(existing.parent_address) ?? existing) : existing) : null
    const zone = getZone(grid.col, grid.row)
    const prefix = ZONE_PREFIX[zone]
    const cell: CellData = primary ?? {
      id: '', address: `${prefix}-${String(grid.row*GRID_COLS+grid.col).padStart(5,'0')}`,
      col: grid.col, row: grid.row, zone, status: 'available',
      name: null, nickname: null, description: null, link_url: null,
      exterior_image_url: null, border_effect: 'none',
      like_count: 0, visit_count: 0, occupied_at: null, expires_at: null, is_permanent: false,
    }
    setContextMenu({ x: e.clientX, y: e.clientY, cell })
  }, [toGrid])

  return (
    <div
      ref={containerRef}
      style={{ width:'100%', height:'100%', overflow:'hidden', cursor, background:'#1a0f05', userSelect:'none', position:'relative', touchAction:'none' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { isPanning.current=false; isMouseDown.current=false; isSelecting.current=false; setSelection(null); setCursor('default'); setTooltip(null) }}
      onContextMenu={handleContextMenu}
    >
      <div style={{ transform:`translate(${offset.x}px,${offset.y}px) scale(${scale})`, transformOrigin:'0 0' }}>
        <canvas ref={canvasRef} width={W * RS} height={H * RS} style={{ display:'block', width:W, height:H }} />
      </div>

      {tooltip && (
        <div style={{
          position:'fixed', left:tooltip.x+14, top:tooltip.y-38,
          background:'#ffffff', color:'#1a1a1a',
          padding:'6px 12px', borderRadius:10, fontSize:12, fontWeight:600,
          border:'1px solid #e9e7e4', pointerEvents:'none', zIndex:200,
          boxShadow:'0 4px 16px rgba(0,0,0,0.10)', whiteSpace:'nowrap',
        }}>{tooltip.text}</div>
      )}

      {blockMsg && (
        <div style={{
          position:'absolute', bottom:24, left:'50%', transform:'translateX(-50%)',
          background:'#fef2f2', color:'#dc2626',
          padding:'10px 20px', borderRadius:10, fontSize:13, fontWeight:600,
          border:'1px solid #dc2626', pointerEvents:'none', whiteSpace:'nowrap',
          boxShadow:'0 4px 16px rgba(0,0,0,0.10)',
        }}>{blockMsg}</div>
      )}

      {contextMenu && (
        <div onClick={() => setContextMenu(null)} style={{ position:'fixed', inset:0, zIndex:490 }}>
          <div onClick={e => e.stopPropagation()} style={{
            position:'fixed',
            left:Math.min(contextMenu.x+4, window.innerWidth-200),
            top:Math.min(contextMenu.y+4, window.innerHeight-220),
            background:'#ffffff', border:'1px solid #e9e7e4', borderRadius:12,
            overflow:'hidden', boxShadow:'0 4px 16px rgba(0,0,0,0.10)',
            minWidth:180, zIndex:491,
          }}>
            <div style={{ padding:'10px 14px 9px', borderBottom:'1px solid #e9e7e4', fontSize:11, color:'#8c8a87', fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {contextMenu.cell.status === 'available' ? `빈 공간 · ${contextMenu.cell.address}` : `${contextMenu.cell.name ?? contextMenu.cell.address}`}
            </div>
            {contextMenu.cell.status === 'available' ? (
              <CtxItem label="입주 신청" onClick={() => { onCellClick(contextMenu.cell); setContextMenu(null) }} />
            ) : (
              <>
                <CtxItem label="집 보기" onClick={() => { onViewCell?.(contextMenu.cell); setContextMenu(null) }} />
                {(isAdmin || myHouseIds?.has(contextMenu.cell.id)) && <>
                  <div style={{ height:1, background:'#e9e7e4', margin:'2px 0' }} />
                  <CtxItem label="수정하기" onClick={() => { onEditCell?.(contextMenu.cell); setContextMenu(null) }} />
                  <CtxItem label={isAdmin && !myHouseIds?.has(contextMenu.cell.id) ? '강제 퇴거 (관리자)' : '퇴거하기'} color="#dc2626" onClick={() => { onVacateCell?.(contextMenu.cell); setContextMenu(null) }} />
                </>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function CtxItem({ label, color, onClick }: { label: string; color?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 14px',
      background:'transparent', border:'none',
      color: color ?? '#1a1a1a', fontSize:13, fontWeight:500,
      cursor:'pointer', textAlign:'left', fontFamily:'inherit', whiteSpace:'nowrap',
    }}
      onMouseEnter={e => (e.currentTarget.style.background='#f4f3f1')}
      onMouseLeave={e => (e.currentTarget.style.background='transparent')}
    >
      <span>{label}</span>
    </button>
  )
}
