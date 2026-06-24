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

    // 배경
    ctx.fillStyle = '#fdf6e3'
    ctx.fillRect(0, 0, W, H)

    // 격자 배경
    ctx.strokeStyle = '#c8a96e22'
    ctx.lineWidth = 1
    for (let x = 0; x < W; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
    for (let y = 0; y < H; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }

    // 외부 테두리
    ctx.strokeStyle = '#7a4f1a'; ctx.lineWidth = 5
    ctx.strokeRect(4, 4, W - 8, H - 8)
    ctx.strokeStyle = '#c8a96e'; ctx.lineWidth = 2
    ctx.strokeRect(14, 14, W - 28, H - 28)

    // 코너 장식
    const corners = [[22, 22], [W - 22, 22], [22, H - 22], [W - 22, H - 22]]
    corners.forEach(([x, y]) => {
      ctx.fillStyle = '#8b6914'
      ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#fdf6e3'
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill()
    })

    // 헤더 띠
    ctx.fillStyle = '#3d2008'
    ctx.fillRect(14, 14, W - 28, 44)

    ctx.fillStyle = '#c8a96e'
    ctx.font = 'bold 15px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('집.zip — 디지털 부동산 기부 증서', W / 2, 36)

    // 집 이모지 영역
    ctx.font = '56px serif'
    ctx.textAlign = 'center'
    ctx.fillText('🏠', W / 2, 118)

    // 집 이름
    ctx.fillStyle = '#2a1505'
    ctx.font = 'bold 28px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(house.name ?? '이름 없는 집', W / 2, 168)

    // 주소 배지
    ctx.fillStyle = '#3d2008'
    drawRoundRect(ctx, W / 2 - 75, 182, 150, 28, 14)
    ctx.fill()
    ctx.fillStyle = '#ffd700'
    ctx.font = 'bold 13px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(house.address, W / 2, 196)

    // 구분선
    ctx.strokeStyle = '#c8a96e55'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(60, 224); ctx.lineTo(W - 60, 224); ctx.stroke()

    // 상세 정보
    const occupiedDate = house.occupied_at ? house.occupied_at.slice(0, 10) : '—'
    const expiresDate = house.is_permanent ? '♾ 영구 보존' : (house.expires_at ? house.expires_at.slice(0, 10) : '—')
    const cellCount = (house.width ?? 1) * (house.height ?? 1)
    const details: [string, string][] = [
      ['입주일', occupiedDate],
      ['만료일', expiresDate],
      ['면적', `${house.width ?? 1} × ${house.height ?? 1} 칸 (${cellCount * 100}px²)`],
      ['구역', house.zone ?? '—'],
    ]

    details.forEach(([label, value], i) => {
      const y = 252 + i * 28
      ctx.fillStyle = '#a08060'; ctx.font = '12px sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
      ctx.fillText(label, W / 2 - 16, y)
      ctx.fillStyle = '#3d2a18'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'left'
      ctx.fillText(value, W / 2 + 16, y)
    })

    // 구분선
    ctx.strokeStyle = '#c8a96e55'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(60, 368); ctx.lineTo(W - 60, 368); ctx.stroke()

    // 푸터
    ctx.fillStyle = '#8b6914'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('이 증서는 집.zip (zipzipworld.com) 에서 디지털 공간을 분양받은 증서입니다.', W / 2, 385)
    ctx.fillText(`발급일: ${new Date().toLocaleDateString('ko-KR')}`, W / 2, 402)

    // 도장
    ctx.save()
    ctx.translate(W - 72, H - 76)
    ctx.rotate(-0.28)
    ctx.strokeStyle = '#ef444488'; ctx.lineWidth = 2.5
    ctx.strokeRect(-38, -20, 76, 40)
    ctx.fillStyle = '#ef4444aa'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('✓ 확인됨', 0, 0)
    ctx.restore()
  }, [house])

  const handleDownload = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `집zip-기부증서-${house.address}.png`
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
      style={{ position: 'fixed', inset: 0, zIndex: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 660, maxWidth: '96vw', maxHeight: '92vh',
          display: 'flex', flexDirection: 'column',
          background: '#fdf6e3', borderRadius: 12,
          border: '4px solid #7a4f1a',
          boxShadow: '0 0 0 2px #e8c97a, 0 0 0 5px #7a4f1a, 0 24px 70px rgba(0,0,0,0.7)',
          fontFamily: '"Noto Sans KR", sans-serif', overflow: 'hidden',
        }}
      >
        <div style={{ background: 'linear-gradient(180deg,#f5ead5,#ecdcc0)', padding: '14px 20px', borderBottom: '3px solid #c8a96e', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#2a1505' }}>📜 기부 증서</div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: '50%', background: '#ef4444', border: '2px solid #b91c1c', color: '#fff', fontSize: 16, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          <div style={{ borderRadius: 10, overflow: 'hidden', border: '2.5px solid #8b6914', marginBottom: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <canvas ref={canvasRef} style={{ display: 'block', width: '100%', imageRendering: 'auto' }} />
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={handleDownload} style={{
              flex: 2, padding: '11px', borderRadius: 8,
              background: 'linear-gradient(180deg,#8b6914,#6b4c10)',
              border: '2px solid #c8a96e', color: '#fdf6e3',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>⬇️ PNG 다운로드</button>

            <button onClick={handleShare} style={{
              flex: 2, padding: '11px', borderRadius: 8,
              background: copied || shared ? '#22c55e18' : 'transparent',
              border: `2px solid ${copied || shared ? '#22c55e' : '#4a3010'}`,
              color: copied || shared ? '#22c55e' : '#d4b483',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>{copied ? '✅ 링크 복사됨' : shared ? '✅ 공유 완료' : '🔗 공유하기'}</button>

            <button onClick={handleTwitter} style={{
              flex: 1, padding: '11px 12px', borderRadius: 8,
              background: 'transparent', border: '2px solid #4a3010',
              color: '#d4b483', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>𝕏</button>
          </div>
        </div>

        <div style={{ height: 8, background: 'repeating-linear-gradient(90deg,#4a7c3f 0,#4a7c3f 5px,#3d6b34 5px,#3d6b34 10px)', borderTop: '2px solid #2d5226' }} />
      </div>
    </div>
  )
}
