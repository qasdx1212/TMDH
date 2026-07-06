import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = 'qasdx1212@gmail.com'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: { user }, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !user) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  }

  if (user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { houseId, address, width, height } = await req.json()
  if (!houseId || !address) {
    return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 })
  }

  await admin.from('houses').update({
    user_id: null, name: null, nickname: null, description: null,
    link_url: null, exterior_image_url: null, interior_image_url: null,
    border_effect: 'none', status: 'available', width: 1, height: 1,
    parent_address: null, occupied_at: null, expires_at: null,
    is_permanent: false, like_count: 0, visit_count: 0, is_visible: true,
  }).eq('id', houseId)

  if ((width ?? 1) > 1 || (height ?? 1) > 1) {
    await admin.from('houses').update({
      user_id: null, status: 'available', parent_address: null,
      occupied_at: null, expires_at: null, is_permanent: false,
    }).eq('parent_address', address)
  }

  return NextResponse.json({ ok: true })
}
