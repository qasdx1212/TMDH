'use client'

import { useState, useRef, useEffect } from 'react'
import type { CellData } from '@/types/cell'


interface FloatingHeaderProps {
  occupiedCount: number
  totalCells: number
  totalDonation: number
  userId?: string
  userEmail?: string
  isAdmin?: boolean
  activeZone: string | null
  onZoneFilter: (zone: string | null) => void
  onApplyClick: () => void
  onMyHouseClick: () => void
  onLogin: () => void
  onLogout: () => void
  houses: CellData[]
  onSearchSelect: (house: CellData) => void
  onZoomIn?: () => void
  onZoomOut?: () => void
  onFitView?: () => void
}

export default function FloatingHeader({
  occupiedCount, totalCells, totalDonation, userId, userEmail, isAdmin,
  activeZone, onZoneFilter,
  onApplyClick, onMyHouseClick, onLogin, onLogout,
  houses, onSearchSelect,
  onZoomIn, onZoomOut, onFitView,
}: FloatingHeaderProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [alarmMsg, setAlarmMsg] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)
  const occupancyRate = ((occupiedCount / totalCells) * 100).toFixed(1)

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
      background:'linear-gradient(180deg,#2c1a08 0%,#1e1005 100%)',
      borderBottom:'3px solid #6b4c2a',
      boxShadow:'0 4px 20px rgba(0,0,0,0.5)',
      fontFamily:'"Noto Sans KR",-apple-system,sans-serif',
    }}>
      {/* 메인 줄 */}
      <div style={{ display:'flex', alignItems:'center', padding:'0 16px', height:58, gap:16 }}>
        {/* 로고 */}
        <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0, marginRight:4 }}>
          <div style={{
            width:40, height:40, borderRadius:8,
            background:'linear-gradient(135deg,#8b6914,#5a3e10)',
            border:'2px solid #c8a96e',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:22, boxShadow:'0 2px 0 #3d2a08', flexShrink:0,
          }}>🏠</div>
          <div className="hide-on-mobile">
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:17, fontWeight:900, color:'#fdf6e3', letterSpacing:'-0.03em' }}>집.zip</span>
              <span style={{ fontSize:9, fontWeight:700, color:'#c084fc', background:'#c084fc20', padding:'1px 5px', borderRadius:3, border:'1px solid #c084fc44' }}>BETA</span>
            </div>
            <div style={{ fontSize:9, color:'#7a5c3a' }}>당신만의 공간, 집.zip</div>
          </div>
        </div>

        {/* 통계 */}
        <div style={{ display:'flex', gap:24 }} className="hide-on-mobile">
          <StatItem label="전체 면적" value="1,000,000 pixels" valueColor="#d4b483" />
          <StatItem label="분양률" value={`${occupancyRate}%`} valueColor="#4ade80" />
          <StatItem label="누적 기부금" value={`₩ ${totalDonation.toLocaleString()}`} valueColor="#f87171" />
        </div>

        <div style={{ flex:1 }} />

        {/* 검색 */}
        <div ref={searchRef} style={{ position:'relative', width:220 }} className="hide-on-mobile">
          <div style={{ position:'relative' }}>
            <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', fontSize:13, color:'#7a5c3a', pointerEvents:'none' }}>🔍</span>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              placeholder="집 검색..."
              style={{
                width:'100%', padding:'7px 10px 7px 28px', borderRadius:8, boxSizing:'border-box' as const,
                background:'rgba(255,255,255,0.08)', border:'1.5px solid #4a3010',
                color:'#fdf6e3', fontSize:12, outline:'none', fontFamily:'inherit',
              }}
            />
          </div>
          {searchFocused && results.length > 0 && (
            <div style={{
              position:'absolute', top:'calc(100% + 6px)', left:0, right:0,
              background:'#2a1a08', border:'2px solid #8b6914', borderRadius:8,
              overflow:'hidden', zIndex:400, boxShadow:'0 8px 30px rgba(0,0,0,0.6)',
            }}>
              {results.map(h => (
                <button key={h.id} onMouseDown={() => handleSelect(h)} style={{
                  display:'block', width:'100%', padding:'10px 14px',
                  background:'transparent', border:'none', borderBottom:'1px solid #3d2a1844',
                  color:'#fdf6e3', cursor:'pointer', textAlign:'left', fontFamily:'inherit',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background='#3d2a18')}
                  onMouseLeave={e => (e.currentTarget.style.background='transparent')}
                >
                  <div style={{ fontSize:12, fontWeight:700 }}>{h.nickname ? `${h.name} (${h.nickname})` : (h.name ?? h.address)}</div>
                  <div style={{ fontSize:10, color:'#8b6914', marginTop:2 }}>{h.address}</div>
                </button>
              ))}
            </div>
          )}
          {searchFocused && searchQuery.trim().length >= 1 && results.length === 0 && (
            <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, right:0, background:'#2a1a08', border:'2px solid #8b6914', borderRadius:8, padding:'14px', fontSize:12, color:'#78614a', zIndex:400, textAlign:'center' }}>
              검색 결과가 없어요
            </div>
          )}
        </div>

        {/* 버튼 그룹 */}
        <div style={{ display:'flex', gap:8, flexShrink:0 }}>
          <button onClick={onApplyClick} style={{
            padding:'9px 20px', borderRadius:8, cursor:'pointer',
            background:'linear-gradient(180deg,#8b6914,#6b4c10)',
            color:'#fdf6e3', fontSize:13, fontWeight:700,
            border:'2px solid #c8a96e', boxShadow:'0 3px 0 #3d2a08',
            display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap',
          }}>✏️ 입주 신청하기</button>

          <div style={{ position:'relative', flexShrink:0 }}>
            <button onClick={() => { setAlarmMsg(true); setTimeout(() => setAlarmMsg(false), 2000) }} style={{
              width:40, height:40, borderRadius:8, border:'2px solid #4a3010',
              background:'rgba(255,255,255,0.06)', color:'#a08060', fontSize:18, cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>🔔</button>
            {alarmMsg && (
              <div style={{
                position:'absolute', top:'calc(100% + 6px)', right:0, whiteSpace:'nowrap',
                background:'#2a1a08', border:'1.5px solid #8b6914', borderRadius:8,
                padding:'8px 14px', fontSize:11, color:'#c8a96e', zIndex:400,
                boxShadow:'0 4px 16px rgba(0,0,0,0.5)',
              }}>🔔 알림 기능 준비 중이에요</div>
            )}
          </div>

          {userId && (
            <button onClick={onMyHouseClick} style={{
              padding:'9px 16px', borderRadius:8, cursor:'pointer',
              background:'rgba(255,255,255,0.08)', color:'#d4b483',
              fontSize:13, fontWeight:600, border:'2px solid #4a3010',
              whiteSpace:'nowrap',
            }}>내 집 보기</button>
          )}
          <a href="/faq" style={{
            padding:'9px 14px', borderRadius:8, cursor:'pointer',
            background:'rgba(255,255,255,0.06)', color:'#a08060',
            fontSize:12, fontWeight:600, border:'2px solid #4a3010',
            whiteSpace:'nowrap', textDecoration:'none', display:'flex', alignItems:'center',
          }}>❓ FAQ</a>
          {isAdmin && (
            <a href="/admin" style={{
              padding:'9px 14px', borderRadius:8, cursor:'pointer',
              background:'rgba(239,68,68,0.12)', color:'#f87171',
              fontSize:12, fontWeight:700, border:'2px solid #ef444444',
              whiteSpace:'nowrap', textDecoration:'none', display:'flex', alignItems:'center',
            }}>🔑 관리</a>
          )}

          {/* 로그인/프로필 */}
          {!userId ? (
            <button onClick={onLogin} style={{
              padding:'9px 16px', borderRadius:8, cursor:'pointer',
              background:'linear-gradient(180deg,#3b5bdb,#2c47c4)',
              color:'#fff', fontSize:13, fontWeight:700,
              border:'2px solid #4c6ef5', whiteSpace:'nowrap',
              boxShadow:'0 3px 0 #1a2d7a',
            }}>🔑 로그인</button>
          ) : (
            <div ref={profileRef} style={{ position:'relative', flexShrink:0 }}>
              <button onClick={() => setProfileOpen(p => !p)} style={{
                display:'flex', alignItems:'center', gap:7, padding:'6px 12px 6px 8px',
                borderRadius:8, cursor:'pointer',
                background: profileOpen ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.08)',
                border:'2px solid #4a3010', color:'#d4b483',
              }}>
                <div style={{
                  width:26, height:26, borderRadius:'50%',
                  background:'linear-gradient(135deg,#8b6914,#5a3e10)',
                  border:`2px solid ${isAdmin ? '#f87171' : '#c8a96e'}`,
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, flexShrink:0,
                }}>{isAdmin ? '👑' : '👤'}</div>
                <span style={{ fontSize:12, fontWeight:600, maxWidth:100, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {isAdmin ? '관리자' : (userEmail?.split('@')[0] ?? '내 계정')}
                </span>
                <span style={{ fontSize:10, color:'#7a5c3a' }}>{profileOpen ? '▲' : '▼'}</span>
              </button>
              {profileOpen && (
                <div style={{
                  position:'absolute', top:'calc(100% + 6px)', right:0,
                  background:'#2a1a08', border:'2px solid #8b6914', borderRadius:10,
                  overflow:'hidden', zIndex:500, minWidth:200,
                  boxShadow:'0 8px 32px rgba(0,0,0,0.7)',
                  fontFamily:'"Noto Sans KR", sans-serif',
                }}>
                  <div style={{ padding:'12px 14px', borderBottom:'1px solid #4a3010' }}>
                    <div style={{ fontSize:10, color:'#7a5c3a', marginBottom:3 }}>로그인된 계정</div>
                    <div style={{ fontSize:12, color:'#fdf6e3', fontWeight:600, wordBreak:'break-all' }}>{userEmail}</div>
                    {isAdmin && <div style={{ marginTop:5, fontSize:10, color:'#f87171', fontWeight:700 }}>👑 관리자 계정</div>}
                  </div>
                  <button onClick={() => { setProfileOpen(false); onMyHouseClick() }} style={{
                    display:'flex', alignItems:'center', gap:10, width:'100%',
                    padding:'11px 14px', background:'transparent', border:'none',
                    borderBottom:'1px solid #3d2a1830', color:'#fdf6e3',
                    fontSize:13, fontWeight:600, cursor:'pointer', textAlign:'left', fontFamily:'inherit',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background='#3d2a18')}
                    onMouseLeave={e => (e.currentTarget.style.background='transparent')}
                  >🏠 내 집 보기</button>
                  <a href="/terms" style={{
                    display:'flex', alignItems:'center', gap:10, width:'100%',
                    padding:'10px 14px', background:'transparent',
                    borderBottom:'1px solid #3d2a1830', color:'#7a5c3a',
                    fontSize:12, textDecoration:'none',
                  }}>📄 이용약관 · 개인정보처리방침</a>
                  <button onClick={() => { setProfileOpen(false); onLogout() }} style={{
                    display:'flex', alignItems:'center', gap:10, width:'100%',
                    padding:'11px 14px', background:'transparent', border:'none',
                    color:'#f87171', fontSize:13, fontWeight:600,
                    cursor:'pointer', textAlign:'left', fontFamily:'inherit',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background='#3d1a1a')}
                    onMouseLeave={e => (e.currentTarget.style.background='transparent')}
                  >🚪 로그아웃</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 하단 줄: 범례 + 줌 컨트롤 */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'0 16px 8px', borderTop:'1px solid #4a3010', gap:12,
      }}>
        <div style={{ flex: 1 }} />

        {/* 모바일 검색 */}
        <div ref={searchRef} style={{ position:'relative', flex:1 }} className="show-on-mobile">
          <div style={{ position:'relative' }}>
            <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', fontSize:12, color:'#7a5c3a', pointerEvents:'none' }}>🔍</span>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              placeholder="집 검색..."
              style={{
                width:'100%', padding:'5px 8px 5px 26px', borderRadius:6, boxSizing:'border-box' as const,
                background:'rgba(255,255,255,0.08)', border:'1.5px solid #4a3010',
                color:'#fdf6e3', fontSize:12, outline:'none', fontFamily:'inherit',
              }}
            />
          </div>
          {searchFocused && results.length > 0 && (
            <div style={{
              position:'absolute', top:'calc(100% + 4px)', left:0, right:0,
              background:'#2a1a08', border:'2px solid #8b6914', borderRadius:8,
              overflow:'hidden', zIndex:400, boxShadow:'0 8px 30px rgba(0,0,0,0.6)',
            }}>
              {results.map(h => (
                <button key={h.id} onMouseDown={() => handleSelect(h)} style={{
                  display:'block', width:'100%', padding:'8px 12px',
                  background:'transparent', border:'none', borderBottom:'1px solid #3d2a1844',
                  color:'#fdf6e3', cursor:'pointer', textAlign:'left', fontFamily:'inherit',
                }}>
                  <div style={{ fontSize:12, fontWeight:700 }}>{h.nickname ? `${h.name} (${h.nickname})` : (h.name ?? h.address)}</div>
                  <div style={{ fontSize:10, color:'#8b6914', marginTop:2 }}>{h.address}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 링크 */}
        <div style={{ display:'flex', alignItems:'center', gap:8 }} className="hide-on-mobile">
          <a href="/terms" style={{ fontSize:10, color:'#5a4030', textDecoration:'none' }}>이용약관</a>
          <span style={{ fontSize:10, color:'#3d2a18' }}>·</span>
          <a href="/privacy" style={{ fontSize:10, color:'#5a4030', textDecoration:'none' }}>개인정보처리방침</a>
          <span style={{ fontSize:10, color:'#3d2a18' }}>·</span>
          <span style={{ fontSize:10, color:'#3d2a18' }}>스트릿애드</span>
        </div>

        {/* 줌 컨트롤 */}
        <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
          <span style={{ fontSize:10, color:'#7a5c3a', marginRight:4 }} className="hide-on-mobile">지도 확대/축소</span>
          <button onClick={onZoomIn} style={zoomBtnStyle} title="확대">+</button>
          <button onClick={onZoomOut} style={zoomBtnStyle} title="축소">−</button>
          <button onClick={onFitView} style={{ ...zoomBtnStyle, fontSize:14 }} title="전체 보기">⤢</button>
        </div>
      </div>
    </div>
  )
}

const zoomBtnStyle: React.CSSProperties = {
  width:28, height:28, borderRadius:6, border:'1.5px solid #4a3010',
  background:'rgba(255,255,255,0.06)', color:'#d4b483',
  fontSize:16, fontWeight:700, cursor:'pointer',
  display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1,
  padding:0,
}

function StatItem({ label, value, valueColor }: { label: string; value: string; valueColor: string }) {
  return (
    <div>
      <div style={{ fontSize:9, color:'#7a5c3a', fontWeight:600, letterSpacing:'0.05em', marginBottom:1 }}>{label}</div>
      <div style={{ fontSize:14, fontWeight:800, color:valueColor, letterSpacing:'-0.01em' }}>{value}</div>
    </div>
  )
}
