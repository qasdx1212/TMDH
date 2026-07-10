'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { ZONES, ZONE_PRICES, DURATIONS, PERMANENT_DAYS, PERMANENT_MULTIPLIER, calcPrice, formatKRW, getAddress, getZone } from '@/lib/constants'
import { hashPwd } from '@/lib/hash'
import { toUserMessage } from '@/lib/errorMessage'
import type { CellData } from '@/types/cell'

interface ApplyFlowProps {
  selectedCell: CellData
  userId: string
  onClose: () => void
  onSuccess: () => void
}

type Step = 1 | 2 | 3 | 4 | 5

interface FormData {
  name: string
  description: string
  linkUrl: string
  nickname: string
  exteriorImage: File | null
  exteriorPreview: string | null
  exteriorFit: 'cover' | 'contain'
  interiorImage: File | null
  interiorPreview: string | null
  days: number
  borderEffect: 'none' | 'neon'
  password: string
  passwordConfirm: string
  removePassword: boolean
}

const STEPS = ['위치 확인', '집 정보', '외관 이미지', '신청 확인', '결제']

export default function ApplyFlow({ selectedCell, userId, onClose, onSuccess }: ApplyFlowProps) {
  const isEdit = selectedCell.status === 'occupied'
  const [step, setStep] = useState<Step>(isEdit ? 2 : 1)
  const [form, setForm] = useState<FormData>({
    name: isEdit ? (selectedCell.name ?? '') : '',
    description: isEdit ? (selectedCell.description ?? '') : '',
    linkUrl: isEdit ? (selectedCell.link_url ?? '') : '',
    nickname: isEdit ? (selectedCell.nickname ?? '') : '',
    exteriorImage: null,
    exteriorPreview: isEdit ? (selectedCell.exterior_image_url ?? null) : null,
    exteriorFit: 'cover',
    interiorImage: null,
    interiorPreview: isEdit ? (selectedCell.interior_image_url ?? null) : null,
    days: PERMANENT_DAYS,
    borderEffect: isEdit ? (selectedCell.border_effect ?? 'none') : 'none',
    password: '',
    passwordConfirm: '',
    removePassword: false,
  })
  const [loading, setLoading] = useState(false)
  const [payMethod, setPayMethod] = useState('card')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [paymentDone, setPaymentDone] = useState(false)
  const [contentChecking, setContentChecking] = useState(false)
  // 결제 전 필수 동의 (전자상거래법 시행령 제21조)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreeRefund, setAgreeRefund] = useState(false)
  const [agreeAge, setAgreeAge] = useState(false)
  const allAgreed = agreeTerms && agreeRefund && agreeAge
  const miniMapRef = useRef<HTMLCanvasElement>(null)
  const lastStep: Step = isEdit ? 4 : 5

  const zone = ZONES[selectedCell.zone]
  const cellCount = (selectedCell.width ?? 1) * (selectedCell.height ?? 1)

  // 구역별 칸수 계산 (cross-zone 선택 지원)
  const zoneBreakdown = useMemo(() => {
    const bd: Partial<Record<string, number>> = {}
    for (let c = selectedCell.col; c < selectedCell.col + (selectedCell.width ?? 1); c++) {
      for (let r = selectedCell.row; r < selectedCell.row + (selectedCell.height ?? 1); r++) {
        const z = getZone(c, r)
        bd[z] = (bd[z] ?? 0) + 1
      }
    }
    return bd
  }, [selectedCell])

  const isMultiZone = Object.keys(zoneBreakdown).length > 1

  const calcTotalPrice = (days: number): number => {
    return Math.round(Object.entries(zoneBreakdown).reduce((sum, [z, count]) => {
      const base = (ZONE_PRICES[z] ?? 0) * (count ?? 0)
      if (days === PERMANENT_DAYS) return sum + base * PERMANENT_MULTIPLIER
      const dur = DURATIONS.find(d => d.days === days)
      return sum + base * (dur?.multiplier ?? 1)
    }, 0))
  }

  const price = calcTotalPrice(form.days)

  // 미니맵 (Step 1) — 4구역 + 선택 셀 표시
  useEffect(() => {
    if (step !== 1) return
    const canvas = miniMapRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    // SX=1 (200 cols → 200px), SY=2 (100 rows → 200px)
    const SX = 1, SY = 2
    ctx.clearRect(0, 0, 200, 200)
    // 통합 지도 — 밝은 중립 배경 (구역 구분 없음)
    ctx.fillStyle = '#eceae6'
    ctx.fillRect(0, 0, 200, 200)
    // 선택된 셀
    ctx.fillStyle = '#1c1c1e'
    ctx.fillRect(selectedCell.col * SX, selectedCell.row * SY, Math.max(1, (selectedCell.width ?? 1) * SX), Math.max(2, (selectedCell.height ?? 1) * SY))
    // 강조 테두리
    ctx.strokeStyle = '#1c1c1e'; ctx.lineWidth = 1.5
    ctx.strokeRect(selectedCell.col * SX - 1, selectedCell.row * SY - 1, Math.max(3, (selectedCell.width ?? 1) * SX + 2), Math.max(4, (selectedCell.height ?? 1) * SY + 2))
  }, [step, selectedCell])

  const handleFile = (type: 'exterior' | 'interior') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const preview = URL.createObjectURL(file)
    if (type === 'exterior') setForm(f => ({ ...f, exteriorImage: file, exteriorPreview: preview }))
    else setForm(f => ({ ...f, interiorImage: file, interiorPreview: preview }))
  }

  const uploadImage = async (file: File, path: string): Promise<string | null> => {
    const { error } = await supabase.storage.from('house-images').upload(path, file, { upsert: true })
    if (error) return null
    const { data } = supabase.storage.from('house-images').getPublicUrl(path)
    return data.publicUrl
  }

  // 수정 모드 저장
  const handleEditSave = async () => {
    setLoading(true); setErrorMsg(null)
    try {
      let exteriorUrl: string | null = selectedCell.exterior_image_url ?? null
      if (form.exteriorImage) exteriorUrl = await uploadImage(form.exteriorImage, `${userId}/exterior-${selectedCell.address}.${form.exteriorImage.name.split('.').pop()}`)
      let interiorUrl: string | null = selectedCell.interior_image_url ?? null
      if (form.interiorImage) interiorUrl = await uploadImage(form.interiorImage, `${userId}/interior-${selectedCell.address}.${form.interiorImage.name.split('.').pop()}`)

      const pwdFields = form.removePassword
        ? { password_hash: null, has_password: false }
        : form.password
          ? { password_hash: await hashPwd(form.password), has_password: true }
          : {}

      const { error } = await supabase.from('houses').update({
        name: form.name || null, nickname: form.nickname || null,
        description: form.description || null, link_url: form.linkUrl || null,
        exterior_image_url: exteriorUrl, interior_image_url: interiorUrl,
        border_effect: form.borderEffect,
        ...pwdFields,
      }).eq('address', selectedCell.address).eq('user_id', userId)
      if (error) { setErrorMsg(`저장 실패: ${toUserMessage(error)}`); return }
      setShowSuccess(true)
      setTimeout(() => { setShowSuccess(false); onSuccess() }, 2200)
    } catch { setErrorMsg('오류가 발생했습니다.') }
    finally { setLoading(false) }
  }

  // 1단계: 이미지 업로드 → DB orders 저장 → Toss 결제창 오픈
  const handlePayment = async () => {
    setLoading(true); setErrorMsg(null)
    try {
      // 이미지 먼저 업로드 (Toss 리다이렉트 전에 완료해야 함)
      let exteriorUrl: string | null = selectedCell.exterior_image_url ?? null
      if (form.exteriorImage) exteriorUrl = await uploadImage(form.exteriorImage, `${userId}/exterior-${selectedCell.address}.${form.exteriorImage.name.split('.').pop()}`)
      let interiorUrl: string | null = selectedCell.interior_image_url ?? null
      if (form.interiorImage) interiorUrl = await uploadImage(form.interiorImage, `${userId}/interior-${selectedCell.address}.${form.interiorImage.name.split('.').pop()}`)

      const orderId = `zipzip-${Date.now()}-${selectedCell.address}`

      // 주문 데이터를 DB에 저장 (sessionStorage 대신 — 모바일 카카오페이 유실 방지, 금액 서버 검증용)
      const { error: orderErr } = await supabase.from('orders').insert({
        id: orderId,
        user_id: userId,
        address: selectedCell.address,
        col: selectedCell.col, row: selectedCell.row,
        width: selectedCell.width ?? 1, height: selectedCell.height ?? 1,
        zone: selectedCell.zone,
        name: form.name || null, nickname: form.nickname || null,
        description: form.description || null, link_url: form.linkUrl || null,
        border_effect: form.borderEffect, days: form.days,
        exterior_url: exteriorUrl, interior_url: interiorUrl,
        amount: price, pay_method: payMethod,
      })
      if (orderErr) { setErrorMsg('주문 저장 실패: ' + toUserMessage(orderErr)); setLoading(false); return }

      // 포트원 v2 SDK 동적 로드 후 결제창 오픈
      const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID
      const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY
      if (!storeId || !channelKey) {
        setErrorMsg('결제 설정이 준비 중이에요. 잠시 후 다시 시도해주세요.')
        setLoading(false)
        return
      }

      const PortOne = await import('@portone/browser-sdk/v2')

      // card → CARD, 카카오페이/토스페이 → EASY_PAY (구체 간편결제사는 포트원 채널 설정으로 라우팅)
      const payMethodMap: Record<string, 'CARD' | 'EASY_PAY'> = {
        card: 'CARD', kakaopay: 'EASY_PAY',
      }

      // orderId를 paymentId로 사용 (서버 검증 시 orders 조회 키와 일치)
      const response = await PortOne.requestPayment({
        storeId,
        channelKey,
        paymentId: orderId,
        orderName: `집.zip 입주 — ${selectedCell.address}`,
        totalAmount: price,
        currency: 'CURRENCY_KRW',
        payMethod: payMethodMap[payMethod] ?? 'CARD',
        redirectUrl: `${window.location.origin}/payment-redirect`,
        customer: { customerId: userId },
      })

      // 모바일은 redirectUrl로 이동(여기 도달 안 함). 데스크탑 팝업은 response로 반환됨.
      if (response?.code !== undefined) {
        // 결제 실패/취소
        setErrorMsg(response.message ?? '결제가 취소되었어요.')
        setLoading(false)
        return
      }
      // 성공 — 검증+입주 처리 페이지로 이동
      window.location.href = `${window.location.origin}/payment-redirect?paymentId=${orderId}`
    } catch (e: unknown) {
      setErrorMsg(toUserMessage(e))
      setLoading(false)
    }
  }

  // 2단계: AI 콘텐츠 검사 + 실제 입주 처리
  const handleMoveIn = async () => {
    setLoading(true); setContentChecking(true); setErrorMsg(null)
    try {
      // AI 콘텐츠 검사 시뮬레이션 (2.5s)
      await new Promise(r => setTimeout(r, 2500))
      setContentChecking(false)

      // 이미지 업로드
      let exteriorUrl: string | null = selectedCell.exterior_image_url ?? null
      if (form.exteriorImage) exteriorUrl = await uploadImage(form.exteriorImage, `${userId}/exterior-${selectedCell.address}.${form.exteriorImage.name.split('.').pop()}`)
      let interiorUrl: string | null = selectedCell.interior_image_url ?? null
      if (form.interiorImage) interiorUrl = await uploadImage(form.interiorImage, `${userId}/interior-${selectedCell.address}.${form.interiorImage.name.split('.').pop()}`)

      // 신규 입주 DB 업데이트
      const expiresAt = form.days === PERMANENT_DAYS ? null : new Date(Date.now() + form.days * 86400000).toISOString()
      const occupiedAt = new Date().toISOString()
      const col = selectedCell.col, row = selectedCell.row
      const width = selectedCell.width ?? 1, height = selectedCell.height ?? 1
      const pwdHash = form.password ? await hashPwd(form.password) : null

      const { error } = await supabase.from('houses').update({
        user_id: userId, name: form.name || null, nickname: form.nickname || null,
        description: form.description || null, link_url: form.linkUrl || null,
        exterior_image_url: exteriorUrl, interior_image_url: interiorUrl,
        border_effect: form.borderEffect, status: 'occupied', is_visible: true,
        width, height, occupied_at: occupiedAt, expires_at: expiresAt,
        is_permanent: form.days === PERMANENT_DAYS,
        password_hash: pwdHash, has_password: !!pwdHash,
      }).eq('address', selectedCell.address)
      if (error) { setErrorMsg(`저장 실패: ${toUserMessage(error)}`); return }

      if (width > 1 || height > 1) {
        for (let c = col; c < col + width; c++) {
          for (let r = row; r < row + height; r++) {
            if (c === col && r === row) continue
            await supabase.from('houses').update({
              user_id: userId, status: 'occupied', parent_address: selectedCell.address,
              occupied_at: occupiedAt, expires_at: expiresAt, is_permanent: form.days === PERMANENT_DAYS,
            }).eq('address', getAddress(c, r))
          }
        }
      }

      // 결제 내역 기록
      await supabase.from('payments').insert({
        user_id: userId,
        house_address: selectedCell.address,
        amount: price,
        type: 'move_in',
        method: payMethod,
        status: 'completed',
      })

      setShowSuccess(true)
      setTimeout(() => { setShowSuccess(false); onSuccess() }, 2200)
    } catch { setErrorMsg('오류가 발생했습니다. 다시 시도해주세요.') }
    finally { setLoading(false); setContentChecking(false) }
  }

  const canNext = () => {
    if (step === 2 && !form.name.trim()) return false
    if (step === 2 && !isEdit && !form.password) return false
    if (step === 2 && form.password && form.password !== form.passwordConfirm) return false
    // 결제 단계: 필수 동의 3개를 모두 체크해야 결제 버튼 활성화
    if (step === lastStep && !isEdit && !paymentDone && !allAgreed) return false
    return true
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:600, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.4)' }}>
      {/* 모바일 반응형: 좁은 화면(≤640px)에서 좌우 2열 레이아웃을 1열로 전환 */}
      <style>{`
        @media (max-width: 640px) {
          .af-row { flex-direction: column !important; }
          .af-col { width: 100% !important; border-right: none !important; }
        }
        .af-modal input::placeholder, .af-modal textarea::placeholder { color:#b0aeaa; }
        @keyframes af-spin { to { transform: rotate(360deg); } }
      `}</style>
      <div className="af-modal" style={{
        width: step === 3 ? 860 : 700, maxWidth:'96vw', maxHeight:'92vh',
        background:'#ffffff', borderRadius:14,
        border:'1px solid #e9e7e4',
        boxShadow:'0 12px 40px rgba(0,0,0,0.14)',
        display:'flex', flexDirection:'column', overflow:'hidden',
        transition:'width 0.2s ease', position:'relative',
      }}>
        {/* AI 검사 오버레이 */}
        {contentChecking && (
          <div style={{
            position:'absolute', inset:0, zIndex:20,
            background:'#ffffff',
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
            gap:16,
          }}>
            <div style={{ width:44, height:44, borderRadius:'50%', border:'3px solid #e9e7e4', borderTopColor:'#1c1c1e', animation:'af-spin 0.8s linear infinite' }} />
            <div style={{ fontSize:18, fontWeight:700, color:'#1a1a1a' }}>AI 콘텐츠 검사 중</div>
            <div style={{ fontSize:13, color:'#8c8a87', textAlign:'center', lineHeight:1.8 }}>
              업로드된 이미지와 텍스트를<br />AI가 검토하고 있어요.
            </div>
            <div style={{ width:200, height:6, borderRadius:10, background:'#f4f3f1', overflow:'hidden', marginTop:4 }}>
              <div style={{ height:'100%', background:'#1c1c1e', borderRadius:10, animation:'ai-progress 2.5s linear forwards' }} />
            </div>
            <style>{`@keyframes ai-progress { from { width:0% } to { width:100% } }`}</style>
          </div>
        )}

        {/* 성공 오버레이 */}
        {showSuccess && (
          <div style={{
            position:'absolute', inset:0, zIndex:20,
            background:'#ffffff',
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
            gap:14,
          }}>
            <div style={{ width:72, height:72, borderRadius:'50%', background:'#1c1c1e', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            </div>
            <div style={{ fontSize:24, fontWeight:800, color:'#1a1a1a' }}>
              {isEdit ? '수정 완료' : '입주 완료'}
            </div>
            <div style={{ fontSize:14, color:'#8c8a87', textAlign:'center', lineHeight:1.8 }}>
              {isEdit
                ? '집 정보가 성공적으로 업데이트되었습니다.'
                : '지도에 당신의 집이 생겼어요\n잠시 후 지도에 반영됩니다.'}
            </div>
          </div>
        )}

        {/* 헤더 */}
        <div style={{ background:'#ffffff', padding:'16px 20px', borderBottom:'1px solid #e9e7e4', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div>
              <div style={{ fontSize:17, fontWeight:700, color:'#1a1a1a' }}>{isEdit ? '집 정보 수정' : '입주 신청'}</div>
              <div style={{ fontSize:12, color:'#8c8a87', fontWeight:500, marginTop:3 }}>{isMultiZone ? '복합 구역' : zone.label} · {selectedCell.address} · {cellCount}칸</div>
            </div>
          </div>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:10, background:'#ffffff', border:'1px solid #e9e7e4', color:'#8c8a87', fontSize:20, fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
        </div>

        {/* 스텝 인디케이터 */}
        <div style={{ display:'flex', background:'#ffffff', borderBottom:'1px solid #e9e7e4', flexShrink:0 }}>
          {STEPS.map((label, i) => {
            const s = (i + 1) as Step
            if (isEdit && (s === 1 || s === 5)) return null
            const isDone = step > s, isActive = step === s
            return (
              <div key={i} style={{ flex:1, padding:'12px 4px', textAlign:'center', fontSize:11, fontWeight:isActive?700:isDone?600:500, color:isActive?'#1a1a1a':isDone?'#1a1a1a':'#b0aeaa', borderBottom:isActive?'2px solid #1a1a1a':'2px solid transparent' }}>
                {label}
              </div>
            )
          })}
        </div>

        {/* 본문 */}
        <div style={{ flex:1, overflowY:'auto' }}>

          {/* ── STEP 1: 위치 확인 ── */}
          {step === 1 && (
            <div className="af-row" style={{ display:'flex', gap:0, height:'100%' }}>
              {/* 왼쪽: 미니맵 */}
              <div className="af-col" style={{ width:220, flexShrink:0, padding:'20px', borderRight:'1px solid #e9e7e4', display:'flex', flexDirection:'column', gap:12 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#1a1a1a' }}>지도에서 선택한 위치</div>
                <div style={{ position:'relative', borderRadius:10, overflow:'hidden', border:'1px solid #e9e7e4' }}>
                  <canvas ref={miniMapRef} width={200} height={200} style={{ display:'block', width:'100%', imageRendering:'pixelated' }} />
                  {/* 주소 라벨 */}
                  <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-60%)', background:'#1c1c1e', color:'#ffffff', fontSize:10, fontWeight:700, padding:'4px 8px', borderRadius:8, whiteSpace:'nowrap' }}>
                    {selectedCell.address}
                  </div>
                </div>
                <button onClick={onClose} style={{ padding:'10px', borderRadius:10, border:'1px solid #e0ddd9', background:'#ffffff', color:'#1a1a1a', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                  다른 위치 선택
                </button>
              </div>

              {/* 오른쪽: 위치 정보 */}
              <div className="af-col" style={{ flex:1, padding:'20px' }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#1a1a1a', marginBottom:14, paddingBottom:10, borderBottom:'1px solid #e9e7e4' }}>선택한 위치 정보</div>
                {[
                  { label:'구역', value: isMultiZone ? `복합 구역 (${Object.keys(zoneBreakdown).length}개)` : zone.label, color: zone.color },
                  { label:'선택 면적', value: `${selectedCell.width ?? 1} × ${selectedCell.height ?? 1} 칸 (${cellCount}칸)` },
                  { label:'기준 가격', value: '1,000원 / 1칸' },
                  { label:'선택 총액', value: `${formatKRW(calcTotalPrice(PERMANENT_DAYS))} (영구)`, color: '#1a1a1a' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid #e9e7e4' }}>
                    <span style={{ fontSize:13, color:'#8c8a87' }}>{label}</span>
                    <span style={{ fontSize:13, fontWeight:700, color: color ?? '#1a1a1a' }}>{value}</span>
                  </div>
                ))}
                {isMultiZone && (
                  <div style={{ marginTop:10, padding:12, borderRadius:10, background:'#faf9f8', border:'1px solid #e9e7e4', fontSize:12, color:'#8c8a87', lineHeight:1.8 }}>
                    <div style={{ fontWeight:700, marginBottom:4, color:'#1a1a1a' }}>구역별 구성</div>
                    {Object.entries(zoneBreakdown).map(([z, count]) => (
                      <div key={z} style={{ display:'flex', justifyContent:'space-between' }}>
                        <span style={{ color: ZONES[z as keyof typeof ZONES]?.color }}>{ZONES[z as keyof typeof ZONES]?.label}</span>
                        <span>{count}칸 × {formatKRW(ZONE_PRICES[z])}/칸</span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ marginTop:16, padding:14, borderRadius:10, background:'#faf9f8', border:'1px solid #e9e7e4', fontSize:12, color:'#8c8a87', lineHeight:1.7 }}>
                  선택한 위치와 면적은 이후 변경할 수 없습니다.
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: 집 정보 + 라이브 미리보기 ── */}
          {step === 2 && (
            <div className="af-row" style={{ display:'flex', gap:0 }}>
              {/* 왼쪽: 폼 */}
              <div className="af-col" style={{ flex:1, padding:'24px 20px', borderRight:'1px solid #e9e7e4', overflowY:'auto', maxHeight:'calc(92vh - 160px)' }}>
                <SectionTitle>집 정보를 입력해주세요</SectionTitle>
                <Field label="집 이름 *" hint="최대 20자">
                  <input style={inputStyle} placeholder="예) 토토의 작은 집" maxLength={20} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  <CharCount cur={form.name.length} max={20} />
                </Field>
                <Field label="소개글" hint="최대 80자">
                  <textarea style={{ ...inputStyle, height:84, resize:'none' }} placeholder="당신의 집을 소개해주세요!" maxLength={80} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                  <CharCount cur={form.description.length} max={80} />
                </Field>

                <div style={{ marginTop:4, marginBottom:16 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:'#1a1a1a', marginBottom:4 }}>링크 설정</div>
                  <div style={{ fontSize:11, color:'#8c8a87', marginBottom:8 }}>집에 연결할 링크를 설정해주세요. (최대 1개)</div>
                  <Field label="집 놀러가기 링크" hint="">
                    <input style={inputStyle} placeholder="https://" type="url" value={form.linkUrl} onChange={e => setForm(f => ({ ...f, linkUrl: e.target.value }))} />
                  </Field>
                  <div style={{ fontSize:11, color:'#8c8a87', marginTop:4 }}>방문객이 클릭하면 이 링크로 이동해요!</div>
                </div>

                <div style={{ marginTop:4, marginBottom:16 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, flexWrap:'wrap' }}>
                    <span style={{ fontSize:14, fontWeight:700, color:'#1a1a1a' }}>내부 인테리어 이미지 등록</span>
                    <span style={{ fontSize:11, color:'#8c8a87', background:'#f4f3f1', padding:'3px 8px', borderRadius:8 }}>집을 열었을 때 가장 크게 보이는 사진이에요.</span>
                  </div>
                  <label style={{ display:'block', cursor:'pointer' }}>
                    <div style={{ height:120, borderRadius:10, border:`1px dashed ${form.interiorPreview ? '#1a1a1a' : '#d5d2ce'}`, background:'#faf9f8', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
                      {form.interiorPreview ? <img src={form.interiorPreview} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : (
                        <div style={{ textAlign:'center', color:'#8c8a87' }}>
                          <div style={{ fontSize:12, fontWeight:600 }}>이미지 선택 또는 드래그</div>
                          <div style={{ fontSize:10, marginTop:3, color:'#b0aeaa' }}>JPG, PNG, WEBP (최대 10MB)</div>
                        </div>
                      )}
                    </div>
                    <input type="file" accept="image/*" onChange={handleFile('interior')} style={{ display:'none' }} />
                  </label>
                </div>

                <Field label="닉네임" hint="최대 7자 · 지도에 표시됨">
                  <input style={inputStyle} placeholder="사용할 닉네임" maxLength={7} value={form.nickname} onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))} />
                  <CharCount cur={form.nickname.length} max={7} />
                </Field>

                {/* 비밀번호 설정 */}
                <div style={{ marginTop:8, padding:'14px', borderRadius:10, background:'#faf9f8', border:'1px solid #e9e7e4' }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#1a1a1a', marginBottom:6 }}>
                    비밀번호 설정
                    {!isEdit && <span style={{ fontSize:11, fontWeight:700, color:'#dc2626', marginLeft:6 }}>* 필수</span>}
                    {isEdit && <span style={{ fontSize:11, fontWeight:500, color:'#8c8a87', marginLeft:6 }}>(변경 선택사항)</span>}
                  </div>
                  <div style={{ fontSize:11, color:'#8c8a87', marginBottom:10, lineHeight:1.6 }}>
                    {isEdit ? '변경하려면 새 비밀번호를 입력하세요.' : '수정·삭제 시 필요한 비밀번호를 설정해주세요.'}
                  </div>
                  {isEdit && selectedCell.has_password && (
                    <label style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, cursor:'pointer' }}>
                      <input type="checkbox" checked={form.removePassword} onChange={e => setForm(f => ({ ...f, removePassword: e.target.checked, password:'', passwordConfirm:'' }))} style={{ accentColor:'#dc2626' }} />
                      <span style={{ fontSize:12, color:'#dc2626', fontWeight:600 }}>기존 비밀번호 삭제</span>
                    </label>
                  )}
                  {!form.removePassword && (
                    <>
                      <input
                        type="password"
                        style={{ ...inputStyle, marginBottom:8 }}
                        placeholder={isEdit ? '새 비밀번호 (변경하려면 입력)' : '비밀번호 입력 (필수)'}
                        value={form.password}
                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      />
                      {form.password && (
                        <>
                          <input
                            type="password"
                            style={{ ...inputStyle, borderColor: form.passwordConfirm && form.password !== form.passwordConfirm ? '#dc2626' : '#e9e7e4' }}
                            placeholder="비밀번호 확인"
                            value={form.passwordConfirm}
                            onChange={e => setForm(f => ({ ...f, passwordConfirm: e.target.value }))}
                          />
                          {form.passwordConfirm && form.password !== form.passwordConfirm && (
                            <div style={{ fontSize:11, color:'#dc2626', marginTop:4 }}>비밀번호가 일치하지 않아요</div>
                          )}
                          {form.passwordConfirm && form.password === form.passwordConfirm && (
                            <div style={{ fontSize:11, color:'#1a1a1a', fontWeight:600, marginTop:4 }}>비밀번호 일치</div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* 오른쪽: 라이브 미리보기 */}
              <div className="af-col" style={{ width:280, flexShrink:0, padding:'16px', background:'#faf9f8', display:'flex', flexDirection:'column', gap:8 }}>
                <div style={{ fontSize:11, fontWeight:600, color:'#8c8a87', textAlign:'center' }}>집을 클릭하면 이렇게 보여요!</div>
                <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e9e7e4', overflow:'hidden', fontSize:12, position:'relative', boxShadow:'0 1px 3px rgba(0,0,0,0.05)' }}>
                  {/* 닫기 */}
                  <div style={{ position:'absolute', top:8, right:8, width:18, height:18, borderRadius:6, background:'#f4f3f1', display:'flex', alignItems:'center', justifyContent:'center', color:'#8c8a87', fontSize:12, fontWeight:500 }}>×</div>
                  {/* 미리보기 헤더 */}
                  <div style={{ background:'#faf9f8', padding:'10px 28px 10px 10px', borderBottom:'1px solid #e9e7e4', display:'flex', alignItems:'center', gap:8 }}>
                    <div>
                      <div style={{ display:'flex', gap:4, marginBottom:3, flexWrap:'wrap' }}>
                        <span style={{ fontSize:9, padding:'2px 6px', borderRadius:6, background:'#f4f3f1', color:'#8c8a87' }}>{selectedCell.address}</span>
                        {form.nickname && <span style={{ fontSize:9, padding:'2px 6px', borderRadius:6, background:'#1c1c1e', color:'#fff', fontWeight:600 }}>{form.nickname}</span>}
                      </div>
                      <div style={{ fontSize:13, fontWeight:700, color:'#1a1a1a' }}>{form.name || '집 이름'}</div>
                    </div>
                  </div>
                  {/* 미리보기 바디 */}
                  <div style={{ display:'flex', gap:0 }}>
                    <div style={{ flex:1, padding:'10px' }}>
                      {form.description && (
                        <div style={{ marginBottom:8 }}>
                          <span style={{ fontSize:9, fontWeight:600, padding:'2px 6px', borderRadius:6, background:'#f4f3f1', color:'#8c8a87', marginBottom:4, display:'inline-block' }}>소개글</span>
                          <div style={{ fontSize:11, color:'#8c8a87', lineHeight:1.6, marginTop:4 }}>{form.description}</div>
                        </div>
                      )}
                      {form.linkUrl && (
                        <div>
                          <span style={{ fontSize:9, fontWeight:600, padding:'2px 6px', borderRadius:6, background:'#f4f3f1', color:'#8c8a87', marginBottom:4, display:'inline-block' }}>링크</span>
                          <div style={{ marginTop:4 }}><span style={{ fontSize:10, padding:'4px 8px', borderRadius:8, background:'#f4f3f1', color:'#1a1a1a', fontWeight:600 }}>홈페이지</span></div>
                        </div>
                      )}
                    </div>
                    {form.interiorPreview && (
                      <div style={{ width:80, padding:'8px 8px 8px 0', flexShrink:0 }}>
                        <img src={form.interiorPreview} alt="" style={{ width:'100%', height:70, objectFit:'cover', borderRadius:8, border:'1px solid #e9e7e4' }} />
                      </div>
                    )}
                  </div>
                  {/* 미리보기 통계 */}
                  <div style={{ display:'flex', borderTop:'1px solid #e9e7e4', background:'#faf9f8' }}>
                    <div style={{ flex:1, padding:'8px', textAlign:'center', fontSize:11, fontWeight:600, color:'#8c8a87' }}>좋아요 0</div>
                    <div style={{ width:1, background:'#e9e7e4' }} />
                    <div style={{ flex:1, padding:'8px', textAlign:'center', fontSize:11, fontWeight:600, color:'#8c8a87' }}>방문 0</div>
                    <div style={{ width:1, background:'#e9e7e4' }} />
                    <div style={{ flex:1, padding:'8px', textAlign:'center', fontSize:10, color:'#8c8a87' }}>오늘</div>
                  </div>
                </div>
                <div style={{ fontSize:10, color:'#b0aeaa', textAlign:'center', lineHeight:1.6 }}>
                  *예시이미지
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3: 외관 이미지 ── */}
          {step === 3 && (
            <div className="af-row" style={{ display:'flex', gap:0 }}>
              {/* 왼쪽 */}
              <div className="af-col" style={{ flex:1, padding:'20px', borderRight:'1px solid #e9e7e4', overflowY:'auto', maxHeight:'calc(92vh - 160px)' }}>
                <SectionTitle>건물 외관 이미지 등록</SectionTitle>
                <div style={{ fontSize:12, color:'#8c8a87', marginBottom:16, lineHeight:1.6 }}>
                  사람들이 지도에서 가장 먼저 보게 되는 이미지예요.
                </div>

                <label style={{ display:'block', cursor:'pointer', marginBottom:16 }}>
                  <div style={{ height:160, borderRadius:10, border:`1px dashed ${form.exteriorPreview ? '#1a1a1a' : '#d5d2ce'}`, background:'#faf9f8', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
                    {form.exteriorPreview ? <img src={form.exteriorPreview} alt="" style={{ width:'100%', height:'100%', objectFit: form.exteriorFit }} /> : (
                      <div style={{ textAlign:'center', color:'#8c8a87' }}>
                        <div style={{ fontSize:13, fontWeight:600 }}>이미지 업로드</div>
                        <div style={{ fontSize:11, marginTop:4, color:'#b0aeaa' }}>JPG, PNG, WEBP (최대 10MB)</div>
                      </div>
                    )}
                  </div>
                  <input type="file" accept="image/*" onChange={handleFile('exterior')} style={{ display:'none' }} />
                </label>

                {/* 권장 가이드 */}
                <div style={{ padding:12, borderRadius:10, background:'#faf9f8', border:'1px solid #e9e7e4', fontSize:12, color:'#8c8a87', marginBottom:16 }}>
                  <div style={{ fontWeight:700, marginBottom:6, color:'#1a1a1a' }}>권장 가이드</div>
                  <div>· 권장 비율: 선택한 영역 비율과 비슷하게</div>
                  <div>· 권장 해상도: 1000px 이상</div>
                  <div>· 파일 크기: 최대 10MB</div>
                </div>

                {/* 표시 방식 */}
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#1a1a1a', marginBottom:10 }}>표시 방식 선택</div>
                  {[
                    { value:'cover', label:'자동 맞춤 (추천)', desc:'영역을 꽉 채우도록 자동으로 맞춰요. 일부가 잘릴 수 있어요.' },
                    { value:'contain', label:'전체 보기', desc:'이미지 전체가 보이도록 여백을 추가해요.' },
                  ].map(({ value, label, desc }) => {
                    const active = form.exteriorFit === value
                    return (
                    <div key={value} onClick={() => setForm(f => ({ ...f, exteriorFit: value as 'cover'|'contain' }))} style={{
                      display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:10, cursor:'pointer', marginBottom:8,
                      border:`1px solid ${active ? '#1a1a1a' : '#e9e7e4'}`,
                      background:'#fff',
                    }}>
                      <RadioDot active={active} />
                      <div>
                        <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a' }}>{label}</div>
                        <div style={{ fontSize:11, color:'#8c8a87', marginTop:2 }}>{desc}</div>
                      </div>
                    </div>
                    )
                  })}
                </div>

                {/* 이미지 수정 정책 */}
                <div style={{ padding:12, borderRadius:10, background:'#faf9f8', border:'1px solid #e9e7e4', fontSize:12, color:'#8c8a87' }}>
                  <div style={{ fontWeight:700, marginBottom:4, color:'#1a1a1a' }}>수정 정책</div>
                  <div>· 집 정보와 이미지는 언제든지 수정 가능합니다.</div>
                  <div>· 위치와 면적은 변경할 수 없습니다.</div>
                </div>
              </div>

              {/* 오른쪽: 지도 미리보기 */}
              <div className="af-col" style={{ width:300, flexShrink:0, padding:'20px', background:'#faf9f8' }}>
                <div style={{ fontSize:12, fontWeight:600, color:'#8c8a87', marginBottom:10 }}>지도 미리보기</div>
                <div style={{ height:160, borderRadius:10, border:'1px solid #e9e7e4', background:'#fff', overflow:'hidden', marginBottom:12, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {form.exteriorPreview ? (
                    <img src={form.exteriorPreview} alt="" style={{ maxWidth:'80%', maxHeight:'80%', objectFit: form.exteriorFit, borderRadius:8, border:'1px solid #e9e7e4' }} />
                  ) : (
                    <div style={{ textAlign:'center', color:'#b0aeaa', fontSize:12 }}>이미지를 업로드하면<br/>미리보기가 표시됩니다</div>
                  )}
                </div>

                {/* 이펙트 */}
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'#1a1a1a', marginBottom:8 }}>이펙트 추가 (선택)</div>
                  <div style={{ display:'flex', gap:8 }}>
                    {(['none','neon'] as const).map(effect => {
                      const active = form.borderEffect === effect
                      return (
                      <button key={effect} onClick={() => setForm(f => ({ ...f, borderEffect: effect }))} style={{
                        flex:1, padding:'10px 8px', borderRadius:10, cursor:'pointer',
                        border:`1px solid ${active ? '#1c1c1e' : '#e9e7e4'}`,
                        background: active ? '#1c1c1e' : '#fff',
                        color: active ? '#fff' : '#1a1a1a',
                        fontSize:11, fontWeight:600, position:'relative',
                      }}>
                        {effect === 'none' ? '기본 (이펙트 없음)' : '네온 테두리'}
                        {effect === 'neon' && <span style={{ position:'absolute', top:-8, right:-4, fontSize:8, background:'#dc2626', color:'#fff', padding:'2px 5px', borderRadius:6, fontWeight:600 }}>신규</span>}
                      </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 4: 신청 확인 ── */}
          {step === 4 && (
            <div className="af-row" style={{ display:'flex', gap:0, padding:0 }}>
              <div className="af-col" style={{ flex:1, padding:'24px 20px' }}>
                <SectionTitle>입력 내용 확인</SectionTitle>
                {[
                  { label:'위치', value:`${selectedCell.address} (${zone.label})` },
                  { label:'크기', value:`${selectedCell.width??1} × ${selectedCell.height??1} (${cellCount}칸)` },
                  { label:'집 이름', value: form.name || '(없음)', highlight: !!form.name },
                  { label:'닉네임', value: form.nickname || '(없음)' },
                  { label:'소개글', value: form.description || '(없음)' },
                  { label:'링크', value: form.linkUrl || '(없음)' },
                ].map(({ label, value, highlight }) => (
                  <InfoRow key={label} label={label} value={value} highlight={highlight} />
                ))}

                {/* 대표 이미지 썸네일 */}
                {(form.exteriorPreview || form.interiorPreview) && (
                  <div style={{ marginTop:16 }}>
                    <div style={{ fontSize:12, color:'#8c8a87', marginBottom:8, fontWeight:600 }}>대표 이미지</div>
                    <div style={{ display:'flex', gap:10 }}>
                      {form.interiorPreview && <img src={form.interiorPreview} alt="내부" style={{ width:80, height:80, objectFit:'cover', borderRadius:10, border:'1px solid #e9e7e4' }} />}
                      {form.exteriorPreview && (
                        <div style={{ position:'relative' }}>
                          <img src={form.exteriorPreview} alt="외관" style={{ width:80, height:80, objectFit:'cover', borderRadius:10, border:'1px solid #e9e7e4' }} />
                          {form.nickname && <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}><span style={{ fontSize:10, fontWeight:600, color:'#fff', background:'rgba(28,28,30,0.85)', padding:'2px 6px', borderRadius:6 }}>{form.nickname}</span></div>}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {!isEdit && (
                  <div style={{ marginTop:20, padding:'16px 18px', borderRadius:12, background:'#faf9f8', border:'1px solid #e9e7e4', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:'#1a1a1a' }}>영구 입주</div>
                      <div style={{ fontSize:11, color:'#8c8a87', marginTop:3 }}>한번 입주하면 영구적으로 유지됩니다.</div>
                    </div>
                    <div style={{ fontSize:18, fontWeight:800, color:'#1a1a1a' }}>{formatKRW(calcTotalPrice(PERMANENT_DAYS))}</div>
                  </div>
                )}
              </div>

              {/* 유의사항 */}
              <div className="af-col" style={{ width:220, flexShrink:0, padding:'24px 16px', background:'#faf9f8', borderLeft:'1px solid #e9e7e4' }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#1a1a1a', marginBottom:12 }}>유의사항</div>
                <div style={{ fontSize:12, color:'#8c8a87', lineHeight:1.8 }}>
                  · 반드시 마지막 단계에서 결제를 완료해야 신청이 정상적으로 접수됩니다.<br /><br />
                  · 결제 완료 후 즉시 입주 처리됩니다.<br /><br />
                  · 영구 입주로 만료일이 없습니다.
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 5: 결제 ── */}
          {step === 5 && (
            <>
            <div className="af-row" style={{ display:'flex', gap:0 }}>
              <div className="af-col" style={{ flex:1, padding:'24px 20px', borderRight:'1px solid #e9e7e4' }}>
                <SectionTitle>주문 정보</SectionTitle>
                {[
                  { label:'위치', value:`${selectedCell.address} (${zone.label})` },
                  { label:'크기', value:`${selectedCell.width??1} × ${selectedCell.height??1} (${cellCount}칸)` },
                  { label:'금액', value: formatKRW(price), highlight: true },
                ].map(({ label, value, highlight }) => (
                  <InfoRow key={label} label={label} value={value} highlight={highlight} />
                ))}
                <div style={{ marginTop:16, fontSize:12, color:'#8c8a87', lineHeight:1.8 }}>
                  · 결제 완료 후 즉시 입주가 확정됩니다.<br />
                  · 영구 입주로 만료일이 없습니다.
                </div>

                {errorMsg && (
                  <div style={{ marginTop:16, padding:12, borderRadius:10, background:'#fef2f2', border:'1px solid #fecaca', fontSize:12, color:'#dc2626', fontWeight:600 }}>{errorMsg}</div>
                )}

              </div>

              <div className="af-col" style={{ width:240, flexShrink:0, padding:'24px 16px', background:'#faf9f8' }}>
                {paymentDone ? (
                  <>
                    <div style={{ textAlign:'center', marginBottom:16 }}>
                      <div style={{ width:48, height:48, borderRadius:'50%', background:'#1c1c1e', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 10px' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                      </div>
                      <div style={{ fontSize:14, fontWeight:700, color:'#1a1a1a' }}>결제 완료</div>
                      <div style={{ fontSize:11, color:'#8c8a87', marginTop:4 }}>이제 입주하기 버튼을 눌러주세요.</div>
                    </div>
                    <div style={{ padding:'10px 12px', borderRadius:10, background:'#fff', border:'1px solid #e9e7e4', fontSize:11, color:'#8c8a87', lineHeight:1.7 }}>
                      입주하기 클릭 시 AI 콘텐츠 검사 후<br />지도에 반영됩니다.
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize:13, fontWeight:700, color:'#1a1a1a', marginBottom:12 }}>결제 수단 선택</div>
                    {[
                      { id:'card', label:'신용/체크카드' },
                      { id:'kakaopay', label:'카카오페이' },
                    ].map(m => {
                      const active = payMethod === m.id
                      return (
                      <div key={m.id} onClick={() => setPayMethod(m.id)} style={{
                        padding:'13px 14px', borderRadius:10, cursor:'pointer', marginBottom:8,
                        border:`1px solid ${active ? '#1a1a1a' : '#e9e7e4'}`,
                        background:'#fff',
                        color:'#1a1a1a',
                        fontSize:13, fontWeight: active ? 700 : 500,
                        display:'flex', alignItems:'center', gap:10,
                      }}>
                        <RadioDot active={active} />
                        <span>{m.label}</span>
                        {m.id === 'kakaopay' && <span style={{ marginLeft:'auto', fontSize:10, fontWeight:700, background:'#FEE500', color:'#191919', padding:'2px 7px', borderRadius:6 }}>pay</span>}
                      </div>
                      )
                    })}
                  </>
                )}
              </div>
            </div>

            {/* 결제 전 필수 동의 (전자상거래법 시행령 제21조) */}
            {!paymentDone && (
              <div style={{ padding:'16px 20px', borderTop:'1px solid #e9e7e4', background:'#faf9f8' }}>
                {/* 모두 동의 마스터 */}
                <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', paddingBottom:10, marginBottom:10, borderBottom:'1px solid #e9e7e4' }}>
                  <input
                    type="checkbox"
                    checked={allAgreed}
                    onChange={e => { const v = e.target.checked; setAgreeTerms(v); setAgreeRefund(v); setAgreeAge(v) }}
                    style={{ width:18, height:18, accentColor:'#1c1c1e', cursor:'pointer', flexShrink:0 }}
                  />
                  <span style={{ fontSize:13, fontWeight:700, color:'#1a1a1a' }}>아래 내용에 모두 동의합니다</span>
                </label>

                {/* [필수] 이용약관 · 개인정보 */}
                <label style={{ display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer', marginBottom:8 }}>
                  <input type="checkbox" checked={agreeTerms} onChange={e => setAgreeTerms(e.target.checked)} style={{ width:16, height:16, accentColor:'#1c1c1e', cursor:'pointer', marginTop:2, flexShrink:0 }} />
                  <span style={{ fontSize:12, color:'#1a1a1a', lineHeight:1.7 }}>
                    <span style={{ color:'#dc2626', fontWeight:700 }}>필수</span>{' '}
                    <a href="/terms" target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color:'#1a1a1a', fontWeight:600, textDecoration:'underline' }}>이용약관</a> 및{' '}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color:'#1a1a1a', fontWeight:600, textDecoration:'underline' }}>개인정보처리방침</a>에 따른 개인정보 수집·이용에 동의합니다
                  </span>
                </label>

                {/* [필수] 환불 제한 확인 */}
                <label style={{ display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer', marginBottom:8 }}>
                  <input type="checkbox" checked={agreeRefund} onChange={e => setAgreeRefund(e.target.checked)} style={{ width:16, height:16, accentColor:'#1c1c1e', cursor:'pointer', marginTop:2, flexShrink:0 }} />
                  <span style={{ fontSize:12, color:'#1a1a1a', lineHeight:1.7 }}>
                    <span style={{ color:'#dc2626', fontWeight:700 }}>필수</span>{' '}
                    디지털 콘텐츠 특성상 결제 완료 즉시 제공이 시작되어{' '}
                    <a href="/terms?tab=refund" target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color:'#1a1a1a', fontWeight:600, textDecoration:'underline' }}>환불</a>이 제한됨을 확인했습니다
                  </span>
                </label>

                {/* [필수] 만 14세 이상 */}
                <label style={{ display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer' }}>
                  <input type="checkbox" checked={agreeAge} onChange={e => setAgreeAge(e.target.checked)} style={{ width:16, height:16, accentColor:'#1c1c1e', cursor:'pointer', marginTop:2, flexShrink:0 }} />
                  <span style={{ fontSize:12, color:'#1a1a1a', lineHeight:1.7 }}>
                    <span style={{ color:'#dc2626', fontWeight:700 }}>필수</span>{' '}
                    만 14세 이상입니다
                  </span>
                </label>
              </div>
            )}
            </>
          )}
        </div>

        {/* 하단 버튼 */}
        <div style={{ padding:'14px 20px', borderTop:'1px solid #e9e7e4', background:'#ffffff', display:'flex', gap:10, flexShrink:0 }}>
          {step > (isEdit ? 2 : 1) && !paymentDone && (
            <button onClick={() => setStep(s => (s - 1) as Step)} style={{ flex:1, padding:'13px', borderRadius:10, cursor:'pointer', border:'1px solid #e0ddd9', background:'#ffffff', color:'#1a1a1a', fontSize:14, fontWeight:600 }}>
              이전 단계
            </button>
          )}
          <button
            onClick={() => {
              if (step < lastStep) { setStep(s => (s + 1) as Step) }
              else if (isEdit) { handleEditSave() }
              else if (!paymentDone) { handlePayment() }
              else { handleMoveIn() }
            }}
            disabled={loading || !canNext()}
            style={{
              flex:2, padding:'13px', borderRadius:10, cursor: loading || !canNext() ? 'not-allowed' : 'pointer',
              background: loading || !canNext() ? '#e9e7e4' : '#1c1c1e',
              color: loading || !canNext() ? '#b0aeaa' : '#ffffff', fontSize:14, fontWeight:700,
              border:'none',
            }}
          >
            {loading
              ? (contentChecking ? 'AI 검사 중...' : '처리 중...')
              : step < lastStep
              ? '다음 단계로'
              : isEdit
              ? '저장하기'
              : paymentDone
              ? '입주하기'
              : `결제하기 ${formatKRW(price)}`}
          </button>
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width:'100%', padding:'11px 12px', borderRadius:10, boxSizing:'border-box',
  border:'1px solid #e9e7e4', background:'#fff', color:'#1a1a1a',
  fontSize:14, outline:'none', fontFamily:'inherit',
}

function RadioDot({ active }: { active: boolean }) {
  return (
    <span style={{ width:18, height:18, borderRadius:'50%', border:`1.5px solid ${active ? '#1a1a1a' : '#d5d2ce'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxSizing:'border-box' }}>
      {active && <span style={{ width:9, height:9, borderRadius:'50%', background:'#1a1a1a' }} />}
    </span>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize:15, fontWeight:700, color:'#1a1a1a', marginBottom:16, paddingBottom:10, borderBottom:'1px solid #e9e7e4' }}>{children}</div>
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
        <span style={{ fontSize:13, fontWeight:600, color:'#1a1a1a' }}>{label}</span>
        {hint && <span style={{ fontSize:11, color:'#8c8a87' }}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function CharCount({ cur, max }: { cur: number; max: number }) {
  return <div style={{ fontSize:11, color: cur >= max ? '#dc2626' : '#b0aeaa', textAlign:'right', marginTop:4 }}>{cur}/{max}</div>
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid #e9e7e4' }}>
      <span style={{ fontSize:13, color:'#8c8a87' }}>{label}</span>
      <span style={{ fontSize:13, fontWeight: highlight ? 800 : 600, color:'#1a1a1a' }}>{value}</span>
    </div>
  )
}

function PeriodBtn({ children, active, color, onClick }: { children: React.ReactNode; active: boolean; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding:'10px 16px', borderRadius:10, cursor:'pointer', textAlign:'center', lineHeight:1.5,
      border:`1px solid ${active ? '#1c1c1e' : '#e9e7e4'}`,
      background: active ? '#1c1c1e' : '#fff',
      color: active ? '#fff' : '#1a1a1a',
      fontSize:13, fontWeight: active ? 700 : 500,
    }}>{children}</button>
  )
}
