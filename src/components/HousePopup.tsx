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
    if (!currentUserId || !house.id) return
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
        style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: 660, maxWidth: '96vw', maxHeight: '90vh',
            display: 'flex', flexDirection: 'column',
            background: '#fdf6e3', borderRadius: 12,
            border: '4px solid #7a4f1a',
            boxShadow: '0 0 0 2px #e8c97a, 0 0 0 5px #7a4f1a, 0 0 0 7px #e8c97a, 0 24px 70px rgba(0,0,0,0.7)',
            fontFamily: '"Noto Sans KR", sans-serif', overflow: 'hidden', position: 'relative',
          }}
        >
          {/* 닫기 */}
          <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, width: 32, height: 32, borderRadius: '50%', background: '#ef4444', border: '3px solid #b91c1c', color: '#fff', fontSize: 20, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 0 #991b1b', lineHeight: 1 }}>×</button>

          {/* 헤더 */}
          <div style={{ background: 'linear-gradient(180deg,#f5ead5 0%,#ecdcc0 100%)', padding: '18px 56px 18px 20px', borderBottom: '3px solid #c8a96e', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 64, lineHeight: 1, flexShrink: 0 }}>🏠</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#e8d5b0', color: '#6b3d0f', border: '1.5px solid #c8a96e' }}>{house.address}</span>
                {house.nickname && (
                  <span style={{ fontSize: 13, fontWeight: 800, padding: '4px 14px', borderRadius: 6, background: '#3d2008', color: '#fdf6e3', letterSpacing: '0.02em' }}>문패 {house.nickname}</span>
                )}
                {house.is_visible === false && (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: '#4a3010', color: '#a08060', border: '1px solid #6b4c2a' }}>🔒 비공개</span>
                )}
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, color: '#2a1505', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                {isAvailable ? '빈 공간' : (house.name ?? '이름 없는 집')}
                {!isAvailable && likeCount > 50 && ' ✨ 💛'}
              </div>
            </div>
          </div>

          {/* 바디 */}
          {isAvailable ? (
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>🏗️</div>
              <div style={{ fontSize: 14, color: '#78614a', lineHeight: 1.8, marginBottom: 28 }}>
                아직 아무도 살지 않는 빈 공간이에요.<br />당신만의 공간으로 꾸며보세요!
              </div>
              <button onClick={() => onBuy(house)} style={{ padding: '14px 40px', borderRadius: 10, cursor: 'pointer', background: 'linear-gradient(180deg,#8b6914,#6b4c10)', color: '#fdf6e3', border: '2px solid #c8a96e', boxShadow: '0 4px 0 #3d2a08', fontSize: 16, fontWeight: 800 }}>입주 신청하기 →</button>
            </div>
          ) : isHidden ? (
            /* 비공개 집 */
            <div style={{ textAlign: 'center', padding: '52px 24px' }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🔒</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#5a3e1a', marginBottom: 8 }}>비공개 집입니다</div>
              <div style={{ fontSize: 13, color: '#a08060', lineHeight: 1.7 }}>이 집은 주인이 비공개로 설정해두었어요.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', minHeight: 180, overflowY: 'auto', flex: 1 }}>
              <div style={{ flex: 1, padding: '22px 20px', minWidth: 0 }}>
                {house.description && (
                  <div style={{ marginBottom: 20 }}>
                    <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 800, padding: '4px 12px', borderRadius: 6, background: '#3b5bdb', color: '#fff', marginBottom: 12 }}>소개글</span>
                    <div style={{ fontSize: 14, color: '#3d2a18', lineHeight: 1.9 }}>{house.description}</div>
                  </div>
                )}
                {house.link_url && (
                  <div>
                    <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 800, padding: '4px 12px', borderRadius: 6, background: '#2f9e44', color: '#fff', marginBottom: 12 }}>링크</span>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <a href={house.link_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: '#e03131', color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none', boxShadow: '0 3px 0 #b91c1c' }}>🌐 공식 홈페이지 ↗</a>
                    </div>
                  </div>
                )}
                {!house.description && !house.link_url && (
                  <div style={{ color: '#a08060', fontSize: 13, marginTop: 8 }}>소개글이 아직 없어요.</div>
                )}
              </div>
              {displayImage && (
                <div style={{ width: 210, flexShrink: 0, padding: '16px 16px 16px 0', display: 'flex', alignItems: 'center' }}>
                  <img src={displayImage} alt={house.name ?? ''} style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 12, border: '2.5px solid #c8a96e', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }} />
                </div>
              )}
            </div>
          )}

          {/* 통계 바 */}
          {!isAvailable && (
            <div style={{ display: 'flex', background: '#f0e4cc', borderTop: '2.5px solid #c8a96e' }}>
              <StatCell>
                <button
                  onClick={toggleLike}
                  disabled={likeLoading || !currentUserId}
                  style={{ background: 'none', border: 'none', cursor: currentUserId ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 6, padding: 0, fontSize: 16, fontWeight: 800, color: liked ? '#e03131' : '#5a3e1a' }}
                >
                  {liked ? '❤️' : '🤍'} {likeCount.toLocaleString()}
                </button>
              </StatCell>
              <div style={{ width: 1.5, background: '#c8a96e', margin: '10px 0' }} />
              <StatCell>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#5a3e1a', display: 'flex', alignItems: 'center', gap: 6 }}>
                  👣 {(house.visit_count + 1).toLocaleString()}
                </span>
              </StatCell>
              <div style={{ width: 1.5, background: '#c8a96e', margin: '10px 0' }} />
              <StatCell>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {house.occupied_at && (
                    <span style={{ fontSize: 13, color: '#78614a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      📅 {house.occupied_at.slice(0, 10)}
                    </span>
                  )}
                  <button onClick={handleShare} style={{ padding: '4px 10px', borderRadius: 6, border: `1.5px solid ${copied ? '#22c55e' : '#c8a96e'}`, background: copied ? '#22c55e18' : '#fdf6e3', color: copied ? '#22c55e' : '#78614a', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    {copied ? '✅ 복사됨' : '🔗 공유'}
                  </button>
                  {/* 신고하기 — 본인 집이 아니고 로그인한 경우만 */}
                  {currentUserId && !isOwnHouse && (
                    <button onClick={() => setShowReport(true)} style={{ padding: '4px 10px', borderRadius: 6, border: '1.5px solid #ef444466', background: 'transparent', color: '#ef444488', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      🚨 신고
                    </button>
                  )}
                </div>
              </StatCell>
            </div>
          )}

          {/* 내 집 관리 바 */}
          {isOwnHouse && !isAvailable && (
            <div style={{ padding: '8px 16px', background: '#0f2a1a', borderTop: '2px solid #2f9e44', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#34d399', fontWeight: 700, flex: 1 }}>
                🏠 내 집 {house.has_password && <span style={{ fontSize: 10, color: '#fbbf24' }}>🔑</span>}
              </span>
              <button onClick={() => requirePassword('edit')} style={{ padding: '6px 16px', borderRadius: 6, background: '#1a4a30', border: '1.5px solid #2f9e44', color: '#34d399', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✏️ 수정</button>
              <button onClick={() => requirePassword('vacate')} style={{ padding: '6px 14px', borderRadius: 6, background: '#fef2f2', border: '1.5px solid #ef444466', color: '#ef4444', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>🗑️ 퇴거</button>
            </div>
          )}

          {/* 관리자 삭제 바 */}
          {isAdmin && !isAvailable && (
            <div style={{ padding: '8px 16px', background: '#3d0a0a', borderTop: '2px solid #7f1d1d', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: '#f87171', fontWeight: 600 }}>🔑 관리자 모드</span>
              <button onClick={handleAdminDelete} style={{ padding: '6px 16px', borderRadius: 6, background: '#ef4444', border: '2px solid #b91c1c', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer', boxShadow: '0 2px 0 #991b1b' }}>🗑️ 강제 퇴거</button>
            </div>
          )}

          {/* 잔디 */}
          <div style={{ height: 28, background: 'repeating-linear-gradient(90deg,#4a7c3f 0px,#4a7c3f 4px,#3d6b34 4px,#3d6b34 8px)', borderTop: '3px solid #2d5226', position: 'relative', overflow: 'visible' }}>
            {['🌸', '🌼', '🌺', '🌻', '🌷', '🌸', '🌼', '🌺'].map((f, i) => (
              <span key={i} style={{ position: 'absolute', top: -10, left: `${4 + i * 13}%`, fontSize: 16, lineHeight: 1, pointerEvents: 'none' }}>{f}</span>
            ))}
          </div>
        </div>
      </div>

      {/* 비밀번호 확인 모달 */}
      {pwdModal && (
        <div style={{ position:'fixed', inset:0, zIndex:700, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.75)', backdropFilter:'blur(4px)' }}>
          <div style={{
            background:'#fdf6e3', borderRadius:12, padding:'28px 24px', width:320, maxWidth:'90vw',
            border:'3px solid #7a4f1a', boxShadow:'0 0 0 2px #e8c97a, 0 16px 48px rgba(0,0,0,0.6)',
            fontFamily:'"Noto Sans KR",-apple-system,sans-serif',
          }}>
            <div style={{ fontSize:40, textAlign:'center', marginBottom:12 }}>🔑</div>
            <div style={{ fontSize:16, fontWeight:900, color:'#3d2a18', textAlign:'center', marginBottom:6 }}>
              {pwdModal === 'edit' ? '수정하기' : '퇴거하기'}
            </div>
            <div style={{ fontSize:12, color:'#78614a', textAlign:'center', marginBottom:20, lineHeight:1.7 }}>
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
                width:'100%', padding:'10px 12px', borderRadius:8, boxSizing:'border-box',
                border:`2px solid ${pwdError ? '#ef4444' : '#d4b483'}`,
                background:'#fdf6e3', color:'#3d2a18', fontSize:14, outline:'none', fontFamily:'inherit',
              }}
            />
            {pwdError && <div style={{ fontSize:12, color:'#ef4444', marginTop:6, textAlign:'center' }}>{pwdError}</div>}
            <div style={{ display:'flex', gap:10, marginTop:18 }}>
              <button onClick={() => setPwdModal(null)} style={{ flex:1, padding:'10px', borderRadius:8, border:'2px solid #c8a96e', background:'#f5ead5', color:'#78614a', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                취소
              </button>
              <button
                onClick={handlePwdSubmit}
                disabled={!pwdInput || pwdLoading}
                style={{
                  flex:2, padding:'10px', borderRadius:8,
                  border:`2px solid ${pwdModal === 'vacate' ? '#ef4444' : '#2f9e44'}`,
                  background: pwdModal === 'vacate' ? '#ef4444' : '#2f9e44',
                  color:'#fff', fontSize:13, fontWeight:800, cursor: !pwdInput || pwdLoading ? 'default' : 'pointer',
                  opacity: !pwdInput || pwdLoading ? 0.6 : 1,
                }}
              >
                {pwdLoading ? '확인 중...' : pwdModal === 'vacate' ? '🗑️ 퇴거하기' : '✏️ 수정하기'}
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
