import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { calcPrice } from '@/lib/constants'

export async function POST(req: NextRequest) {
  const { paymentId } = await req.json()

  if (!paymentId) {
    return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 })
  }

  // 1. JWT 인증 검증
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  }

  const apiSecret = process.env.PORTONE_V2_API_SECRET
  if (!apiSecret) {
    return NextResponse.json({ error: '결제 설정 오류' }, { status: 500 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 토큰으로 유저 확인
  const { data: { user }, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !user) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  }

  // 2. 주문 조회 (orderId === paymentId)
  const { data: order, error: orderErr } = await admin
    .from('orders')
    .select('*')
    .eq('id', paymentId)
    .single()

  if (orderErr || !order) {
    return NextResponse.json({ error: '주문을 찾을 수 없습니다' }, { status: 404 })
  }

  // 3. 주문 소유자 확인
  if (order.user_id !== user.id) {
    return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })
  }

  if (order.status !== 'pending') {
    return NextResponse.json({ error: '이미 처리된 주문입니다' }, { status: 400 })
  }

  // 4. 서버사이드 금액 독립 계산 + 검증 (DB 값 자체가 조작된 케이스 방어)
  const expectedAmount = calcPrice(order.zone, order.width * order.height, order.days)
  if (expectedAmount !== order.amount) {
    return NextResponse.json({ error: '주문 금액 불일치' }, { status: 400 })
  }

  // 5. 포트원 결제 단건 조회로 실제 결제 검증
  const res = await fetch(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `PortOne ${apiSecret}` },
  })
  const payment = await res.json()

  if (!res.ok) {
    return NextResponse.json({ error: '결제 조회에 실패했습니다' }, { status: 502 })
  }

  // 6. 결제 상태 및 금액 위변조 검증
  if (payment.status !== 'PAID') {
    return NextResponse.json({ error: '결제가 완료되지 않았습니다' }, { status: 400 })
  }
  if (payment.amount?.total !== order.amount) {
    return NextResponse.json({ error: '결제 금액이 일치하지 않습니다' }, { status: 400 })
  }

  await admin.from('orders').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', paymentId)

  // order를 함께 반환 — payment-redirect에서 입주 처리에 사용
  return NextResponse.json({ ok: true, order })
}
