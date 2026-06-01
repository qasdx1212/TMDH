'use client'

import { useState, useRef, useEffect } from 'react'
import { DURATIONS, PERMANENT_DAYS, PERMANENT_PRICES, ZONE_PRICES, PALETTE } from '@/lib/constants'
import { calcPrice, formatKRW, getFgColor } from '@/lib/utils'
import type { ContentType, Draft, LayoutMode, PreviewConfig, Zone } from '@/types/cell'

type PConfig = {
  contentType: ContentType; text: string; textColor: string
  fontSize: number; imageData: string | null; days: number; layoutMode: LayoutMode
}

interface PurchaseDrawerProps {
  isOpen: boolean
  selectedCount: number
  zoneCounts: Record<Zone, number>
  selectionMinCol: number
  selectionMaxCol: number
  drafts: Draft[]
  onPreviewChange: (config: PreviewConfig | null) => void
  onAddDraft: (config: PConfig) => void
  onPurchase: (config: PConfig) => void
  onCancelDraft: (draftId: string) => void
  onClose: () => void
}

export default function PurchaseDrawer({
  isOpen, selectedCount, zoneCounts,
  selectionMinCol, selectionMaxCol,
  drafts, onPreviewChange, onAddDraft, onPurchase, onCancelDraft, onClose,
}: PurchaseDrawerProps) {
  const [contentType, setContentType] = useState<ContentType>('text')
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('perCell')
  const [text, setText] = useState('')
  const [textColor, setTextColor] = useState('#000000')
  const [fontSize, setFontSize] = useState(16)
  const [imageData, setImageData] = useState<string | null>(null)
  const [days, setDays] = useState(7)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const onPreviewChangeRef = useRef(onPreviewChange)
  onPreviewChangeRef.current = onPreviewChange

  const base7 = zoneCounts.a * ZONE_PRICES.a + zoneCounts.b * ZONE_PRICES.b + zoneCounts.c * ZONE_PRICES.c
  const totalPrice = calcPrice(zoneCounts, days)

  useEffect(() => {
    if (!isOpen || selectedCount === 0) { onPreviewChangeRef.current(null); return }
    const base = { textColor, fontSize, layoutMode, selectionMinCol, selectionMaxCol }
    if (contentType === 'text' && text.length > 0) {
      onPreviewChangeRef.current({ contentType: 'text', text, imageData: null, ...base })
    } else if (contentType === 'image' && imageData) {
      onPreviewChangeRef.current({ contentType: 'image', text: '', imageData, ...base })
    } else {
      onPreviewChangeRef.current(null)
    }
  }, [contentType, text, textColor, fontSize, imageData, isOpen, selectedCount, layoutMode, selectionMinCol, selectionMaxCol])

  useEffect(() => {
    if (!isOpen) { setText(''); setImageData(null); setContentType('text'); setLayoutMode('perCell') }
  }, [isOpen])

  const handleImgFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setImageData(ev.target?.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handlePurchase = () => {
    if (contentType === 'text' && !text.trim()) { alert('텍스트를 입력하세요'); return }
    if (contentType === 'image' && !imageData) { alert('이미지를 업로드하세요'); return }
    onPurchase({ contentType, text, textColor, fontSize, imageData, days, layoutMode })
  }

  const handleAddDraft = () => {
    if (contentType === 'text' && !text.trim()) { alert('텍스트를 입력하세요'); return }
    if (contentType === 'image' && !imageData) { alert('이미지를 업로드하세요'); return }
    onAddDraft({ contentType, text, textColor, fontSize, imageData, days, layoutMode })
  }

  const zoneItems = [
    zoneCounts.a > 0 && { label: 'Zone A', count: zoneCounts.a, color: '#f59e0b' },
    zoneCounts.b > 0 && { label: 'Zone B', count: zoneCounts.b, color: '#6366f1' },
    zoneCounts.c > 0 && { label: 'Zone C', count: zoneCounts.c, color: '#94a3b8' },
  ].filter(Boolean) as { label: string; count: number; color: string }[]

  return (
    <>
      {/* 오버레이 없음 — 셀 선택 유지하면서 드로어 사용 가능 */}

      {/* 드로어 */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        height: '100vh',
        width: 360,
        background: '#fff',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}>

        {/* 헤더 */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>셀 구매</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{selectedCount}칸 선택됨</div>
          </div>
          <button
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontSize: 16, color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ×
          </button>
        </div>

        {/* 본문 (스크롤 가능) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Zone 배지 */}
          {zoneItems.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {zoneItems.map(z => (
                <span key={z.label} style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: z.color + '18', color: z.color, border: `1px solid ${z.color}33` }}>
                  {z.label} ×{z.count}
                </span>
              ))}
            </div>
          )}

          {/* 콘텐츠 타입 토글 */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>콘텐츠 타입</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['text', 'image'] as ContentType[]).map(t => (
                <button
                  key={t}
                  onClick={() => { setContentType(t); setImageData(null); setText('') }}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    border: contentType === t ? '1.5px solid #6366f1' : '1.5px solid #e2e8f0',
                    background: contentType === t ? '#eef2ff' : '#f8fafc',
                    color: contentType === t ? '#6366f1' : '#64748b',
                    transition: 'all 0.15s',
                  }}
                >
                  {t === 'text' ? '텍스트' : '이미지'}
                </button>
              ))}
            </div>
          </div>

          {/* 배치 방식 */}
          {contentType === 'text' && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>배치 방식</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {([['perCell', '셀당 1글자'], ['block', '블록 배치']] as [LayoutMode, string][]).map(([m, label]) => (
                  <button key={m} onClick={() => setLayoutMode(m)} style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    border: layoutMode === m ? '1.5px solid #6366f1' : '1.5px solid #e2e8f0',
                    background: layoutMode === m ? '#eef2ff' : '#f8fafc',
                    color: layoutMode === m ? '#6366f1' : '#64748b',
                    transition: 'all 0.15s',
                  }}>
                    {label}
                  </button>
                ))}
              </div>
              {layoutMode === 'block' && (
                <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 6, lineHeight: 1.5 }}>
                  선택 영역을 글자 수로 균등 분할해 각 구역에 하나의 글자를 채웁니다.
                </p>
              )}
            </div>
          )}

          {/* 입력 */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>내용</div>
            {contentType === 'text' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="예) 사랑해 김민지 ♡"
                  style={{
                    width: '100%', height: 72, padding: '10px 12px', borderRadius: 8,
                    border: '1.5px solid #e2e8f0', fontSize: 13, resize: 'none', outline: 'none',
                    fontFamily: 'inherit', color: '#0f172a', background: '#f8fafc',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => (e.target.style.borderColor = '#6366f1')}
                  onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>크기 {fontSize}px</span>
                  <input type="range" min={10} max={32} value={fontSize} onChange={e => setFontSize(+e.target.value)}
                    style={{ flex: 1, accentColor: '#6366f1' }} />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {PALETTE.map(c => (
                    <div
                      key={c}
                      onClick={() => setTextColor(c)}
                      style={{
                        width: 20, height: 20, borderRadius: 4, background: c, cursor: 'pointer',
                        border: c === '#ffffff' ? '1.5px solid #e2e8f0' : '1.5px solid transparent',
                        boxShadow: c === textColor ? `0 0 0 2px #fff, 0 0 0 4px ${c === '#ffffff' ? '#94a3b8' : c}` : 'none',
                        transition: 'box-shadow 0.1s',
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    height: 80, borderRadius: 8, border: '1.5px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#f8fafc', transition: 'border-color 0.15s, background 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.background = '#eef2ff' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#f8fafc' }}
                >
                  {imageData
                    ? <img src={imageData} style={{ maxHeight: 68, maxWidth: '100%', objectFit: 'contain', borderRadius: 6 }} alt="" />
                    : <span style={{ fontSize: 12, color: '#94a3b8' }}>클릭하여 이미지 업로드</span>}
                </div>
                {imageData && (
                  <button onClick={() => setImageData(null)} style={{ alignSelf: 'flex-start', fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    이미지 제거
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImgFile} style={{ display: 'none' }} />
              </div>
            )}
          </div>

          {/* 미리보기 */}
          {(contentType === 'text' && text.length > 0) || (contentType === 'image' && imageData) ? (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>미리보기</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, padding: 8, borderRadius: 8, border: '1px solid #f1f5f9', background: '#f8fafc', maxHeight: 72, overflow: 'hidden' }}>
                {contentType === 'text'
                  ? text.split('').map((ch, i) => (
                      <div key={i} style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, background: textColor, color: getFgColor(textColor), fontSize: Math.min(fontSize, 14), fontWeight: 700 }}>
                        {ch}
                      </div>
                    ))
                  : <img src={imageData!} style={{ maxHeight: 56, objectFit: 'contain', borderRadius: 4 }} alt="" />
                }
              </div>
            </div>
          ) : null}

          {/* 기간 */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>기간</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {DURATIONS.map(({ days: d, label, multiplier }) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  style={{
                    padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 500, cursor: 'pointer', lineHeight: 1.4,
                    border: d === days ? '1.5px solid #0f172a' : '1.5px solid #e2e8f0',
                    background: d === days ? '#0f172a' : '#f8fafc',
                    color: d === days ? '#fff' : '#475569',
                    transition: 'all 0.12s',
                  }}
                >
                  {label}<br />
                  <span style={{ fontSize: 9, opacity: 0.75 }}>{formatKRW(Math.round(base7 * multiplier))}</span>
                </button>
              ))}
              <button
                onClick={() => setDays(PERMANENT_DAYS)}
                style={{
                  padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 500, cursor: 'pointer', lineHeight: 1.4,
                  border: days === PERMANENT_DAYS ? '1.5px solid #0f172a' : '1.5px solid #e2e8f0',
                  background: days === PERMANENT_DAYS ? '#0f172a' : '#f8fafc',
                  color: days === PERMANENT_DAYS ? '#fff' : '#475569',
                  transition: 'all 0.12s',
                }}
              >
                영구<br />
                <span style={{ fontSize: 9, opacity: 0.75 }}>
                  {formatKRW(zoneCounts.a * PERMANENT_PRICES.a + zoneCounts.b * PERMANENT_PRICES.b + zoneCounts.c * PERMANENT_PRICES.c)}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* 저장된 드래프트 목록 */}
        {drafts.length > 0 && (
          <div style={{ padding: '12px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
              추가된 구간 ({drafts.length})
            </div>
            {drafts.map((d, i) => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: '#475569', background: '#f8fafc', borderRadius: 6, padding: '5px 10px', border: '1px solid #e2e8f0' }}>
                <span>구간 {i + 1} — {d.cellMap.size}칸</span>
                <button onClick={() => onCancelDraft(d.id)} style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>취소</button>
              </div>
            ))}
          </div>
        )}

        {/* 하단 결제 */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>{days === PERMANENT_DAYS ? '영구보존' : `${days}일 기준`}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.03em' }}>{formatKRW(totalPrice)}</div>
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'right' }}>
              {selectedCount}칸<br />
              {zoneItems.map(z => `${z.label} ×${z.count}`).join(', ')}
            </div>
          </div>
          <button
            onClick={handleAddDraft}
            style={{
              width: '100%', padding: '11px', borderRadius: 10,
              border: '1.5px solid #6366f1', background: '#eef2ff',
              color: '#6366f1', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#e0e7ff' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#eef2ff' }}
          >
            + 다음 구간 추가
          </button>
          <button
            onClick={handlePurchase}
            style={{
              width: '100%', padding: '14px', borderRadius: 10, border: 'none',
              background: '#0f172a', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer',
              letterSpacing: '-0.01em', transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#1e293b')}
            onMouseLeave={e => (e.currentTarget.style.background = '#0f172a')}
          >
            {drafts.length > 0 ? `전체 결제하기 (${drafts.length + 1}구간) →` : '결제하기 →'}
          </button>
        </div>
      </div>
    </>
  )
}
