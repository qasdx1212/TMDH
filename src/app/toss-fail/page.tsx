'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// Toss가 전달하는 대표적인 실패 코드를 사용자 친화적 문구로 변환
function friendlyMessage(code: string | null, rawMessage: string | null): string {
  if (code === 'PAY_PROCESS_CANCELED' || code === 'USER_CANCEL') {
    return '결제를 취소하셨어요. 언제든 다시 시도할 수 있어요.'
  }
  if (code === 'PAY_PROCESS_ABORTED') {
    return '결제가 중단됐어요. 잠시 후 다시 시도해 주세요.'
  }
  if (code === 'REJECT_CARD_COMPANY') {
    return '카드사에서 결제가 거절됐어요. 다른 카드로 시도해 주세요.'
  }
  if (rawMessage && rawMessage.trim()) return rawMessage
  return '결제가 정상적으로 완료되지 않았어요.'
}

function TossFailContent() {
  const searchParams = useSearchParams()
  const [message, setMessage] = useState('결제가 정상적으로 완료되지 않았어요.')

  useEffect(() => {
    const code = searchParams.get('code')
    const rawMessage = searchParams.get('message')
    const orderId = searchParams.get('orderId')

    setMessage(friendlyMessage(code, rawMessage))

    // 고아 주문 정리: pending 주문을 failed로 표시 (실패해도 UI는 정상 표시)
    if (orderId) {
      supabase
        .from('orders')
        .update({ status: 'failed' })
        .eq('id', orderId)
        .eq('status', 'pending')
        .then(() => {}, () => {})
    }
  }, [searchParams])

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
        <div style={{ fontSize: 64, marginBottom: 16 }}>⚠️</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: '#c8a96e', marginBottom: 12 }}>결제가 취소되었어요</div>
        <div style={{ fontSize: 13, color: '#a08060', lineHeight: 1.8, marginBottom: 28 }}>
          {message}<br />
          <span style={{ color: '#5a3e1a', fontSize: 11 }}>결제 금액은 청구되지 않았어요.</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <a href="/" style={{
            display: 'inline-block', padding: '12px 32px', borderRadius: 10,
            background: 'linear-gradient(180deg,#8b6914,#6b4c10)',
            color: '#fdf6e3', fontSize: 14, fontWeight: 700, textDecoration: 'none',
            border: '2px solid #c8a96e', boxShadow: '0 4px 0 #3d2a08',
          }}>다시 시도하기</a>
          <a href="/" style={{
            display: 'inline-block', padding: '10px 24px', borderRadius: 8,
            background: '#1a0f05', color: '#c8a96e', fontSize: 13, fontWeight: 600,
            textDecoration: 'none', border: '2px solid #4a3010',
          }}>← 지도로 돌아가기</a>
        </div>
      </div>
    </div>
  )
}

export default function TossFailPage() {
  return (
    <Suspense fallback={
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0906', color: '#c8a96e', fontFamily: 'sans-serif' }}>
        결제 확인 중...
      </div>
    }>
      <TossFailContent />
    </Suspense>
  )
}
