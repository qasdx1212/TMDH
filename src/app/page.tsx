'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getZone } from '@/lib/constants'
import type { CellData } from '@/types/cell'
import MapGrid from '@/components/MapGrid'
import FloatingHeader from '@/components/FloatingHeader'
import HousePopup from '@/components/HousePopup'
import ApplyFlow from '@/components/ApplyFlow'
import StatsPanel from '@/components/StatsPanel'
import MyHousesDrawer from '@/components/MyHousesDrawer'

export default function Home() {
  const [houses, setHouses] = useState<CellData[]>([])
  const [userId, setUserId] = useState<string | undefined>()
  const [myHouseIds, setMyHouseIds] = useState<Set<string>>(new Set())
  const [selectedCell, setSelectedCell] = useState<CellData | null>(null)
  const [showApply, setShowApply] = useState(false)
  const [applyCell, setApplyCell] = useState<CellData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeZone, setActiveZone] = useState<string | null>(null)
  const [showMyHouses, setShowMyHouses] = useState(false)

  const occupiedCount = houses.filter(h => h.status === 'occupied').length
  const totalDonation = occupiedCount * 5000

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUserId(session?.user?.id)
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
      .select('id, address, col, row, width, height, zone, status, name, nickname, description, link_url, exterior_image_url, border_effect, like_count, visit_count, occupied_at, expires_at, is_permanent, parent_address')
      .neq('status', 'available')
    setHouses((data ?? []) as CellData[])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchHouses()
    const channel = supabase
      .channel('houses-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'houses' }, () => fetchHouses())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchHouses])

  // URL 파라미터로 특정 집 자동 오픈 (?house=N-0000)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const houseAddr = params.get('house')
    if (!houseAddr || loading) return
    const target = houses.find(h => h.address === houseAddr)
    if (target) setSelectedCell(target)
  }, [loading, houses])

  const openApply = useCallback((cell: CellData) => {
    setApplyCell(cell)
    setShowApply(true)
  }, [])

  const handleCellClick = useCallback((cell: CellData) => {
    if (cell.status === 'available') openApply(cell)
    else setSelectedCell(cell)
  }, [openApply])

  const handleAreaSelect = useCallback(({ col, row, width, height }: { col: number; row: number; width: number; height: number }) => {
    const zone = getZone(col + Math.floor(width / 2), row + Math.floor(height / 2))
    const prefix = { neon: 'N', riverside: 'R', oldtown: 'O', artdistrict: 'A' }[zone]
    const cell: CellData = {
      id: '', address: `${prefix}-${String(row * 100 + col).padStart(4, '0')}`,
      col, row, width, height, zone, status: 'available',
      name: null, nickname: null, description: null, link_url: null,
      exterior_image_url: null, border_effect: 'none',
      like_count: 0, visit_count: 0, occupied_at: null, expires_at: null, is_permanent: false,
    }
    openApply(cell)
  }, [openApply])

  const handleApplySuccess = useCallback(() => {
    setShowApply(false)
    setApplyCell(null)
    fetchHouses()
  }, [fetchHouses])

  const headerHeight = 52 + 34 // 메인 줄 + 필터 줄

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#1a0f05', overflow: 'hidden' }}>
      <FloatingHeader
        occupiedCount={occupiedCount}
        totalCells={10000}
        totalDonation={totalDonation}
        userId={userId}
        activeZone={activeZone}
        onZoneFilter={setActiveZone}
        onApplyClick={() => setShowApply(true)}
        onMyHouseClick={() => setShowMyHouses(true)}
      />

      <div style={{ flex: 1, marginTop: headerHeight, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#a07850', fontSize: 14 }}>
            지도를 불러오는 중...
          </div>
        ) : (
          <MapGrid
            houses={houses}
            onCellClick={handleCellClick}
            onAreaSelect={handleAreaSelect}
            myHouseIds={myHouseIds}
            activeZone={activeZone}
          />
        )}
      </div>

      <StatsPanel houses={houses} />

      {selectedCell && (
        <HousePopup
          house={selectedCell}
          currentUserId={userId}
          onClose={() => setSelectedCell(null)}
          onBuy={(cell) => { setSelectedCell(null); openApply(cell) }}
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, textAlign: 'center', maxWidth: 320, fontFamily: '"Noto Sans KR", -apple-system, sans-serif' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔑</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>로그인이 필요해요</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>입주 신청을 위해 로그인해 주세요.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowApply(false)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontSize: 13 }}>취소</button>
              <button
                onClick={() => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback` } })}
                style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >구글로 로그인</button>
            </div>
          </div>
        </div>
      )}

      {showMyHouses && userId && (
        <MyHousesDrawer
          userId={userId}
          onClose={() => setShowMyHouses(false)}
          onEdit={(house) => { setShowMyHouses(false); openApply(house) }}
        />
      )}
    </div>
  )
}
