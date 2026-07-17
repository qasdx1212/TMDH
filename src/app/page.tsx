'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { hashPwd } from '@/lib/hash'
import { isAdminEmail } from '@/lib/admins'
import type { CellData, Zone } from '@/types/cell'
import MapGrid from '@/components/MapGrid'
import FloatingHeader from '@/components/FloatingHeader'
import HousePopup from '@/components/HousePopup'
import ApplyFlow from '@/components/ApplyFlow'
import StatsPanel from '@/components/StatsPanel'
import MyHousesDrawer from '@/components/MyHousesDrawer'
import OnboardingOverlay from '@/components/OnboardingOverlay'

export default function Home() {
  const [houses, setHouses] = useState<CellData[]>([])
  const [userId, setUserId] = useState<string | undefined>()
  const [userEmail, setUserEmail] = useState<string | undefined>()
  const isRealAdmin = isAdminEmail(userEmail)
  // 관리자가 "이용자 모드"로 볼 때 true (localStorage 저장). 이 땐 관리자 권한/버튼 숨김.
  const [viewAsUser, setViewAsUser] = useState(false)
  useEffect(() => { setViewAsUser(localStorage.getItem('zipzip_view_as_user') === '1') }, [])
  const toggleViewAsUser = useCallback(() => {
    setViewAsUser(v => { const nv = !v; localStorage.setItem('zipzip_view_as_user', nv ? '1' : '0'); return nv })
  }, [])
  const isAdmin = isRealAdmin && !viewAsUser
  const [myHouseIds, setMyHouseIds] = useState<Set<string>>(new Set())
  const [selectedCell, setSelectedCell] = useState<CellData | null>(null)
  const [showApply, setShowApply] = useState(false)
  const [applyCell, setApplyCell] = useState<CellData | null>(null)
  const [applyMode, setApplyMode] = useState(false)   // 지도에서 입주할 칸 고르는 모드
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
        setSelectedCell(null); setShowApply(false); setApplyCell(null); setShowMyHouses(false); setApplyMode(false)
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
    // 1000행 제한 대비 페이지네이션 (많이 소유 시 '내 집 테두리' 누락 방지)
    ;(async () => {
      const PAGE = 1000
      const ids = new Set<string>()
      for (let from = 0; from < 80000; from += PAGE) {
        const { data, error } = await supabase.from('houses').select('id')
          .eq('user_id', userId).order('id', { ascending: true }).range(from, from + PAGE - 1)
        if (error || !data || data.length === 0) break
        data.forEach((h: { id: string }) => ids.add(h.id))
        if (data.length < PAGE) break
      }
      setMyHouseIds(ids)
    })()
  }, [userId])

  const fetchHouses = useCallback(async () => {
    // public_houses 뷰: 비공개 집의 이름·소개글·이미지는 소유자 외엔 null 로 마스킹됨
    // (직접 houses 테이블을 읽지 않으므로 F12 네트워크 탭에도 비공개 내용이 안 보임)
    // ⚠️ .range(0,79999) 만으로는 Supabase db-max-rows(기본 1000) 에 막힘 →
    //    1000행씩 페이지네이션으로 전부 불러온다 (대표칸 누락으로 인한 '유령 집' 방지)
    const COLS = 'id, address, col, row, width, height, zone, status, name, nickname, description, link_url, exterior_image_url, interior_image_url, border_effect, like_count, visit_count, occupied_at, expires_at, is_permanent, parent_address, is_visible, has_password'
    const PAGE = 1000
    const all: CellData[] = []
    for (let from = 0; from < 80000; from += PAGE) {
      const { data, error } = await supabase
        .from('public_houses').select(COLS)
        .neq('status', 'available')
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1)
      if (error || !data || data.length === 0) break
      all.push(...(data as CellData[]))
      if (data.length < PAGE) break
    }
    setHouses(all)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchHouses()
    // 실시간 변경을 디바운스: 멀티셀 입주(수백 건 이벤트)가 전체 재조회를 폭주시키지 않게
    // 마지막 변경 후 600ms 뒤에 한 번만 재조회
    let timer: ReturnType<typeof setTimeout> | null = null
    const channel = supabase.channel('houses-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'houses' }, () => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => fetchHouses(), 600)
      })
      .subscribe()
    return () => { if (timer) clearTimeout(timer); supabase.removeChannel(channel) }
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
      id: '', address: `${prefix}-${String(row * 400 + col).padStart(5, '0')}`,
      col, row, width, height, zone, status: 'available',
      name: null, nickname: null, description: null, link_url: null,
      exterior_image_url: null, border_effect: 'none',
      like_count: 0, visit_count: 0, occupied_at: null, expires_at: null, is_permanent: false,
    }
    setApplyMode(false)
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
    // 자식칸은 width/height 값에 상관없이 항상 정리 (고아 셀 방지)
    {
      await supabase.from('houses').update({
        user_id: null, status: 'available', parent_address: null,
        occupied_at: null, expires_at: null, is_permanent: false,
      }).eq('parent_address', cell.address)
    }
    setSelectedCell(null)
    fetchHouses()
  }, [fetchHouses])

  const HEADER_H = 58 + 36  // FloatingHeader 실제 높이
  const STATS_H = 188       // StatsPanel 실제 높이 (스탯 160 + 사업자정보 푸터 28)

  return (
    <div style={{ width:'100vw', height:'100vh', background:'#f4f3f1', overflow:'hidden' }}>
      <OnboardingOverlay />
      <FloatingHeader
        occupiedCount={occupiedCount}
        totalCells={80000}
        userId={userId}
        userEmail={userEmail}
        isAdmin={isAdmin}
        isRealAdmin={isRealAdmin}
        viewAsUser={viewAsUser}
        onToggleViewAsUser={toggleViewAsUser}
        activeZone={activeZone}
        onZoneFilter={setActiveZone}
        onApplyClick={() => { if (!userId) setShowApply(true); else setApplyMode(m => !m) }}
        onMyHouseClick={() => setShowMyHouses(true)}
        onLogin={() => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback` } })}
        onLogout={() => supabase.auth.signOut()}
        houses={houses}
        onSearchSelect={(house) => {
          setSelectedCell(house)
          setCenterTarget({ col: house.col, row: house.row })
          setTimeout(() => setCenterTarget(null), 100)
        }}
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
            applyMode={applyMode}
            onCancelApply={() => setApplyMode(false)}
          />
        )}
      </div>

      {/* 스탯: 하단 고정 */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0 }}>
        <StatsPanel
          houses={houses}
          mapViewport={mapViewport}
          onZoomIn={() => zoomInRef.current?.()}
          onZoomOut={() => zoomOutRef.current?.()}
          onFitView={() => fitViewRef.current?.()}
        />
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
          isAdmin={isAdmin}
          onClose={() => { setShowApply(false); setApplyCell(null) }}
          onSuccess={handleApplySuccess}
        />
      )}

      {showApply && !userId && (
        <div style={{ position:'fixed', inset:0, zIndex:600, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.4)' }}>
          <div style={{
            background:'#ffffff', borderRadius:14, padding:'32px 28px', textAlign:'center',
            maxWidth:340, width:'90vw',
            border:'1px solid #e9e7e4', boxShadow:'0 12px 40px rgba(0,0,0,0.14)',
          }}>
            <div style={{ fontSize:18, fontWeight:700, color:'#1a1a1a', marginBottom:8 }}>로그인이 필요해요</div>
            <div style={{ fontSize:13, color:'#6f6d6a', marginBottom:24, lineHeight:1.7 }}>입주 신청을 위해<br />구글 계정으로 로그인해 주세요.</div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setShowApply(false)} style={{ flex:1, padding:'12px', borderRadius:10, border:'1px solid #e0ddd9', background:'#ffffff', cursor:'pointer', fontSize:13, fontWeight:600, color:'#1a1a1a' }}>취소</button>
              <button
                onClick={() => supabase.auth.signInWithOAuth({ provider:'google', options:{ redirectTo:`${window.location.origin}/auth/callback` } })}
                style={{ flex:2, padding:'12px', borderRadius:10, border:'1px solid #1c1c1e', background:'#1c1c1e', color:'#ffffff', cursor:'pointer', fontSize:13, fontWeight:700 }}
              >구글로 로그인</button>
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
