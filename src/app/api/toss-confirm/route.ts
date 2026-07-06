import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { calcPrice } from '@/lib/constants'

export async function POST(req: NextRequest) {
  const { paymentKey, orderId } = await req.json()

  if (!paymentKey || !orderId) {
    return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 })
  }

  // 1. JWT 인증 검증
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  }

  const secretKey = process.env.TOSS_SECRET_KEY
  if (!secretKey) {
    return NextResponse.json({ error: '결제 설정 오류' }, { status: 500 })
  }

  // 서비스 롤로 주문 조회 — 클라이언트가 보낸 금액은 사용하지 않음
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 토큰으로 유저 확인
  const { data: { user }, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !user) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  }

  const { data: order, error: orderErr } = await admin
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single()

  if (orderErr || !order) {
    return NextResponse.json({ error: '주문을 찾을 수 없습니다' }, { status: 404 })
  }

  // 2. 주문 소유자 확인
  if (order.user_id !== user.id) {
    return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })
  }

  if (order.status !== 'pending') {
    return NextResponse.json({ error: '이미 처리된 주문입니다' }, { status: 400 })
  }

  // 3. 서버사이드 금액 독립 계산 + 검증 (DB 값 자체가 조작된 케이스 방어)
  const expectedAmount = calcPrice(order.zone, order.width * order.height, order.days)
  if (expectedAmount !== order.amount) {
    return NextResponse.json({ error: '주문 금액 불일치' }, { status: 400 })
  }

  // DB에 저장된 금액으로 Toss 승인 (클라이언트 금액 무시)
  const encoded = Buffer.from(`${secretKey}:`).toString('base64')
  const res = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'POST',
    headers: { Authorization: `Basic ${encoded}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentKey, orderId, amount: order.amount }),
  })

  const data = await res.json()

  if (!res.ok) {
    return NextResponse.json({ error: data.message ?? '결제 승인 실패' }, { status: res.status })
  }

  await admin.from('orders').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', orderId)

  // order를 함께 반환 — toss-success에서 sessionStorage 없이 사용
  return NextResponse.json({ ...data, order })
}
