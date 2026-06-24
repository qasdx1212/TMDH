'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Payment {
  id: string
  house_address: string
  amount: number
  type: 'move_in' | 'edit'
  method: string | null
  status: string
  created_at: string
}

const METHOD_LABEL: Record<string, string> = {
  card: '💳 카드',
  kakaopay: '💛 카카오페이',
  tosspay: '🔵 토스페이',
}

export default function PaymentsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [payments, setPayments] = useState<Payment[]>([])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.replace('/'); return }
      const { data: pData } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', data.user.id)
        .order('created_at', { ascending: false })
      setPayments((pData ?? []) as Payment[])
      setLoading(false)
    })
  }, [router])

  const totalAmount = payments.filter(p => p.status === 'completed').reduce((s, p) => s + p.amount, 0)

  return (
    <div style={{ height: '100vh', overflowY: 'auto', background: '#0f0906', fontFamily: '"Noto Sans KR", -apple-system, sans-serif', color: '#fdf6e3' }}>
      {/* 헤더 */}
      <div style={{ background: 'linear-gradient(180deg,#2c1a08,#1e1005)', borderBottom: '3px solid #6b4c2a', padding: '0 24px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, height: 60, maxWidth: 860, margin: '0 auto' }}>
          <a href="/" style={{ color: '#c8a96e', textDecoration: 'none', fontSize: 13, padding: '6px 12px', borderRadius: 6, border: '1px solid #4a3010', background: 'rgba(255,255,255,0.04)' }}>← 지도</a>
          <div style={{ width: 1, height: 20, background: '#4a3010' }} />
          <div style={{ fontSize: 18, fontWeight: 900 }}>🧾 결제 내역</div>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 24px' }}>
        {/* 요약 카드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: '총 결제 건수', value: `${payments.length}건`, color: '#4ade80' },
            { label: '총 결제 금액', value: `₩${totalAmount.toLocaleString()}`, color: '#fbbf24' },
            { label: '입주 횟수', value: `${payments.filter(p => p.type === 'move_in').length}회`, color: '#c084fc' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: 'linear-gradient(180deg,#2a1a08,#1e1005)', border: '1.5px solid #4a3010', borderRadius: 10, padding: '14px 18px' }}>
              <div style={{ fontSize: 10, color: '#7a5c3a', marginBottom: 5 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
            </div>
          ))}
        </div>

        {/* 테이블 */}
        <div style={{ background: '#1a0f05', border: '1.5px solid #4a3010', borderRadius: 10, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#5a3e1a' }}>불러오는 중...</div>
          ) : payments.length === 0 ? (
            <div style={{ padding: '56px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 14 }}>🧾</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#5a3e1a', marginBottom: 6 }}>결제 내역이 없어요</div>
              <div style={{ fontSize: 12, color: '#3d2a08' }}>입주 신청 후 여기서 내역을 확인할 수 있어요.</div>
              <a href="/" style={{ display: 'inline-block', marginTop: 18, padding: '10px 24px', borderRadius: 8, background: 'linear-gradient(180deg,#8b6914,#6b4c10)', color: '#fdf6e3', fontSize: 13, fontWeight: 700, textDecoration: 'none', border: '2px solid #c8a96e' }}>
                지도에서 입주 신청하기 →
              </a>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#2a1a08', borderBottom: '1.5px solid #4a3010' }}>
                    {['날짜', '구분', '주소', '금액', '결제 수단', '상태'].map(h => (
                      <th key={h} style={{ padding: '11px 14px', textAlign: 'left', color: '#8b6914', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p, i) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #2a1a0840', background: i % 2 === 0 ? 'transparent' : '#1e100522' }}>
                      <td style={{ padding: '12px 14px', color: '#7a5c3a', whiteSpace: 'nowrap' }}>{p.created_at.slice(0, 10)}</td>
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 700, whiteSpace: 'nowrap', background: p.type === 'move_in' ? '#22c55e22' : '#3b82f622', color: p.type === 'move_in' ? '#22c55e' : '#3b82f6', border: `1px solid ${p.type === 'move_in' ? '#22c55e44' : '#3b82f644'}` }}>
                          {p.type === 'move_in' ? '신규 입주' : '수정'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <a href={`/?house=${p.house_address}`} style={{ color: '#c8a96e', fontWeight: 700, textDecoration: 'none' }}>{p.house_address}</a>
                      </td>
                      <td style={{ padding: '12px 14px', color: '#fbbf24', fontWeight: 700, whiteSpace: 'nowrap' }}>₩{p.amount.toLocaleString()}</td>
                      <td style={{ padding: '12px 14px', color: '#a08060', whiteSpace: 'nowrap' }}>{p.method ? (METHOD_LABEL[p.method] ?? p.method) : '—'}</td>
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 700, background: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e44' }}>
                          {p.status === 'completed' ? '완료' : p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {payments.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 11, color: '#4a3010' }}>{payments.length}건의 내역</div>
            <div style={{ fontSize: 11, color: '#4a3010' }}>⚠️ 현재 테스트 모드 — 실제 결제 없음</div>
          </div>
        )}
      </div>
    </div>
  )
}
