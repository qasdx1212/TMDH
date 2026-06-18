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

  const totalCells = 10000
  const occupiedHouses = houses.filter(h => h.status === 'occupied')
  const occupiedCount = occupiedHouses.length
  const occupancyRate = ((occupiedCount / totalCells) * 100).toFixed(1)

  // 구역별 방문수 집계
  const zoneSums: Record<string, number> = {}
  occupiedHouses.forEach(h => {
    zoneSums[h.zone] = (zoneSums[h.zone] ?? 0) + h.visit_count
  })
  const topAreas = Object.entries(zoneSums)
    .sort(([, a], [, b]) => b - a)
    .map(([zone, count], i) => ({ zone, count, rank: i + 1 }))

  useEffect(() => {
    supabase.from('houses').select('id, name, nickname, zone, occupied_at')
      .eq('status', 'occupied').order('occupied_at', { ascending: false }).limit(5)
      .then(({ data }) => setRecentHouses((data ?? []) as RecentHouse[]))
  }, [houses])

  // 미니맵 canvas 렌더
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 100×100 canvas, 1px per cell
    ctx.clearRect(0, 0, 100, 100)

    // 존 배경
    const zoneKeys = Object.keys(ZONES) as Array<keyof typeof ZONES>
    for (const key of zoneKeys) {
      const z = ZONES[key]
      ctx.fillStyle = z.bg
      ctx.fillRect(z.colMin, z.rowMin, z.colMax - z.colMin + 1, z.rowMax - z.rowMin + 1)
    }

    // 입주된 칸 dot
    for (const h of houses) {
      if (h.status !== 'occupied') continue
      const z = ZONES[h.zone as keyof typeof ZONES]
      if (!z) continue
      ctx.fillStyle = z.color
      const w = h.width ?? 1, ht = h.height ?? 1
      ctx.fillRect(h.col, h.row, w, ht)
    }
  }, [houses])

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '140px 1fr 1fr 1fr',
      background: 'linear-gradient(180deg, #2a1a08 0%, #1a0f05 100%)',
      borderTop: '3px solid #8b6914',
      height: 148,
      fontFamily: '"Noto Sans KR", -apple-system, sans-serif',
      boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
    }}>
      {/* 미니맵 */}
      <div style={{
        padding: '10px 14px',
        borderRight: '1px solid #8b691430',
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        <PanelLabel>🗺️ 미니맵</PanelLabel>
        <canvas
          ref={canvasRef}
          width={100}
          height={100}
          style={{
            width: 110, height: 110,
            borderRadius: 4,
            border: '2px solid #8b6914',
            imageRendering: 'pixelated',
            flexShrink: 0,
          }}
        />
      </div>

      {/* 분양 현황 */}
      <div style={{ padding: '10px 16px', borderRight: '1px solid #8b691430', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <PanelLabel>📊 분양 현황</PanelLabel>

        {/* 점유율 바 */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: '#d4b47a' }}>점유율</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#fdf6e3' }}>{occupancyRate}%</span>
          </div>
          <div style={{ height: 8, background: '#3d2a18', borderRadius: 4, overflow: 'hidden', border: '1px solid #5a3e1a' }}>
            <div style={{
              height: '100%', borderRadius: 4,
              width: `${occupancyRate}%`,
              background: 'linear-gradient(90deg, #22c55e, #4ade80)',
              transition: 'width 0.5s ease',
            }} />
          </div>
        </div>

        {[
          { label: '입주 완료', value: occupiedCount, color: '#22c55e' },
          { label: '비어있음', value: totalCells - occupiedCount, color: '#5a3e1a' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: item.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: '#a08060', flex: 1 }}>{item.label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#fdf6e3' }}>{item.value.toLocaleString()}</span>
          </div>
        ))}
      </div>

      {/* 인기 지역 */}
      <div style={{ padding: '10px 16px', borderRight: '1px solid #8b691430', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <PanelLabel>🏆 인기 구역 (방문순)</PanelLabel>
        {topAreas.length === 0 ? (
          <div style={{ fontSize: 11, color: '#5a3e1a', marginTop: 8 }}>아직 방문 데이터가 없어요</div>
        ) : topAreas.map(area => (
          <div key={area.zone} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 9, fontWeight: 800, width: 18, height: 18,
              borderRadius: 3, background: '#3d2a18', color: '#c8a96e',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>{area.rank}</span>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 9, color: ZONES[area.zone as keyof typeof ZONES]?.color ?? '#fff' }}>●</span>
                <span style={{ fontSize: 11, color: '#d4b47a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ZONES[area.zone]?.label ?? area.zone}
                </span>
              </div>
            </div>
            <span style={{ fontSize: 10, color: '#78614a', flexShrink: 0 }}>👣 {area.count.toLocaleString()}</span>
          </div>
        ))}
      </div>

      {/* 최근 입주자 */}
      <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <PanelLabel>🆕 최근 입주자</PanelLabel>
        {recentHouses.length === 0 ? (
          <div style={{ fontSize: 11, color: '#5a3e1a', marginTop: 8 }}>첫 번째 입주자가 되어보세요!</div>
        ) : recentHouses.map(h => (
          <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 8, fontWeight: 800, padding: '1px 5px', borderRadius: 3,
              background: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e44',
              flexShrink: 0,
            }}>NEW</span>
            <span style={{
              fontSize: 11, color: '#d4b47a', flex: 1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {h.name ?? h.nickname ?? '이름 없음'}
            </span>
            <span style={{ fontSize: 10, color: '#5a3e1a', flexShrink: 0 }}>
              {h.occupied_at ? getTimeAgo(h.occupied_at) : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: '#8b6914', letterSpacing: '0.05em', marginBottom: 4 }}>
      {children}
    </div>
  )
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}분 전`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}시간 전`
  return `${Math.floor(hours / 24)}일 전`
}
