'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { GRID_COLS, GRID_ROWS, ZONES, getZone } from '@/lib/constants'
import type { CellData } from '@/types/cell'

interface Selection { col: number; row: number; width: number; height: number }

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
}

const CELL = 10
const W = GRID_COLS * CELL
const H = GRID_ROWS * CELL
const DRAG_THRESHOLD = 4
const RS = 3

const rng = (x: number, y: number, s = 0) => {
  const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.3) * 43758.5453
  return n - Math.floor(n)
}

function buildTerrainCanvas(): HTMLCanvasElement {
  const tc = document.createElement('canvas')
  tc.width = W * RS; tc.height = H * RS
  const ctx = tc.getContext('2d')!
  ctx.save(); ctx.scale(RS, RS)

  for (let c = 0; c < GRID_COLS; c++) {
    for (let r = 0; r < GRID_ROWS; r++) {
      const px = c * CELL, py = r * CELL
      const n = rng(c, r)
      let color: string
      if (c < 50 && r < 50) {
        if (c % 9 === 0 || r % 9 === 0) { color = '#150c20' }
        else { const bn = rng(Math.floor(c/3), Math.floor(r/3), 1); color = bn < 0.33 ? '#2d1a3e' : bn < 0.67 ? '#261535' : '#322046' }
      } else if (c >= 50 && r < 50) {
        const riverX = 82 + Math.floor(Math.sin(r * 0.25) * 4)
        if (c >= riverX) { color = n < 0.4 ? '#154060' : n < 0.7 ? '#1a4e72' : '#122e4a' }
        else if (c >= riverX - 3) { color = n < 0.5 ? '#2a4a30' : '#233e28' }
        else { const path = (c-50)%14===7||r%12===6; color = path ? '#264430' : (n<0.35?'#1a3028':n<0.7?'#1f3a2c':'#243e30') }
      } else if (c < 50 && r >= 50) {
        const pathH = (r-50)%8<=1, pathV = c%8===0
        if (pathH||pathV) { color = n<0.5?'#7a5a38':'#8a6840' }
        else { const sn = rng(Math.floor(c/2), Math.floor(r/2), 2); color = sn<0.33?'#4a3520':sn<0.67?'#5a4228':'#3e2c18' }
      } else {
        const bn = rng(Math.floor(c/4), Math.floor(r/4), 3)
        color = n<0.04?'#5a2525':(bn<0.4?'#3d1a1a':bn<0.75?'#4a2020':'#33181a')
      }
      ctx.fillStyle = color; ctx.fillRect(px, py, CELL, CELL)
    }
  }

  Object.entries(ZONES).forEach(([, zone]) => {
    ctx.strokeStyle = zone.gridColor; ctx.lineWidth = 0.4
    for (let c = zone.colMin; c <= zone.colMax+1; c++) { ctx.beginPath(); ctx.moveTo(c*CELL,zone.rowMin*CELL); ctx.lineTo(c*CELL,(zone.rowMax+1)*CELL); ctx.stroke() }
    for (let r = zone.rowMin; r <= zone.rowMax+1; r++) { ctx.beginPath(); ctx.moveTo(zone.colMin*CELL,r*CELL); ctx.lineTo((zone.colMax+1)*CELL,r*CELL); ctx.stroke() }
  })

  for (let c = 50; c <= 78; c++) {
    for (let r = 0; r < 50; r++) {
      if (rng(c, r, 4) < 0.08) {
        ctx.fillStyle='#2a5235'; ctx.beginPath(); ctx.arc(c*CELL+5,r*CELL+5,3.8,0,Math.PI*2); ctx.fill()
        ctx.fillStyle='#4a7050'; ctx.beginPath(); ctx.arc(c*CELL+4,r*CELL+4,2.2,0,Math.PI*2); ctx.fill()
      }
    }
  }
  for (let c = 83; c < GRID_COLS; c++) {
    for (let r = 0; r < 50; r++) {
      const riverX = 82+Math.floor(Math.sin(r*0.25)*4)
      if (c>=riverX&&rng(c,r,5)<0.12) { ctx.fillStyle='rgba(255,255,255,0.07)'; ctx.fillRect(c*CELL+2,r*CELL+4,5,1) }
    }
  }
  for (let c = 0; c < 50; c += 9) for (let r = 0; r < 50; r += 9) {
    ctx.fillStyle='#c084fc55'; ctx.beginPath(); ctx.arc(c*CELL+1,r*CELL+1,1.5,0,Math.PI*2); ctx.fill()
  }
  ctx.strokeStyle='#6b4c2a'; ctx.lineWidth=2
  ctx.beginPath(); ctx.moveTo(50*CELL,0); ctx.lineTo(50*CELL,H); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(0,50*CELL); ctx.lineTo(W,50*CELL); ctx.stroke()

  Object.entries(ZONES).forEach(([, zone]) => {
    const cx=(zone.colMin+zone.colMax+1)/2*CELL, cy=(zone.rowMin+zone.rowMax+1)/2*CELL
    ctx.font='bold 13px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'
    ctx.fillStyle='#00000066'; ctx.fillText(zone.label,cx+1,cy+1)
    ctx.fillStyle=zone.color+'aa'; ctx.fillText(zone.label,cx,cy)
  })
  ctx.restore()
  return tc
}

export default function MapGrid({ houses, onCellClick, onAreaSelect, myHouseIds, activeZone, centerTarget, zoomInRef, zoomOutRef, fitViewRef, isAdmin, onViewCell, onEditCell, onVacateCell }: MapGridProps) {
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

  // touch refs
  const lastPinchDist = useRef<number | null>(null)
  const touchStartPos = useRef<{ x: number; y: number } | null>(null)
  const touchStartTime = useRef(0)

  // keep scaleRef in sync
  useEffect(() => { scaleRef.current = scale }, [scale])

  const clampOffset = useCallback((x: number, y: number, s: number) => {
    const c = containerRef.current
    if (!c) return { x, y }
    const { width: cw, height: ch } = c.getBoundingClientRect()
    const cx = Math.min(0, Math.max(cw - W * s, x))
    const cy = Math.min(0, Math.max(ch - H * s, y))
    return { x: cx, y: cy }
  }, [])

  // expose zoom functions to parent
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
      scaleRef.current = newScale
      lastOffset.current = clamped
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
  }, [zoomInRef, zoomOutRef, fitViewRef])

  // center map on target cell (e.g. from search)
  useEffect(() => {
    if (!centerTarget) return
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const s = Math.max(scaleRef.current, 2)
    const cellCx = (centerTarget.col + 0.5) * CELL
    const cellCy = (centerTarget.row + 0.5) * CELL
    const newX = rect.width / 2 - cellCx * s
    const newY = rect.height / 2 - cellCy * s
    scaleRef.current = s
    lastOffset.current = { x: newX, y: newY }
    setScale(s)
    setOffset({ x: newX, y: newY })
  }, [centerTarget])

  useEffect(() => {
    const m = new Map<string, CellData>()
    const am = new Map<string, CellData>()
    houses.forEach(h => { m.set(`${h.col},${h.row}`, h); am.set(h.address, h) })
    houseMap.current = m; addressMap.current = am
  }, [houses])

  // 마운트 시 cover fit (여백 없이 뷰포트 꽉 채움, 정사각형 픽셀 유지)
  useEffect(() => {
    const c = containerRef.current
    if (!c) return
    const r = c.getBoundingClientRect()
    const s = Math.max(r.width / W, r.height / H)
    const nx = (r.width - W * s) / 2
    const ny = (r.height - H * s) / 2
    scaleRef.current = s; lastOffset.current = { x: nx, y: ny }
    setScale(s); setOffset({ x: nx, y: ny })
  }, [])

  useEffect(() => {
    if (terrainCanvas.current) return
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
    else { ctx.fillStyle = '#2a1a0a'; ctx.fillRect(0, 0, W*RS, H*RS) }
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
      if (myHouseIds?.has(h.id)) { ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.strokeRect(x,y,w,ht) }
      if (h.nickname && w >= 20) {
        ctx.fillStyle='#fff'; ctx.font=`bold ${Math.min(8,w/h.nickname.length)}px sans-serif`
        ctx.textAlign='center'; ctx.textBaseline='middle'
        if (hasImage) { ctx.shadowColor='rgba(0,0,0,0.8)'; ctx.shadowBlur=3 }
        ctx.fillText(h.nickname, x+w/2, y+ht/2); ctx.shadowBlur=0
      }
    })

    if (activeZone) {
      Object.entries(ZONES).forEach(([key, zone]) => {
        if (key === activeZone) return
        ctx.fillStyle = 'rgba(0,0,0,0.6)'
        ctx.fillRect(zone.colMin*CELL, zone.rowMin*CELL, (zone.colMax-zone.colMin+1)*CELL, (zone.rowMax-zone.rowMin+1)*CELL)
      })
    }

    if (selection) {
      const { c1,r1,c2,r2 } = selection
      const sx=Math.min(c1,c2)*CELL, sy=Math.min(r1,r2)*CELL
      const sw=(Math.abs(c2-c1)+1)*CELL, sh=(Math.abs(r2-r1)+1)*CELL
      ctx.fillStyle='#ffffff22'; ctx.fillRect(sx,sy,sw,sh)
      ctx.strokeStyle='#fff'; ctx.lineWidth=1.5; ctx.setLineDash([4,3]); ctx.strokeRect(sx,sy,sw,sh); ctx.setLineDash([])
      ctx.fillStyle='#fff'; ctx.font='bold 9px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'
      ctx.fillText(`${Math.abs(c2-c1)+1}×${Math.abs(r2-r1)+1}`, sx+sw/2, sy+sh/2)
    }
    ctx.restore()
  }, [houses, myHouseIds, selection, activeZone, terrainReady])

  useEffect(() => {
    houses.forEach(h => {
      if (!h.exterior_image_url || h.parent_address) return
      if (imageCache.current.has(h.address)) return
      const img = new Image(); img.crossOrigin = 'anonymous'
      img.onload = () => { imageCache.current.set(h.address, img); draw() }
      img.onerror = () => { imageCache.current.set(h.address, img) }
      img.src = h.exterior_image_url
    })
  }, [houses, draw])

  useEffect(() => { draw() }, [draw])

  // Wheel: zoom to cursor
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const coverScale = Math.max(rect.width / W, rect.height / H)
      const newScale = Math.max(coverScale, Math.min(6, scaleRef.current - e.deltaY * 0.002))
      const wx = (mx - lastOffset.current.x) / scaleRef.current
      const wy = (my - lastOffset.current.y) / scaleRef.current
      const newX = mx - wx * newScale
      const newY = my - wy * newScale
      const clamped = clampOffset(newX, newY, newScale)
      scaleRef.current = newScale
      lastOffset.current = clamped
      setScale(newScale)
      setOffset(clamped)
    }
    canvas.addEventListener('wheel', handler, { passive: false })
    return () => canvas.removeEventListener('wheel', handler)
  }, [])

  // Touch: pan + pinch-zoom + tap
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
        touchStartTime.current = Date.now()
        panStart.current = {
          x: e.touches[0].clientX - lastOffset.current.x,
          y: e.touches[0].clientY - lastOffset.current.y,
        }
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
        const coverSc = Math.max(el.clientWidth / W, el.clientHeight / H)
        const newScale = Math.max(coverSc, Math.min(6, scaleRef.current * (dist / lastPinchDist.current)))
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2
        const rect = el.getBoundingClientRect()
        const mx = cx - rect.left, my = cy - rect.top
        const wx = (mx - lastOffset.current.x) / scaleRef.current
        const wy = (my - lastOffset.current.y) / scaleRef.current
        const clamped = clampOffset(mx - wx * newScale, my - wy * newScale, newScale)
        scaleRef.current = newScale
        lastOffset.current = clamped
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
              const prefix = { neon:'N', riverside:'R', oldtown:'O', artdistrict:'A' }[zone]
              onCellClick({ id:'', address:`${prefix}-${String(grid.row*100+grid.col).padStart(4,'0')}`, col:grid.col, row:grid.row, zone, status:'available', name:null, nickname:null, description:null, link_url:null, exterior_image_url:null, border_effect:'none', like_count:0, visit_count:0, occupied_at:null, expires_at:null, is_permanent:false })
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
  }, [toGrid, onCellClick])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) return // 우클릭은 onContextMenu에서 처리
    mouseDownPos.current = { x: e.clientX, y: e.clientY }
    isMouseDown.current = true
    setTooltip(null)
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
      lastOffset.current = clamped
      setOffset(clamped)
      return
    }
    // hover tooltip
    if (!isMouseDown.current) {
      const grid = toGrid(e.clientX, e.clientY)
      if (grid) {
        const existing = houseMap.current.get(`${grid.col},${grid.row}`)
        const primary = existing?.parent_address ? (addressMap.current.get(existing.parent_address) ?? existing) : existing
        if (primary?.status === 'occupied') {
          const text = primary.nickname ?? primary.name ?? '이름 없음'
          setTooltip({ x: e.clientX, y: e.clientY, text })
        } else { setTooltip(null) }
      } else { setTooltip(null) }
    }
    if (!isMouseDown.current) return
    const dx = Math.abs(e.clientX - mouseDownPos.current.x)
    const dy = Math.abs(e.clientY - mouseDownPos.current.y)
    if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) { isSelecting.current = true; setCursor('crosshair') }
    if (isSelecting.current && selectStart.current) {
      const grid = toGrid(e.clientX, e.clientY)
      if (grid) {
        selectEnd.current = grid
        setSelection({ c1: selectStart.current.col, r1: selectStart.current.row, c2: grid.col, r2: grid.row })
      }
    }
  }, [toGrid])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) return // 우클릭은 onContextMenu에서 처리
    const hadMouseDown = isMouseDown.current
    isPanning.current = false; isMouseDown.current = false; setCursor('default')
    if (!hadMouseDown) return // confirm 다이얼로그 닫힐 때 발생하는 spurious mouseup 무시
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
        const prefix = { neon:'N', riverside:'R', oldtown:'O', artdistrict:'A' }[zone]
        onCellClick({ id:'', address:`${prefix}-${String(grid.row*100+grid.col).padStart(4,'0')}`, col:grid.col, row:grid.row, zone, status:'available', name:null, nickname:null, description:null, link_url:null, exterior_image_url:null, border_effect:'none', like_count:0, visit_count:0, occupied_at:null, expires_at:null, is_permanent:false })
      }
    } else if (isSelecting.current && selectStart.current && selectEnd.current) {
      const c1=Math.min(selectStart.current.col,selectEnd.current.col)
      const c2=Math.max(selectStart.current.col,selectEnd.current.col)
      const r1=Math.min(selectStart.current.row,selectEnd.current.row)
      const r2=Math.max(selectStart.current.row,selectEnd.current.row)
      let hasOccupied = false
      outer: for (let c=c1;c<=c2;c++) for (let r=r1;r<=r2;r++) if (houseMap.current.has(`${c},${r}`)) { hasOccupied=true; break outer }
      setSelection(null); isSelecting.current = false
      if (hasOccupied) { setBlockMsg('선택 영역에 이미 입주된 칸이 있어요 🏠'); setTimeout(()=>setBlockMsg(''),2500) }
      else onAreaSelect({ col:c1, row:r1, width:c2-c1+1, height:r2-r1+1 })
    }
    selectStart.current = null; selectEnd.current = null
  }, [toGrid, onCellClick, onAreaSelect])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setTooltip(null)
    const grid = toGrid(e.clientX, e.clientY)
    if (!grid) { setContextMenu(null); return }
    const existing = houseMap.current.get(`${grid.col},${grid.row}`)
    const primary = existing
      ? (existing.parent_address ? (addressMap.current.get(existing.parent_address) ?? existing) : existing)
      : null
    const zone = getZone(grid.col, grid.row)
    const prefix = { neon:'N', riverside:'R', oldtown:'O', artdistrict:'A' }[zone]
    const cell: CellData = primary ?? {
      id: '', address: `${prefix}-${String(grid.row*100+grid.col).padStart(4,'0')}`,
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
        <canvas ref={canvasRef} width={W*RS} height={H*RS} style={{ display:'block', width:W, height:H }} />
      </div>

      {tooltip && (
        <div style={{
          position: 'fixed', left: tooltip.x + 14, top: tooltip.y - 38,
          background: 'rgba(26,15,5,0.95)', color: '#fdf6e3',
          padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700,
          border: '1.5px solid #8b6914', pointerEvents: 'none', zIndex: 200,
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)', whiteSpace: 'nowrap',
          fontFamily: '"Noto Sans KR", sans-serif',
        }}>
          🏠 {tooltip.text}
        </div>
      )}

      {blockMsg && (
        <div style={{
          position:'absolute', bottom:24, left:'50%', transform:'translateX(-50%)',
          background:'rgba(239,68,68,0.92)', color:'#fff',
          padding:'10px 20px', borderRadius:10, fontSize:13, fontWeight:600,
          fontFamily:'"Noto Sans KR", sans-serif', pointerEvents:'none', whiteSpace:'nowrap',
          boxShadow:'0 4px 20px rgba(0,0,0,0.4)',
        }}>{blockMsg}</div>
      )}

      {/* 우클릭 컨텍스트 메뉴 */}
      {contextMenu && (
        <div
          onClick={() => setContextMenu(null)}
          style={{ position:'fixed', inset:0, zIndex:490 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position:'fixed',
              left: Math.min(contextMenu.x + 4, window.innerWidth - 200),
              top: Math.min(contextMenu.y + 4, window.innerHeight - 220),
              background:'#2a1a08',
              border:'2px solid #8b6914',
              borderRadius:10,
              overflow:'hidden',
              boxShadow:'0 8px 32px rgba(0,0,0,0.75)',
              minWidth:180,
              zIndex:491,
              fontFamily:'"Noto Sans KR", -apple-system, sans-serif',
            }}
          >
            <div style={{ padding:'8px 14px 7px', borderBottom:'1px solid #4a3010', fontSize:11, color:'#8b6914', fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {contextMenu.cell.status === 'available'
                ? `📍 빈 공간 · ${contextMenu.cell.address}`
                : `🏠 ${contextMenu.cell.name ?? contextMenu.cell.address}`}
            </div>

            {contextMenu.cell.status === 'available' ? (
              <CtxItem emoji="🏠" label="입주 신청" onClick={() => { onCellClick(contextMenu.cell); setContextMenu(null) }} />
            ) : (
              <>
                <CtxItem emoji="👁" label="집 보기" onClick={() => { onViewCell?.(contextMenu.cell); setContextMenu(null) }} />
                {(isAdmin || myHouseIds?.has(contextMenu.cell.id)) && <>
                  <div style={{ height:1, background:'#4a3010', margin:'2px 0' }} />
                  <CtxItem emoji="✏️" label="수정하기" onClick={() => { onEditCell?.(contextMenu.cell); setContextMenu(null) }} />
                  <CtxItem
                    emoji="🗑️"
                    label={isAdmin && !myHouseIds?.has(contextMenu.cell.id) ? '강제 퇴거 (관리자)' : '퇴거하기'}
                    color="#ef4444"
                    onClick={() => { onVacateCell?.(contextMenu.cell); setContextMenu(null) }}
                  />
                </>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function CtxItem({ emoji, label, color, onClick }: { emoji: string; label: string; color?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display:'flex', alignItems:'center', gap:10,
        width:'100%', padding:'10px 14px',
        background:'transparent', border:'none', borderBottom:'1px solid #3d2a1820',
        color: color ?? '#fdf6e3', fontSize:13, fontWeight:600,
        cursor:'pointer', textAlign:'left', fontFamily:'inherit', whiteSpace:'nowrap',
      }}
      onMouseEnter={e => (e.currentTarget.style.background='#3d2a18')}
      onMouseLeave={e => (e.currentTarget.style.background='transparent')}
    >
      <span style={{ width:20, textAlign:'center' }}>{emoji}</span>
      <span>{label}</span>
    </button>
  )
}
