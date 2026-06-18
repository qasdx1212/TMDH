'use client'

const ZONE_FILTERS = [
  { key: null,          label: '전체',     color: '#d4b483' },
  { key: 'neon',        label: '🌃 네온',  color: '#c084fc' },
  { key: 'riverside',   label: '🌿 강변',  color: '#34d399' },
  { key: 'oldtown',     label: '🏮 구시가', color: '#fbbf24' },
  { key: 'artdistrict', label: '🎨 예술구', color: '#f87171' },
]

interface FloatingHeaderProps {
  occupiedCount: number
  totalCells: number
  totalDonation: number
  userId?: string
  activeZone: string | null
  onZoneFilter: (zone: string | null) => void
  onApplyClick: () => void
  onMyHouseClick: () => void
}

export default function FloatingHeader({
  occupiedCount, totalCells, totalDonation, userId,
  activeZone, onZoneFilter, onApplyClick, onMyHouseClick,
}: FloatingHeaderProps) {
  const occupancyRate = ((occupiedCount / totalCells) * 100).toFixed(1)

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 300,
      background: 'linear-gradient(180deg, #2c1a08 0%, #1e1005 100%)',
      borderBottom: '3px solid #6b4c2a',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      fontFamily: '"Noto Sans KR", -apple-system, sans-serif',
    }}>
      {/* 메인 줄 */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '0 20px', height: 56,
        gap: 20,
      }}>
        {/* 로고 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, marginRight: 8 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 8,
            background: 'linear-gradient(135deg, #8b6914, #5a3e10)',
            border: '2px solid #c8a96e',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, boxShadow: '0 2px 0 #3d2a08',
          }}>🏠</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 16, fontWeight: 900, color: '#fdf6e3', letterSpacing: '-0.03em' }}>집.zip</span>
              <span style={{
                fontSize: 9, fontWeight: 700, color: '#c084fc',
                background: '#c084fc20', padding: '1px 5px', borderRadius: 3,
                border: '1px solid #c084fc44',
              }}>BETA</span>
            </div>
            <div style={{ fontSize: 9, color: '#7a5c3a', marginTop: -1 }}>당신만의 공간, 집.zip</div>
          </div>
        </div>

        {/* 통계 */}
        <div style={{ display: 'flex', gap: 20, flex: 1 }}>
          <StatItem label="전체 면적" value="1,000,000 pixels" valueColor="#d4b483" />
          <StatItem label="분양률" value={`${occupancyRate}%`} valueColor="#4ade80" />
          <StatItem
            label="누적 기부금"
            value={`₩ ${totalDonation.toLocaleString()}`}
            valueColor="#f87171"
          />
        </div>

        {/* 버튼 */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            onClick={onApplyClick}
            style={{
              padding: '8px 18px', borderRadius: 8, cursor: 'pointer',
              background: 'linear-gradient(180deg, #8b6914, #6b4c10)',
              color: '#fdf6e3', fontSize: 13, fontWeight: 700,
              border: '2px solid #c8a96e',
              boxShadow: '0 3px 0 #3d2a08',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            ✏️ 입주 신청하기
          </button>
          <button style={{
            width: 38, height: 38, borderRadius: 8,
            border: '2px solid #4a3010', background: 'rgba(255,255,255,0.06)',
            color: '#a08060', fontSize: 16, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>🔔</button>
          {userId && (
            <button
              onClick={onMyHouseClick}
              style={{
                padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
                background: 'rgba(255,255,255,0.08)',
                color: '#d4b483', fontSize: 13, fontWeight: 600,
                border: '2px solid #4a3010',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >내 집 보기</button>
          )}
        </div>
      </div>

      {/* 구역 필터 줄 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '0 20px 8px',
        borderTop: '1px solid #4a3010',
      }}>
        <span style={{ fontSize: 10, color: '#7a5c3a', marginRight: 6, flexShrink: 0, fontWeight: 600 }}>구역</span>
        {ZONE_FILTERS.map(({ key, label, color }) => {
          const active = activeZone === key
          return (
            <button
              key={String(key)}
              onClick={() => onZoneFilter(key)}
              style={{
                padding: '3px 12px', borderRadius: 20, cursor: 'pointer',
                border: `1.5px solid ${active ? color : '#4a3010'}`,
                background: active ? color + '28' : 'transparent',
                color: active ? color : '#7a5c3a',
                fontSize: 11, fontWeight: active ? 700 : 500,
                transition: 'all 0.12s',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StatItem({ label, value, valueColor }: { label: string; value: string; valueColor: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: '#7a5c3a', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color: valueColor, letterSpacing: '-0.01em' }}>{value}</div>
    </div>
  )
}
