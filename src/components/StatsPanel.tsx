'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { ZONES } from '@/lib/constants'
import type { CellData } from '@/types/cell'

interface StatsPanelProps {
  houses: CellData[]
  mapViewport?: { scale: number; offset: { x: number; y: number }; containerW: number; containerH: number; mapW?: number } | null
  onZoomIn?: () => void
  onZoomOut?: () => void
  onFitView?: () => void
}

interface RecentHouse {
  id: string
  name: string | null
  nickname: string | null
  zone: string
  occupied_at: string | null
}

export default function StatsPanel({ houses, mapViewport, onZoomIn, onZoomOut, onFitView }: StatsPanelProps) {
  const [recentHouses, setRecentHouses] = useState<RecentHouse[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const donutRef = useRef<HTMLCanvasElement>(null)

  const totalCells = 80000
  const occupiedHouses = houses.filter(h => h.status === 'occupied')
  const occupiedCount = occupiedHouses.length
  const pendingCount = houses.filter(h => h.status === 'pending').length
  const availableCount = totalCells - occupiedCount - pendingCount
  const occupancyRate = ((occupiedCount / totalCells) * 100).toFixed(1)

  const topAreas = [...occupiedHouses]
    .sort((a, b) => b.visit_count - a.visit_count)
    .slice(0, 5)
    .map((h, i) => ({ name: h.name ?? h.nickname ?? h.address, zone: h.zone, count: h.visit_count, rank: i + 1 }))

  useEffect(() => {
    supabase.from('houses').select('id, name, nickname, zone, occupied_at')
      .eq('status', 'occupied').order('occupied_at', { ascending: false }).limit(5)
      .then(({ data }) => setRecentHouses((data ?? []) as RecentHouse[]))
  }, [houses])

  // 미니맵 (뷰포트 표시 포함)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = 120, H = 60      // 실제 지도와 동일한 2:1 비율
    const CELL = 5
    const SX = 120 / 400, SY = 60 / 200  // 400cols→120px, 200rows→60px (둘 다 0.3)
    ctx.clearRect(0, 0, W, H)

    // 배경 (단일 색상)
    ctx.fillStyle = '#eceae6'
    ctx.fillRect(0, 0, W, H)

    // 입주 셀
    for (const h of houses) {
      if (h.status !== 'occupied') continue
      ctx.fillStyle = '#a1834a'
      ctx.fillRect(h.col * SX, h.row * SY, Math.max((h.width ?? 1) * SX, 0.5), Math.max((h.height ?? 1) * SY, 0.5))
    }

    // 뷰포트 표시: 바깥을 어둡게, 안쪽을 창문처럼
    if (mapViewport) {
      const { scale, offset, containerW, containerH } = mapViewport
      const rx = Math.max(0, -offset.x / (scale * CELL) * SX)
      const ry = Math.max(0, -offset.y / (scale * CELL) * SY)
      const rw = Math.min(containerW / (scale * CELL) * SX, W - rx)
      const rh = Math.min(containerH / (scale * CELL) * SY, H - ry)

      // 뷰포트 밖 어두운 오버레이
      ctx.fillStyle = 'rgba(28,28,30,0.28)'
      ctx.fillRect(0, 0, W, ry)               // 위
      ctx.fillRect(0, ry + rh, W, H - ry - rh) // 아래
      ctx.fillRect(0, ry, rx, rh)             // 왼쪽
      ctx.fillRect(rx + rw, ry, W - rx - rw, rh) // 오른쪽

      // 뷰포트 테두리
      ctx.strokeStyle = '#1a1a1a'
      ctx.lineWidth = 1
      ctx.strokeRect(rx, ry, rw, rh)
    }
  }, [houses, mapViewport])

  // 도넛 차트
  useEffect(() => {
    const canvas = donutRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const sz = canvas.width, cx = sz / 2, cy = sz / 2
    const r = sz / 2 - 4, innerR = r * 0.55
    const segments = [
      { value: occupiedCount, color: '#16a34a' },
      { value: pendingCount, color: '#2563eb' },
      { value: availableCount, color: '#e9e7e4' },
    ]
    const total = segments.reduce((s, seg) => s + seg.value, 0) || 1
    ctx.clearRect(0, 0, sz, sz)
    let start = -Math.PI / 2
    for (const seg of segments) {
      const sweep = (seg.value / total) * 2 * Math.PI
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, r, start, start + sweep)
      ctx.closePath()
      ctx.fillStyle = seg.color
      ctx.fill()
      start += sweep
    }
    ctx.beginPath()
    ctx.arc(cx, cy, innerR, 0, 2 * Math.PI)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.font = `bold ${sz * 0.14}px sans-serif`
    ctx.fillStyle = '#1a1a1a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(`${occupancyRate}%`, cx, cy)
  }, [occupiedCount, pendingCount, availableCount, occupancyRate])

  return (
    <div style={{ overflowX:'auto', borderTop:'1px solid #e9e7e4' }}>
    <div style={{
      display:'grid', gridTemplateColumns:'156px 340px 1fr 1fr',
      background:'#ffffff',
      height:160, minWidth:720,   // 미니맵(60) + 줌버튼(28) + 라벨/여백 수용
    }}>
      {/* 미니맵 + 줌 컨트롤 */}
      <div style={{ padding:'10px 12px', borderRight:'1px solid #e9e7e4', display:'flex', flexDirection:'column', gap:6 }}>
        <PanelLabel>미니맵</PanelLabel>
        <canvas ref={canvasRef} width={120} height={60} style={{ width:120, height:60, borderRadius:10, border:'1px solid #e9e7e4', imageRendering:'pixelated', flexShrink:0 }} />
        <div style={{ display:'flex', alignItems:'center', gap:6, width:120 }}>
          <button onClick={onZoomIn} style={zoomBtnStyle} title="확대">+</button>
          <button onClick={onZoomOut} style={zoomBtnStyle} title="축소">−</button>
          <button onClick={onFitView} style={{ ...zoomBtnStyle, fontSize:13 }} title="전체 보기">⤢</button>
        </div>
      </div>

      {/* 분양 현황 — 도넛 차트 */}
      <div style={{ padding:'10px 14px', borderRight:'1px solid #e9e7e4', display:'flex', flexDirection:'column', gap:6 }}>
        <PanelLabel>실시간 분양 현황</PanelLabel>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <canvas ref={donutRef} width={80} height={80} style={{ flexShrink:0 }} />
          <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
            {[
              { label:'분양 완료', value: occupiedCount, color:'#16a34a' },
              { label:'판매 중',   value: pendingCount,  color:'#2563eb' },
              { label:'관심 구역', value: availableCount, color:'#e9e7e4' },
            ].map(item => (
              <div key={item.label} style={{ display:'flex', alignItems:'center', gap:4, whiteSpace:'nowrap', flexShrink:0 }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:item.color, flexShrink:0 }} />
                <span style={{ fontSize:10, color:'#6f6d6a' }}>{item.label}</span>
                <span style={{ fontSize:10, fontWeight:600, color:'#1a1a1a' }}>{((item.value/totalCells)*100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 인기 지역 */}
      <div style={{ padding:'10px 16px', borderRight:'1px solid #e9e7e4', display:'flex', flexDirection:'column', gap:5 }}>
        <PanelLabel>인기 지역 TOP 5 (방문자 수 기준)</PanelLabel>
        {topAreas.length === 0 ? (
          <div style={{ fontSize:11, color:'#6f6d6a', marginTop:8 }}>아직 방문 데이터가 없어요</div>
        ) : topAreas.map(area => (
          <div key={area.rank} style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:10, fontWeight:700, width:18, height:18, borderRadius:'50%', background:'#f4f3f1', color:'#1a1a1a', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{area.rank}</span>
            <span style={{ fontSize:9, color:ZONES[area.zone as keyof typeof ZONES]?.color ?? '#1a1a1a' }}>●</span>
            <span style={{ fontSize:11, color:'#1a1a1a', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{area.name}</span>
            <span style={{ fontSize:10, color:'#6f6d6a', flexShrink:0 }}>{area.count.toLocaleString()}</span>
          </div>
        ))}
      </div>

      {/* 최근 입주자 */}
      <div style={{ padding:'10px 16px', display:'flex', flexDirection:'column', gap:5 }}>
        <PanelLabel>최근 입주자</PanelLabel>
        {recentHouses.length === 0 ? (
          <div style={{ fontSize:11, color:'#6f6d6a', marginTop:8 }}>첫 번째 입주자가 되어보세요!</div>
        ) : recentHouses.map(h => (
          <div key={h.id} style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:9, fontWeight:600, padding:'1px 7px', borderRadius:8, background:'#f4f3f1', color:'#6f6d6a', border:'1px solid #e9e7e4', flexShrink:0 }}>new</span>
            <span style={{ fontSize:11, color:'#1a1a1a', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{h.name ?? h.nickname ?? '이름 없음'}</span>
            <span style={{ fontSize:10, color:'#6f6d6a', flexShrink:0 }}>{h.occupied_at ? getTimeAgo(h.occupied_at) : ''}</span>
          </div>
        ))}
      </div>
    </div>
    {/* 사업자정보 + 상품/요금 (PG 심사·전자상거래법 표기) */}
    <div style={{
      background:'#ffffff', borderTop:'1px solid #e9e7e4',
      padding:'8px 16px', fontSize:10, color:'#6f6d6a',
      whiteSpace:'nowrap', overflowX:'auto', minWidth:720,
    }}>
      <strong style={{ color:'#1a1a1a', fontWeight:600 }}>스트릿애드 (StreetAd)</strong>
      {' · 대표 이승원 · 사업자등록번호 593-17-02833 · 경기도 의정부시 태평로 13, 14층 1401호 · 전화 0502-1946-1697 · '}
      qasdx1212@gmail.com
      {' · 통신판매업신고 신고 중 · '}
      <strong style={{ color:'#1a1a1a', fontWeight:600 }}>집.zip 디지털 공간 이용권 1칸(픽셀) 1,000원~ (이용기간 30일·90일·180일·365일·영구)</strong>
      {' · '}
      <a href="/terms" style={{ color:'#6f6d6a', textDecoration:'none' }}>이용약관</a>
      {' · '}
      <a href="/privacy" style={{ color:'#6f6d6a', textDecoration:'none' }}>개인정보처리방침</a>
      {' · '}
      <a href="/terms?tab=refund" style={{ color:'#6f6d6a', textDecoration:'none' }}>환불정책</a>
    </div>
    </div>
  )
}

const zoomBtnStyle: React.CSSProperties = {
  width:28, height:28, borderRadius:8, border:'1px solid #e0ddd9',
  background:'#ffffff', color:'#1a1a1a',
  fontSize:15, fontWeight:600, cursor:'pointer',
  display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1,
  padding:0, flexShrink:0,
}

function PanelLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize:10, fontWeight:600, color:'#6f6d6a', letterSpacing:'0.01em', marginBottom:4 }}>{children}</div>
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}분 전`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}시간 전`
  return `${Math.floor(hours / 24)}일 전`
}
