'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ZONES } from '@/lib/constants'
import { hashPwd } from '@/lib/hash'
import type { CellData } from '@/types/cell'
import ReportModal from './ReportModal'

interface HousePopupProps {
  house: CellData
  currentUserId?: string
  isAdmin?: boolean
  isOwnHouse?: boolean
  onClose: () => void
  onBuy: (house: CellData) => void
  onEdit?: (house: CellData) => void
  onVacate?: (house: CellData) => void
  onAdminDelete?: () => void
}

export default function HousePopup({ house, currentUserId, isAdmin, isOwnHouse, onClose, onBuy, onEdit, onVacate, onAdminDelete }: HousePopupProps) {
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(house.like_count)
  const [likeLoading, setLikeLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [pwdModal, setPwdModal] = useState<'edit' | 'vacate' | null>(null)
  const [pwdInput, setPwdInput] = useState('')
  const [pwdError, setPwdError] = useState('')
  const [pwdLoading, setPwdLoading] = useState(false)

  const zone = ZONES[house.zone]
  const isAvailable = house.status === 'available'
  const isHidden = house.is_visible === false && !isOwnHouse && !isAdmin
  const displayImage = house.interior_image_url || house.exterior_image_url

  useEffect(() => {
    if (!currentUserId || !house.id) return
    supabase.from('likes').select('id').eq('user_id', currentUserId).eq('house_id', house.id).maybeSingle()
      .then(({ data }) => setLiked(!!data))
  }, [currentUserId, house.id])

  useEffect(() => {
    if (!house.id || isAvailable) return
    supabase.from('houses').update({ visit_count: house.visit_count + 1 }).eq('id', house.id)
  }, [house.id, isAvailable])

  const toggleLike = async () => {
    if (!currentUserId) {
      alert('로그인 후 좋아요를 누를 수 있어요')
      return
    }
    if (!house.id) return
    setLikeLoading(true)
    if (liked) {
      const { error } = await supabase.from('likes').delete().eq('user_id', currentUserId).eq('house_id', house.id)
      if (!error) { setLiked(false); const n = Math.max(0, likeCount - 1); setLikeCount(n); supabase.from('houses').update({ like_count: n }).eq('id', house.id) }
    } else {
      const { error } = await supabase.from('likes').insert({ user_id: currentUserId, house_id: house.id })
      if (!error) { setLiked(true); const n = likeCount + 1; setLikeCount(n); supabase.from('houses').update({ like_count: n }).eq('id', house.id) }
    }
    setLikeLoading(false)
  }

  const handleAdminDelete = async () => {
    if (!confirm(`"${house.name ?? house.address}"을 삭제하시겠어요?\n이 작업은 되돌릴 수 없습니다.`)) return
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
    onAdminDelete?.()
  }

  const requirePassword = (action: 'edit' | 'vacate') => {
    if (!isOwnHouse && !isAdmin) return
    if (isAdmin || !house.has_password) {
      if (action === 'edit') { onEdit?.(house); onClose() }
      else onVacate?.(house)
    } else {
      setPwdInput(''); setPwdError(''); setPwdModal(action)
    }
  }

  const handlePwdSubmit = async () => {
    if (!pwdInput) return
    setPwdLoading(true); setPwdError('')
    try {
      const hash = await hashPwd(pwdInput)
      const { data } = await supabase.rpc('verify_house_password', { house_address: house.address, pwd_hash: hash })
      if (data) {
        const action = pwdModal; setPwdModal(null); setPwdInput('')
        if (action === 'edit') { onEdit?.(house); onClose() }
        else if (action === 'vacate') onVacate?.(house)
      } else {
        setPwdError('비밀번호가 틀렸어요 🔒')
      }
    } catch { setPwdError('오류가 발생했습니다.') }
    finally { setPwdLoading(false) }
  }

  const handleShare = () => {
    navigator.clipboard.writeText(`${window.location.origin}?house=${house.address}`)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }}
        onClick={onClose}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: 660, maxWidth: '96vw', maxHeight: '90vh',
            display: 'flex', flexDirection: 'column',
            background: '#ffffff', borderRadius: 14,
            border: '1px solid #e9e7e4',
            boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
            overflow: 'hidden', position: 'relative',
          }}
        >
          {/* 닫기 */}
          <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, zIndex: 10, width: 32, height: 32, borderRadius: 10, background: '#f4f3f1', border: '1px solid #e9e7e4', color: '#8c8a87', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>

          {/* 헤더 */}
          <div style={{ padding: '22px 56px 20px 24px', borderBottom: '1px solid #e9e7e4', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 8, background: '#f4f3f1', color: '#8c8a87', border: '1px solid #e9e7e4' }}>{house.address}</span>
                {house.nickname && (
                  <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 8, background: '#1c1c1e', color: '#ffffff' }}>문패 {house.nickname}</span>
                )}
                {house.is_visible === false && (
                  <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 8, background: '#f4f3f1', color: '#8c8a87', border: '1px solid #e9e7e4' }}>비공개</span>
                )}
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#1a1a1a', letterSpacing: '-0.02em', lineHeight: 1.25 }}>
                {isAvailable ? '빈 공간' : (house.name ?? '이름 없는 집')}
                {!isAvailable && likeCount > 50 && ' 💛'}
              </div>
            </div>
          </div>

          {/* 바디 */}
          {isAvailable ? (
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontSize: 15, color: '#8c8a87', lineHeight: 1.8, marginBottom: 28 }}>
                아직 아무도 살지 않는 빈 공간이에요.<br />당신만의 공간으로 꾸며보세요!
              </div>
              <button onClick={() => onBuy(house)} style={{ padding: '13px 32px', borderRadius: 10, cursor: 'pointer', background: '#1c1c1e', color: '#ffffff', border: 'none', fontSize: 15, fontWeight: 600 }}>입주 신청하기</button>
            </div>
          ) : isHidden ? (
            /* 비공개 집 */
            <div style={{ textAlign: 'center', padding: '52px 24px' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>비공개 집입니다</div>
              <div style={{ fontSize: 14, color: '#8c8a87', lineHeight: 1.7 }}>이 집은 주인이 비공개로 설정해두었어요.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', minHeight: 180, overflowY: 'auto', flex: 1 }}>
              <div style={{ flex: 1, padding: '22px 24px', minWidth: 0 }}>
                {house.description && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#b0aeaa', marginBottom: 8 }}>소개글</div>
                    <div style={{ fontSize: 14, color: '#1a1a1a', lineHeight: 1.9 }}>{house.description}</div>
                  </div>
                )}
                {house.link_url && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#b0aeaa', marginBottom: 8 }}>링크</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <a href={house.link_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, background: '#ffffff', color: '#1a1a1a', fontSize: 13, fontWeight: 600, textDecoration: 'none', border: '1px solid #e0ddd9' }}>공식 홈페이지 ↗</a>
                    </div>
                  </div>
                )}
                {!house.description && !house.link_url && (
                  <div style={{ color: '#8c8a87', fontSize: 14, marginTop: 8 }}>소개글이 아직 없어요.</div>
                )}
              </div>
              {displayImage && (
                <div style={{ width: 210, flexShrink: 0, padding: '16px 16px 16px 0', display: 'flex', alignItems: 'center' }}>
                  <img src={displayImage} alt={house.name ?? ''} style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 10, border: '1px solid #e9e7e4' }} />
                </div>
              )}
            </div>
          )}

          {/* 통계 바 */}
          {!isAvailable && (
            <div style={{ display: 'flex', background: '#ffffff', borderTop: '1px solid #e9e7e4' }}>
              <StatCell>
                <button
                  onClick={toggleLike}
                  disabled={likeLoading}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: 0, fontSize: 15, fontWeight: 600, color: liked ? '#dc2626' : '#8c8a87' }}
                >
                  {liked ? '❤️' : '🤍'} {likeCount.toLocaleString()}
                </button>
              </StatCell>
              <div style={{ width: 1, background: '#e9e7e4', margin: '12px 0' }} />
              <StatCell>
                <span style={{ fontSize: 14, fontWeight: 500, color: '#8c8a87', display: 'flex', alignItems: 'center', gap: 6 }}>
                  방문 {(house.visit_count + 1).toLocaleString()}
                </span>
              </StatCell>
              <div style={{ width: 1, background: '#e9e7e4', margin: '12px 0' }} />
              <StatCell>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {house.occupied_at && (
                    <span style={{ fontSize: 13, color: '#8c8a87', fontWeight: 500 }}>
                      {house.occupied_at.slice(0, 10)}
                    </span>
                  )}
                  <button onClick={handleShare} style={{ padding: '5px 12px', borderRadius: 10, border: '1px solid #e0ddd9', background: '#ffffff', color: copied ? '#1a1a1a' : '#8c8a87', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    {copied ? '복사됨' : '공유'}
                  </button>
                  {/* 신고하기 — 본인 집이 아니고 로그인한 경우만 */}
                  {currentUserId && !isOwnHouse && (
                    <button onClick={() => setShowReport(true)} style={{ padding: '5px 12px', borderRadius: 10, border: '1px solid #e0ddd9', background: '#ffffff', color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      신고
                    </button>
                  )}
                </div>
              </StatCell>
            </div>
          )}

          {/* 내 집 관리 바 */}
          {isOwnHouse && !isAvailable && (
            <div style={{ padding: '10px 16px', background: '#f4f3f1', borderTop: '1px solid #e9e7e4', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#8c8a87', fontWeight: 600, flex: 1 }}>
                내 집 {house.has_password && <span style={{ color: '#b0aeaa' }}>· 잠금</span>}
              </span>
              <button onClick={() => requirePassword('edit')} style={{ padding: '8px 18px', borderRadius: 10, background: '#1c1c1e', border: 'none', color: '#ffffff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>수정</button>
              <button onClick={() => requirePassword('vacate')} style={{ padding: '8px 16px', borderRadius: 10, background: '#ffffff', border: '1px solid #e0ddd9', color: '#dc2626', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>퇴거</button>
            </div>
          )}

          {/* 관리자 삭제 바 */}
          {isAdmin && !isAvailable && (
            <div style={{ padding: '10px 16px', background: '#f4f3f1', borderTop: '1px solid #e9e7e4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#8c8a87', fontWeight: 600 }}>관리자 모드</span>
              <button onClick={handleAdminDelete} style={{ padding: '8px 18px', borderRadius: 10, background: '#dc2626', border: 'none', color: '#ffffff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>강제 퇴거</button>
            </div>
          )}
        </div>
      </div>

      {/* 비밀번호 확인 모달 */}
      {pwdModal && (
        <div style={{ position:'fixed', inset:0, zIndex:700, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.45)' }}>
          <div style={{
            background:'#ffffff', borderRadius:14, padding:'28px 24px', width:320, maxWidth:'90vw',
            border:'1px solid #e9e7e4', boxShadow:'0 8px 30px rgba(0,0,0,0.12)',
          }}>
            <div style={{ fontSize:17, fontWeight:700, color:'#1a1a1a', textAlign:'center', marginBottom:6 }}>
              {pwdModal === 'edit' ? '수정하기' : '퇴거하기'}
            </div>
            <div style={{ fontSize:13, color:'#8c8a87', textAlign:'center', marginBottom:20, lineHeight:1.7 }}>
              이 집에 설정된 비밀번호를 입력해주세요.
            </div>
            <input
              type="password"
              autoFocus
              value={pwdInput}
              onChange={e => { setPwdInput(e.target.value); setPwdError('') }}
              onKeyDown={e => e.key === 'Enter' && handlePwdSubmit()}
              placeholder="비밀번호 입력"
              style={{
                width:'100%', padding:'11px 12px', borderRadius:10, boxSizing:'border-box',
                border:`1px solid ${pwdError ? '#dc2626' : '#e0ddd9'}`,
                background:'#ffffff', color:'#1a1a1a', fontSize:14, outline:'none',
              }}
            />
            {pwdError && <div style={{ fontSize:12, color:'#dc2626', marginTop:6, textAlign:'center' }}>{pwdError}</div>}
            <div style={{ display:'flex', gap:10, marginTop:18 }}>
              <button onClick={() => setPwdModal(null)} style={{ flex:1, padding:'11px', borderRadius:10, border:'1px solid #e0ddd9', background:'#ffffff', color:'#1a1a1a', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                취소
              </button>
              <button
                onClick={handlePwdSubmit}
                disabled={!pwdInput || pwdLoading}
                style={{
                  flex:2, padding:'11px', borderRadius:10,
                  border:'none',
                  background: pwdModal === 'vacate' ? '#dc2626' : '#1c1c1e',
                  color: '#ffffff', fontSize:13, fontWeight:600, cursor: !pwdInput || pwdLoading ? 'default' : 'pointer',
                  opacity: !pwdInput || pwdLoading ? 0.5 : 1,
                }}
              >
                {pwdLoading ? '확인 중...' : pwdModal === 'vacate' ? '퇴거하기' : '수정하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 신고 모달 */}
      {showReport && currentUserId && (
        <ReportModal house={house} userId={currentUserId} onClose={() => setShowReport(false)} />
      )}
    </>
  )
}

function StatCell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px 12px' }}>
      {children}
    </div>
  )
}
