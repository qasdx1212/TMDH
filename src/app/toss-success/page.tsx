'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PERMANENT_DAYS, getAddress } from '@/lib/constants'

interface PendingOrder {
  orderId: string
  userId: string
  address: string
  col: number
  row: number
  width: number
  height: number
  zone: string
  name: string | null
  nickname: string | null
  description: string | null
  linkUrl: string | null
  borderEffect: string
  days: number
  exteriorUrl: string | null
  interiorUrl: string | null
  amount: number
  payMethod: string
}

function TossSuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'processing' | 'done' | 'error'>('processing')
  const [errorMsg, setErrorMsg] = useState('')
  const [address, setAddress] = useState('')

  useEffect(() => {
    const paymentKey = searchParams.get('paymentKey')
    const orderId = searchParams.get('orderId')
    const amount = Number(searchParams.get('amount'))

    const run = async () => {
      if (!paymentKey || !orderId || !amount) {
        setErrorMsg('결제 파라미터가 올바르지 않아요.')
        setStatus('error')
        return
      }

      // 1. 서버사이드 결제 승인
      const confirmRes = await fetch('/api/toss-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentKey, orderId, amount }),
      })
      if (!confirmRes.ok) {
        const err = await confirmRes.json()
        setErrorMsg(err.error ?? '결제 승인에 실패했어요.')
        setStatus('error')
        return
      }

      // 2. 주문 정보 꺼내기
      const raw = sessionStorage.getItem('toss_pending_order')
      if (!raw) {
        setErrorMsg('주문 정보를 찾을 수 없어요. 고객센터에 문의해주세요.')
        setStatus('error')
        return
      }
      const order: PendingOrder = JSON.parse(raw)
      sessionStorage.removeItem('toss_pending_order')
      setAddress(order.address)

      // 3. 인증 확인
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setErrorMsg('로그인 세션이 만료됐어요. 다시 로그인 후 고객센터에 문의해주세요.')
        setStatus('error')
        return
      }

      // 4. 입주 처리
      const expiresAt = order.days === PERMANENT_DAYS
        ? null
        : new Date(Date.now() + order.days * 86400000).toISOString()
      const occupiedAt = new Date().toISOString()

      const { error: houseErr } = await supabase.from('houses').update({
        user_id: user.id,
        name: order.name, nickname: order.nickname,
        description: order.description, link_url: order.linkUrl,
        exterior_image_url: order.exteriorUrl, interior_image_url: order.interiorUrl,
        border_effect: order.borderEffect, status: 'occupied', is_visible: true,
        width: order.width, height: order.height,
        occupied_at: occupiedAt, expires_at: expiresAt,
        is_permanent: order.days === PERMANENT_DAYS,
      }).eq('address', order.address)

      if (houseErr) {
        setErrorMsg(`입주 처리 실패: ${houseErr.message}`)
        setStatus('error')
        return
      }

      // 위성 셀 처리
      if (order.width > 1 || order.height > 1) {
        for (let c = order.col; c < order.col + order.width; c++) {
          for (let r = order.row; r < order.row + order.height; r++) {
            if (c === order.col && r === order.row) continue
            await supabase.from('houses').update({
              user_id: user.id, status: 'occupied', parent_address: order.address,
              occupied_at: occupiedAt, expires_at: expiresAt,
              is_permanent: order.days === PERMANENT_DAYS,
            }).eq('address', getAddress(c, r))
          }
        }
      }

      // 5. 결제 내역 기록
      await supabase.from('payments').insert({
        user_id: user.id,
        house_address: order.address,
        amount: order.amount,
        type: 'move_in',
        method: order.payMethod,
        status: 'completed',
      })

      setStatus('done')
      setTimeout(() => router.push(`/?house=${order.address}`), 3000)
    }

    run().catch(e => {
      setErrorMsg(String(e))
      setStatus('error')
    })
  }, [searchParams, router])

  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0f0906', fontFamily: '"Noto Sans KR", sans-serif', color: '#fdf6e3',
    }}>
      <div style={{
        width: 400, maxWidth: '92vw', textAlign: 'center',
        background: '#1e1005', borderRadius: 16,
        border: '3px solid #4a3010', padding: '48px 32px',
        boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
      }}>
        {status === 'processing' && (
          <>
            <div style={{ fontSize: 64, marginBottom: 20 }}>⏳</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>처리 중...</div>
            <div style={{ fontSize: 13, color: '#7a5c3a', lineHeight: 1.8 }}>
              결제를 확인하고 입주 처리 중이에요.<br />잠시만 기다려 주세요.
            </div>
            <div style={{ marginTop: 24, width: '100%', height: 4, borderRadius: 2, background: '#2a1a08', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'linear-gradient(90deg,#8b6914,#c8a96e)', borderRadius: 2, animation: 'toss-loading 2s ease-in-out infinite' }} />
            </div>
            <style>{`@keyframes toss-loading { 0%,100%{width:20%} 50%{width:80%} }`}</style>
          </>
        )}

        {status === 'done' && (
          <>
            <div style={{ fontSize: 72, marginBottom: 16 }}>🎉</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#fdf6e3', marginBottom: 10 }}>입주 완료!</div>
            <div style={{ fontSize: 13, color: '#c8a96e', lineHeight: 1.8, marginBottom: 24 }}>
              <strong style={{ color: '#ffd700' }}>{address}</strong>에<br />
              당신의 집이 생겼어요 🏠<br />
              <span style={{ color: '#7a5c3a' }}>3초 후 지도로 이동합니다...</span>
            </div>
            <a href={`/?house=${address}`} style={{
              display: 'inline-block', padding: '12px 32px', borderRadius: 10,
              background: 'linear-gradient(180deg,#8b6914,#6b4c10)',
              color: '#fdf6e3', fontSize: 14, fontWeight: 700, textDecoration: 'none',
              border: '2px solid #c8a96e', boxShadow: '0 4px 0 #3d2a08',
            }}>지도에서 내 집 보기 →</a>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: 64, marginBottom: 16 }}>⚠️</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#ef4444', marginBottom: 10 }}>오류가 발생했어요</div>
            <div style={{ fontSize: 13, color: '#a08060', lineHeight: 1.8, marginBottom: 24 }}>
              {errorMsg}<br />
              <span style={{ color: '#5a3e1a', fontSize: 11 }}>결제가 완료됐다면 고객센터로 연락해주세요.</span>
            </div>
            <a href="/" style={{
              display: 'inline-block', padding: '12px 24px', borderRadius: 8,
              background: '#1a0f05', color: '#c8a96e', fontSize: 13, fontWeight: 600,
              textDecoration: 'none', border: '2px solid #4a3010',
            }}>← 지도로 돌아가기</a>
          </>
        )}
      </div>
    </div>
  )
}

export default function TossSuccessPage() {
  return (
    <Suspense fallback={
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0906', color: '#c8a96e', fontFamily: 'sans-serif' }}>
        결제 확인 중...
      </div>
    }>
      <TossSuccessContent />
    </Suspense>
  )
}
