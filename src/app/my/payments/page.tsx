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
  card: '카드',
  kakaopay: '카카오페이',
  tosspay: '토스페이',
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
    <div style={{ height: '100vh', overflowY: 'auto', background: '#f4f3f1', color: '#1a1a1a' }}>
      {/* 헤더 */}
      <div style={{ background: '#ffffff', borderBottom: '1px solid #e9e7e4', padding: '0 24px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, height: 60, maxWidth: 860, margin: '0 auto' }}>
          <a href="/" style={{ color: '#1a1a1a', textDecoration: 'none', fontSize: 13, padding: '7px 14px', border: '1px solid #e0ddd9', borderRadius: 10, background: '#ffffff', fontWeight: 600 }}>← 지도</a>
          <div style={{ width: 1, height: 20, background: '#e9e7e4' }} />
          <div style={{ fontSize: 16, fontWeight: 700 }}>결제 내역</div>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 24px' }}>
        {/* 요약 카드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: '총 결제 건수', value: `${payments.length}건` },
            { label: '총 결제 금액', value: `₩${totalAmount.toLocaleString()}` },
            { label: '입주 횟수', value: `${payments.filter(p => p.type === 'move_in').length}회` },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: '#ffffff', border: '1px solid #e9e7e4', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: '16px 18px' }}>
              <div style={{ fontSize: 12, color: '#6f6d6a', marginBottom: 6, fontWeight: 500 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* 테이블 */}
        <div style={{ background: '#ffffff', border: '1px solid #e9e7e4', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#6f6d6a' }}>불러오는 중...</div>
          ) : payments.length === 0 ? (
            <div style={{ padding: '56px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a', marginBottom: 6 }}>결제 내역이 없어요</div>
              <div style={{ fontSize: 13, color: '#6f6d6a' }}>입주 신청 후 여기서 내역을 확인할 수 있어요.</div>
              <a href="/" style={{ display: 'inline-block', marginTop: 18, padding: '11px 24px', background: '#1c1c1e', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none', borderRadius: 10 }}>
                지도에서 입주 신청하기 →
              </a>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#faf9f7' }}>
                    {['날짜', '구분', '주소', '금액', '결제 수단', '상태'].map(h => (
                      <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: '#6f6d6a', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap', borderBottom: '1px solid #e9e7e4' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f0efec' }}>
                      <td style={{ padding: '13px 14px', color: '#6f6d6a', whiteSpace: 'nowrap' }}>{p.created_at.slice(0, 10)}</td>
                      <td style={{ padding: '13px 14px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 999, fontWeight: 500, whiteSpace: 'nowrap', background: '#faf9f7', color: '#575654', border: '1px solid #e9e7e4' }}>
                          {p.type === 'move_in' ? '신규 입주' : '수정'}
                        </span>
                      </td>
                      <td style={{ padding: '13px 14px', whiteSpace: 'nowrap' }}>
                        <a href={`/?house=${p.house_address}`} style={{ color: '#1a1a1a', fontWeight: 600, textDecoration: 'underline' }}>{p.house_address}</a>
                      </td>
                      <td style={{ padding: '13px 14px', color: '#1a1a1a', fontWeight: 600, whiteSpace: 'nowrap' }}>₩{p.amount.toLocaleString()}</td>
                      <td style={{ padding: '13px 14px', color: '#575654', whiteSpace: 'nowrap' }}>{p.method ? (METHOD_LABEL[p.method] ?? p.method) : '—'}</td>
                      <td style={{ padding: '13px 14px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 999, fontWeight: 500, background: p.status === 'completed' ? '#eaf6ee' : '#faf9f7', color: p.status === 'completed' ? '#16a34a' : '#575654', border: p.status === 'completed' ? '1px solid #d4ead9' : '1px solid #e9e7e4' }}>
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
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: '#6f6d6a' }}>{payments.length}건의 내역</div>
            <div style={{ fontSize: 12, color: '#6f6d6a' }}>현재 테스트 모드 — 실제 결제 없음</div>
          </div>
        )}
      </div>
    </div>
  )
}
