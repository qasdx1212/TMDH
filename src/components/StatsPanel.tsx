'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
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

interface TopArea {
  zone: string
  label: string
  visit_count: number
  rank: number
}

const ZONE_LABELS: Record<string, string> = {
  neon: '네온 스트리트',
  riverside: '리버사이드',
  oldtown: '올드타운',
  artdistrict: '아트 디스트릭트',
}

const ZONE_COLORS: Record<string, string> = {
  neon: '#a855f7',
  riverside: '#22d3ee',
  oldtown: '#f59e0b',
  artdistrict: '#f472b6',
}

export default function StatsPanel({ houses }: StatsPanelProps) {
  const [recentHouses, setRecentHouses] = useState<RecentHouse[]>([])
  const [topAreas, setTopAreas] = useState<TopArea[]>([])

  const totalCells = 10000
  const occupiedCount = houses.filter(h => h.status === 'occupied').length
  const pendingCount = houses.filter(h => h.status === 'pending').length
  const occupancyRate = ((occupiedCount / totalCells) * 100).toFixed(1)

  useEffect(() => {
    // 최근 입주자
    supabase
      .from('houses')
      .select('id, name, nickname, zone, occupied_at')
      .eq('status', 'occupied')
      .order('occupied_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setRecentHouses((data ?? []) as RecentHouse[]))

    // 인기 지역 TOP5 (방문수 기준)
    supabase
      .from('houses')
      .select('zone, visit_count')
      .eq('status', 'occupied')
      .then(({ data }) => {
        const zoneSums: Record<string, number> = {}
        ;(data ?? []).forEach((h: { zone: string; visit_count: number }) => {
          zoneSums[h.zone] = (zoneSums[h.zone] ?? 0) + h.visit_count
        })
        const sorted = Object.entries(zoneSums)
          .sort(([, a], [, b]) => b - a)
          .map(([zone, count], i) => ({
            zone, label: ZONE_LABELS[zone] ?? zone,
            visit_count: count, rank: i + 1,
          }))
        setTopAreas(sorted)
      })
  }, [houses])

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '180px 1fr 1fr 1fr',
      gap: 0,
      background: '#120a02',
      borderTop: '1px solid #6b4c2a55',
      height: 160,
    }}>
      {/* 미니맵 */}
      <div style={{ padding: '12px 16px', borderRight: '1px solid #ffffff10' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', marginBottom: 8 }}>미니맵</div>
        <div style={{
          width: '100%', aspectRatio: '1',
          maxWidth: 120,
          background: '#1a1a2e',
          borderRadius: 4,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          overflow: 'hidden',
        }}>
          <div style={{ background: '#a855f733' }} />
          <div style={{ background: '#22d3ee33' }} />
          <div style={{ background: '#f59e0b33' }} />
          <div style={{ background: '#f472b633' }} />
        </div>
      </div>

      {/* 실시간 분양 현황 */}
      <div style={{ padding: '12px 20px', borderRight: '1px solid #ffffff10' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', marginBottom: 12 }}>실시간 분양 현황</div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {/* 도넛 차트 대신 수치 표시 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { label: '분양 완료', value: occupiedCount, color: '#22c55e' },
              { label: '판매 중', value: pendingCount, color: '#6366f1' },
              { label: '분양 예정', value: totalCells - occupiedCount - pendingCount, color: '#475569' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: '#94a3b8', width: 60 }}>{item.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{item.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginLeft: 'auto' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#22c55e', letterSpacing: '-0.03em' }}>{occupancyRate}%</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>분양률</div>
          </div>
        </div>
      </div>

      {/* 인기 지역 TOP5 */}
      <div style={{ padding: '12px 20px', borderRight: '1px solid #ffffff10' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', marginBottom: 8 }}>인기 지역 TOP 5 (방문자 수)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {topAreas.slice(0, 5).map(area => (
            <div key={area.zone} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', width: 14 }}>{area.rank}</span>
              <span style={{ fontSize: 11, color: ZONE_COLORS[area.zone] ?? '#94a3b8', flex: 1 }}>{area.label}</span>
              <span style={{ fontSize: 11, color: '#64748b' }}>👣 {area.visit_count.toLocaleString()}</span>
            </div>
          ))}
          {topAreas.length === 0 && (
            <div style={{ fontSize: 11, color: '#475569' }}>아직 방문 데이터가 없어요</div>
          )}
        </div>
      </div>

      {/* 최근 입주자 */}
      <div style={{ padding: '12px 20px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', marginBottom: 8 }}>최근 입주자</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {recentHouses.map((h, i) => (
            <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '1px 5px',
                borderRadius: 3, background: '#22c55e22', color: '#22c55e',
              }}>NEW</span>
              <span style={{ fontSize: 11, color: '#e2e8f0', flex: 1 }}>{h.name ?? h.nickname ?? '이름 없음'}</span>
              <span style={{ fontSize: 10, color: '#475569' }}>
                {h.occupied_at ? getTimeAgo(h.occupied_at) : ''}
              </span>
            </div>
          ))}
          {recentHouses.length === 0 && (
            <div style={{ fontSize: 11, color: '#475569' }}>첫 번째 입주자가 되어보세요!</div>
          )}
        </div>
      </div>
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
