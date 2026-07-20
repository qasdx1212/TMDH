'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ZONES } from '@/lib/constants'
import { hashPwd } from '@/lib/hash'
import { pwdChecks, isPwdValid } from '@/lib/password'
import { safeUrl } from '@/lib/url'
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
  const [resetMode, setResetMode] = useState(false)   // #11 로그인한 집주인 비밀번호 재설정

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
    // visit_count 는 houses RLS(소유자만 update)에 막히므로 SECURITY DEFINER RPC 로 올린다.
    // (남의 집 방문이 카운트 안 되던 버그 수정 — fix_visit_count.sql)
    supabase.rpc('increment_visit', { p_house_id: house.id })
  }, [house.id, isAvailable])

  const toggleLike = async () => {
    if (!currentUserId) {
      alert('로그인 후 좋아요를 누를 수 있어요')
      return
    }
    if (!house.id) return
    setLikeLoading(true)
    // like_count 는 likes 테이블 트리거(update_like_count, SECURITY DEFINER)가 갱신함.
    // 클라이언트에서 houses 를 직접 update 하면 남의 집은 RLS 에 막혀 실패하므로 하지 않는다.
    if (liked) {
      const { error } = await supabase.from('likes').delete().eq('user_id', currentUserId).eq('house_id', house.id)
      if (!error) { setLiked(false); setLikeCount(n => Math.max(0, n - 1)) }
    } else {
      const { error } = await supabase.from('likes').insert({ user_id: currentUserId, house_id: house.id })
      if (!error) { setLiked(true); setLikeCount(n => n + 1) }
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
      setPwdInput(''); setPwdError(''); setResetMode(false); setPwdModal(action)
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

  // #11 로그인한 집주인은 예전 비밀번호 없이 새 비밀번호로 재설정 가능 (계정 로그인 = 본인 인증).
  // 집주인은 houses RLS(auth.uid()=user_id)를 통과하므로 password_hash 를 직접 갱신할 수 있다.
  const handlePwdReset = async () => {
    if (!isPwdValid(pwdInput)) { setPwdError('비밀번호 조건을 확인해주세요.'); return }
    setPwdLoading(true); setPwdError('')
    try {
      const hash = await hashPwd(pwdInput)
      const { error } = await supabase.from('houses')
        .update({ password_hash: hash, has_password: true }).eq('id', house.id)
      if (error) { setPwdError('재설정에 실패했어요.'); return }
      const action = pwdModal; setPwdModal(null); setPwdInput(''); setResetMode(false)
      if (action === 'edit') { onEdit?.(house); onClose() }
      else if (action === 'vacate') onVacate?.(house)
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
            width: 520, maxWidth: '96vw', maxHeight: '90vh',
            display: 'flex', flexDirection: 'column',
            background: '#ffffff', borderRadius: 14,
            border: '1px solid #e9e7e4',
            boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
            overflow: 'hidden', position: 'relative',
          }}
        >
          {/* 닫기 */}
          <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, zIndex: 10, width: 32, height: 32, borderRadius: 10, background: '#f4f3f1', border: '1px solid #e9e7e4', color: '#6f6d6a', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>

          {/* 헤더 */}
          <div style={{ padding: '16px 56px 14px 20px', borderBottom: '1px solid #e9e7e4' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 8, background: '#f4f3f1', color: '#6f6d6a', border: '1px solid #e9e7e4' }}>{house.address}</span>
              {house.is_visible === false && (
                <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 8, background: '#f4f3f1', color: '#6f6d6a', border: '1px solid #e9e7e4' }}>비공개</span>
              )}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', letterSpacing: '-0.02em', lineHeight: 1.25 }}>
              {isAvailable ? '빈 공간' : (house.name ?? '이름 없는 집')}
              {!isAvailable && likeCount > 50 && ' 💛'}
            </div>
            {/* 입주일 + 공유 — 상단 배치 (#6) */}
            {!isAvailable && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                {house.occupied_at && (
                  <span style={{ fontSize: 13, color: '#6f6d6a', fontWeight: 500 }}>
                    입주일 {house.occupied_at.slice(0, 10)}
                  </span>
                )}
                <button onClick={handleShare} style={{ padding: '5px 12px', borderRadius: 10, border: '1px solid #e0ddd9', background: '#ffffff', color: copied ? '#1a1a1a' : '#6f6d6a', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {copied ? '복사됨 ✓' : '공유'}
                </button>
              </div>
            )}
          </div>

          {/* 바디 */}
          {isAvailable ? (
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontSize: 15, color: '#6f6d6a', lineHeight: 1.8, marginBottom: 28 }}>
                아직 아무도 살지 않는 빈 공간이에요.<br />당신만의 공간으로 꾸며보세요!
              </div>
              <button onClick={() => onBuy(house)} style={{ padding: '13px 32px', borderRadius: 10, cursor: 'pointer', background: '#1c1c1e', color: '#ffffff', border: 'none', fontSize: 15, fontWeight: 600 }}>입주 신청하기</button>
            </div>
          ) : isHidden ? (
            /* 비공개 집 */
            <div style={{ textAlign: 'center', padding: '52px 24px' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>비공개 집입니다</div>
              <div style={{ fontSize: 14, color: '#6f6d6a', lineHeight: 1.7 }}>이 집은 주인이 비공개로 설정해두었어요.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', minHeight: 180, overflowY: 'auto', flex: 1 }}>
              <div style={{ flex: 1, padding: '16px 20px', minWidth: 0 }}>
                {house.description && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#97948f', marginBottom: 8 }}>소개글</div>
                    <div style={{ fontSize: 14, color: '#1a1a1a', lineHeight: 1.9 }}>{house.description}</div>
                  </div>
                )}
                {(() => {
                  const links = (house.link_url ?? '').split('\n').map(u => u.trim()).filter(Boolean)
                    .map(u => ({ raw: u, safe: safeUrl(u) })).filter(l => l.safe)
                  if (links.length === 0) return null
                  return (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#97948f', marginBottom: 8 }}>링크</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {links.map((l, i) => (
                          <a key={i} href={l.safe!} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'flex-start', gap: 4, color: '#1a1a1a', fontSize: 13, fontWeight: 500, textDecoration: 'underline', wordBreak: 'break-all', lineHeight: 1.6 }}>
                            {l.raw}<span style={{ flexShrink: 0 }}>↗</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )
                })()}
                {!house.description && !house.link_url && (
                  <div style={{ color: '#6f6d6a', fontSize: 14, marginTop: 8 }}>소개글이 아직 없어요.</div>
                )}
              </div>
              {displayImage && (
                <div style={{ width: 210, flexShrink: 0, padding: '16px 16px 16px 0', display: 'flex', alignItems: 'center' }}>
                  <img src={displayImage} alt={house.name ?? ''} style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 10, border: '1px solid #e9e7e4' }} />
                </div>
              )}
            </div>
          )}

          {/* 통계 바 — 좋아요 · 방문 (좁게), 신고는 우측 하단 */}
          {!isAvailable && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '12px 20px', background: '#ffffff', borderTop: '1px solid #e9e7e4' }}>
              <button
                onClick={toggleLike}
                disabled={likeLoading}
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: 0, fontSize: 15, fontWeight: 600, color: liked ? '#dc2626' : '#6f6d6a' }}
              >
                {liked ? '❤️' : '🤍'} {likeCount.toLocaleString()}
              </button>
              <span style={{ fontSize: 14, fontWeight: 500, color: '#6f6d6a' }}>
                방문 {(house.visit_count + 1).toLocaleString()}
              </span>
              {/* 신고하기 — 본인 집이 아니고 로그인한 경우만 */}
              {currentUserId && !isOwnHouse && (
                <button onClick={() => setShowReport(true)} style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: 10, border: '1px solid #e0ddd9', background: '#ffffff', color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  신고
                </button>
              )}
            </div>
          )}

          {/* 내 집 관리 바 */}
          {isOwnHouse && !isAvailable && (
            <div style={{ padding: '10px 16px', background: '#f4f3f1', borderTop: '1px solid #e9e7e4', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#6f6d6a', fontWeight: 600, flex: 1 }}>
                내 집 {house.has_password && <span style={{ color: '#97948f' }}>· 잠금</span>}
              </span>
              <button onClick={() => requirePassword('edit')} style={{ padding: '8px 18px', borderRadius: 10, background: '#1c1c1e', border: 'none', color: '#ffffff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>수정</button>
              <button onClick={() => requirePassword('vacate')} style={{ padding: '8px 16px', borderRadius: 10, background: '#ffffff', border: '1px solid #e0ddd9', color: '#dc2626', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>퇴거</button>
            </div>
          )}

          {/* 관리자 삭제 바 */}
          {isAdmin && !isAvailable && (
            <div style={{ padding: '10px 16px', background: '#f4f3f1', borderTop: '1px solid #e9e7e4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#6f6d6a', fontWeight: 600 }}>관리자 모드</span>
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
              {resetMode ? '비밀번호 재설정' : pwdModal === 'edit' ? '수정하기' : '퇴거하기'}
            </div>
            <div style={{ fontSize:13, color:'#6f6d6a', textAlign:'center', marginBottom:20, lineHeight:1.7, whiteSpace:'pre-line' }}>
              {resetMode
                ? '로그인한 집주인이므로 예전 비밀번호 없이\n새 비밀번호로 재설정할 수 있어요.'
                : '이 집에 설정된 비밀번호를 입력해주세요.'}
            </div>
            <input
              type="password"
              autoFocus
              value={pwdInput}
              onChange={e => { setPwdInput(e.target.value); setPwdError('') }}
              onKeyDown={e => e.key === 'Enter' && (resetMode ? handlePwdReset() : handlePwdSubmit())}
              placeholder={resetMode ? '새 비밀번호' : '비밀번호 입력'}
              style={{
                width:'100%', padding:'11px 12px', borderRadius:10, boxSizing:'border-box',
                border:`1px solid ${pwdError ? '#dc2626' : '#e0ddd9'}`,
                background:'#ffffff', color:'#1a1a1a', fontSize:14, outline:'none',
              }}
            />
            {resetMode && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:8 }}>
                {(() => { const c = pwdChecks(pwdInput); return [
                  { ok: c.len, label:'10자 이상' },
                  { ok: c.alpha, label:'영문' },
                  { ok: c.num, label:'숫자' },
                  { ok: c.special, label:'특수문자' },
                ]})().map(chk => (
                  <span key={chk.label} style={{ fontSize:11, fontWeight:600, padding:'3px 8px', borderRadius:8, background: chk.ok ? '#eaf6ee' : '#f4f3f1', color: chk.ok ? '#16a34a' : '#97948f', border:`1px solid ${chk.ok ? '#d4ead9' : '#e9e7e4'}` }}>
                    {chk.ok ? '✓ ' : ''}{chk.label}
                  </span>
                ))}
              </div>
            )}
            {pwdError && <div style={{ fontSize:12, color:'#dc2626', marginTop:6, textAlign:'center' }}>{pwdError}</div>}
            {!resetMode && isOwnHouse && (
              <button
                onClick={() => { setResetMode(true); setPwdInput(''); setPwdError('') }}
                style={{ display:'block', margin:'12px auto 0', background:'none', border:'none', color:'#97948f', fontSize:12, textDecoration:'underline', cursor:'pointer' }}
              >
                비밀번호를 잊으셨나요?
              </button>
            )}
            <div style={{ display:'flex', gap:10, marginTop:18 }}>
              <button onClick={() => { if (resetMode) { setResetMode(false); setPwdInput(''); setPwdError('') } else setPwdModal(null) }} style={{ flex:1, padding:'11px', borderRadius:10, border:'1px solid #e0ddd9', background:'#ffffff', color:'#1a1a1a', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                {resetMode ? '뒤로' : '취소'}
              </button>
              {resetMode ? (
                <button
                  onClick={handlePwdReset}
                  disabled={!isPwdValid(pwdInput) || pwdLoading}
                  style={{
                    flex:2, padding:'11px', borderRadius:10, border:'none',
                    background:'#1c1c1e', color:'#ffffff', fontSize:13, fontWeight:600,
                    cursor: !isPwdValid(pwdInput) || pwdLoading ? 'default' : 'pointer',
                    opacity: !isPwdValid(pwdInput) || pwdLoading ? 0.5 : 1,
                  }}
                >
                  {pwdLoading ? '저장 중...' : '재설정하고 계속'}
                </button>
              ) : (
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
              )}
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
