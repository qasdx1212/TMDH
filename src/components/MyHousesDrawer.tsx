'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ZONES } from '@/lib/constants'
import type { CellData } from '@/types/cell'
import CertificateModal from './CertificateModal'

interface MyHousesDrawerProps {
  userId: string
  isAdmin?: boolean
  onClose: () => void
  onEdit: (house: CellData) => void
  onRefresh?: () => void
}

export default function MyHousesDrawer({ userId, isAdmin, onClose, onEdit, onRefresh }: MyHousesDrawerProps) {
  const [houses, setHouses] = useState<CellData[]>([])
  const [loading, setLoading] = useState(true)
  const [vacatingId, setVacatingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [certHouse, setCertHouse] = useState<CellData | null>(null)

  const handleVacate = async (house: CellData) => {
    if (!confirm(`"${house.name ?? house.address}" 에서 퇴거하시겠어요?\n이 작업은 되돌릴 수 없습니다.`)) return
    setVacatingId(house.id)
    await supabase.from('houses').update({
      user_id: null, name: null, nickname: null, description: null,
      link_url: null, exterior_image_url: null, interior_image_url: null,
      border_effect: 'none', status: 'available', width: 1, height: 1,
      parent_address: null, occupied_at: null, expires_at: null,
      is_permanent: false, like_count: 0, visit_count: 0, is_visible: true,
    }).eq('id', house.id)
    if ((house.width ?? 1) > 1 || (house.height ?? 1) > 1) {
      await supabase.from('houses').update({
        user_id: null, status: 'available', parent_address: null,
        occupied_at: null, expires_at: null, is_permanent: false,
      }).eq('parent_address', house.address)
    }
    setVacatingId(null)
    setHouses(prev => prev.filter(h => h.id !== house.id))
    onRefresh?.()
  }

  const handleToggleVisible = async (house: CellData) => {
    setTogglingId(house.id)
    const newVal = house.is_visible === false ? true : false
    await supabase.from('houses').update({ is_visible: newVal }).eq('id', house.id)
    setHouses(prev => prev.map(h => h.id === house.id ? { ...h, is_visible: newVal } : h))
    setTogglingId(null)
  }

  useEffect(() => {
    supabase.from('houses').select('*').eq('user_id', userId).eq('status', 'occupied')
      .order('occupied_at', { ascending: false })
      .then(({ data }) => { setHouses((data ?? []) as CellData[]); setLoading(false) })
  }, [userId])

  const getDaysLeft = (expiresAt: string | null, isPermanent: boolean) => {
    if (isPermanent || !expiresAt) return null
    return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000)
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(0,0,0,0.68)', backdropFilter: 'blur(4px)' }} />

      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 701,
        width: 400, maxWidth: '95vw',
        background: '#fdf6e3',
        boxShadow: '-4px 0 0 #8b6914, -8px 0 0 #c8a96e, -10px 0 0 #5a3e1a, -20px 0 60px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column',
        fontFamily: '"Noto Sans KR", -apple-system, sans-serif',
      }}>
        {/* 헤더 */}
        <div style={{
          background: 'linear-gradient(135deg, #4a2e10, #2e1a08)',
          padding: '18px 20px',
          borderBottom: '3px solid #8b6914',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fdf6e3' }}>🏠 내 집</div>
            <div style={{ fontSize: 11, color: '#c8a96e', marginTop: 3 }}>총 {houses.length}채 입주 중</div>
          </div>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: '50%',
            background: '#ef4444', border: '2px solid #b91c1c',
            color: '#fff', fontSize: 18, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>

        {/* 리스트 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#a08060', fontSize: 14 }}>불러오는 중...</div>
          ) : houses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: 52, marginBottom: 14 }}>🏗️</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#4a2e10', marginBottom: 8 }}>아직 입주한 집이 없어요</div>
              <div style={{ fontSize: 12, color: '#78614a', lineHeight: 1.7 }}>지도에서 빈 칸을 클릭해<br />입주 신청을 해보세요!</div>
            </div>
          ) : houses.map(h => {
            const zone = ZONES[h.zone]
            const daysLeft = getDaysLeft(h.expires_at, h.is_permanent)
            const isExpiringSoon = daysLeft !== null && daysLeft <= 7
            const isExpired = daysLeft !== null && daysLeft <= 0
            const statusColor = isExpired ? '#ef4444' : isExpiringSoon ? '#f59e0b' : '#22c55e'
            const isVisible = h.is_visible !== false

            return (
              <div key={h.id} style={{
                background: '#fff',
                border: `2px solid ${isExpired ? '#ef444444' : isExpiringSoon ? '#f59e0b44' : '#d4b48366'}`,
                borderLeft: `4px solid ${zone.color}`,
                borderRadius: 10,
                overflow: 'hidden',
              }}>
                {/* 썸네일 */}
                {(h.exterior_image_url || h.interior_image_url) && (
                  <div style={{ height: 80, overflow: 'hidden', borderBottom: '1px solid #e8d8bb', position: 'relative' }}>
                    <img
                      src={h.interior_image_url ?? h.exterior_image_url ?? ''}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: isVisible ? 1 : 0.45 }}
                    />
                    {!isVisible && (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.42)' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,0.55)', padding: '3px 10px', borderRadius: 6 }}>🔒 비공개</span>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ padding: '12px 14px' }}>
                  {/* 구역 배지 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: zone.color + '22', color: zone.color, border: `1px solid ${zone.color}44` }}>
                      {zone.label}
                    </span>
                    <span style={{ fontSize: 10, color: '#a08060' }}>{h.address}</span>
                    <span style={{ fontSize: 10, color: '#a08060', marginLeft: 'auto' }}>
                      📐 {(h.width ?? 1) * (h.height ?? 1)}칸
                    </span>
                  </div>

                  <div style={{ fontSize: 15, fontWeight: 800, color: '#3d2a18', marginBottom: 4 }}>
                    {h.name ?? '이름 없는 집'}
                  </div>

                  {h.description && (
                    <div style={{
                      fontSize: 12, color: '#78614a', marginBottom: 8, lineHeight: 1.5,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {h.description}
                    </div>
                  )}

                  {/* 통계 */}
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#78614a', marginBottom: 10 }}>
                    <span>❤️ {h.like_count.toLocaleString()}</span>
                    <span>👣 {h.visit_count.toLocaleString()}</span>
                  </div>

                  {/* 만료일 */}
                  <div style={{ fontSize: 11, color: statusColor, fontWeight: 600, marginBottom: 10 }}>
                    {h.is_permanent
                      ? '✨ 영구 입주'
                      : isExpired
                      ? '⚠️ 기간 만료됨'
                      : daysLeft !== null
                      ? `⏱ ${daysLeft}일 후 만료 (${h.expires_at?.slice(0, 10)})`
                      : ''}
                  </div>

                  {/* 버튼 행 1: 수정 / 비공개 토글 / 기부증서 */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <button onClick={() => onEdit(h)} style={{
                      flex: 2, padding: '8px', borderRadius: 8,
                      border: `1.5px solid ${zone.color}66`, background: zone.color + '15',
                      color: zone.color, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    }}>✏️ 수정</button>

                    <button
                      onClick={() => handleToggleVisible(h)}
                      disabled={togglingId === h.id}
                      style={{
                        flex: 1, padding: '8px', borderRadius: 8,
                        border: `1.5px solid ${isVisible ? '#c8a96e' : '#8b5cf6'}`,
                        background: isVisible ? '#f5ead5' : '#8b5cf622',
                        color: isVisible ? '#6b4c2a' : '#8b5cf6',
                        fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      }}
                    >{togglingId === h.id ? '...' : isVisible ? '🔓 공개' : '🔒 비공개'}</button>

                    <button onClick={() => setCertHouse(h)} style={{
                      flex: 1, padding: '8px', borderRadius: 8,
                      border: '1.5px solid #c8a96e', background: '#f5ead5',
                      color: '#6b4c2a', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    }}>📜 증서</button>
                  </div>

                  {/* 버튼 행 2: 방문 링크 / 퇴거 */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    {h.link_url && (
                      <a href={h.link_url} target="_blank" rel="noopener noreferrer" style={{
                        flex: 1, padding: '8px', borderRadius: 8,
                        border: '1.5px solid #c8a96e', background: '#f5ead5',
                        color: '#6b4c2a', fontSize: 12, fontWeight: 700,
                        textDecoration: 'none', textAlign: 'center', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', gap: 4,
                      }}>🌐 방문</a>
                    )}
                    <button
                      onClick={() => handleVacate(h)}
                      disabled={vacatingId === h.id}
                      style={{
                        flex: 1, padding: '8px', borderRadius: 8,
                        border: '1.5px solid #ef444466', background: '#fef2f2',
                        color: '#ef4444', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      }}
                    >{vacatingId === h.id ? '퇴거 중...' : '🗑️ 퇴거'}</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* 하단 */}
        <div>
          <div style={{ padding: '10px 20px', borderTop: '2px solid #d4b483', background: '#f5ead5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: '#a08060' }}>만료 7일 전부터 알림이 표시됩니다</span>
            <a href="/my/payments" style={{ fontSize: 11, color: '#8b6914', fontWeight: 700, textDecoration: 'none', padding: '4px 10px', borderRadius: 6, border: '1px solid #c8a96e', background: '#fdf6e3' }}>🧾 결제 내역</a>
          </div>
          <div style={{ height: 8, background: 'repeating-linear-gradient(90deg,#4a7c3f 0px,#4a7c3f 5px,#3d6b34 5px,#3d6b34 10px)', borderTop: '2px solid #2d5226' }} />
        </div>
      </div>

      {certHouse && <CertificateModal house={certHouse} onClose={() => setCertHouse(null)} />}
    </>
  )
}
