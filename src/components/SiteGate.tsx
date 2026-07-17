'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ADMIN_EMAILS } from '@/lib/admins'

// 유지보수(비공개) 모드: 기본 ON. 오픈할 때 Vercel 환경변수 NEXT_PUBLIC_MAINTENANCE=off 로 해제.
const MAINTENANCE = process.env.NEXT_PUBLIC_MAINTENANCE !== 'off'
// 비공개 모드에서도 접속 허용할 이메일 (관리자들 + Vercel env NEXT_PUBLIC_ALLOWED_EMAILS 콤마 목록)
const ALLOWED = new Set(
  [...ADMIN_EMAILS, ...(process.env.NEXT_PUBLIC_ALLOWED_EMAILS ?? '').split(',')]
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
)
const isAllowed = (email?: string | null) => !!email && ALLOWED.has(email.toLowerCase())

export default function SiteGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'checking' | 'admin' | 'blocked'>('checking')

  useEffect(() => {
    if (!MAINTENANCE) { setState('admin'); return }
    // OAuth 콜백은 통과시켜 로그인이 완료되게 함
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/auth/')) {
      setState('admin'); return
    }
    supabase.auth.getUser().then(({ data }) => {
      setState(isAllowed(data.user?.email) ? 'admin' : 'blocked')
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setState(isAllowed(session?.user?.email) ? 'admin' : 'blocked')
    })
    return () => subscription.unsubscribe()
  }, [])

  if (!MAINTENANCE || state === 'admin') return <>{children}</>

  if (state === 'checking') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f3f1', color: '#97948f', fontSize: 13 }}>
        불러오는 중…
      </div>
    )
  }

  // 비공개 모드 화면 (일반 방문자)
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f3f1', color: '#1a1a1a', padding: 20 }}>
      <div style={{
        width: 420, maxWidth: '92vw', textAlign: 'center', background: '#ffffff',
        border: '1px solid #e9e7e4', borderRadius: 16, padding: '48px 32px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 10 }}>집.zip</div>
        <div style={{ display: 'inline-block', fontSize: 12, fontWeight: 600, color: '#6f6d6a', background: '#faf9f7', border: '1px solid #e9e7e4', borderRadius: 999, padding: '5px 14px', marginBottom: 18 }}>
          오픈 준비 중
        </div>
        <div style={{ fontSize: 14, color: '#575654', lineHeight: 1.8, marginBottom: 28 }}>
          더 완성도 높은 서비스로 곧 찾아뵙겠습니다.<br />조금만 기다려 주세요!
        </div>
        <button
          onClick={() => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback` } })}
          style={{ fontSize: 11, color: '#97948f', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
        >
          관계자 로그인
        </button>
      </div>
    </div>
  )
}
