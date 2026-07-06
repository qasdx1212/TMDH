'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ZONES } from '@/lib/constants'
import type { CellData } from '@/types/cell'

const ADMIN_EMAIL = 'qasdx1212@gmail.com'

type Tab = 'all' | 'expiring' | 'expired' | 'reports'

interface Report {
  id: string
  house_id: string
  reason: string
  description: string | null
  reporter_id: string
  created_at: string
  status: string
  house?: { address: string; name: string | null; zone: string } | null
}

const REASON_LABEL: Record<string, string> = {
  inappropriate_image: '🔞 부적절한 이미지',
  illegal_ad: '🚫 불법 광고',
  copyright: '📋 저작권 침해',
  impersonation: '🎭 사칭',
  other: '💬 기타',
}

export default function AdminPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [houses, setHouses] = useState<CellData[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const [filterZone, setFilterZone] = useState<string | null>(null)
  const [vacatingId, setVacatingId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'occupied_at' | 'expires_at' | 'visit_count' | 'like_count'>('occupied_at')
  const [reports, setReports] = useState<Report[]>([])
  const [reportsLoading, setReportsLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email === ADMIN_EMAIL) {
        setAuthorized(true)
      } else {
        router.replace('/')
      }
      setAuthChecked(true)
    })
  }, [router])

  const fetchHouses = useCallback(async () => {
    const { data } = await supabase
      .from('houses')
      .select('*')
      .eq('status', 'occupied')
      .is('parent_address', null)
      .order('occupied_at', { ascending: false })
    setHouses((data ?? []) as CellData[])
    setLoading(false)
  }, [])

  const fetchReports = useCallback(async () => {
    setReportsLoading(true)
    const { data: rData } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })
    if (rData && rData.length > 0) {
      const houseIds = [...new Set(rData.map((r: Report) => r.house_id))]
      const { data: hData } = await supabase
        .from('houses')
        .select('id, address, name, zone')
        .in('id', houseIds)
      const houseMap = Object.fromEntries((hData ?? []).map((h: { id: string; address: string; name: string | null; zone: string }) => [h.id, h]))
      setReports(rData.map((r: Report) => ({ ...r, house: houseMap[r.house_id] ?? null })))
    } else {
      setReports([])
    }
    setReportsLoading(false)
  }, [])

  useEffect(() => {
    if (authorized) fetchHouses()
  }, [authorized, fetchHouses])

  useEffect(() => {
    if (authorized && tab === 'reports') fetchReports()
  }, [authorized, tab, fetchReports])

  const handleVacate = async (house: CellData) => {
    if (!confirm(`"${house.name ?? house.address}" 강제 퇴거하시겠어요?\n이 작업은 되돌릴 수 없습니다.`)) return
    setVacatingId(house.id)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/vacate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({
        houseId: house.id,
        address: house.address,
        width: house.width ?? 1,
        height: house.height ?? 1,
      }),
    })
    if (!res.ok) {
      alert('강제 퇴거 실패')
      setVacatingId(null)
      return
    }
    setVacatingId(null)
    setHouses(prev => prev.filter(h => h.id !== house.id))
  }

  if (!authChecked) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0906', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c8a96e', fontFamily: 'sans-serif' }}>
        인증 확인 중...
      </div>
    )
  }

  if (!authorized) return null

  const now = Date.now()

  const filtered = houses
    .filter(h => {
      if (filterZone && h.zone !== filterZone) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const matches = h.name?.toLowerCase().includes(q) ||
          h.nickname?.toLowerCase().includes(q) ||
          h.address.toLowerCase().includes(q)
        if (!matches) return false
      }
      if (tab === 'expiring') {
        if (h.is_permanent || !h.expires_at) return false
        const ms = new Date(h.expires_at).getTime() - now
        return ms > 0 && ms <= 7 * 86400000
      }
      if (tab === 'expired') {
        if (h.is_permanent || !h.expires_at) return false
        return new Date(h.expires_at).getTime() <= now
      }
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'expires_at') {
        if (!a.expires_at) return 1
        if (!b.expires_at) return -1
        return new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime()
      }
      if (sortBy === 'visit_count') return b.visit_count - a.visit_count
      if (sortBy === 'like_count') return b.like_count - a.like_count
      return new Date(b.occupied_at ?? 0).getTime() - new Date(a.occupied_at ?? 0).getTime()
    })

  const expiringCount = houses.filter(h => !h.is_permanent && h.expires_at && new Date(h.expires_at).getTime() - now > 0 && new Date(h.expires_at).getTime() - now <= 7 * 86400000).length
  const expiredCount = houses.filter(h => !h.is_permanent && h.expires_at && new Date(h.expires_at).getTime() <= now).length
  const permanentCount = houses.filter(h => h.is_permanent).length
  const totalVisits = houses.reduce((s, h) => s + h.visit_count, 0)
  const totalLikes = houses.reduce((s, h) => s + h.like_count, 0)
  const occupancyRate = ((houses.length / 20000) * 100).toFixed(2)

  return (
    <div style={{ height: '100vh', overflowY: 'auto', background: '#0f0906', fontFamily: '"Noto Sans KR", -apple-system, sans-serif', color: '#fdf6e3' }}>

      {/* 헤더 */}
      <div style={{ background: 'linear-gradient(180deg,#2c1a08,#1e1005)', borderBottom: '3px solid #6b4c2a', padding: '0 24px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60, maxWidth: 1400, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <a href="/" style={{ color: '#c8a96e', textDecoration: 'none', fontSize: 13, padding: '6px 12px', borderRadius: 6, border: '1px solid #4a3010', background: 'rgba(255,255,255,0.04)' }}>← 지도</a>
            <div style={{ width: 1, height: 20, background: '#4a3010' }} />
            <div style={{ fontSize: 18, fontWeight: 900 }}>🔑 관리자 대시보드</div>
          </div>
          <button onClick={fetchHouses} style={{ padding: '6px 14px', borderRadius: 6, border: '1.5px solid #4a3010', background: 'rgba(255,255,255,0.06)', color: '#a08060', cursor: 'pointer', fontSize: 12 }}>
            🔄 새로고침
          </button>
        </div>
      </div>

      <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>

        {/* 핵심 통계 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: '총 입주', value: `${houses.length.toLocaleString()}채`, color: '#4ade80', sub: `/ 20,000칸` },
            { label: '분양률', value: `${occupancyRate}%`, color: '#f59e0b', sub: '전체 대비' },
            { label: '영구 입주', value: `${permanentCount}채`, color: '#c084fc', sub: '만료 없음' },
            { label: '만료 임박', value: `${expiringCount}채`, color: '#f97316', sub: '7일 이내' },
            { label: '기간 만료', value: `${expiredCount}채`, color: '#ef4444', sub: '처리 필요' },
            { label: '총 방문', value: totalVisits.toLocaleString(), color: '#34d399', sub: `❤️ ${totalLikes.toLocaleString()}` },
          ].map(({ label, value, color, sub }) => (
            <div key={label} style={{ background: 'linear-gradient(180deg,#2a1a08,#1e1005)', border: '1.5px solid #4a3010', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, color: '#7a5c3a', marginBottom: 5 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
              <div style={{ fontSize: 10, color: '#5a3e1a', marginTop: 3 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* 구역별 통계 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
          {Object.entries(ZONES).map(([key, zone]) => {
            const zoneHouses = houses.filter(h => h.zone === key)
            const count = zoneHouses.length
            const rate = ((count / 5000) * 100).toFixed(1)
            const visits = zoneHouses.reduce((s, h) => s + h.visit_count, 0)
            return (
              <div
                key={key}
                onClick={() => setFilterZone(filterZone === key ? null : key)}
                style={{
                  padding: '12px 16px', borderRadius: 8, cursor: 'pointer',
                  border: `2px solid ${filterZone === key ? zone.color : '#4a3010'}`,
                  background: filterZone === key ? zone.color + '15' : '#1a0f05',
                  transition: 'all 0.12s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: zone.color, fontWeight: 700 }}>{zone.label}</span>
                  <span style={{ fontSize: 10, color: '#5a3e1a' }}>👣 {visits.toLocaleString()}</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#fdf6e3' }}>{count}채</div>
                <div style={{ marginTop: 6, height: 4, borderRadius: 2, background: '#2a1a08' }}>
                  <div style={{ height: '100%', borderRadius: 2, width: `${rate}%`, background: zone.color }} />
                </div>
                <div style={{ fontSize: 10, color: '#5a3e1a', marginTop: 4 }}>{rate}% 분양</div>
              </div>
            )
          })}
        </div>

        {/* 탭 + 검색 + 정렬 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {([
              { id: 'all', label: `전체 ${houses.length}` },
              { id: 'expiring', label: `만료 임박 ${expiringCount}` },
              { id: 'expired', label: `기간 만료 ${expiredCount}` },
              { id: 'reports', label: `🚨 신고` },
            ] as const).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: '7px 16px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: tab === t.id ? 700 : 500,
                border: `2px solid ${tab === t.id ? (t.id === 'reports' ? '#ef4444' : '#c8a96e') : '#4a3010'}`,
                background: tab === t.id ? (t.id === 'reports' ? '#3d0a0a' : '#3d2a08') : 'transparent',
                color: tab === t.id ? '#fdf6e3' : '#7a5c3a',
              }}>{t.label}</button>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          {tab !== 'reports' && (
            <>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as typeof sortBy)}
                style={{ padding: '7px 12px', borderRadius: 7, background: '#2a1a08', border: '1.5px solid #4a3010', color: '#c8a96e', fontSize: 12, cursor: 'pointer', outline: 'none' }}
              >
                <option value="occupied_at">최신 입주순</option>
                <option value="expires_at">만료일 임박순</option>
                <option value="visit_count">방문 많은순</option>
                <option value="like_count">좋아요 많은순</option>
              </select>

              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="🔍 이름 / 닉네임 / 주소"
                style={{
                  padding: '7px 14px', borderRadius: 7, width: 220, fontSize: 12,
                  background: '#2a1a08', border: '1.5px solid #4a3010',
                  color: '#fdf6e3', outline: 'none', fontFamily: 'inherit',
                }}
              />
            </>
          )}
        </div>

        {/* 신고 탭 */}
        {tab === 'reports' ? (
          <div style={{ background: '#1a0f05', border: '1.5px solid #4a3010', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#3d0a0a', borderBottom: '1.5px solid #7f1d1d' }}>
                    {['날짜', '신고된 집', '구역', '사유', '상세 내용', '작업'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#f87171', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportsLoading ? (
                    <tr><td colSpan={6} style={{ padding: 48, textAlign: 'center', color: '#5a3e1a' }}>불러오는 중...</td></tr>
                  ) : reports.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: 48, textAlign: 'center', color: '#5a3e1a' }}>신고 내역이 없어요 ✅</td></tr>
                  ) : reports.map((r, i) => {
                    const houseData = r.house
                    const zone = houseData ? ZONES[houseData.zone as keyof typeof ZONES] : null
                    const houseInList = houseData ? houses.find(h => h.id === r.house_id) : null
                    return (
                      <tr key={r.id} style={{ borderBottom: '1px solid #2a1a0840', background: i % 2 === 0 ? 'transparent' : '#1e100522' }}>
                        <td style={{ padding: '10px 12px', color: '#7a5c3a', whiteSpace: 'nowrap' }}>{r.created_at.slice(0, 10)}</td>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                          {houseData
                            ? <><span style={{ color: '#c8a96e', fontWeight: 700 }}>{houseData.address}</span><span style={{ color: '#7a5c3a', marginLeft: 6 }}>{houseData.name ?? '—'}</span></>
                            : <span style={{ color: '#4a3010' }}>삭제된 집</span>}
                        </td>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                          {zone && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: zone.color + '20', color: zone.color, border: `1px solid ${zone.color}44` }}>{zone.label}</span>}
                        </td>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: 11, color: '#f87171', fontWeight: 600 }}>{REASON_LABEL[r.reason] ?? r.reason}</span>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#a08060', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.description ?? <span style={{ color: '#4a3010' }}>—</span>}
                        </td>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                          {houseInList ? (
                            <button
                              onClick={() => handleVacate(houseInList)}
                              disabled={vacatingId === houseInList.id}
                              style={{ padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700, background: '#ef4444', border: '1.5px solid #b91c1c', color: '#fff' }}
                            >{vacatingId === houseInList.id ? '처리중...' : '강제퇴거'}</button>
                          ) : (
                            <span style={{ fontSize: 11, color: '#4a3010' }}>이미 퇴거됨</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (

        /* 일반 집 테이블 */
        <div style={{ background: '#1a0f05', border: '1.5px solid #4a3010', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#2a1a08', borderBottom: '1.5px solid #4a3010' }}>
                  {['주소', '집 이름', '닉네임', '구역', '크기', '입주일', '만료일 / 상태', '방문 / 좋아요', '링크', '작업'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#8b6914', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} style={{ padding: 48, textAlign: 'center', color: '#5a3e1a' }}>불러오는 중...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={10} style={{ padding: 48, textAlign: 'center', color: '#5a3e1a' }}>해당하는 집이 없어요</td></tr>
                ) : filtered.map((h, i) => {
                  const zone = ZONES[h.zone as keyof typeof ZONES]
                  const daysLeft = h.is_permanent || !h.expires_at
                    ? null
                    : Math.ceil((new Date(h.expires_at).getTime() - now) / 86400000)
                  const isExpiring = daysLeft !== null && daysLeft > 0 && daysLeft <= 7
                  const isExpired = daysLeft !== null && daysLeft <= 0

                  return (
                    <tr
                      key={h.id}
                      style={{
                        borderBottom: '1px solid #2a1a0840',
                        background: isExpired ? '#3d0a0a22' : isExpiring ? '#3d2a0822' : i % 2 === 0 ? 'transparent' : '#1e100522',
                      }}
                    >
                      <td style={{ padding: '10px 12px', color: '#c8a96e', fontWeight: 700, whiteSpace: 'nowrap' }}>{h.address}</td>
                      <td style={{ padding: '10px 12px', color: '#fdf6e3', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {h.exterior_image_url && <img src={h.exterior_image_url} alt="" style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 3, marginRight: 6, verticalAlign: 'middle' }} />}
                        {h.name ?? <span style={{ color: '#4a3010' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#a08060' }}>{h.nickname ?? '—'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: zone.color + '20', color: zone.color, border: `1px solid ${zone.color}44`, whiteSpace: 'nowrap' }}>{zone.label}</span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#7a5c3a', whiteSpace: 'nowrap' }}>{(h.width ?? 1)}×{(h.height ?? 1)}</td>
                      <td style={{ padding: '10px 12px', color: '#7a5c3a', whiteSpace: 'nowrap' }}>{h.occupied_at?.slice(0, 10) ?? '—'}</td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        {h.is_permanent
                          ? <span style={{ color: '#c084fc', fontSize: 11, fontWeight: 700 }}>♾ 영구</span>
                          : isExpired
                          ? <span style={{ color: '#ef4444', fontWeight: 700 }}>⚠️ 만료됨</span>
                          : isExpiring
                          ? <span style={{ color: '#f97316', fontWeight: 700 }}>D-{daysLeft} ({h.expires_at?.slice(0, 10)})</span>
                          : <span style={{ color: '#7a5c3a' }}>D-{daysLeft} ({h.expires_at?.slice(0, 10)})</span>}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#7a5c3a', whiteSpace: 'nowrap' }}>
                        👣 {h.visit_count.toLocaleString()} / ❤️ {h.like_count.toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {h.link_url
                          ? <a href={h.link_url} target="_blank" rel="noopener noreferrer" style={{ color: '#34d399', fontSize: 11, textDecoration: 'none' }}>🔗 방문</a>
                          : <span style={{ color: '#4a3010' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => handleVacate(h)}
                          disabled={vacatingId === h.id}
                          style={{
                            padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700,
                            background: '#fef2f2', border: '1.5px solid #ef444466', color: '#ef4444',
                          }}
                        >{vacatingId === h.id ? '처리중...' : '강제퇴거'}</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <div style={{ fontSize: 11, color: '#4a3010' }}>
            {tab === 'reports' ? `${reports.length}건의 신고` : `${filtered.length}건 표시 중 / 전체 ${houses.length}건`}
          </div>
          {filterZone && tab !== 'reports' && (
            <button onClick={() => setFilterZone(null)} style={{ fontSize: 11, color: '#c8a96e', background: 'none', border: 'none', cursor: 'pointer' }}>
              구역 필터 초기화 ×
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
