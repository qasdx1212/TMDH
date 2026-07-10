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
        background: 'rgba(26,26,26,0.45)',
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
          background: '#ffffff',
          border: '1px solid #e9e7e4',
          borderRadius: 14,
          padding: '32px 28px',
          maxWidth: 360,
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
        }}
      >
        <div
          style={{
            fontSize: 19,
            fontWeight: 700,
            color: '#1a1a1a',
            marginBottom: 22,
          }}
        >
          집.zip에 오신 걸 환영해요!
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            marginBottom: 26,
            textAlign: 'left',
          }}
        >
          {STEPS.map((step) => (
            <div
              key={step}
              style={{
                fontSize: 13.5,
                color: '#575654',
                fontWeight: 500,
                lineHeight: 1.5,
                padding: '12px 14px',
                background: '#faf9f7',
                border: '1px solid #e9e7e4',
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
            border: 'none',
            background: '#1c1c1e',
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            borderRadius: 10,
          }}
        >
          시작하기
        </button>
      </div>
    </div>
  )
}
