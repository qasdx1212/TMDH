'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { hashPwd } from '@/lib/hash'
import type { CellData, Zone } from '@/types/cell'
import MapGrid from '@/components/MapGrid'
import FloatingHeader from '@/components/FloatingHeader'
import HousePopup from '@/components/HousePopup'
import ApplyFlow from '@/components/ApplyFlow'
import StatsPanel from '@/components/StatsPanel'
import MyHousesDrawer from '@/components/MyHousesDrawer'

export default function Home() {
  const [houses, setHouses] = useState<CellData[]>([])
  const [userId, setUserId] = useState<string | undefined>()
  const [userEmail, setUserEmail] = useState<string | undefined>()
  const isAdmin = userEmail === 'qasdx1212@gmail.com'
  const [myHouseIds, setMyHouseIds] = useState<Set<string>>(new Set())
  const [selectedCell, setSelectedCell] = useState<CellData | null>(null)
  const [showApply, setShowApply] = useState(false)
  const [applyCell, setApplyCell] = useState<CellData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeZone, setActiveZone] = useState<string | null>(null)
  const [showMyHouses, setShowMyHouses] = useState(false)
  const [centerTarget, setCenterTarget] = useState<{ col: number; row: number } | null>(null)

  const zoomInRef = useRef<(() => void) | null>(null)
  const zoomOutRef = useRef<(() => void) | null>(null)
  const fitViewRef = useRef<(() => void) | null>(null)
  const deepLinkProcessed = useRef(false)
  const [mapViewport, setMapViewport] = useState<{ scale: number; offset: { x: number; y: number }; containerW: number; containerH: number; mapW: number } | null>(null)

  // Escape키로 모든 팝업 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedCell(null); setShowApply(false); setApplyCell(null); setShowMyHouses(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // URL 딥링크: popup 열릴 때 ?house= 업데이트
  useEffect(() => {
    if (selectedCell && selectedCell.status === 'occupied') {
      const url = new URL(window.location.href)
      url.searchParams.set('house', selectedCell.address)
      window.history.replaceState(null, '', url.toString())
    } else {
      const url = new URL(window.location.href)
      url.searchParams.delete('house')
      window.history.replaceState(null, '', url.toString())
    }
  }, [selectedCell])

  const occupiedCount = houses.filter(h => h.status === 'occupied').length
  const totalDonation = occupiedCount * 5000

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id)
      setUserEmail(data.user?.email ?? undefined)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUserId(session?.user?.id)
      setUserEmail(session?.user?.email ?? undefined)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!userId) return
    supabase.from('houses').select('id').eq('user_id', userId)
      .then(({ data }) => setMyHouseIds(new Set((data ?? []).map((h: { id: string }) => h.id))))
  }, [userId])

  const fetchHouses = useCallback(async () => {
    const { data } = await supabase
      .from('houses')
      .select('id, address, col, row, width, height, zone, status, name, nickname, description, link_url, exterior_image_url, interior_image_url, border_effect, like_count, visit_count, occupied_at, expires_at, is_permanent, parent_address, is_visible, has_password')
      .neq('status', 'available')
      .range(0, 19999)
    setHouses((data ?? []) as CellData[])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchHouses()
    const channel = supabase.channel('houses-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'houses' }, () => fetchHouses())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchHouses])

  // URL 파라미터로 특정 집 자동 오픈 (최초 1회만)
  useEffect(() => {
    if (loading || deepLinkProcessed.current) return
    deepLinkProcessed.current = true
    const params = new URLSearchParams(window.location.search)
    const houseAddr = params.get('house')
    if (!houseAddr) return
    const target = houses.find(h => h.address === houseAddr)
    if (target) setSelectedCell(target)
  }, [loading, houses])

  const openApply = useCallback((cell: CellData) => {
    setApplyCell(cell); setShowApply(true)
  }, [])

  const handleCellClick = useCallback((cell: CellData) => {
    if (cell.status === 'available') openApply(cell)
    else setSelectedCell(cell)
  }, [openApply])

  const handleAreaSelect = useCallback(({ col, row, width, height, zone }: { col: number; row: number; width: number; height: number; zone: Zone }) => {
    const prefix = { neon:'N', riverside:'R', oldtown:'O', artdistrict:'A' }[zone]
    const cell: CellData = {
      id: '', address: `${prefix}-${String(row * 200 + col).padStart(5, '0')}`,
      col, row, width, height, zone, status: 'available',
      name: null, nickname: null, description: null, link_url: null,
      exterior_image_url: null, border_effect: 'none',
      like_count: 0, visit_count: 0, occupied_at: null, expires_at: null, is_permanent: false,
    }
    openApply(cell)
  }, [openApply])

  const handleApplySuccess = useCallback(() => {
    setShowApply(false); setApplyCell(null); fetchHouses()
  }, [fetchHouses])

  const handleVacate = useCallback(async (cell: CellData) => {
    // 비밀번호 보호된 집은 context menu 경로도 검증 (admin 제외)
    if (!isAdmin && cell.has_password) {
      const pwd = window.prompt('비밀번호를 입력해주세요:')
      if (!pwd) return
      const hash = await hashPwd(pwd)
      const { data } = await supabase.rpc('verify_house_password', { house_address: cell.address, pwd_hash: hash })
      if (!data) { alert('비밀번호가 틀렸어요 🔒'); return }
    }
    if (!confirm(`"${cell.name ?? cell.address}"에서 퇴거하시겠어요?\n이 작업은 되돌릴 수 없습니다.`)) return
    await supabase.from('houses').update({
      user_id: null, name: null, nickname: null, description: null,
      link_url: null, exterior_image_url: null, interior_image_url: null,
      border_effect: 'none', status: 'available', width: 1, height: 1,
      parent_address: null, occupied_at: null, expires_at: null,
      is_permanent: false, like_count: 0, visit_count: 0, is_visible: true,
    }).eq('id', cell.id)
    if ((cell.width ?? 1) > 1 || (cell.height ?? 1) > 1) {
      await supabase.from('houses').update({
        user_id: null, status: 'available', parent_address: null,
        occupied_at: null, expires_at: null, is_permanent: false,
      }).eq('parent_address', cell.address)
    }
    setSelectedCell(null)
    fetchHouses()
  }, [fetchHouses])

  const HEADER_H = 58 + 36  // FloatingHeader 실제 높이
  const STATS_H = 148       // StatsPanel 실제 높이

  return (
    <div style={{ width:'100vw', height:'100vh', background:'#1a0f05', overflow:'hidden' }}>
      <FloatingHeader
        occupiedCount={occupiedCount}
        totalCells={20000}
        totalDonation={totalDonation}
        userId={userId}
        userEmail={userEmail}
        isAdmin={isAdmin}
        activeZone={activeZone}
        onZoneFilter={setActiveZone}
        onApplyClick={() => setShowApply(true)}
        onMyHouseClick={() => setShowMyHouses(true)}
        onLogin={() => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback` } })}
        onLogout={() => supabase.auth.signOut()}
        houses={houses}
        onSearchSelect={(house) => {
          setSelectedCell(house)
          setCenterTarget({ col: house.col, row: house.row })
          setTimeout(() => setCenterTarget(null), 100)
        }}
        onZoomIn={() => zoomInRef.current?.()}
        onZoomOut={() => zoomOutRef.current?.()}
        onFitView={() => fitViewRef.current?.()}
      />

      {/* 맵: 헤더 아래~스탯 위 사이 고정 영역 */}
      <div style={{ position:'fixed', top:HEADER_H, left:0, right:0, bottom:STATS_H, overflow:'hidden' }}>
        {loading ? (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'#a07850', fontSize:14 }}>
            지도를 불러오는 중...
          </div>
        ) : (
          <MapGrid
            houses={houses}
            onCellClick={handleCellClick}
            onAreaSelect={handleAreaSelect}
            myHouseIds={myHouseIds}
            activeZone={activeZone}
            centerTarget={centerTarget}
            zoomInRef={zoomInRef}
            zoomOutRef={zoomOutRef}
            fitViewRef={fitViewRef}
            isAdmin={isAdmin}
            onViewCell={setSelectedCell}
            onEditCell={(cell) => { setSelectedCell(null); openApply(cell) }}
            onVacateCell={handleVacate}
            onViewportChange={setMapViewport}
          />
        )}
      </div>

      {/* 스탯: 하단 고정 */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0 }}>
        <StatsPanel houses={houses} mapViewport={mapViewport} />
      </div>

      {selectedCell && (
        <HousePopup
          house={selectedCell}
          currentUserId={userId}
          isAdmin={isAdmin}
          isOwnHouse={myHouseIds.has(selectedCell.id)}
          onClose={() => setSelectedCell(null)}
          onBuy={(cell) => { setSelectedCell(null); openApply(cell) }}
          onEdit={(cell) => { setSelectedCell(null); openApply(cell) }}
          onVacate={handleVacate}
          onAdminDelete={() => { setSelectedCell(null); fetchHouses() }}
        />
      )}

      {showApply && applyCell && userId && (
        <ApplyFlow
          selectedCell={applyCell}
          userId={userId}
          onClose={() => { setShowApply(false); setApplyCell(null) }}
          onSuccess={handleApplySuccess}
        />
      )}

      {showApply && !userId && (
        <div style={{ position:'fixed', inset:0, zIndex:600, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.82)', backdropFilter:'blur(6px)' }}>
          <div style={{
            background:'#fdf6e3', borderRadius:12, padding:'32px 28px', textAlign:'center',
            maxWidth:340, width:'90vw', fontFamily:'"Noto Sans KR",-apple-system,sans-serif',
            border:'4px solid #7a4f1a', boxShadow:'0 0 0 2px #e8c97a, 0 0 0 5px #7a4f1a, 0 24px 60px rgba(0,0,0,0.7)',
          }}>
            <div style={{ fontSize:52, marginBottom:12 }}>🔑</div>
            <div style={{ fontSize:18, fontWeight:800, color:'#3d2a18', marginBottom:8 }}>로그인이 필요해요</div>
            <div style={{ fontSize:13, color:'#78614a', marginBottom:24, lineHeight:1.7 }}>입주 신청을 위해<br />구글 계정으로 로그인해 주세요.</div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setShowApply(false)} style={{ flex:1, padding:'11px', borderRadius:8, border:'2px solid #c8a96e', background:'#f5ead5', cursor:'pointer', fontSize:13, fontWeight:600, color:'#78614a' }}>취소</button>
              <button
                onClick={() => supabase.auth.signInWithOAuth({ provider:'google', options:{ redirectTo:`${window.location.origin}/auth/callback` } })}
                style={{ flex:2, padding:'11px', borderRadius:8, border:'2px solid #8b6914', background:'linear-gradient(180deg,#8b6914,#6b4c10)', color:'#fdf6e3', cursor:'pointer', fontSize:13, fontWeight:700, boxShadow:'0 3px 0 #3d2a08' }}
              >🔍 구글로 로그인</button>
            </div>
          </div>
        </div>
      )}

      {showMyHouses && userId && (
        <MyHousesDrawer
          userId={userId}
          isAdmin={isAdmin}
          onClose={() => setShowMyHouses(false)}
          onEdit={(house) => { setShowMyHouses(false); openApply(house) }}
          onRefresh={fetchHouses}
        />
      )}
    </div>
  )
}
