'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function TossFailContent() {
  const searchParams = useSearchParams()
  const message = searchParams.get('message') ?? '결제가 취소되었거나 실패했어요.'
  const code = searchParams.get('code')

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
        <div style={{ fontSize: 64, marginBottom: 16 }}>💸</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#f87171', marginBottom: 10 }}>
          {code === 'PAY_PROCESS_CANCELED' ? '결제를 취소했어요' : '결제에 실패했어요'}
        </div>
        <div style={{ fontSize: 13, color: '#a08060', lineHeight: 1.8, marginBottom: 28 }}>
          {message}
          {code && <div style={{ marginTop: 8, fontSize: 11, color: '#4a3010' }}>코드: {code}</div>}
        </div>
        <a href="/" style={{
          display: 'inline-block', padding: '12px 32px', borderRadius: 10,
          background: 'linear-gradient(180deg,#8b6914,#6b4c10)',
          color: '#fdf6e3', fontSize: 14, fontWeight: 700, textDecoration: 'none',
          border: '2px solid #c8a96e', boxShadow: '0 4px 0 #3d2a08',
        }}>← 지도로 돌아가기</a>
      </div>
    </div>
  )
}

export default function TossFailPage() {
  return (
    <Suspense fallback={
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0906', color: '#c8a96e' }}>
        로딩 중...
      </div>
    }>
      <TossFailContent />
    </Suspense>
  )
}
