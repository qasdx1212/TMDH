'use client'

import { useState, useRef, useEffect } from 'react'
import { DURATIONS, PERMANENT_DAYS, PERMANENT_PRICES, ZONE_PRICES, PALETTE } from '@/lib/constants'
import { calcPrice, formatKRW, getFgColor } from '@/lib/utils'
import type { ContentType, PreviewConfig, Zone } from '@/types/cell'

interface BottomPanelProps {
  isOpen: boolean
  selectedCount: number
  zoneCounts: Record<Zone, number>
  onPreviewChange: (config: PreviewConfig | null) => void
  onPurchase: (config: {
    contentType: ContentType
    text: string
    textColor: string
    fontSize: number
    imageData: string | null
    days: number
  }) => void
  onClose: () => void
}

export default function BottomPanel({
  isOpen,
  selectedCount,
  zoneCounts,
  onPreviewChange,
  onPurchase,
  onClose,
}: BottomPanelProps) {
  const [contentType, setContentType] = useState<ContentType>('text')
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
    if (contentType === 'text' && text.length > 0) {
      onPreviewChangeRef.current({ contentType: 'text', text, textColor, fontSize, imageData: null })
    } else if (contentType === 'image' && imageData) {
      onPreviewChangeRef.current({ contentType: 'image', text: '', textColor, fontSize, imageData })
    } else {
      onPreviewChangeRef.current(null)
    }
  }, [contentType, text, textColor, fontSize, imageData, isOpen, selectedCount])

  useEffect(() => {
    if (!isOpen) { setText(''); setImageData(null); setContentType('text') }
  }, [isOpen])

  const handleImgFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setImageData(ev.target?.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handlePurchase = () => {
    if (contentType === 'text' && !text.trim()) { alert('텍스트를 입력하세요'); return }
    if (contentType === 'image' && !imageData) { alert('이미지를 업로드하세요'); return }
    onPurchase({ contentType, text, textColor, fontSize, imageData, days })
  }

  const zoneLabel = [
    zoneCounts.a > 0 ? `A×${zoneCounts.a}` : null,
    zoneCounts.b > 0 ? `B×${zoneCounts.b}` : null,
    zoneCounts.c > 0 ? `C×${zoneCounts.c}` : null,
  ].filter(Boolean).join(' / ')

  const sec: React.CSSProperties = {
    padding: '8px 12px',
    borderRight: '1px solid #ddd',
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  }

  const secTitle: React.CSSProperties = {
    fontSize: 10,
    color: '#888',
    fontWeight: 'bold',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  }

  const inp: React.CSSProperties = {
    fontFamily: 'Arial, sans-serif',
    fontSize: 12,
    border: '1px solid #bbb',
    padding: '2px 5px',
    outline: 'none',
    background: '#fff',
    width: '100%',
  }

  const btn: React.CSSProperties = {
    fontSize: 11,
    padding: '3px 10px',
    border: '1px solid #999',
    background: '#f0f0f0',
    cursor: 'pointer',
    fontFamily: 'Arial, sans-serif',
  }

  return (
    <div style={{
      height: isOpen ? 160 : 0,
      overflow: 'hidden',
      borderTop: isOpen ? '1px solid #aaa' : 'none',
      background: '#f7f7f7',
      transition: 'height 0.15s ease',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Arial, sans-serif',
      fontSize: 12,
    }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid #ccc', background: '#eee', flexShrink: 0, height: 24 }}>
        <div style={{ padding: '0 14px', fontSize: 11, fontWeight: 'bold', display: 'flex', alignItems: 'center', borderRight: '1px solid #ccc', background: '#f7f7f7', borderBottom: '1px solid #f7f7f7', marginBottom: -1 }}>
          셀 편집
        </div>
        <div style={{ marginLeft: 'auto', padding: '0 14px', fontSize: 11, color: '#c00', fontWeight: 'bold', borderLeft: '1px solid #ccc', display: 'flex', alignItems: 'center' }}>
          {selectedCount}칸 선택됨
        </div>
        <div
          onClick={onClose}
          style={{ padding: '0 12px', fontSize: 13, cursor: 'pointer', borderLeft: '1px solid #ccc', display: 'flex', alignItems: 'center' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#e0e0e0')}
          onMouseLeave={e => (e.currentTarget.style.background = '')}
        >
          ×
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Zone info + type selector */}
        <div style={{ ...sec, minWidth: 120 }}>
          <div style={secTitle}>영역</div>
          <div style={{ fontSize: 10, color: '#555', lineHeight: 1.7 }}>
            {zoneLabel || '—'}<br />
            <span style={{ color: '#888' }}>7일 {formatKRW(base7)}</span>
          </div>
          <div style={{ marginTop: 'auto' }}>
            <select
              value={contentType}
              onChange={e => { setContentType(e.target.value as ContentType); setImageData(null); setText('') }}
              style={{ ...inp, fontSize: 11, padding: '2px 4px' }}
            >
              <option value="text">텍스트</option>
              <option value="image">이미지</option>
            </select>
          </div>
        </div>

        {/* Content input */}
        <div style={{ ...sec, flex: 1, minWidth: 170 }}>
          <div style={secTitle}>내용</div>
          {contentType === 'text' ? (
            <>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="예) 사랑해 김민지"
                style={{ ...inp, resize: 'none', height: 42, fontSize: 11 }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <label style={{ fontSize: 10, color: '#888' }}>크기</label>
                <input type="range" min={10} max={32} value={fontSize} onChange={e => setFontSize(parseInt(e.target.value))} style={{ width: 68 }} />
                <span style={{ fontSize: 10, minWidth: 28 }}>{fontSize}px</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, width: 130 }}>
                {PALETTE.map(color => (
                  <div
                    key={color}
                    onClick={() => setTextColor(color)}
                    style={{
                      width: 14,
                      height: 14,
                      background: color,
                      cursor: 'pointer',
                      border: color === '#ffffff' ? '1px solid #bbb' : '1px solid transparent',
                      outline: color === textColor ? '2px solid #000' : 'none',
                      outlineOffset: 1,
                    }}
                  />
                ))}
              </div>
            </>
          ) : (
            <>
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{ border: '1px dashed #bbb', padding: '4px 8px', fontSize: 10, color: '#888', cursor: 'pointer', textAlign: 'center', background: '#fafafa', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#555')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#bbb')}
              >
                {imageData
                  ? <img src={imageData} style={{ maxHeight: 48, maxWidth: '100%', objectFit: 'contain' }} alt="" />
                  : '[ 클릭하여 이미지 업로드 ]'}
              </div>
              {imageData && (
                <button onClick={() => setImageData(null)} style={{ ...btn, fontSize: 10, padding: '1px 6px', width: 'fit-content' }}>제거</button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImgFile} style={{ display: 'none' }} />
            </>
          )}
        </div>

        {/* Mini preview */}
        <div style={{ ...sec, minWidth: 90 }}>
          <div style={secTitle}>미리보기</div>
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 1, padding: 4,
            border: '1px solid #ccc', background: '#fff',
            minWidth: 68, minHeight: 44, maxHeight: 84,
            overflow: 'hidden', alignContent: 'flex-start',
          }}>
            {contentType === 'text' && text.length > 0
              ? text.split('').map((ch, i) => (
                  <div key={i} style={{
                    width: 18, height: 18,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: Math.min(fontSize, 13), fontWeight: 'bold',
                    background: textColor, color: getFgColor(textColor),
                    border: '1px solid rgba(0,0,0,.15)',
                  }}>
                    {ch}
                  </div>
                ))
              : contentType === 'image' && imageData
              ? <img src={imageData} style={{ maxHeight: 60, maxWidth: '100%', objectFit: 'contain' }} alt="" />
              : <span style={{ fontSize: 10, color: '#bbb', padding: 2, alignSelf: 'center' }}>입력 대기</span>
            }
          </div>
        </div>

        {/* Duration */}
        <div style={{ ...sec, minWidth: 240 }}>
          <div style={secTitle}>기간</div>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {DURATIONS.map(({ days: d, label, multiplier }) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                style={{
                  fontSize: 10, padding: '2px 6px',
                  border: '1px solid #bbb',
                  background: d === days ? '#000' : '#fff',
                  color: d === days ? '#fff' : '#000',
                  cursor: 'pointer', fontFamily: 'Arial, sans-serif',
                  lineHeight: 1.4,
                }}
              >
                {label}<br />
                <span style={{ fontSize: 9 }}>{formatKRW(Math.round(base7 * multiplier))}</span>
              </button>
            ))}
            <button
              onClick={() => setDays(PERMANENT_DAYS)}
              style={{
                fontSize: 10, padding: '2px 6px',
                border: '1px solid #bbb',
                background: days === PERMANENT_DAYS ? '#000' : '#fff',
                color: days === PERMANENT_DAYS ? '#fff' : '#000',
                cursor: 'pointer', fontFamily: 'Arial, sans-serif',
                lineHeight: 1.4,
              }}
            >
              영구<br />
              <span style={{ fontSize: 9 }}>
                {formatKRW(zoneCounts.a * PERMANENT_PRICES.a + zoneCounts.b * PERMANENT_PRICES.b + zoneCounts.c * PERMANENT_PRICES.c)}
              </span>
            </button>
          </div>
        </div>

        {/* Price + purchase */}
        <div style={{ ...sec, minWidth: 120, justifyContent: 'space-between', borderRight: 'none' }}>
          <div style={secTitle}>결제</div>
          <div>
            <div style={{ fontSize: 10, color: '#888' }}>{days === PERMANENT_DAYS ? '영구보존' : `${days}일 기준`}</div>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#c00', fontFamily: 'Courier New, monospace' }}>
              {formatKRW(totalPrice)}
            </div>
          </div>
          <button
            onClick={handlePurchase}
            style={{ background: '#000', color: '#fff', border: '1px solid #000', fontSize: 12, padding: '5px 14px', cursor: 'pointer', fontFamily: 'Arial, sans-serif' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#333')}
            onMouseLeave={e => (e.currentTarget.style.background = '#000')}
          >
            결제하기 →
          </button>
        </div>
      </div>
    </div>
  )
}
