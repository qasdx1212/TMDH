'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ZONES } from '@/lib/constants'
import { safeUrl } from '@/lib/url'
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
    // 대표칸만 조회 — 멀티셀 집의 위성칸(parent_address 있음)은 한 집의 몸통이므로 제외.
    // (예전엔 위성칸까지 다 나와서 1000행 제한에 대표칸이 밀려 '내 집이 안 나오는' 버그가 있었음)
    supabase.from('houses').select('*').eq('user_id', userId).eq('status', 'occupied')
      .is('parent_address', null)
      .order('occupied_at', { ascending: false })
      .then(({ data }) => { setHouses((data ?? []) as CellData[]); setLoading(false) })
  }, [userId])

  const getDaysLeft = (expiresAt: string | null, isPermanent: boolean) => {
    if (isPermanent || !expiresAt) return null
    return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000)
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(0,0,0,0.4)' }} />

      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 701,
        width: 400, maxWidth: '95vw',
        background: '#f4f3f1',
        borderLeft: '1px solid #e9e7e4',
        boxShadow: '-8px 0 30px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* 헤더 */}
        <div style={{
          background: '#ffffff',
          padding: '18px 20px',
          borderBottom: '1px solid #e9e7e4',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>내 집</div>
            <div style={{ fontSize: 12, color: '#6f6d6a', marginTop: 3 }}>총 {houses.length}채 입주 중</div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 10,
            background: '#f4f3f1', border: '1px solid #e9e7e4',
            color: '#6f6d6a', fontSize: 18, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
          }}>×</button>
        </div>

        {/* 리스트 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6f6d6a', fontSize: 14 }}>불러오는 중...</div>
          ) : houses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>아직 입주한 집이 없어요</div>
              <div style={{ fontSize: 13, color: '#6f6d6a', lineHeight: 1.7 }}>지도에서 빈 칸을 클릭해<br />입주 신청을 해보세요!</div>
            </div>
          ) : houses.map(h => {
            const zone = ZONES[h.zone]
            const daysLeft = getDaysLeft(h.expires_at, h.is_permanent)
            const isExpiringSoon = daysLeft !== null && daysLeft <= 7
            const isExpired = daysLeft !== null && daysLeft <= 0
            const statusColor = isExpired ? '#dc2626' : isExpiringSoon ? '#6f6d6a' : '#6f6d6a'
            const isVisible = h.is_visible !== false

            return (
              <div key={h.id} style={{
                background: '#ffffff',
                border: '1px solid #e9e7e4',
                borderLeft: `3px solid ${zone.color}`,
                borderRadius: 14,
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                overflow: 'hidden',
              }}>
                {/* 썸네일 */}
                {(h.exterior_image_url || h.interior_image_url) && (
                  <div style={{ height: 80, overflow: 'hidden', borderBottom: '1px solid #e9e7e4', position: 'relative' }}>
                    <img
                      src={h.interior_image_url ?? h.exterior_image_url ?? ''}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: isVisible ? 1 : 0.45 }}
                    />
                    {!isVisible && (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a', background: '#ffffff', border: '1px solid #e9e7e4', padding: '4px 12px', borderRadius: 8 }}>비공개</span>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ padding: '12px 14px' }}>
                  {/* 구역 배지 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 8, background: '#f4f3f1', color: '#6f6d6a', border: '1px solid #e9e7e4' }}>
                      {zone.label}
                    </span>
                    <span style={{ fontSize: 11, color: '#6f6d6a' }}>{h.address}</span>
                    <span style={{ fontSize: 11, color: '#97948f', marginLeft: 'auto' }}>
                      {(h.width ?? 1) * (h.height ?? 1)}칸
                    </span>
                  </div>

                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 4 }}>
                    {h.name ?? '이름 없는 집'}
                  </div>

                  {h.description && (
                    <div style={{
                      fontSize: 12, color: '#6f6d6a', marginBottom: 8, lineHeight: 1.5,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {h.description}
                    </div>
                  )}

                  {/* 통계 */}
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#6f6d6a', marginBottom: 10 }}>
                    <span>❤️ {h.like_count.toLocaleString()}</span>
                    <span>방문 {h.visit_count.toLocaleString()}</span>
                  </div>

                  {/* 만료일 */}
                  <div style={{ fontSize: 12, color: statusColor, fontWeight: 600, marginBottom: 10 }}>
                    {h.is_permanent
                      ? '영구 입주'
                      : isExpired
                      ? '기간 만료됨'
                      : daysLeft !== null
                      ? `${daysLeft}일 후 만료 (${h.expires_at?.slice(0, 10)})`
                      : ''}
                  </div>

                  {/* 버튼 행 1: 수정 / 비공개 토글 / 소유증서 */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <button onClick={() => onEdit(h)} style={{
                      flex: 2, padding: '9px', borderRadius: 10,
                      border: 'none', background: '#1c1c1e',
                      color: '#ffffff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}>수정</button>

                    <button
                      onClick={() => handleToggleVisible(h)}
                      disabled={togglingId === h.id}
                      style={{
                        flex: 1, padding: '9px', borderRadius: 10,
                        border: '1px solid #e0ddd9',
                        background: '#ffffff',
                        color: isVisible ? '#1a1a1a' : '#6f6d6a',
                        fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      }}
                    >{togglingId === h.id ? '...' : isVisible ? '공개' : '비공개'}</button>

                    <button onClick={() => setCertHouse(h)} style={{
                      flex: 1, padding: '9px', borderRadius: 10,
                      border: '1px solid #e0ddd9', background: '#ffffff',
                      color: '#1a1a1a', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    }}>증서</button>
                  </div>

                  {/* 버튼 행 2: 방문 링크 / 퇴거 */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    {safeUrl((h.link_url ?? '').split('\n')[0]) && (
                      <a href={safeUrl((h.link_url ?? '').split('\n')[0])!} target="_blank" rel="noopener noreferrer" style={{
                        flex: 1, padding: '9px', borderRadius: 10,
                        border: '1px solid #e0ddd9', background: '#ffffff',
                        color: '#1a1a1a', fontSize: 12, fontWeight: 600,
                        textDecoration: 'none', textAlign: 'center', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', gap: 4,
                      }}>방문</a>
                    )}
                    <button
                      onClick={() => handleVacate(h)}
                      disabled={vacatingId === h.id}
                      style={{
                        flex: 1, padding: '9px', borderRadius: 10,
                        border: '1px solid #e0ddd9', background: '#ffffff',
                        color: '#dc2626', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      }}
                    >{vacatingId === h.id ? '퇴거 중...' : '퇴거'}</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* 하단 */}
        <div>
          <div style={{ padding: '12px 20px', borderTop: '1px solid #e9e7e4', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: '#6f6d6a' }}>영구 입주 · 만료일 없음</span>
            <a href="/my/payments" style={{ fontSize: 12, color: '#1a1a1a', fontWeight: 600, textDecoration: 'none', padding: '6px 12px', borderRadius: 10, border: '1px solid #e0ddd9', background: '#ffffff' }}>결제 내역</a>
          </div>
        </div>
      </div>

      {certHouse && <CertificateModal house={certHouse} onClose={() => setCertHouse(null)} />}
    </>
  )
}
