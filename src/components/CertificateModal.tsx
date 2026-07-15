'use client'

import { useEffect, useRef, useState } from 'react'
import type { CellData } from '@/types/cell'

interface CertificateModalProps {
  house: CellData
  onClose: () => void
}

function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

export default function CertificateModal({ house, onClose }: CertificateModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [copied, setCopied] = useState(false)
  const [shared, setShared] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = 600, H = 420
    canvas.width = W; canvas.height = H

    const SANS = "'Pretendard', system-ui, -apple-system, sans-serif"

    // 배경
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, W, H)

    // 외부 테두리 (얇은 라운드)
    drawRoundRect(ctx, 12, 12, W - 24, H - 24, 16)
    ctx.strokeStyle = '#e9e7e4'; ctx.lineWidth = 1.5
    ctx.stroke()

    // 헤더
    ctx.fillStyle = '#6f6d6a'
    ctx.font = `600 13px ${SANS}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('집.zip · 디지털 공간 소유 증서', W / 2, 52)

    // 집 이름
    ctx.fillStyle = '#1a1a1a'
    ctx.font = `700 30px ${SANS}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(house.name ?? '이름 없는 집', W / 2, 118)

    // 주소 배지 (라이트 채움 + 옅은 테두리, 라운드)
    drawRoundRect(ctx, W / 2 - 80, 148, 160, 30, 8)
    ctx.fillStyle = '#f4f3f1'
    ctx.fill()
    ctx.strokeStyle = '#e9e7e4'; ctx.lineWidth = 1
    ctx.stroke()
    ctx.fillStyle = '#1a1a1a'
    ctx.font = `600 13px ${SANS}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(house.address, W / 2, 163)

    // 구분선
    ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(70, 206); ctx.lineTo(W - 70, 206); ctx.stroke()

    // 상세 정보
    const occupiedDate = house.occupied_at ? house.occupied_at.slice(0, 10) : '—'
    const expiresDate = house.is_permanent ? '영구 보존' : (house.expires_at ? house.expires_at.slice(0, 10) : '—')
    const cellCount = (house.width ?? 1) * (house.height ?? 1)
    const details: [string, string][] = [
      ['입주일', occupiedDate],
      ['만료일', expiresDate],
      ['면적', `${house.width ?? 1} × ${house.height ?? 1} 칸 (${cellCount * 100}px²)`],
      ['구역', house.zone ?? '—'],
    ]

    details.forEach(([label, value], i) => {
      const y = 238 + i * 30
      ctx.fillStyle = '#6f6d6a'; ctx.font = `12px ${SANS}`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
      ctx.fillText(label, W / 2 - 16, y)
      ctx.fillStyle = '#1a1a1a'; ctx.font = `600 13px ${SANS}`; ctx.textAlign = 'left'
      ctx.fillText(value, W / 2 + 16, y)
    })

    // 구분선
    ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(70, 360); ctx.lineTo(W - 70, 360); ctx.stroke()

    // 푸터
    ctx.fillStyle = '#97948f'; ctx.font = `10px ${SANS}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('이 증서는 집.zip (zipzipworld.com) 에서 디지털 공간을 분양받은 증서입니다.', W / 2, 382)
    ctx.fillText(`발급일: ${new Date().toLocaleDateString('ko-KR')}`, W / 2, 399)

    // 도장 (차분한 원형 씰)
    ctx.save()
    ctx.translate(W - 74, H - 116)
    ctx.strokeStyle = '#d5d2ce'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = '#97948f'; ctx.font = `600 12px ${SANS}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('확인', 0, 0)
    ctx.restore()
  }, [house])

  const handleDownload = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `집zip-소유증서-${house.address}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const handleShare = async () => {
    const url = `${window.location.origin}?house=${house.address}`
    if (navigator.share) {
      try {
        await navigator.share({ title: `집.zip — ${house.name ?? house.address}`, text: `집.zip에서 내 디지털 공간을 만들었어요!`, url })
        setShared(true); setTimeout(() => setShared(false), 2000)
      } catch { /* 취소 */ }
    } else {
      navigator.clipboard.writeText(url)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleTwitter = () => {
    const url = `${window.location.origin}?house=${house.address}`
    const text = `집.zip에서 내 디지털 공간을 분양받았어요! 🏠\n${house.name ?? house.address}`
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank')
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 660, maxWidth: '96vw', maxHeight: '92vh',
          display: 'flex', flexDirection: 'column',
          background: '#ffffff', borderRadius: 14,
          border: '1px solid #e9e7e4',
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e9e7e4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>소유 증서</div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 10, background: '#f4f3f1', border: '1px solid #e9e7e4', color: '#6f6d6a', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid #e9e7e4', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <canvas ref={canvasRef} style={{ display: 'block', width: '100%', imageRendering: 'auto' }} />
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={handleDownload} style={{
              flex: 2, padding: '12px', borderRadius: 10,
              background: '#1c1c1e',
              border: 'none', color: '#ffffff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>PNG 다운로드</button>

            <button onClick={handleShare} style={{
              flex: 2, padding: '12px', borderRadius: 10,
              background: '#ffffff',
              border: '1px solid #e0ddd9',
              color: '#1a1a1a',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>{copied ? '링크 복사됨' : shared ? '공유 완료' : '공유하기'}</button>

            <button onClick={handleTwitter} style={{
              flex: 1, padding: '12px', borderRadius: 10,
              background: '#ffffff', border: '1px solid #e0ddd9',
              color: '#1a1a1a', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>𝕏</button>
          </div>
        </div>
      </div>
    </div>
  )
}
