'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GRID_COLS, GRID_ROWS } from '@/lib/constants'
import { getFgColor } from '@/lib/utils'
import type { CellData, DraftCellInfo, PreviewConfig } from '@/types/cell'

// ── GridCell ──────────────────────────────────────────────────────────────────

interface BlockBg { url: string; bgX: number; bgY: number; totalW: number; totalH: number }

interface GridCellProps {
  cell: CellData
  isSelected: boolean
  previewChar: string | undefined
  previewImageData: string | null
  previewTextColor: string
  previewFontSize: number
  cellSize: number
  blockBg?: BlockBg | null
  draftInfo?: DraftCellInfo | null
}

const GridCell = memo(function GridCell({
  cell, isSelected, previewChar, previewImageData,
  previewTextColor, previewFontSize, cellSize, blockBg, draftInfo,
}: GridCellProps) {
  const hasPreview = isSelected && (previewChar !== undefined || previewImageData !== null || blockBg != null)
  const fontSize = Math.max(8, Math.min(cellSize * 0.55, 32))
  const base: React.CSSProperties = {
    width: cellSize, height: cellSize,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', flexShrink: 0, fontWeight: 700,
    borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9',
  }
  let style = base
  let className = ''
  let content: string | null = null

  if (isSelected && blockBg) {
    style = {
      ...base,
      backgroundImage: `url(${blockBg.url})`,
      backgroundSize: `${blockBg.totalW}px ${blockBg.totalH}px`,
      backgroundPosition: `${blockBg.bgX}px ${blockBg.bgY}px`,
      boxShadow: 'inset 0 0 0 0.5px rgba(99,102,241,0.3)',
    }
  } else if (hasPreview && previewImageData) {
    style = { ...base, backgroundImage: `url(${previewImageData})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.65, boxShadow: 'inset 0 0 0 1.5px #e00' }
  } else if (hasPreview && previewChar !== undefined) {
    style = { ...base, background: previewTextColor + '44', color: previewTextColor, fontSize: Math.min(previewFontSize, fontSize), boxShadow: 'inset 0 0 0 1.5px ' + previewTextColor }
    content = previewChar
  } else if (isSelected) {
    style = { ...base, background: '#6366f1', color: '#fff' }
  } else if (draftInfo) {
    // 드래프트: 취득 예정 (반투명 + 보라 테두리)
    if (draftInfo.imageData) {
      style = { ...base, backgroundImage: `url(${draftInfo.imageData})`, backgroundSize: draftInfo.imageBgSize ?? 'cover', backgroundPosition: draftInfo.imageBgPos ?? 'center', opacity: 0.65, boxShadow: 'inset 0 0 0 1.5px #6366f1' }
    } else {
      style = { ...base, background: draftInfo.textColor + 'bb', color: getFgColor(draftInfo.textColor), fontSize: Math.min(draftInfo.fontSize, fontSize), boxShadow: 'inset 0 0 0 1.5px #6366f1' }
      content = draftInfo.contentText
    }
  } else if (cell.taken) {
    className = 'cell-taken'
    if (cell.imageData) {
      style = {
        ...base,
        backgroundImage: `url(${cell.imageData})`,
        backgroundSize: cell.imageBgSize ?? 'cover',
        backgroundPosition: cell.imageBgPos ?? 'center',
      }
    } else {
      style = { ...base, background: cell.textColor, color: getFgColor(cell.textColor), fontSize: Math.min(cell.fontSize, fontSize) }
      content = cell.contentText
    }
  } else {
    className = `cell-z-${cell.zone}`
  }

  return <div className={className} style={style}>{content}</div>
})

// ── CellGrid ──────────────────────────────────────────────────────────────────

interface CellGridProps {
  cells: CellData[]
  selected: Set<number>
  previewConfig: PreviewConfig | null
  cellSize: number
  draftCellMap: Map<number, DraftCellInfo>
  onSelectionChange: (selected: Set<number>) => void
  onCellTaken: (msg: string) => void
}

export default function CellGrid({ cells, selected, previewConfig, cellSize, draftCellMap, onSelectionChange, onCellTaken }: CellGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isSpaceDown, setIsSpaceDown] = useState(false)

  // 드래그 상태 (ref)
  const isDragging = useRef(false)
  const dragStartCell = useRef<{ row: number; col: number } | null>(null)
  const isPanning = useRef(false)
  const panStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null)

  // 최신값 ref
  const cellsRef = useRef(cells)
  const selectedRef = useRef(selected)
  const offsetRef = useRef(offset)
  const scaleRef = useRef(scale)
  const onSelectionChangeRef = useRef(onSelectionChange)
  const onCellTakenRef = useRef(onCellTaken)
  const isSpaceRef = useRef(isSpaceDown)
  const previewActiveRef = useRef(false)

  cellsRef.current = cells
  selectedRef.current = selected
  offsetRef.current = offset
  scaleRef.current = scale
  onSelectionChangeRef.current = onSelectionChange
  onCellTakenRef.current = onCellTaken
  isSpaceRef.current = isSpaceDown
  // 미리보기가 활성화된 상태 = 텍스트/이미지가 입력됨
  previewActiveRef.current = previewConfig !== null

  // 스페이스바
  useEffect(() => {
    const dn = (e: KeyboardEvent) => { if (e.code === 'Space' && !e.repeat) { e.preventDefault(); setIsSpaceDown(true) } }
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') setIsSpaceDown(false) }
    window.addEventListener('keydown', dn)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up) }
  }, [])

  // getBoundingClientRect 기준으로 셀 좌표 계산 (scale 자동 반영)
  const getCellAt = useCallback((clientX: number, clientY: number) => {
    const grid = gridRef.current
    if (!grid) return null
    const rect = grid.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null
    // rect.width / GRID_COLS = cellSize * scale (transform 반영됨)
    const stepX = rect.width / GRID_COLS
    const stepY = rect.height / GRID_ROWS
    const col = Math.floor(x / stepX)
    const row = Math.floor(y / stepY)
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return null
    return { col, row, id: row * GRID_COLS + col }
  }, [])

  const applyRange = useCallback((sr: number, sc2: number, er: number, ec: number) => {
    const r1 = Math.min(sr, er), r2 = Math.max(sr, er)
    const c1 = Math.min(sc2, ec), c2 = Math.max(sc2, ec)
    const next = new Set<number>()
    for (let r = r1; r <= r2; r++)
      for (let c = c1; c <= c2; c++) {
        const cell = cellsRef.current[r * GRID_COLS + c]
        if (cell && !cell.taken) next.add(cell.id)
      }
    onSelectionChangeRef.current(next)
  }, [])

  // window 레벨 mousemove / mouseup
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (isPanning.current && panStart.current) {
        setOffset({
          x: panStart.current.ox + e.clientX - panStart.current.mx,
          y: panStart.current.oy + e.clientY - panStart.current.my,
        })
        return
      }
      if (isDragging.current && dragStartCell.current) {
        const hit = getCellAt(e.clientX, e.clientY)
        if (hit) applyRange(dragStartCell.current.row, dragStartCell.current.col, hit.row, hit.col)
      }
    }
    const onUp = () => {
      isDragging.current = false
      isPanning.current = false
      panStart.current = null
      dragStartCell.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [getCellAt, applyRange])

  // 스크롤 줌 (커서 기준)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
      const rect = el.getBoundingClientRect()
      const cx = e.clientX - rect.left - rect.width / 2
      const cy = e.clientY - rect.top - rect.height / 2
      setScale(prev => {
        const next = Math.max(1,Math.min(12, prev * factor))
        setOffset(o => ({
          x: cx - (cx - o.x) * (next / prev),
          y: cy - (cy - o.y) * (next / prev),
        }))
        return next
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // 컨테이너 mousedown
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault()
      isPanning.current = true
      panStart.current = { mx: e.clientX, my: e.clientY, ox: offsetRef.current.x, oy: offsetRef.current.y }
      return
    }

    // 패닝: 스페이스+왼쪽 or 오른쪽 클릭
    if (isSpaceRef.current || e.button === 2) {
      e.preventDefault()
      isPanning.current = true
      panStart.current = { mx: e.clientX, my: e.clientY, ox: offsetRef.current.x, oy: offsetRef.current.y }
      return
    }

    // (미리보기 활성 상태에서도 셀 선택 허용)

    // 셀 선택
    const hit = getCellAt(e.clientX, e.clientY)
    if (!hit) return
    const cell = cellsRef.current[hit.id]
    if (!cell) return
    if (cell.taken) { onCellTakenRef.current('이미 점유된 셀입니다'); return }

    isDragging.current = true
    dragStartCell.current = { row: hit.row, col: hit.col }

    if (e.shiftKey) {
      const next = new Set(selectedRef.current)
      if (next.has(hit.id)) next.delete(hit.id); else next.add(hit.id)
      onSelectionChangeRef.current(next)
    } else {
      onSelectionChangeRef.current(new Set([hit.id]))
    }
  }, [getCellAt])

  const selectionOrderMap = useMemo(() => {
    const sorted = Array.from(selected).sort((a, b) => a - b)
    return new Map(sorted.map((id, idx) => [id, idx]))
  }, [selected])

  // 블록 프리뷰: 이미지 or 블록 텍스트 → 전체 선택 영역에 하나로 펼치기
  const blockPreview = useMemo<{ url: string; minCol: number; minRow: number; totalW: number; totalH: number; keepFrom: number; keepTo: number } | null>(() => {
    if (typeof document === 'undefined') return null
    if (!previewConfig) return null
    const isBlockText = previewConfig.layoutMode === 'block' && previewConfig.contentType === 'text' && previewConfig.text.length > 0
    const isImage = previewConfig.contentType === 'image' && !!previewConfig.imageData
    if (!isBlockText && !isImage) return null
    const selCells = Array.from(selected).map(id => cells[id]).filter(Boolean)
    if (selCells.length === 0) return null

    const minCol = Math.min(...selCells.map(c => c.col))
    const maxCol = Math.max(...selCells.map(c => c.col))
    const minRow = Math.min(...selCells.map(c => c.row))
    const maxRow = Math.max(...selCells.map(c => c.row))
    const totalW = (maxCol - minCol + 1) * cellSize
    const totalH = (maxRow - minRow + 1) * cellSize

    // 이미지: 빈 행 제거 없이 전체 사용
    if (isImage) {
      const relRows = maxRow - minRow
      return { url: previewConfig.imageData!, minCol, minRow, totalW, totalH, keepFrom: 0, keepTo: relRows }
    }

    const canvas = document.createElement('canvas')
    canvas.width = totalW; canvas.height = totalH
    const ctx = canvas.getContext('2d')!
    const text = previewConfig.text
    const charW = totalW / text.length
    // 세로를 꽉 채우는 폰트 크기 찾기
    let fontSize = totalH * 0.9
    ctx.font = `bold ${fontSize}px Arial, sans-serif`
    const metrics = ctx.measureText(text[0] ?? 'A')
    const actualH = (metrics.actualBoundingBoxAscent ?? fontSize * 0.75) + (metrics.actualBoundingBoxDescent ?? fontSize * 0.15)
    if (actualH > 0) fontSize = fontSize * (totalH * 0.88 / actualH)
    fontSize = Math.min(fontSize, charW * 0.92)
    ctx.font = `bold ${fontSize}px Arial, sans-serif`
    ctx.fillStyle = previewConfig.textColor
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    text.split('').forEach((ch, i) => ctx.fillText(ch, charW * (i + 0.5), totalH / 2))

    // 빈 행 감지
    const pd = ctx.getImageData(0, 0, totalW, totalH).data
    let textMinY = totalH, textMaxY = -1
    for (let y = 0; y < totalH; y++) {
      for (let x = 0; x < totalW; x++) {
        if (pd[(y * totalW + x) * 4 + 3] > 20) {
          if (y < textMinY) textMinY = y
          textMaxY = y
          break
        }
      }
    }
    const pad = Math.ceil(cellSize * 0.2)
    const keepFrom = textMaxY >= 0 ? Math.max(0, Math.floor((textMinY - pad) / cellSize)) : 0
    const keepTo = textMaxY >= 0 ? Math.min(maxRow - minRow, Math.floor((textMaxY + pad) / cellSize)) : maxRow - minRow

    return { url: canvas.toDataURL(), minCol, minRow, totalW, totalH, keepFrom, keepTo }
  }, [previewConfig, selected, cells, cellSize])

  if (cellSize === 0) return null

  const cursor = isSpaceDown ? (isPanning.current ? 'grabbing' : 'grab') : 'crosshair'

  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#f8fafc', cursor }}
      onMouseDown={handleMouseDown}
      onContextMenu={e => e.preventDefault()}
    >
      {/* 줌/패닝 래퍼 */}
      <div style={{
        position: 'absolute',
        left: '50%', top: '50%',
        transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
        transformOrigin: 'center center',
        willChange: 'transform',
      }}>
        <div ref={gridRef} style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${GRID_COLS}, ${cellSize}px)`,
          borderTop: '1px solid #f1f5f9',
          borderLeft: '1px solid #f1f5f9',
          userSelect: 'none',
        }}>
          {cells.map((cell) => {
            const isSelected = selected.has(cell.id)
            const idx = selectionOrderMap.get(cell.id) ?? -1
            let previewChar: string | undefined = undefined
            if (isSelected && previewConfig?.contentType === 'text' && previewConfig.text.length > 0 && previewConfig.layoutMode !== 'block') {
              previewChar = previewConfig.text[idx] ?? ''
            }
            // 이미지는 blockBg spanning으로만 처리 (per-cell 제거)
            const previewImageData: string | null = null

            // 블록 프리뷰 bg 계산
            let blockBg: BlockBg | null = null
            if (isSelected && blockPreview) {
              const relRow = cell.row - blockPreview.minRow
              if (relRow >= blockPreview.keepFrom && relRow <= blockPreview.keepTo) {
                blockBg = {
                  url: blockPreview.url,
                  bgX: -(cell.col - blockPreview.minCol) * cellSize,
                  bgY: -(cell.row - blockPreview.minRow) * cellSize,
                  totalW: blockPreview.totalW,
                  totalH: blockPreview.totalH,
                }
              }
            }

            const draftInfo = !isSelected ? (draftCellMap.get(cell.id) ?? null) : null

            return (
              <GridCell key={cell.id} cell={cell} isSelected={isSelected}
                previewChar={previewChar} previewImageData={previewImageData}
                previewTextColor={previewConfig?.textColor ?? '#000000'}
                previewFontSize={previewConfig?.fontSize ?? 16}
                cellSize={cellSize} blockBg={blockBg} draftInfo={draftInfo}
              />
            )
          })}
        </div>
      </div>

      {/* 줌 컨트롤 */}
      <div style={{ position: 'absolute', bottom: 16, right: 16, display: 'flex', gap: 6, alignItems: 'center' }}
        onMouseDown={e => e.stopPropagation()}>
        <button onClick={() => setScale(s => Math.min(12, +(s * 1.3).toFixed(2)))} style={zBtn}>+</button>
        <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', minWidth: 40, textAlign: 'center' }}>
          {Math.round(scale * 100)}%
        </span>
        <button onClick={() => setScale(s => Math.max(1,+(s / 1.3).toFixed(2)))} style={zBtn}>−</button>
        <button onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }) }} style={{ ...zBtn, padding: '4px 10px', fontSize: 10 }}>초기화</button>
      </div>

      {/* 힌트 */}
      <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', fontSize: 10, color: '#cbd5e1', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
        스크롤: 줌 &nbsp;·&nbsp; Space+드래그: 이동 &nbsp;·&nbsp; 드래그: 셀 선택
      </div>
    </div>
  )
}

const zBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 6,
  border: '1px solid #e2e8f0', background: 'rgba(255,255,255,0.9)',
  backdropFilter: 'blur(4px)', cursor: 'pointer',
  fontSize: 15, color: '#475569',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
