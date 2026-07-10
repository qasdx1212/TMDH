'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PERMANENT_DAYS, getAddress } from '@/lib/constants'
import { toUserMessage } from '@/lib/errorMessage'

interface PendingOrder {
  id: string
  user_id: string
  address: string
  col: number
  row: number
  width: number
  height: number
  zone: string
  name: string | null
  nickname: string | null
  description: string | null
  link_url: string | null
  border_effect: string
  days: number
  exterior_url: string | null
  interior_url: string | null
  amount: number
  pay_method: string
}

function PaymentRedirectContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'processing' | 'done' | 'error' | 'failed'>('processing')
  const [errorMsg, setErrorMsg] = useState('')
  const [address, setAddress] = useState('')

  useEffect(() => {
    const paymentId = searchParams.get('paymentId')
    const code = searchParams.get('code')       // 실패 시에만 존재
    const message = searchParams.get('message')

    const run = async () => {
      // 결제 실패/취소 — 포트원은 실패 시 code/message를 붙여 redirect
      if (code) {
        setStatus('failed')
        setErrorMsg(message || '결제가 취소되었어요.')
        // 고아 pending 주문 정리 (실패해도 UI는 정상 표시)
        if (paymentId) {
          supabase.from('orders').update({ status: 'failed' }).eq('id', paymentId).eq('status', 'pending')
            .then(() => {}, () => {})
        }
        return
      }

      if (!paymentId) {
        setErrorMsg('결제 정보가 올바르지 않아요.')
        setStatus('error')
        return
      }

      // 1. 세션 토큰 확인
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setErrorMsg('로그인 세션이 만료됐어요. 다시 로그인 후 고객센터에 문의해주세요.')
        setStatus('error')
        return
      }

      // 2. 서버사이드 결제 검증 (포트원 조회 + 금액 위변조 검증 + JWT 소유자 확인)
      const verifyRes = await fetch('/api/payment-complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ paymentId }),
      })
      if (!verifyRes.ok) {
        const err = await verifyRes.json()
        setErrorMsg(err.error ?? '결제 검증에 실패했어요.')
        setStatus('error')
        return
      }

      // 3. 주문 정보를 응답에서 꺼내기
      const verifyData = await verifyRes.json()
      const order: PendingOrder = verifyData.order
      if (!order) {
        setErrorMsg('주문 정보를 찾을 수 없어요. 고객센터에 문의해주세요.')
        setStatus('error')
        return
      }
      setAddress(order.address)

      const user = session.user

      // 4. 입주 처리 — .eq('status','available') 조건으로 동시 구매 race condition 방지
      const expiresAt = order.days === PERMANENT_DAYS
        ? null
        : new Date(Date.now() + order.days * 86400000).toISOString()
      const occupiedAt = new Date().toISOString()

      const { data: claimed, error: houseErr } = await supabase.from('houses').update({
        user_id: user.id,
        name: order.name, nickname: order.nickname,
        description: order.description, link_url: order.link_url,
        exterior_image_url: order.exterior_url, interior_image_url: order.interior_url,
        border_effect: order.border_effect, status: 'occupied', is_visible: true,
        width: order.width, height: order.height,
        occupied_at: occupiedAt, expires_at: expiresAt,
        is_permanent: order.days === PERMANENT_DAYS,
      }).eq('address', order.address).eq('status', 'available').select('id')

      if (houseErr || !claimed || claimed.length === 0) {
        setErrorMsg('이미 다른 사람이 입주한 칸이에요. 결제 환불은 고객센터로 문의해주세요.')
        setStatus('error')
        return
      }

      // 위성 셀 처리 (멀티셀 구매)
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
        method: order.pay_method,
        status: 'completed',
      })

      setStatus('done')
      setTimeout(() => router.push(`/?house=${order.address}`), 3000)
    }

    run().catch(e => {
      setErrorMsg(toUserMessage(e))
      setStatus('error')
    })
  }, [searchParams, router])

  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f4f3f1', color: '#1a1a1a', padding: '20px',
    }}>
      <div style={{
        width: 400, maxWidth: '92vw', textAlign: 'center',
        background: '#ffffff',
        border: '1px solid #e9e7e4', borderRadius: 14, padding: '44px 32px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        {status === 'processing' && (
          <>
            <div style={{ display: 'inline-block', fontSize: 12.5, fontWeight: 600, color: '#6f6d6a', background: '#faf9f7', border: '1px solid #e9e7e4', borderRadius: 999, padding: '5px 14px', marginBottom: 20 }}>처리 중</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', marginBottom: 10 }}>처리 중...</div>
            <div style={{ fontSize: 13, color: '#575654', lineHeight: 1.9 }}>
              결제를 확인하고 입주 처리 중이에요.<br />잠시만 기다려 주세요.
            </div>
            <div style={{ marginTop: 24, width: '100%', height: 8, background: '#f0efec', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#1c1c1e', borderRadius: 999, animation: 'pay-loading 2s ease-in-out infinite' }} />
            </div>
            <style>{`@keyframes pay-loading { 0%,100%{width:20%} 50%{width:80%} }`}</style>
          </>
        )}

        {status === 'done' && (
          <>
            <div style={{ display: 'inline-block', fontSize: 12.5, fontWeight: 600, color: '#16a34a', background: '#eaf6ee', border: '1px solid #d4ead9', borderRadius: 999, padding: '5px 14px', marginBottom: 16 }}>입주 완료</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#1a1a1a', marginBottom: 10 }}>입주 완료!</div>
            <div style={{ fontSize: 13.5, color: '#575654', lineHeight: 1.9, marginBottom: 24 }}>
              <strong style={{ color: '#1a1a1a', background: '#faf9f7', padding: '2px 8px', borderRadius: 6, border: '1px solid #e9e7e4' }}>{address}</strong>에<br />
              당신의 집이 생겼어요<br />
              <span style={{ color: '#6f6d6a' }}>3초 후 지도로 이동합니다...</span>
            </div>
            <a href={`/?house=${address}`} style={{
              display: 'inline-block', padding: '12px 28px',
              background: '#1c1c1e',
              color: '#fff', fontSize: 14, fontWeight: 600, textDecoration: 'none',
              borderRadius: 10,
            }}>지도에서 내 집 보기 →</a>
          </>
        )}

        {status === 'failed' && (
          <>
            <div style={{ display: 'inline-block', fontSize: 12.5, fontWeight: 600, color: '#dc2626', background: '#fdecec', border: '1px solid #f5d5d5', borderRadius: 999, padding: '5px 14px', marginBottom: 16 }}>결제 취소</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', marginBottom: 10 }}>결제가 취소되었어요</div>
            <div style={{ fontSize: 13, color: '#575654', lineHeight: 1.9, marginBottom: 24 }}>
              {errorMsg}<br />
              <span style={{ color: '#6f6d6a', fontSize: 12 }}>다시 시도하시거나 다른 결제수단을 이용해주세요.</span>
            </div>
            <a href="/" style={{
              display: 'inline-block', padding: '12px 24px',
              background: '#1c1c1e', color: '#fff', fontSize: 13, fontWeight: 600,
              textDecoration: 'none', borderRadius: 10,
            }}>← 다시 시도하기</a>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ display: 'inline-block', fontSize: 12.5, fontWeight: 600, color: '#dc2626', background: '#fdecec', border: '1px solid #f5d5d5', borderRadius: 999, padding: '5px 14px', marginBottom: 16 }}>오류</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', marginBottom: 10 }}>오류가 발생했어요</div>
            <div style={{ fontSize: 13, color: '#575654', lineHeight: 1.9, marginBottom: 24 }}>
              {errorMsg}<br />
              <span style={{ color: '#6f6d6a', fontSize: 12 }}>결제가 완료됐다면 고객센터로 연락해주세요.</span>
            </div>
            <a href="/" style={{
              display: 'inline-block', padding: '12px 24px',
              background: '#ffffff', color: '#1a1a1a', fontSize: 13, fontWeight: 600,
              textDecoration: 'none', border: '1px solid #e0ddd9', borderRadius: 10,
            }}>← 지도로 돌아가기</a>
          </>
        )}
      </div>
    </div>
  )
}

export default function PaymentRedirectPage() {
  return (
    <Suspense fallback={
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f3f1', color: '#6f6d6a' }}>
        결제 확인 중...
      </div>
    }>
      <PaymentRedirectContent />
    </Suspense>
  )
}
