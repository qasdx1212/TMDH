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
  const [bizOpen, setBizOpen] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const totalCells = 80000
  const occupiedHouses = houses.filter(h => h.status === 'occupied')
  const occupiedCount = occupiedHouses.length   // 입주 칸 수(위성칸 포함) — 분양률·남은칸 계산용
  const occupancyRate = ((occupiedCount / totalCells) * 100).toFixed(1)

  const topAreas = [...occupiedHouses]
    .sort((a, b) => b.visit_count - a.visit_count)
    .slice(0, 5)
    .map((h, i) => ({ name: h.name ?? h.nickname ?? h.address, zone: h.zone, count: h.visit_count, rank: i + 1 }))

  useEffect(() => {
    // 최근 입주자도 마스킹 뷰에서 — 비공개 집은 이름이 null 로 내려와 '이름 없음'으로 표시됨
    supabase.from('public_houses').select('id, name, nickname, zone, occupied_at')
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


  return (
    <div style={{ background:'#ffffff' }}>
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

      {/* 분양 현황 — 분양률 */}
      <div style={{ padding:'10px 14px', borderRight:'1px solid #e9e7e4', display:'flex', flexDirection:'column', gap:6, justifyContent:'center' }}>
        <PanelLabel>실시간 분양 현황</PanelLabel>
        <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
          <span style={{ fontSize:34, fontWeight:800, color:'#1a1a1a', lineHeight:1 }}>{occupancyRate}</span>
          <span style={{ fontSize:16, fontWeight:700, color:'#6f6d6a' }}>%</span>
          <span style={{ fontSize:11, color:'#97948f', marginLeft:2 }}>분양됨</span>
        </div>
        {/* 진행 바 */}
        <div style={{ height:8, borderRadius:999, background:'#f0efec', overflow:'hidden', marginTop:2 }}>
          <div style={{ height:'100%', width:`${occupancyRate}%`, minWidth: occupiedCount > 0 ? 3 : 0, background:'#a1834a', borderRadius:999 }} />
        </div>
        <div style={{ fontSize:11, color:'#6f6d6a' }}>
          {occupiedCount.toLocaleString()}칸 분양 · {(totalCells - occupiedCount).toLocaleString()}칸 남음
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
    </div>

    {/* 사업자정보 푸터 (전자상거래법 제10조 표시 의무 — 항상 DOM에 존재, 접힘 시 시각적으로만 숨김) */}
    <div style={{
      position:'relative',
      height:28, boxSizing:'border-box',
      borderTop:'1px solid #e9e7e4', background:'#ffffff',
      padding:'0 16px',
      display:'flex', alignItems:'center', gap:10,
      fontSize:10, color:'#6f6d6a', whiteSpace:'nowrap',
    }}>
      <button
        type="button"
        onClick={() => setBizOpen(v => !v)}
        aria-expanded={bizOpen}
        aria-controls="biz-info-panel"
        style={{
          display:'flex', alignItems:'center', gap:4,
          padding:'2px 8px', height:18,
          borderRadius:8, border:'1px solid #e9e7e4',
          background: bizOpen ? '#1c1c1e' : '#ffffff',
          color: bizOpen ? '#ffffff' : '#1a1a1a',
          fontSize:10, fontWeight:600, lineHeight:1,
          cursor:'pointer', flexShrink:0,
        }}
      >
        사업자정보
        <span style={{ fontSize:8, transform: bizOpen ? 'rotate(180deg)' : 'none', lineHeight:1 }}>▾</span>
      </button>

      <span style={{ color:'#e9e7e4' }}>|</span>

      <a href="/terms" style={footerLinkStyle}>이용약관</a>
      <span style={{ color:'#e9e7e4' }}>·</span>
      <a href="/privacy" style={footerLinkStyle}>개인정보처리방침</a>
      <span style={{ color:'#e9e7e4' }}>·</span>
      <a href="/terms?tab=refund" style={footerLinkStyle}>환불정책</a>

      {/* 펼침 팝오버 — absolute(위로 열림)라 푸터 높이(28px)는 그대로 유지됨 */}
      <div
        id="biz-info-panel"
        style={{
          position:'absolute', bottom:'calc(100% + 8px)', left:12,
          maxWidth:'min(680px, calc(100vw - 24px))',
          background:'#ffffff',
          border:'1px solid #e9e7e4', borderRadius:14,
          boxShadow:'0 4px 20px rgba(0,0,0,0.08)',
          padding:'14px 16px',
          fontSize:11, color:'#6f6d6a', lineHeight:1.9,
          whiteSpace:'normal',
          visibility: bizOpen ? 'visible' : 'hidden',
          opacity: bizOpen ? 1 : 0,
          pointerEvents: bizOpen ? 'auto' : 'none',
          transition:'opacity 120ms ease',
          zIndex:20,
        }}
      >
        <div style={{ fontSize:12, fontWeight:700, color:'#1a1a1a', marginBottom:8 }}>
          스트릿애드 (StreetAd)
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'auto 1fr', columnGap:14, rowGap:2 }}>
          {[
            ['대표자', '이승원'],
            ['사업자등록번호', '593-17-02833'],
            ['통신판매업신고번호', '제 2026-의정부흥선-0490 호'],
            ['주소', '경기도 의정부시 태평로 13, 14층 1401호'],
            ['전화', '0502-1946-1697'],
            ['이메일', 'qasdx1212@gmail.com'],
          ].map(([label, value]) => (
            <div key={label} style={{ display:'contents' }}>
              <span style={{ color:'#97948f', whiteSpace:'nowrap' }}>{label}</span>
              <span style={{ color:'#1a1a1a' }}>{value}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop:10, paddingTop:10, borderTop:'1px solid #e9e7e4' }}>
          <div style={{ fontSize:11, fontWeight:600, color:'#1a1a1a' }}>
            집.zip 디지털 공간 이용권 — 1칸(픽셀) 1,000원~
          </div>
          <div style={{ marginTop:2 }}>
            영구 입주 (만료·갱신 없음) / 이펙트(네온 테두리) 선택 시 추가금 1,000원
          </div>
        </div>
      </div>
    </div>
    </div>
  )
}

const footerLinkStyle: React.CSSProperties = {
  color:'#6f6d6a', textDecoration:'none', flexShrink:0,
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
