'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ZONES } from '@/lib/constants'
import type { CellData } from '@/types/cell'

interface MyHousesDrawerProps {
  userId: string
  onClose: () => void
  onEdit: (house: CellData) => void
}

export default function MyHousesDrawer({ userId, onClose, onEdit }: MyHousesDrawerProps) {
  const [houses, setHouses] = useState<CellData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('houses')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'occupied')
      .order('occupied_at', { ascending: false })
      .then(({ data }) => {
        setHouses((data ?? []) as CellData[])
        setLoading(false)
      })
  }, [userId])

  const getDaysLeft = (expiresAt: string | null, isPermanent: boolean) => {
    if (isPermanent) return null
    if (!expiresAt) return null
    const diff = new Date(expiresAt).getTime() - Date.now()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(0,0,0,0.5)' }}
      />

      {/* 드로어 */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 701,
        width: 380, maxWidth: '95vw',
        background: '#fdf6e3',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column',
        fontFamily: '"Noto Sans KR", -apple-system, sans-serif',
      }}>
        {/* 헤더 */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#1a0f05',
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>🏠 내 집 보기</div>
            <div style={{ fontSize: 11, color: '#a07850', marginTop: 2 }}>
              총 {houses.length}채
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: '50%',
              background: '#ffffff20', border: 'none',
              color: '#fff', fontSize: 18, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>
        </div>

        {/* 리스트 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 14 }}>
              불러오는 중...
            </div>
          ) : houses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🏗️</div>
              <div style={{ fontSize: 15, color: '#64748b', marginBottom: 6 }}>아직 입주한 집이 없어요</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>지도에서 빈 칸을 클릭해 입주 신청하세요!</div>
            </div>
          ) : (
            houses.map(h => {
              const zone = ZONES[h.zone]
              const daysLeft = getDaysLeft(h.expires_at, h.is_permanent)
              const isExpiringSoon = daysLeft !== null && daysLeft <= 7
              const isExpired = daysLeft !== null && daysLeft <= 0

              return (
                <div
                  key={h.id}
                  style={{
                    background: '#fff',
                    border: `2px solid ${isExpired ? '#ef4444' : isExpiringSoon ? '#f59e0b' : zone.color + '66'}`,
                    borderRadius: 12,
                    padding: '14px 16px',
                    marginBottom: 12,
                    position: 'relative',
                  }}
                >
                  {/* 구역 배지 */}
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: 10, fontWeight: 700,
                    padding: '2px 8px', borderRadius: 4,
                    background: zone.color + '22', color: zone.color,
                    border: `1px solid ${zone.color}44`,
                    marginBottom: 6,
                  }}>
                    {zone.label} · {h.address}
                  </div>

                  <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
                    {h.name ?? '이름 없는 집'}
                  </div>

                  {h.description && (
                    <div style={{
                      fontSize: 12, color: '#64748b', marginBottom: 8,
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {h.description}
                    </div>
                  )}

                  {/* 통계 */}
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#64748b', marginBottom: 10 }}>
                    <span>❤️ {h.like_count}</span>
                    <span>👣 {h.visit_count}</span>
                    <span>📐 {(h.width ?? 1) * (h.height ?? 1)}칸</span>
                  </div>

                  {/* 만료일 */}
                  <div style={{
                    fontSize: 11,
                    color: isExpired ? '#ef4444' : isExpiringSoon ? '#f59e0b' : '#94a3b8',
                    marginBottom: 10,
                    fontWeight: isExpiringSoon || isExpired ? 600 : 400,
                  }}>
                    {h.is_permanent
                      ? '✨ 영구 입주'
                      : isExpired
                      ? '⚠️ 기간 만료됨'
                      : daysLeft !== null
                      ? `⏱ ${daysLeft}일 후 만료 (${h.expires_at?.slice(0, 10)})`
                      : ''}
                  </div>

                  {/* 버튼 */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => onEdit(h)}
                      style={{
                        flex: 1, padding: '7px', borderRadius: 8,
                        border: `1px solid ${zone.color}66`,
                        background: zone.color + '15', color: zone.color,
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      ✏️ 수정
                    </button>
                    {h.link_url && (
                      <a
                        href={h.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          flex: 1, padding: '7px', borderRadius: 8,
                          border: '1px solid #e5e7eb',
                          background: '#f8fafc', color: '#374151',
                          fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          textDecoration: 'none', textAlign: 'center',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        🌐 방문
                      </a>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* 푸터 안내 */}
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid #e5e7eb',
          fontSize: 11, color: '#94a3b8', textAlign: 'center',
          background: '#fafaf9',
        }}>
          만료 7일 전부터 알림이 표시됩니다
        </div>
      </div>
    </>
  )
}
