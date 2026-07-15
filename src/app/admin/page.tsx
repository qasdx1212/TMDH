'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { safeUrl } from '@/lib/url'
import type { CellData } from '@/types/cell'

const ADMIN_EMAIL = 'qasdx1212@gmail.com'

type Tab = 'all' | 'reports'

interface Report {
  id: string
  house_id: string
  reason: string
  description: string | null
  reporter_id: string
  created_at: string
  status: string
  house?: { address: string; name: string | null } | null
}

const REASON_LABEL: Record<string, string> = {
  inappropriate_image: '부적절한 이미지',
  illegal_ad: '불법 광고',
  copyright: '저작권 침해',
  impersonation: '사칭',
  other: '기타',
}

export default function AdminPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [houses, setHouses] = useState<CellData[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const [vacatingId, setVacatingId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'occupied_at' | 'visit_count' | 'like_count'>('occupied_at')
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
        .select('id, address, name')
        .in('id', houseIds)
      const houseMap = Object.fromEntries((hData ?? []).map((h: { id: string; address: string; name: string | null }) => [h.id, h]))
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
      <div style={{ minHeight: '100vh', background: '#f4f3f1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6f6d6a' }}>
        인증 확인 중...
      </div>
    )
  }

  if (!authorized) return null

  const filtered = houses
    .filter(h => {
      if (search.trim()) {
        const q = search.toLowerCase()
        const matches = h.name?.toLowerCase().includes(q) ||
          h.nickname?.toLowerCase().includes(q) ||
          h.address.toLowerCase().includes(q)
        if (!matches) return false
      }
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'visit_count') return b.visit_count - a.visit_count
      if (sortBy === 'like_count') return b.like_count - a.like_count
      return new Date(b.occupied_at ?? 0).getTime() - new Date(a.occupied_at ?? 0).getTime()
    })

  const totalVisits = houses.reduce((s, h) => s + h.visit_count, 0)
  const totalLikes = houses.reduce((s, h) => s + h.like_count, 0)
  const totalCells = houses.reduce((s, h) => s + (h.width ?? 1) * (h.height ?? 1), 0)
  const occupancyRate = ((totalCells / 80000) * 100).toFixed(2)

  return (
    <div style={{ height: '100vh', overflowY: 'auto', background: '#f4f3f1', color: '#1a1a1a' }}>

      {/* 헤더 */}
      <div style={{ background: '#ffffff', borderBottom: '1px solid #e9e7e4', padding: '0 24px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60, maxWidth: 1400, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <a href="/" style={{ color: '#1a1a1a', textDecoration: 'none', fontSize: 13, padding: '7px 14px', border: '1px solid #e0ddd9', borderRadius: 10, background: '#ffffff', fontWeight: 600 }}>← 지도</a>
            <div style={{ width: 1, height: 20, background: '#e9e7e4' }} />
            <div style={{ fontSize: 16, fontWeight: 700 }}>관리자 대시보드</div>
          </div>
          <button onClick={fetchHouses} style={{ padding: '8px 16px', border: '1px solid #e0ddd9', borderRadius: 10, background: '#ffffff', color: '#1a1a1a', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            새로고침
          </button>
        </div>
      </div>

      <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>

        {/* 핵심 통계 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: '총 입주', value: `${houses.length.toLocaleString()}채`, sub: `${totalCells.toLocaleString()}칸 / 80,000칸` },
            { label: '분양률', value: `${occupancyRate}%`, sub: '전체 대비' },
            { label: '총 방문', value: totalVisits.toLocaleString(), sub: '누적 방문 수' },
            { label: '총 좋아요', value: `♥ ${totalLikes.toLocaleString()}`, sub: '누적 좋아요' },
          ].map(({ label, value, sub }) => (
            <div key={label} style={{ background: '#ffffff', border: '1px solid #e9e7e4', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: '16px' }}>
              <div style={{ fontSize: 11, color: '#6f6d6a', marginBottom: 6, fontWeight: 500 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a' }}>{value}</div>
              <div style={{ fontSize: 11, color: '#97948f', marginTop: 3 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* 탭 + 검색 + 정렬 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {([
              { id: 'all', label: `전체 ${houses.length}` },
              { id: 'reports', label: `신고` },
            ] as const).map(t => {
              const active = tab === t.id
              const isReports = t.id === 'reports'
              return (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 500, borderRadius: 10,
                  border: active ? '1px solid #1a1a1a' : '1px solid #e0ddd9',
                  background: active ? '#1c1c1e' : '#ffffff',
                  color: active ? '#fff' : (isReports ? '#dc2626' : '#575654'),
                }}>{t.label}</button>
              )
            })}
          </div>

          <div style={{ flex: 1 }} />

          {tab !== 'reports' && (
            <>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as typeof sortBy)}
                style={{ padding: '8px 12px', background: '#ffffff', border: '1px solid #e0ddd9', borderRadius: 10, color: '#1a1a1a', fontSize: 13, cursor: 'pointer', outline: 'none', fontWeight: 500 }}
              >
                <option value="occupied_at">최신 입주순</option>
                <option value="visit_count">방문 많은순</option>
                <option value="like_count">좋아요 많은순</option>
              </select>

              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="이름 / 닉네임 / 주소 검색"
                style={{
                  padding: '8px 14px', width: 220, fontSize: 13,
                  background: '#ffffff', border: '1px solid #e0ddd9', borderRadius: 10,
                  color: '#1a1a1a', outline: 'none',
                }}
              />
            </>
          )}
        </div>

        {/* 신고 탭 */}
        {tab === 'reports' ? (
          <div style={{ background: '#ffffff', border: '1px solid #e9e7e4', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: '#faf9f7' }}>
                    {['날짜', '신고된 집', '사유', '상세 내용', '작업'].map(h => (
                      <th key={h} style={{ padding: '11px 12px', textAlign: 'left', color: '#6f6d6a', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap', borderBottom: '1px solid #e9e7e4' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportsLoading ? (
                    <tr><td colSpan={5} style={{ padding: 48, textAlign: 'center', color: '#6f6d6a' }}>불러오는 중...</td></tr>
                  ) : reports.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: 48, textAlign: 'center', color: '#6f6d6a' }}>신고 내역이 없어요</td></tr>
                  ) : reports.map((r) => {
                    const houseData = r.house
                    const houseInList = houseData ? houses.find(h => h.id === r.house_id) : null
                    return (
                      <tr key={r.id} style={{ borderBottom: '1px solid #f0efec' }}>
                        <td style={{ padding: '11px 12px', color: '#6f6d6a', whiteSpace: 'nowrap' }}>{r.created_at.slice(0, 10)}</td>
                        <td style={{ padding: '11px 12px', whiteSpace: 'nowrap' }}>
                          {houseData
                            ? <><span style={{ color: '#1a1a1a', fontWeight: 600 }}>{houseData.address}</span><span style={{ color: '#6f6d6a', marginLeft: 6 }}>{houseData.name ?? '—'}</span></>
                            : <span style={{ color: '#6f6d6a' }}>삭제된 집</span>}
                        </td>
                        <td style={{ padding: '11px 12px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 500 }}>{REASON_LABEL[r.reason] ?? r.reason}</span>
                        </td>
                        <td style={{ padding: '11px 12px', color: '#575654', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.description ?? <span style={{ color: '#6f6d6a' }}>—</span>}
                        </td>
                        <td style={{ padding: '11px 12px', whiteSpace: 'nowrap' }}>
                          {houseInList ? (
                            <button
                              onClick={() => handleVacate(houseInList)}
                              disabled={vacatingId === houseInList.id}
                              style={{ padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, borderRadius: 10, background: '#dc2626', border: 'none', color: '#fff' }}
                            >{vacatingId === houseInList.id ? '처리중...' : '강제퇴거'}</button>
                          ) : (
                            <span style={{ fontSize: 12, color: '#6f6d6a' }}>이미 퇴거됨</span>
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
        <div style={{ background: '#ffffff', border: '1px solid #e9e7e4', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: '#faf9f7' }}>
                  {['주소', '집 이름', '닉네임', '크기', '입주일', '방문 / 좋아요', '링크', '작업'].map(h => (
                    <th key={h} style={{ padding: '11px 12px', textAlign: 'left', color: '#6f6d6a', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap', borderBottom: '1px solid #e9e7e4' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ padding: 48, textAlign: 'center', color: '#6f6d6a' }}>불러오는 중...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: 48, textAlign: 'center', color: '#6f6d6a' }}>해당하는 집이 없어요</td></tr>
                ) : filtered.map((h) => (
                  <tr key={h.id} style={{ borderBottom: '1px solid #f0efec', background: '#ffffff' }}>
                    <td style={{ padding: '11px 12px', color: '#1a1a1a', fontWeight: 600, whiteSpace: 'nowrap' }}>{h.address}</td>
                    <td style={{ padding: '11px 12px', color: '#1a1a1a', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {h.exterior_image_url && <img src={h.exterior_image_url} alt="" style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 6, border: '1px solid #e9e7e4', marginRight: 6, verticalAlign: 'middle' }} />}
                      {h.name ?? <span style={{ color: '#6f6d6a' }}>—</span>}
                    </td>
                    <td style={{ padding: '11px 12px', color: '#575654' }}>{h.nickname ?? '—'}</td>
                    <td style={{ padding: '11px 12px', color: '#6f6d6a', whiteSpace: 'nowrap' }}>{(h.width ?? 1)}×{(h.height ?? 1)}</td>
                    <td style={{ padding: '11px 12px', color: '#6f6d6a', whiteSpace: 'nowrap' }}>{h.occupied_at?.slice(0, 10) ?? '—'}</td>
                    <td style={{ padding: '11px 12px', color: '#6f6d6a', whiteSpace: 'nowrap' }}>
                      방문 {h.visit_count.toLocaleString()} / ♥ {h.like_count.toLocaleString()}
                    </td>
                    <td style={{ padding: '11px 12px' }}>
                      {safeUrl(h.link_url)
                        ? <a href={safeUrl(h.link_url)!} target="_blank" rel="noopener noreferrer" style={{ color: '#1a1a1a', fontSize: 12, textDecoration: 'underline', fontWeight: 500 }}>방문</a>
                        : <span style={{ color: '#6f6d6a' }}>—</span>}
                    </td>
                    <td style={{ padding: '11px 12px', whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => handleVacate(h)}
                        disabled={vacatingId === h.id}
                        style={{
                          padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, borderRadius: 10,
                          background: '#dc2626', border: 'none', color: '#fff',
                        }}
                      >{vacatingId === h.id ? '처리중...' : '강제퇴거'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )}

        <div style={{ marginTop: 12, fontSize: 12, color: '#6f6d6a' }}>
          {tab === 'reports' ? `${reports.length}건의 신고` : `${filtered.length}건 표시 중 / 전체 ${houses.length}건`}
        </div>
      </div>
    </div>
  )
}
