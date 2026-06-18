'use client'

const ZONE_FILTERS = [
  { key: null, label: '전체' },
  { key: 'neon', label: '✨ 네온', color: '#c084fc' },
  { key: 'riverside', label: '🌿 강변', color: '#34d399' },
  { key: 'oldtown', label: '🏮 구시가', color: '#fbbf24' },
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
      background: 'rgba(26,10,2,0.97)', backdropFilter: 'blur(12px)',
      borderBottom: '1px solid #6b4c2a55',
      fontFamily: '"Noto Sans KR", -apple-system, sans-serif',
    }}>
      {/* 메인 헤더 줄 */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '0 20px',
        height: 52,
      }}>
        {/* 로고 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 28, flexShrink: 0 }}>
          <div style={{ fontSize: 22 }}>🏠</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em' }}>
              집.zip{' '}
              <span style={{ fontSize: 9, fontWeight: 500, color: '#6366f1', background: '#6366f120', padding: '1px 6px', borderRadius: 4, verticalAlign: 'middle' }}>BETA</span>
            </div>
            <div style={{ fontSize: 9, color: '#64748b', marginTop: -2 }}>당신만의 공간, 집.zip</div>
          </div>
        </div>

        {/* 통계 */}
        <div style={{ display: 'flex', gap: 24, flex: 1 }}>
          <div>
            <div style={{ fontSize: 9, color: '#64748b', letterSpacing: '0.06em' }}>전체 면적</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>1,000,000 px</div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: '#64748b', letterSpacing: '0.06em' }}>분양률</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#22c55e' }}>{occupancyRate}%</div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: '#64748b', letterSpacing: '0.06em' }}>누적 기부금</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>₩ {totalDonation.toLocaleString()}</div>
          </div>
        </div>

        {/* 버튼들 */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            onClick={onApplyClick}
            style={{
              padding: '7px 14px', borderRadius: 8, border: 'none',
              background: '#6366f1', color: '#fff',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            ✏️ 입주 신청
          </button>
          <button style={{
            width: 34, height: 34, borderRadius: 8,
            border: '1px solid #ffffff20', background: 'transparent',
            color: '#94a3b8', fontSize: 15, cursor: 'pointer',
          }}>🔔</button>
          {userId && (
            <button
              onClick={onMyHouseClick}
              style={{
                padding: '7px 14px', borderRadius: 8,
                border: '1px solid #ffffff30', background: 'transparent',
                color: '#e2e8f0', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >내 집 보기</button>
          )}
        </div>
      </div>

      {/* 구역 필터 줄 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '0 20px 8px',
        borderTop: '1px solid #ffffff08',
      }}>
        <span style={{ fontSize: 10, color: '#64748b', marginRight: 4, flexShrink: 0 }}>구역 필터</span>
        {ZONE_FILTERS.map(({ key, label, color }) => {
          const active = activeZone === key
          return (
            <button
              key={String(key)}
              onClick={() => onZoneFilter(key)}
              style={{
                padding: '3px 10px', borderRadius: 20,
                border: `1px solid ${active ? (color ?? '#6366f1') : '#ffffff20'}`,
                background: active ? (color ?? '#6366f1') + '33' : 'transparent',
                color: active ? (color ?? '#e2e8f0') : '#94a3b8',
                fontSize: 11, fontWeight: active ? 700 : 400,
                cursor: 'pointer', transition: 'all 0.15s',
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
