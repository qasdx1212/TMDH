'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { ZONES } from '@/lib/constants'
import type { CellData } from '@/types/cell'

interface StatsPanelProps {
  houses: CellData[]
}

interface RecentHouse {
  id: string
  name: string | null
  nickname: string | null
  zone: string
  occupied_at: string | null
}

export default function StatsPanel({ houses }: StatsPanelProps) {
  const [recentHouses, setRecentHouses] = useState<RecentHouse[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const donutRef = useRef<HTMLCanvasElement>(null)

  const totalCells = 10000
  const occupiedHouses = houses.filter(h => h.status === 'occupied')
  const occupiedCount = occupiedHouses.length
  const pendingCount = houses.filter(h => h.status === 'pending').length
  const availableCount = totalCells - occupiedCount - pendingCount
  const occupancyRate = ((occupiedCount / totalCells) * 100).toFixed(1)

  const zoneSums: Record<string, number> = {}
  occupiedHouses.forEach(h => { zoneSums[h.zone] = (zoneSums[h.zone] ?? 0) + h.visit_count })
  const topAreas = Object.entries(zoneSums)
    .sort(([, a], [, b]) => b - a)
    .map(([zone, count], i) => ({ zone, count, rank: i + 1 }))

  useEffect(() => {
    supabase.from('houses').select('id, name, nickname, zone, occupied_at')
      .eq('status', 'occupied').order('occupied_at', { ascending: false }).limit(5)
      .then(({ data }) => setRecentHouses((data ?? []) as RecentHouse[]))
  }, [houses])

  // 미니맵
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, 100, 100)
    const zoneKeys = Object.keys(ZONES) as Array<keyof typeof ZONES>
    for (const key of zoneKeys) {
      const z = ZONES[key]
      ctx.fillStyle = z.bg
      ctx.fillRect(z.colMin, z.rowMin, z.colMax - z.colMin + 1, z.rowMax - z.rowMin + 1)
    }
    for (const h of houses) {
      if (h.status !== 'occupied') continue
      const z = ZONES[h.zone as keyof typeof ZONES]
      if (!z) continue
      ctx.fillStyle = z.color
      ctx.fillRect(h.col, h.row, h.width ?? 1, h.height ?? 1)
    }
  }, [houses])

  // 도넛 차트
  useEffect(() => {
    const canvas = donutRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const sz = canvas.width, cx = sz / 2, cy = sz / 2
    const r = sz / 2 - 4, innerR = r * 0.55
    const segments = [
      { value: occupiedCount, color: '#22c55e' },
      { value: pendingCount, color: '#3b82f6' },
      { value: availableCount, color: '#4a3520' },
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
    ctx.fillStyle = '#1a0f05'
    ctx.fill()
    ctx.font = `bold ${sz * 0.14}px sans-serif`
    ctx.fillStyle = '#4ade80'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(`${occupancyRate}%`, cx, cy)
  }, [occupiedCount, pendingCount, availableCount, occupancyRate])

  return (
    <div style={{ overflowX:'auto', borderTop:'3px solid #8b6914', boxShadow:'0 -4px 20px rgba(0,0,0,0.5)' }}>
    <div style={{
      display:'grid', gridTemplateColumns:'140px 200px 1fr 1fr',
      background:'linear-gradient(180deg,#2a1a08 0%,#1a0f05 100%)',
      height:148, minWidth:580,
      fontFamily:'"Noto Sans KR",-apple-system,sans-serif',
    }}>
      {/* 미니맵 */}
      <div style={{ padding:'10px 12px', borderRight:'1px solid #8b691430', display:'flex', flexDirection:'column', gap:6 }}>
        <PanelLabel>🗺️ 미니맵</PanelLabel>
        <canvas ref={canvasRef} width={100} height={100} style={{ width:110, height:110, borderRadius:4, border:'2px solid #8b6914', imageRendering:'pixelated', flexShrink:0 }} />
      </div>

      {/* 분양 현황 — 도넛 차트 */}
      <div style={{ padding:'10px 14px', borderRight:'1px solid #8b691430', display:'flex', flexDirection:'column', gap:6 }}>
        <PanelLabel>📊 실시간 분양 현황</PanelLabel>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <canvas ref={donutRef} width={80} height={80} style={{ flexShrink:0 }} />
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            {[
              { label:'분양 완료', value: occupiedCount, color:'#22c55e' },
              { label:'판매 중',   value: pendingCount,  color:'#3b82f6' },
              { label:'관심 구역', value: availableCount, color:'#4a3520' },
            ].map(item => (
              <div key={item.label} style={{ display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ width:8, height:8, borderRadius:2, background:item.color, flexShrink:0 }} />
                <span style={{ fontSize:10, color:'#a08060', flex:1 }}>{item.label}</span>
                <span style={{ fontSize:11, fontWeight:700, color:'#fdf6e3' }}>{((item.value/totalCells)*100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 인기 지역 */}
      <div style={{ padding:'10px 16px', borderRight:'1px solid #8b691430', display:'flex', flexDirection:'column', gap:5 }}>
        <PanelLabel>🏆 인기 지역 TOP 5 (방문자 수 기준)</PanelLabel>
        {topAreas.length === 0 ? (
          <div style={{ fontSize:11, color:'#5a3e1a', marginTop:8 }}>아직 방문 데이터가 없어요</div>
        ) : topAreas.slice(0, 5).map(area => (
          <div key={area.zone} style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:10, fontWeight:800, width:18, height:18, borderRadius:4, background:'#3d2a18', color:'#c8a96e', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{area.rank}</span>
            <span style={{ fontSize:9, color:ZONES[area.zone as keyof typeof ZONES]?.color ?? '#fff' }}>●</span>
            <span style={{ fontSize:11, color:'#d4b47a', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ZONES[area.zone as keyof typeof ZONES]?.label ?? area.zone}</span>
            <span style={{ fontSize:10, color:'#78614a', flexShrink:0 }}>👣 {area.count.toLocaleString()}</span>
          </div>
        ))}
      </div>

      {/* 최근 입주자 */}
      <div style={{ padding:'10px 16px', display:'flex', flexDirection:'column', gap:5 }}>
        <PanelLabel>🆕 최근 입주자</PanelLabel>
        {recentHouses.length === 0 ? (
          <div style={{ fontSize:11, color:'#5a3e1a', marginTop:8 }}>첫 번째 입주자가 되어보세요!</div>
        ) : recentHouses.map(h => (
          <div key={h.id} style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:8, fontWeight:800, padding:'1px 5px', borderRadius:3, background:'#22c55e22', color:'#22c55e', border:'1px solid #22c55e44', flexShrink:0 }}>NEW</span>
            <span style={{ fontSize:11, color:'#d4b47a', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{h.name ?? h.nickname ?? '이름 없음'}</span>
            <span style={{ fontSize:10, color:'#5a3e1a', flexShrink:0 }}>{h.occupied_at ? getTimeAgo(h.occupied_at) : ''}</span>
          </div>
        ))}
      </div>
    </div>
    </div>
  )
}

function PanelLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize:10, fontWeight:700, color:'#8b6914', letterSpacing:'0.05em', marginBottom:4 }}>{children}</div>
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}분 전`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}시간 전`
  return `${Math.floor(hours / 24)}일 전`
}
