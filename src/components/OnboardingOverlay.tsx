'use client'

import { useState, useEffect } from 'react'

const STORAGE_KEY = 'zipzip_onboarded'

const STEPS = [
  '① 지도의 빈 칸을 클릭하세요',
  '② 집 정보와 이미지를 등록하세요',
  '③ 나만의 디지털 공간이 생겨요',
]

export default function OnboardingOverlay() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setShow(true)
    } catch {
      // localStorage 접근 불가(프라이빗 모드 등) 시 그냥 표시 안 함
    }
  }, [])

  const handleStart = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // 저장 실패해도 오버레이는 닫음
    }
    setShow(false)
  }

  if (!show) return null

  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="집.zip 온보딩 안내"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 900,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.7)',
        fontFamily: '"Noto Sans KR", -apple-system, sans-serif',
        padding: '20px',
        animation: reduceMotion ? undefined : 'zipzipOnboardFade 0.25s ease',
      }}
    >
      <style>{`
        @keyframes zipzipOnboardFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
      <div
        style={{
          background: '#1a0f05',
          border: '2px solid #c8a96e',
          borderRadius: 16,
          padding: '32px 28px',
          maxWidth: 360,
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
        }}
      >
        <div style={{ fontSize: 52, marginBottom: 14, lineHeight: 1 }}>🏠</div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: '#c8a96e',
            marginBottom: 20,
          }}
        >
          집.zip에 오신 걸 환영해요!
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            marginBottom: 26,
            textAlign: 'left',
          }}
        >
          {STEPS.map((step) => (
            <div
              key={step}
              style={{
                fontSize: 14,
                color: '#a08060',
                lineHeight: 1.5,
                padding: '10px 14px',
                background: 'rgba(200,169,110,0.08)',
                border: '1px solid rgba(200,169,110,0.25)',
                borderRadius: 10,
              }}
            >
              {step}
            </div>
          ))}
        </div>
        <button
          onClick={handleStart}
          style={{
            width: '100%',
            padding: '13px',
            borderRadius: 10,
            border: '2px solid #c8a96e',
            background: '#c8a96e',
            color: '#1a0f05',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          시작하기
        </button>
      </div>
    </div>
  )
}
