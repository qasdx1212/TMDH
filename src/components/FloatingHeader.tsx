'use client'

interface FloatingHeaderProps {
  totalCells: number
  takenCells: number
  selectedCount: number
  draftCount: number
}

export default function FloatingHeader({ totalCells, takenCells, selectedCount, draftCount }: FloatingHeaderProps) {
  const remaining = totalCells - takenCells
  const pct = Math.round((takenCells / totalCells) * 100)

  return (
    <div style={{
      position: 'fixed',
      top: 16,
      left: 16,
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      background: 'rgba(255,255,255,0.88)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      border: '1px solid rgba(0,0,0,0.07)',
      borderRadius: 12,
      padding: '8px 14px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: '-0.03em', color: '#0f172a' }}>
        CELLAR
      </span>

      <div style={{ width: 1, height: 14, background: '#e2e8f0' }} />

      <span style={{ fontSize: 11, color: '#64748b' }}>
        잔여 <b style={{ color: '#0f172a', fontWeight: 600 }}>{remaining.toLocaleString()}</b>칸
      </span>

      <div style={{
        width: 48, height: 4, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden',
      }}>
        <div style={{ width: `${pct}%`, height: '100%', background: '#6366f1', borderRadius: 2, transition: 'width 0.4s' }} />
      </div>

      {draftCount > 0 && (
        <>
          <div style={{ width: 1, height: 14, background: '#e2e8f0' }} />
          <span style={{ background: '#f59e0b', color: '#fff', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>
            대기 {draftCount}칸
          </span>
        </>
      )}
      {selectedCount > 0 && (
        <>
          <div style={{ width: 1, height: 14, background: '#e2e8f0' }} />
          <span style={{ background: '#6366f1', color: '#fff', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>
            {selectedCount}칸 선택됨
          </span>
        </>
      )}
    </div>
  )
}
