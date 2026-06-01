'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { GRID_COLS, GRID_ROWS } from '@/lib/constants'
import { getZone, countByZone } from '@/lib/utils'
import type { CellData, ContentType, Draft, DraftCellInfo, LayoutMode, PreviewConfig, Zone } from '@/types/cell'
import CellGrid from '@/components/CellGrid'
import PurchaseDrawer from '@/components/PurchaseDrawer'
import FloatingHeader from '@/components/FloatingHeader'

function initCells(): CellData[] {
  const data: CellData[] = []
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      data.push({
        id: row * GRID_COLS + col, col, row,
        zone: getZone(col, row),
        taken: false, contentType: 'text', contentText: '',
        textColor: '#000000', fontSize: 16, imageData: null,
        isPermanent: false, expiresAt: null,
      })
    }
  }
  return data
}

type PurchaseConfig = {
  contentType: ContentType
  text: string
  textColor: string
  fontSize: number
  imageData: string | null
  days: number
  layoutMode: LayoutMode
}

// 선택한 셀들의 span 정보 계산 (드래프트/구매 공통)
function buildCellMap(
  ids: number[],
  config: PurchaseConfig,
  cells: CellData[],
  cellSize: number
): Map<number, DraftCellInfo> {
  const chars = config.text.split('')
  const minCol = Math.min(...ids.map(id => cells[id]?.col ?? 0))
  const maxCol = Math.max(...ids.map(id => cells[id]?.col ?? 0))
  const minRow = Math.min(...ids.map(id => cells[id]?.row ?? 0))
  const spanW = (maxCol - minCol + 1) * cellSize
  const spanH = (Math.max(...ids.map(id => cells[id]?.row ?? 0)) - minRow + 1) * cellSize

  let spanImageUrl: string | null = null
  if (config.layoutMode === 'block' && config.contentType === 'text' && chars.length > 0) {
    const canvas = document.createElement('canvas')
    canvas.width = spanW; canvas.height = spanH
    const ctx = canvas.getContext('2d')!
    const charW = spanW / chars.length
    let fs = spanH * 0.9
    ctx.font = `bold ${fs}px Arial, sans-serif`
    const m = ctx.measureText(chars[0] ?? 'A')
    const aH = (m.actualBoundingBoxAscent ?? fs * 0.75) + (m.actualBoundingBoxDescent ?? fs * 0.15)
    if (aH > 0) fs = fs * (spanH * 0.88 / aH)
    fs = Math.min(fs, charW * 0.92)
    ctx.font = `bold ${fs}px Arial, sans-serif`
    ctx.fillStyle = config.textColor
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    chars.forEach((ch, i) => ctx.fillText(ch, charW * (i + 0.5), spanH / 2))
    spanImageUrl = canvas.toDataURL()

    // 빈 행 제거: 픽셀 스캔으로 글자가 실제로 있는 행 범위만 남김
    const pd = ctx.getImageData(0, 0, spanW, spanH).data
    let textMinY = spanH, textMaxY = -1
    for (let y = 0; y < spanH; y++) {
      for (let x = 0; x < spanW; x++) {
        if (pd[(y * spanW + x) * 4 + 3] > 20) {
          if (y < textMinY) textMinY = y
          textMaxY = y
          break
        }
      }
    }
    if (textMaxY >= 0) {
      const pad = Math.ceil(cellSize * 0.2)
      const keepFrom = Math.max(0, Math.floor((textMinY - pad) / cellSize))
      const keepTo = Math.min(maxRow - minRow, Math.floor((textMaxY + pad) / cellSize))
      effectiveIds = ids.filter(id => {
        const relRow = (cells[id]?.row ?? minRow) - minRow
        return relRow >= keepFrom && relRow <= keepTo
      })
    }
  } else if (config.contentType === 'image' && config.imageData) {
    spanImageUrl = config.imageData
  }

  const sortedIds = [...ids].sort((a, b) => a - b)
  const idIndexMap = new Map(sortedIds.map((id, i) => [id, i]))
  const map = new Map<number, DraftCellInfo>()

  ids.forEach(id => {
    const cell = cells[id]
    if (!cell) return
    const isSpanning = spanImageUrl !== null
    const char = !isSpanning && config.contentType === 'text'
      ? (chars[idIndexMap.get(id) ?? 0] ?? '') : ''
    map.set(id, {
      contentType: isSpanning ? 'image' : config.contentType,
      contentText: char,
      textColor: config.textColor,
      fontSize: config.fontSize,
      imageData: isSpanning ? spanImageUrl : null,
      imageBgSize: isSpanning ? `${spanW}px ${spanH}px` : undefined,
      imageBgPos: isSpanning ? `${-(cell.col - minCol) * cellSize}px ${-(cell.row - minRow) * cellSize}px` : undefined,
    })
  })
  return map
}

export default function Home() {
  const [cells, setCells] = useState<CellData[]>(initCells)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [previewConfig, setPreviewConfig] = useState<PreviewConfig | null>(null)
  const [cellSize, setCellSize] = useState(10)
  const [drafts, setDrafts] = useState<Draft[]>([])

  useEffect(() => {
    const calc = () => {
      const maxW = Math.floor((window.innerWidth  - (GRID_COLS - 1)) / GRID_COLS)
      const maxH = Math.floor((window.innerHeight - (GRID_ROWS - 1)) / GRID_ROWS)
      setCellSize(Math.max(4, Math.min(maxW, maxH)))
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])

  const sortedSelected = useMemo(() => Array.from(selected).sort((a, b) => a - b), [selected])
  const zoneCounts = useMemo(() => countByZone(sortedSelected, cells), [sortedSelected, cells])
  const takenCount = useMemo(() => cells.filter(c => c.taken).length, [cells])

  const selectionBounds = useMemo(() => {
    if (selected.size === 0) return { minCol: 0, maxCol: 0 }
    let minCol = GRID_COLS, maxCol = 0
    for (const id of selected) {
      const col = cells[id]?.col ?? 0
      if (col < minCol) minCol = col
      if (col > maxCol) maxCol = col
    }
    return { minCol, maxCol }
  }, [selected, cells])

  // 드래프트 셀 맵 (렌더링용)
  const draftCellMap = useMemo(() => {
    const map = new Map<number, DraftCellInfo>()
    for (const draft of drafts) {
      for (const [id, info] of draft.cellMap) map.set(id, info)
    }
    return map
  }, [drafts])

  const handleSelectionChange = useCallback((next: Set<number>) => {
    setSelected(next)
    if (next.size === 0) setPreviewConfig(null)
  }, [])

  const handleClearSelection = useCallback(() => {
    setSelected(new Set())
    setPreviewConfig(null)
  }, [])

  // 현재 선택을 드래프트로 저장 → 선택 초기화 → 새 구간 선택 가능
  const handleAddDraft = useCallback((config: PurchaseConfig) => {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    const cellMap = buildCellMap(ids, config, cells, cellSize)
    setDrafts(prev => [...prev, { id: Date.now().toString(), cellMap }])
    setSelected(new Set())
    setPreviewConfig(null)
  }, [selected, cells, cellSize])

  // 드래프트 + 현재 선택 전체 구매
  const handlePurchase = useCallback((config: PurchaseConfig) => {
    const currentIds = Array.from(selected)
    const currentMap = currentIds.length > 0
      ? buildCellMap(currentIds, config, cells, cellSize)
      : new Map<number, DraftCellInfo>()

    // 모든 드래프트 + 현재 선택 병합
    const allUpdates = new Map<number, DraftCellInfo>()
    for (const draft of drafts) {
      for (const [id, info] of draft.cellMap) allUpdates.set(id, info)
    }
    for (const [id, info] of currentMap) allUpdates.set(id, info)

    if (allUpdates.size === 0) return

    setCells(prev => prev.map(cell => {
      const info = allUpdates.get(cell.id)
      if (!info) return cell
      return {
        ...cell,
        taken: true,
        contentType: info.contentType,
        contentText: info.contentText,
        textColor: info.textColor,
        fontSize: info.fontSize,
        imageData: info.imageData ?? null,
        imageBgSize: info.imageBgSize,
        imageBgPos: info.imageBgPos,
        isPermanent: config.days === -1,
        expiresAt: config.days > 0 ? new Date(Date.now() + config.days * 86400000) : null,
      }
    }))

    setDrafts([])
    setSelected(new Set())
    setPreviewConfig(null)
  }, [selected, cells, cellSize, drafts])

  const handleCancelDraft = useCallback((draftId: string) => {
    setDrafts(prev => prev.filter(d => d.id !== draftId))
  }, [])

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#f8fafc' }}>
      <CellGrid
        cells={cells}
        selected={selected}
        previewConfig={previewConfig}
        cellSize={cellSize}
        draftCellMap={draftCellMap}
        onSelectionChange={handleSelectionChange}
        onCellTaken={() => {}}
      />
      <FloatingHeader
        totalCells={GRID_COLS * GRID_ROWS}
        takenCells={takenCount}
        selectedCount={selected.size}
        draftCount={drafts.reduce((s, d) => s + d.cellMap.size, 0)}
      />
      <PurchaseDrawer
        isOpen={selected.size > 0}
        selectedCount={selected.size}
        zoneCounts={zoneCounts}
        selectionMinCol={selectionBounds.minCol}
        selectionMaxCol={selectionBounds.maxCol}
        drafts={drafts}
        onPreviewChange={setPreviewConfig}
        onAddDraft={handleAddDraft}
        onPurchase={handlePurchase}
        onCancelDraft={handleCancelDraft}
        onClose={handleClearSelection}
      />
    </div>
  )
}
