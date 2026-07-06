import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = 'qasdx1212@gmail.com'

export async function POST(req: NextRequest) {
  // Authorization 헤더에서 Bearer 토큰 추출
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // service_role 클라이언트로 admin 권한 획득
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // 토큰으로 현재 사용자 검증
  const { data: { user }, error: userError } = await admin.auth.getUser(token)
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 관리자 이메일 확인
  if (user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { houseId, address, width, height } = body as {
    houseId: string
    address: string
    width: number
    height: number
  }

  if (!houseId || !address) {
    return NextResponse.json({ error: 'Bad Request' }, { status: 400 })
  }

  // 메인 셀 초기화
  const { error: mainError } = await admin.from('houses').update({
    user_id: null,
    name: null,
    nickname: null,
    description: null,
    link_url: null,
    exterior_image_url: null,
    interior_image_url: null,
    border_effect: 'none',
    status: 'available',
    width: 1,
    height: 1,
    parent_address: null,
    occupied_at: null,
    expires_at: null,
    is_permanent: false,
    like_count: 0,
    visit_count: 0,
    is_visible: true,
  }).eq('id', houseId)

  if (mainError) {
    return NextResponse.json({ error: mainError.message }, { status: 500 })
  }

  // 위성 셀 초기화 (멀티 셀인 경우)
  if (width > 1 || height > 1) {
    const { error: satelliteError } = await admin.from('houses').update({
      user_id: null,
      status: 'available',
      parent_address: null,
      occupied_at: null,
      expires_at: null,
      is_permanent: false,
    }).eq('parent_address', address)

    if (satelliteError) {
      return NextResponse.json({ error: satelliteError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
