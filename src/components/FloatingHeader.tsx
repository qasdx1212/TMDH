'use client'

import { useState, useRef, useEffect } from 'react'
import type { CellData } from '@/types/cell'


interface FloatingHeaderProps {
  occupiedCount: number
  totalCells: number
  userId?: string
  userEmail?: string
  isAdmin?: boolean
  isRealAdmin?: boolean          // 실제 관리자 계정 여부 (이용자 모드여도 true)
  viewAsUser?: boolean           // 이용자 모드로 보는 중
  onToggleViewAsUser?: () => void
  activeZone: string | null
  onZoneFilter: (zone: string | null) => void
  onApplyClick: () => void
  onMyHouseClick: () => void
  onLogin: () => void
  onLogout: () => void
  houses: CellData[]
  onSearchSelect: (house: CellData) => void
}

export default function FloatingHeader({
  occupiedCount, totalCells, userId, userEmail, isAdmin,
  isRealAdmin, viewAsUser, onToggleViewAsUser,
  activeZone, onZoneFilter,
  onApplyClick, onMyHouseClick, onLogin, onLogout,
  houses, onSearchSelect,
}: FloatingHeaderProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [alarmOpen, setAlarmOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)
  const occupancyRate = ((occupiedCount / totalCells) * 100).toFixed(1)
  const remainingCells = totalCells - occupiedCount                       // 남은 면적(칸)
  const houseCount = houses.filter(h => h.status === 'occupied' && !h.parent_address).length  // 실제 집 수(부모칸만)

  const results = searchQuery.trim().length >= 1
    ? houses.filter(h =>
        h.status === 'occupied' && (
          h.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          h.nickname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          h.address.toLowerCase().includes(searchQuery.toLowerCase())
        )
      ).slice(0, 6)
    : []

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchFocused(false)
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (house: CellData) => {
    onSearchSelect(house)
    setSearchQuery(''); setSearchFocused(false)
  }

  return (
    <div style={{
      position:'fixed', top:0, left:0, right:0, zIndex:300,
      background:'#ffffff',
      borderBottom:'1px solid #e9e7e4',
    }}>
      {/* 모바일 헤더 반응형: 좁은 화면(≤600px)에서 버튼 라벨을 숨기고 아이콘만 표시 */}
      <style>{`
        .fh-btn-icon { display: none; }
        @media (max-width: 600px) {
          .fh-main-row { padding: 0 10px !important; gap: 8px !important; }
          .fh-btn-group { gap: 6px !important; }
          .fh-action-btn { padding: 9px 12px !important; }
          .fh-btn-label { display: none !important; }
          .fh-btn-icon { display: inline !important; }
          .fh-profile-meta { display: none !important; }
          .fh-profile-btn { padding: 6px 8px !important; }
        }
      `}</style>
      {/* 메인 줄 */}
      <div className="fh-main-row" style={{ display:'flex', alignItems:'center', padding:'0 16px', height:58, gap:16 }}>
        {/* 로고 */}
        <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0, marginRight:4 }}>
          <div className="hide-on-mobile">
            <div style={{ display:'flex', alignItems:'center', gap:7 }}>
              <span style={{ fontSize:18, fontWeight:800, color:'#1a1a1a', letterSpacing:'-0.03em' }}>집.zip</span>
              <span style={{ fontSize:10, fontWeight:600, color:'#6f6d6a', background:'#f4f3f1', padding:'1px 6px', borderRadius:6, border:'1px solid #e9e7e4' }}>beta</span>
            </div>
            <div style={{ fontSize:11, color:'#97948f', marginTop:1 }}>당신만의 공간, 집.zip</div>
          </div>
        </div>

        {/* 통계 */}
        <div style={{ display:'flex', gap:24 }} className="hide-on-mobile">
          <StatItem label="전체 면적" value={`${totalCells.toLocaleString()}칸`} valueColor="#1a1a1a" />
          <StatItem label="분양률" value={`${occupancyRate}%`} valueColor="#1a1a1a" />
          <StatItem label="남은 면적" value={`${remainingCells.toLocaleString()}칸`} valueColor="#1a1a1a" />
          <StatItem label="입주한 집" value={`${houseCount.toLocaleString()}채`} valueColor="#1a1a1a" />
        </div>

        <div style={{ flex:1 }} />

        {/* 검색 */}
        <div ref={searchRef} style={{ position:'relative', width:220 }} className="hide-on-mobile">
          <div style={{ position:'relative' }}>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              placeholder="집 검색..."
              style={{
                width:'100%', padding:'8px 12px', borderRadius:10, boxSizing:'border-box' as const,
                background:'#ffffff', border:'1px solid #e9e7e4',
                color:'#1a1a1a', fontSize:12, outline:'none',
              }}
            />
          </div>
          {searchFocused && results.length > 0 && (
            <div style={{
              position:'absolute', top:'calc(100% + 6px)', left:0, right:0,
              background:'#ffffff', border:'1px solid #e9e7e4', borderRadius:12,
              overflow:'hidden', zIndex:400, boxShadow:'0 1px 3px rgba(0,0,0,0.05)',
            }}>
              {results.map(h => (
                <button key={h.id} onMouseDown={() => handleSelect(h)} style={{
                  display:'block', width:'100%', padding:'10px 14px',
                  background:'transparent', border:'none', borderBottom:'1px solid #e9e7e4',
                  color:'#1a1a1a', cursor:'pointer', textAlign:'left',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background='#f4f3f1')}
                  onMouseLeave={e => (e.currentTarget.style.background='transparent')}
                >
                  <div style={{ fontSize:12, fontWeight:600 }}>{h.nickname ? `${h.name} (${h.nickname})` : (h.name ?? h.address)}</div>
                  <div style={{ fontSize:10, color:'#6f6d6a', marginTop:2 }}>{h.address}</div>
                </button>
              ))}
            </div>
          )}
          {searchFocused && searchQuery.trim().length >= 1 && results.length === 0 && (
            <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, right:0, background:'#ffffff', border:'1px solid #e9e7e4', borderRadius:12, padding:'14px', fontSize:12, color:'#6f6d6a', zIndex:400, textAlign:'center', boxShadow:'0 1px 3px rgba(0,0,0,0.05)' }}>
              검색 결과가 없어요
            </div>
          )}
        </div>

        {/* 버튼 그룹 */}
        <div className="fh-btn-group" style={{ display:'flex', gap:8, flexShrink:0 }}>
          <button onClick={onApplyClick} className="fh-action-btn" style={{
            padding:'9px 20px', borderRadius:10, cursor:'pointer',
            background:'#1c1c1e',
            color:'#ffffff', fontSize:13, fontWeight:700,
            border:'1px solid #1c1c1e',
            display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap',
          }}><span className="fh-btn-icon">✏️</span><span className="fh-btn-label">입주 신청하기</span></button>

          <div style={{ position:'relative', flexShrink:0 }}>
            <button onClick={() => setAlarmOpen(o => !o)} style={{
              width:40, height:40, borderRadius:10,
              border: alarmOpen ? '1px solid #1c1c1e' : '1px solid #e0ddd9',
              background:'#ffffff', color:'#1a1a1a', fontSize:17, cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>🔔</button>
            {alarmOpen && (
              <>
                {/* 바깥 클릭 닫기 */}
                <div onClick={() => setAlarmOpen(false)} style={{ position:'fixed', inset:0, zIndex:399 }} />
                <div style={{
                  position:'absolute', top:'calc(100% + 6px)', right:0, width:240, zIndex:400,
                  background:'#ffffff', border:'1px solid #e9e7e4', borderRadius:12,
                  boxShadow:'0 8px 28px rgba(0,0,0,0.10)', overflow:'hidden',
                }}>
                  <div style={{ padding:'12px 14px', borderBottom:'1px solid #f0efec', fontSize:13, fontWeight:700, color:'#1a1a1a' }}>알림</div>
                  <div style={{ padding:'28px 14px', textAlign:'center', fontSize:12.5, color:'#97948f', lineHeight:1.7 }}>
                    새로운 알림이 없어요
                  </div>
                </div>
              </>
            )}
          </div>

          {userId && (
            <button onClick={onMyHouseClick} className="fh-action-btn" style={{
              padding:'9px 16px', borderRadius:10, cursor:'pointer',
              background:'#ffffff', color:'#1a1a1a',
              fontSize:13, fontWeight:600, border:'1px solid #e0ddd9',
              whiteSpace:'nowrap', display:'flex', alignItems:'center',
            }}><span className="fh-btn-icon">🏠</span><span className="fh-btn-label">내 집 보기</span></button>
          )}
          <a href="/faq" className="fh-action-btn" style={{
            padding:'9px 14px', borderRadius:10, cursor:'pointer',
            background:'#ffffff', color:'#1a1a1a',
            fontSize:12, fontWeight:600, border:'1px solid #e0ddd9',
            whiteSpace:'nowrap', textDecoration:'none', display:'flex', alignItems:'center',
          }}><span className="fh-btn-icon">❓</span><span className="fh-btn-label">FAQ</span></a>
          {isAdmin && (
            <a href="/admin" className="fh-action-btn" style={{
              padding:'9px 14px', borderRadius:10, cursor:'pointer',
              background:'#ffffff', color:'#1a1a1a',
              fontSize:12, fontWeight:600, border:'1px solid #e0ddd9',
              whiteSpace:'nowrap', textDecoration:'none', display:'flex', alignItems:'center',
            }}><span className="fh-btn-icon">🔑</span><span className="fh-btn-label">관리</span></a>
          )}

          {/* 로그인/프로필 */}
          {!userId ? (
            <button onClick={onLogin} className="fh-action-btn" style={{
              padding:'9px 16px', borderRadius:10, cursor:'pointer',
              background:'#ffffff',
              color:'#1a1a1a', fontSize:13, fontWeight:600,
              border:'1px solid #e0ddd9', whiteSpace:'nowrap',
              display:'flex', alignItems:'center',
            }}><span className="fh-btn-icon">🔑</span><span className="fh-btn-label">로그인</span></button>
          ) : (
            <div ref={profileRef} style={{ position:'relative', flexShrink:0 }}>
              <button onClick={() => setProfileOpen(p => !p)} className="fh-profile-btn" style={{
                display:'flex', alignItems:'center', gap:7, padding:'6px 12px 6px 8px',
                borderRadius:10, cursor:'pointer',
                background: profileOpen ? '#f4f3f1' : '#ffffff',
                border:'1px solid #e0ddd9', color:'#1a1a1a',
              }}>
                <div style={{
                  width:26, height:26, borderRadius:'50%',
                  background:'#f4f3f1',
                  border:'1px solid #e0ddd9',
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#6f6d6a', flexShrink:0,
                }}>{(isAdmin ? '관리자' : (userEmail?.split('@')[0] ?? '내 계정')).charAt(0).toUpperCase()}</div>
                <span className="fh-profile-meta" style={{ fontSize:12, fontWeight:600, maxWidth:100, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {isAdmin ? '관리자' : (userEmail?.split('@')[0] ?? '내 계정')}
                </span>
                <span className="fh-profile-meta" style={{ fontSize:9, color:'#97948f' }}>{profileOpen ? '▲' : '▼'}</span>
              </button>
              {profileOpen && (
                <div style={{
                  position:'absolute', top:'calc(100% + 6px)', right:0,
                  background:'#ffffff', border:'1px solid #e9e7e4', borderRadius:12,
                  overflow:'hidden', zIndex:500, minWidth:200,
                  boxShadow:'0 1px 3px rgba(0,0,0,0.05)',
                }}>
                  <div style={{ padding:'12px 14px', borderBottom:'1px solid #e9e7e4', background:'#f4f3f1' }}>
                    <div style={{ fontSize:10, color:'#6f6d6a', marginBottom:3 }}>로그인된 계정</div>
                    <div style={{ fontSize:12, color:'#1a1a1a', fontWeight:600, wordBreak:'break-all' }}>{userEmail}</div>
                    {isRealAdmin && (
                      <div style={{ marginTop:5, fontSize:10, fontWeight:600, color: viewAsUser ? '#97948f' : '#6f6d6a' }}>
                        {viewAsUser ? '이용자 모드로 보는 중' : '관리자 계정'}
                      </div>
                    )}
                  </div>
                  {/* 관리자/이용자 모드 전환 (실제 관리자만) */}
                  {isRealAdmin && (
                    <button onClick={() => { setProfileOpen(false); onToggleViewAsUser?.() }} style={{
                      display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, width:'100%',
                      padding:'11px 14px', background:'transparent', border:'none',
                      borderBottom:'1px solid #e9e7e4', color:'#1a1a1a',
                      fontSize:13, fontWeight:600, cursor:'pointer', textAlign:'left',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background='#f4f3f1')}
                      onMouseLeave={e => (e.currentTarget.style.background='transparent')}
                    >
                      <span>{viewAsUser ? '관리자 모드로 전환' : '이용자 모드로 보기'}</span>
                      <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:6, background: viewAsUser ? '#1c1c1e' : '#f4f3f1', color: viewAsUser ? '#fff' : '#6f6d6a', border:'1px solid #e0ddd9' }}>
                        {viewAsUser ? '이용자' : '관리자'}
                      </span>
                    </button>
                  )}
                  <button onClick={() => { setProfileOpen(false); onMyHouseClick() }} style={{
                    display:'flex', alignItems:'center', gap:10, width:'100%',
                    padding:'11px 14px', background:'transparent', border:'none',
                    borderBottom:'1px solid #e9e7e4', color:'#1a1a1a',
                    fontSize:13, fontWeight:600, cursor:'pointer', textAlign:'left',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background='#f4f3f1')}
                    onMouseLeave={e => (e.currentTarget.style.background='transparent')}
                  >내 집 보기</button>
                  <a href="/terms" style={{
                    display:'flex', alignItems:'center', gap:10, width:'100%',
                    padding:'10px 14px', background:'transparent',
                    borderBottom:'1px solid #e9e7e4', color:'#6f6d6a',
                    fontSize:12, textDecoration:'none',
                  }}>이용약관 · 개인정보처리방침</a>
                  <button onClick={() => { setProfileOpen(false); onLogout() }} style={{
                    display:'flex', alignItems:'center', gap:10, width:'100%',
                    padding:'11px 14px', background:'transparent', border:'none',
                    color:'#1a1a1a', fontSize:13, fontWeight:600,
                    cursor:'pointer', textAlign:'left',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background='#f4f3f1')}
                    onMouseLeave={e => (e.currentTarget.style.background='transparent')}
                  >로그아웃</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 하단 줄: 모바일 검색 + 링크 (줌 컨트롤은 StatsPanel 미니맵 옆으로 이동) */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'0 16px 8px', borderTop:'1px solid #e9e7e4', gap:12, minHeight:28,
      }}>
        <div style={{ flex: 1 }} />

        {/* 모바일 검색 */}
        <div ref={searchRef} style={{ position:'relative', flex:1 }} className="show-on-mobile">
          <div style={{ position:'relative' }}>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              placeholder="집 검색..."
              style={{
                width:'100%', padding:'6px 10px', borderRadius:10, boxSizing:'border-box' as const,
                background:'#ffffff', border:'1px solid #e9e7e4',
                color:'#1a1a1a', fontSize:12, outline:'none',
              }}
            />
          </div>
          {searchFocused && results.length > 0 && (
            <div style={{
              position:'absolute', top:'calc(100% + 4px)', left:0, right:0,
              background:'#ffffff', border:'1px solid #e9e7e4', borderRadius:12,
              overflow:'hidden', zIndex:400, boxShadow:'0 1px 3px rgba(0,0,0,0.05)',
            }}>
              {results.map(h => (
                <button key={h.id} onMouseDown={() => handleSelect(h)} style={{
                  display:'block', width:'100%', padding:'8px 12px',
                  background:'transparent', border:'none', borderBottom:'1px solid #e9e7e4',
                  color:'#1a1a1a', cursor:'pointer', textAlign:'left',
                }}>
                  <div style={{ fontSize:12, fontWeight:600 }}>{h.nickname ? `${h.name} (${h.nickname})` : (h.name ?? h.address)}</div>
                  <div style={{ fontSize:10, color:'#6f6d6a', marginTop:2 }}>{h.address}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 링크 */}
        <div style={{ display:'flex', alignItems:'center', gap:8 }} className="hide-on-mobile">
          <a href="/terms" style={{ fontSize:10, color:'#6f6d6a', textDecoration:'none' }}>이용약관</a>
          <span style={{ fontSize:10, color:'#97948f' }}>·</span>
          <a href="/privacy" style={{ fontSize:10, color:'#6f6d6a', textDecoration:'none' }}>개인정보처리방침</a>
          <span style={{ fontSize:10, color:'#97948f' }}>·</span>
          <span style={{ fontSize:10, color:'#6f6d6a' }}>스트릿애드</span>
        </div>
      </div>
    </div>
  )
}

function StatItem({ label, value, valueColor }: { label: string; value: string; valueColor: string }) {
  return (
    <div>
      <div style={{ fontSize:10, color:'#6f6d6a', fontWeight:500, letterSpacing:'0.01em', marginBottom:2 }}>{label}</div>
      <div style={{ fontSize:14, fontWeight:700, color:valueColor, letterSpacing:'-0.01em' }}>{value}</div>
    </div>
  )
}
