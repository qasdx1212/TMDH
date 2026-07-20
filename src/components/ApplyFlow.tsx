'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { ZONES, ZONE_PRICES, DURATIONS, PERMANENT_DAYS, PERMANENT_MULTIPLIER, NEON_PRESETS, NEON_PRICE, NEON_MAX_WIDTH, DEFAULT_NEON, isNeon, neonColor, neonWidth, neonWidthFrac, buildNeon, getEffectPrice, effectLabel, calcPrice, formatKRW, getAddress, getZone } from '@/lib/constants'
import { safeUrl } from '@/lib/url'
import { hashPwd } from '@/lib/hash'
import { pwdChecks, isPwdValid } from '@/lib/password'
import { toUserMessage } from '@/lib/errorMessage'
import type { CellData } from '@/types/cell'

interface ApplyFlowProps {
  selectedCell: CellData
  userId: string
  isAdmin?: boolean
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
  exteriorScale: number                       // 기본 맞춤 대비 확대 배율 (1 = 기본)
  exteriorOffset: { x: number; y: number }    // 캔버스 크기 대비 정규화된 이동값
  interiorImage: File | null
  interiorPreview: string | null
  interiorScale: number                       // 1:1 크롭 배율
  interiorOffset: { x: number; y: number }    // 1:1 크롭 이동값 (정규화)
  days: number
  borderEffect: string
  password: string
  passwordConfirm: string
  removePassword: boolean
}

const STEPS = ['위치 확인', '집 정보', '외관 이미지', '신청 확인', '결제']

/* ─── 이미지 변환 공통 로직 (외관·내부 크롭에서 재사용) ─── */
interface Transform { fit: 'cover' | 'contain'; scale: number; offset: { x: number; y: number } }

// 기본맞춤(cover/contain) × 사용자 배율 + 정규화 이동으로 img를 TW×TH 캔버스에 그림
function drawTransformed(ctx: CanvasRenderingContext2D, img: HTMLImageElement, TW: number, TH: number, t: Transform) {
  const iw = img.naturalWidth, ih = img.naturalHeight
  if (!iw || !ih) return
  const base = t.fit === 'cover' ? Math.max(TW / iw, TH / ih) : Math.min(TW / iw, TH / ih)
  const s = base * t.scale
  const dw = iw * s, dh = ih * s
  const dx = (TW - dw) / 2 + t.offset.x * TW
  const dy = (TH - dh) / 2 + t.offset.y * TH
  ctx.drawImage(img, dx, dy, dw, dh)
}

// 캔버스 한 장을 (흰 배경 + 이미지 + 선택적 네온 테두리)로 칠함
function paintCanvas(canvas: HTMLCanvasElement | null, img: HTMLImageElement | null, t: Transform, neon?: { color: string; frac: number }) {
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  if (img) drawTransformed(ctx, img, canvas.width, canvas.height, t)
  if (neon) {
    // 최대(frac=1)일 때 원래 고정 두께(3), 아래로 비례 축소
    const lw = Math.max(0.6, 3 * neon.frac)
    const off = lw / 2 + 0.5
    ctx.save()
    ctx.shadowColor = neon.color
    ctx.shadowBlur = 8
    ctx.strokeStyle = neon.color
    ctx.lineWidth = lw
    ctx.strokeRect(off, off, canvas.width - off * 2, canvas.height - off * 2)
    ctx.strokeRect(off, off, canvas.width - off * 2, canvas.height - off * 2) // 두 번 그려 글로우 강조
    ctx.restore()
  }
}

// 조정값을 실제 픽셀에 구워낸 업로드용 파일 생성
async function bakeFile(img: HTMLImageElement, t: Transform, tw: number, th: number, filename: string): Promise<File | null> {
  const cv = document.createElement('canvas')
  cv.width = Math.max(1, Math.round(tw)); cv.height = Math.max(1, Math.round(th))
  const ctx = cv.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, cv.width, cv.height)
  drawTransformed(ctx, img, cv.width, cv.height, t)
  const blob: Blob | null = await new Promise(res => cv.toBlob(res, 'image/jpeg', 0.92))
  if (!blob) return null
  return new File([blob], filename, { type: 'image/jpeg' })
}

/* 비밀번호 규칙(pwdChecks / isPwdValid)은 @/lib/password 로 이동 (HousePopup 재설정과 공유) */

/* ─── 임시저장(draft) ─── */
interface Draft {
  name?: string; description?: string; linkUrl?: string; nickname?: string
  days?: number; borderEffect?: string
  exteriorFit?: 'cover' | 'contain'
  exteriorScale?: number; exteriorOffset?: { x: number; y: number }
  interiorScale?: number; interiorOffset?: { x: number; y: number }
}

function linkHost(url: string): string | null {
  const v = url.trim()
  if (!v) return null
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`)
    return u.hostname.replace(/^www\./, '')
  } catch { return null }
}

export default function ApplyFlow({ selectedCell, userId, isAdmin, onClose, onSuccess }: ApplyFlowProps) {
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
    exteriorScale: 1,
    exteriorOffset: { x: 0, y: 0 },
    interiorImage: null,
    interiorPreview: isEdit ? (selectedCell.interior_image_url ?? null) : null,
    interiorScale: 1,
    interiorOffset: { x: 0, y: 0 },
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

  // 이펙트 추가금 (네온 +1,000원 등) — 총액·결제버튼·orders.amount 전부 이 값을 사용
  const effectPrice = getEffectPrice(form.borderEffect)
  const price = calcTotalPrice(form.days) + effectPrice

  /* ─── 단계별 임시저장 (셀 주소별 localStorage) ─── */
  // File 객체·비밀번호는 저장하지 않음 (직렬화 불가 + 보안)
  const draftKey = `zipzip_draft_${selectedCell.address}`
  const [draftRestored, setDraftRestored] = useState(false)
  const hydrated = useRef(false)

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(draftKey) } catch { /* storage 차단 환경 무시 */ }
  }, [draftKey])

  // 복원 — 수정 모드에서는 기존 데이터가 우선이므로 복원하지 않음
  useEffect(() => {
    if (isEdit) { hydrated.current = true; return }
    try {
      const raw = localStorage.getItem(draftKey)
      if (raw) {
        const d = JSON.parse(raw) as Draft
        const hasContent = !!(d.name || d.description || d.linkUrl || d.nickname)
        setForm(f => ({
          ...f,
          name: d.name ?? f.name,
          description: d.description ?? f.description,
          linkUrl: d.linkUrl ?? f.linkUrl,
          nickname: d.nickname ?? f.nickname,
          days: typeof d.days === 'number' ? d.days : f.days,
          borderEffect: d.borderEffect ?? f.borderEffect,
          exteriorFit: d.exteriorFit === 'contain' ? 'contain' : f.exteriorFit,
          exteriorScale: typeof d.exteriorScale === 'number' ? d.exteriorScale : f.exteriorScale,
          exteriorOffset: d.exteriorOffset ?? f.exteriorOffset,
          interiorScale: typeof d.interiorScale === 'number' ? d.interiorScale : f.interiorScale,
          interiorOffset: d.interiorOffset ?? f.interiorOffset,
        }))
        if (hasContent) setDraftRestored(true)
      }
    } catch { /* 손상된 draft 무시 */ }
    hydrated.current = true
  }, [isEdit, draftKey])

  // 자동 저장
  useEffect(() => {
    if (isEdit || !hydrated.current) return
    const t = setTimeout(() => {
      const d: Draft = {
        name: form.name, description: form.description, linkUrl: form.linkUrl, nickname: form.nickname,
        days: form.days, borderEffect: form.borderEffect,
        exteriorFit: form.exteriorFit, exteriorScale: form.exteriorScale, exteriorOffset: form.exteriorOffset,
        interiorScale: form.interiorScale, interiorOffset: form.interiorOffset,
      }
      try { localStorage.setItem(draftKey, JSON.stringify(d)) } catch { /* 무시 */ }
    }, 300)
    return () => clearTimeout(t)
  }, [isEdit, draftKey, form])

  const resetDraft = () => {
    clearDraft()
    setDraftRestored(false)
    setForm(f => ({
      ...f,
      name: '', description: '', linkUrl: '', nickname: '',
      borderEffect: 'none',
      exteriorFit: 'cover', exteriorScale: 1, exteriorOffset: { x: 0, y: 0 },
      interiorScale: 1, interiorOffset: { x: 0, y: 0 },
    }))
  }

  // 수동 임시저장 (버튼) — 텍스트·설정을 즉시 저장하고 "저장됨" 표시
  const [draftSaved, setDraftSaved] = useState(false)
  const saveDraftNow = useCallback(() => {
    const d: Draft = {
      name: form.name, description: form.description, linkUrl: form.linkUrl, nickname: form.nickname,
      days: form.days, borderEffect: form.borderEffect,
      exteriorFit: form.exteriorFit, exteriorScale: form.exteriorScale, exteriorOffset: form.exteriorOffset,
      interiorScale: form.interiorScale, interiorOffset: form.interiorOffset,
    }
    try { localStorage.setItem(draftKey, JSON.stringify(d)); setDraftSaved(true); setTimeout(() => setDraftSaved(false), 2000) } catch { /* 무시 */ }
  }, [form, draftKey])

  // 미니맵 (Step 1) — 4구역 + 선택 셀 표시
  useEffect(() => {
    if (step !== 1) return
    const canvas = miniMapRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    // SX=0.5 (400 cols → 200px), SY=1 (200 rows → 200px)
    const SX = 0.5, SY = 1
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
    if (type === 'exterior') setForm(f => ({ ...f, exteriorImage: file, exteriorPreview: preview, exteriorScale: 1, exteriorOffset: { x: 0, y: 0 } }))
    else setForm(f => ({ ...f, interiorImage: file, interiorPreview: preview, interiorScale: 1, interiorOffset: { x: 0, y: 0 } }))
    e.target.value = '' // 같은 파일을 다시 골라도 onChange가 발생하도록
  }

  const uploadImage = async (file: File, path: string): Promise<string | null> => {
    const { error } = await supabase.storage.from('house-images').upload(path, file, { upsert: true })
    if (error) return null
    const { data } = supabase.storage.from('house-images').getPublicUrl(path)
    return data.publicUrl
  }

  /* ─── 이미지 크롭 (미리보기 = 지도 = 업로드 결과가 동일) ─── */
  const cw = selectedCell.width ?? 1
  const ch = selectedCell.height ?? 1
  const cellAR = cw / ch

  // 선택 영역 비율에 맞춘 크롭 캔버스 크기 (에디터용)
  const editW = cellAR >= 1 ? 300 : Math.round(200 * cellAR)
  const editH = cellAR >= 1 ? Math.round(300 / cellAR) : 200
  // 우측 지도 미리보기 캔버스 크기 (같은 비율)
  let pvW = 240, pvH = Math.round(240 / cellAR)
  if (pvH > 140) { pvH = 140; pvW = Math.round(140 * cellAR) }
  // 내부 이미지는 1:1 고정
  const INT_EDIT = 200
  // 신청 확인 카드의 외관 미리보기 캔버스 크기 (같은 비율)
  let cfW = 320, cfH = Math.round(320 / cellAR)
  if (cfH > 190) { cfH = 190; cfW = Math.round(190 * cellAR) }
  // 2단계 "메인 지도 모습" 미리보기 박스 크기 (같은 비율)

  const cropRef = useRef<HTMLCanvasElement>(null)
  const mapPreviewRef = useRef<HTMLCanvasElement>(null)
  const intCropRef = useRef<HTMLCanvasElement>(null)
  const confirmRef = useRef<HTMLCanvasElement>(null)
  // 로드된 이미지를 state로 보관 — 파일을 교체하면 항상 새 객체라 리렌더+재페인트가 보장됨
  // (기존 imgReady 불리언은 true→true 갱신이 no-op이라 교체가 즉시 반영되지 않는 버그가 있었음)
  const [extImg, setExtImg] = useState<HTMLImageElement | null>(null)
  const [intImg, setIntImg] = useState<HTMLImageElement | null>(null)
  const dragRef = useRef<{ x: number; y: number; target: 'exterior' | 'interior' } | null>(null)

  const neonOn = isNeon(form.borderEffect)
  const neonPaintColor = neonColor(form.borderEffect)
  const neonFrac = neonWidthFrac(form.borderEffect)   // 0~1, 최대=원래 고정 두께
  const neonPaint = neonOn ? { color: neonPaintColor, frac: neonFrac } : undefined

  // 새로 고른 파일만 크롭 대상 (기존 저장된 URL은 CORS/변조 이슈로 제외)
  const cropEnabled = !!form.exteriorImage && !!extImg
  const intCropEnabled = !!form.interiorImage && !!intImg

  const extTransform: Transform = { fit: form.exteriorFit, scale: form.exteriorScale, offset: form.exteriorOffset }
  const intTransform: Transform = { fit: 'cover', scale: form.interiorScale, offset: form.interiorOffset }

  // 파일 선택 시 이미지 로드 (외관)
  useEffect(() => {
    if (!form.exteriorImage || !form.exteriorPreview) { setExtImg(null); return }
    let alive = true
    const im = new Image()
    im.onload = () => { if (alive) setExtImg(im) }
    im.onerror = () => { if (alive) setExtImg(null) }
    im.src = form.exteriorPreview
    return () => { alive = false }
  }, [form.exteriorImage, form.exteriorPreview])

  // 파일 선택 시 이미지 로드 (내부)
  useEffect(() => {
    if (!form.interiorImage || !form.interiorPreview) { setIntImg(null); return }
    let alive = true
    const im = new Image()
    im.onload = () => { if (alive) setIntImg(im) }
    im.onerror = () => { if (alive) setIntImg(null) }
    im.src = form.interiorPreview
    return () => { alive = false }
  }, [form.interiorImage, form.interiorPreview])

  // 내부 이미지 크롭 에디터 (Step 2)
  useEffect(() => {
    if (step !== 2) return
    paintCanvas(intCropRef.current, intImg, intTransform)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, intImg, form.interiorScale, form.interiorOffset])

  // 외관 에디터 + 지도 미리보기 동시 렌더 (Step 3) — 지도 미리보기엔 네온 이펙트도 반영
  useEffect(() => {
    if (step !== 3) return
    paintCanvas(cropRef.current, extImg, extTransform)
    paintCanvas(mapPreviewRef.current, extImg, extTransform, neonPaint)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, extImg, form.exteriorFit, form.exteriorScale, form.exteriorOffset, neonOn, neonPaintColor, neonFrac])

  // 신청 확인 미리보기 카드 (Step 4)
  useEffect(() => {
    if (step !== 4) return
    // 네온은 대표이미지 래퍼(div)가 담당 → 캔버스엔 네온 안 그림
    paintCanvas(confirmRef.current, extImg, extTransform, undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, extImg, form.exteriorFit, form.exteriorScale, form.exteriorOffset, neonOn, neonPaintColor, neonFrac])

  // 드래그로 위치 조정 (외관·내부 공용)
  const onCropDown = (target: 'exterior' | 'interior') => (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (target === 'exterior' ? !cropEnabled : !intCropEnabled) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { x: e.clientX, y: e.clientY, target }
  }
  const onCropMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current
    if (!d) return
    const rect = e.currentTarget.getBoundingClientRect()
    const dx = (e.clientX - d.x) / rect.width
    const dy = (e.clientY - d.y) / rect.height
    dragRef.current = { ...d, x: e.clientX, y: e.clientY }
    if (d.target === 'exterior') setForm(f => ({ ...f, exteriorOffset: { x: f.exteriorOffset.x + dx, y: f.exteriorOffset.y + dy } }))
    else setForm(f => ({ ...f, interiorOffset: { x: f.interiorOffset.x + dx, y: f.interiorOffset.y + dy } }))
  }
  const onCropUp = () => { dragRef.current = null }

  const resetCrop = () => setForm(f => ({ ...f, exteriorScale: 1, exteriorOffset: { x: 0, y: 0 } }))
  const resetIntCrop = () => setForm(f => ({ ...f, interiorScale: 1, interiorOffset: { x: 0, y: 0 } }))

  // 조정한 그대로 구워낸 업로드용 파일 생성 (외관: 선택 영역 비율)
  const buildExteriorFile = useCallback(async (): Promise<File | null> => {
    if (!form.exteriorImage) return null
    if (!extImg || !extImg.naturalWidth) return form.exteriorImage // 폴백: 원본 그대로
    const MAX = 1200
    const ew = cellAR >= 1 ? MAX : Math.round(MAX * cellAR)
    const eh = cellAR >= 1 ? Math.round(MAX / cellAR) : MAX
    return (await bakeFile(extImg, extTransform, ew, eh, 'exterior.jpg')) ?? form.exteriorImage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.exteriorImage, extImg, cellAR, form.exteriorFit, form.exteriorScale, form.exteriorOffset])

  // 내부 이미지: 1:1 정사각형으로 구워냄
  const buildInteriorFile = useCallback(async (): Promise<File | null> => {
    if (!form.interiorImage) return null
    if (!intImg || !intImg.naturalWidth) return form.interiorImage
    return (await bakeFile(intImg, intTransform, 1200, 1200, 'interior.jpg')) ?? form.interiorImage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.interiorImage, intImg, form.interiorScale, form.interiorOffset])

  // ── AI 콘텐츠 검사 ────────────────────────────────────────────────
  // 이미지는 아직 업로드 전이라 URL이 없음 → 파일을 축소해 base64로 직접 검사한다.
  // 768px면 유해물 판별에 충분하고 토큰 비용이 크게 줄어듦.
  const fileToCheckData = async (file: File): Promise<{ media_type: string; data: string } | null> => {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image()
        im.onload = () => resolve(im)
        im.onerror = reject
        im.src = URL.createObjectURL(file)
      })
      const MAX = 768
      const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight))
      const w = Math.max(1, Math.round(img.naturalWidth * scale))
      const h = Math.max(1, Math.round(img.naturalHeight * scale))
      const cv = document.createElement('canvas')
      cv.width = w; cv.height = h
      const ctx = cv.getContext('2d')
      if (!ctx) return null
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(img.src)
      const dataUrl = cv.toDataURL('image/jpeg', 0.8)
      return { media_type: 'image/jpeg', data: dataUrl.split(',')[1] }
    } catch { return null }
  }

  // 통과하면 null, 막히면 사용자에게 보여줄 사유 문자열을 반환한다.
  const runContentCheck = async (): Promise<string | null> => {
    const files = [await buildExteriorFile(), await buildInteriorFile()].filter((f): f is File => !!f)
    const text = [form.name, form.nickname, form.description, form.linkUrl].filter(Boolean).join('\n')
    if (files.length === 0 && !text.trim()) return null   // 검사할 내용 없음

    const images = (await Promise.all(files.map(fileToCheckData))).filter((x): x is { media_type: string; data: string } => !!x)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return '로그인이 만료되었어요. 다시 로그인해 주세요.'

    const res = await fetch('/api/check-content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ images, text }),
    })
    const json = await res.json().catch(() => null)
    if (json?.ok === true) return null
    return json?.reason ?? '콘텐츠 검사에 실패했어요. 잠시 후 다시 시도해 주세요.'
  }

  // 수정 모드 저장
  const handleEditSave = async () => {
    setLoading(true); setErrorMsg(null)
    try {
      // ⚠️ 수정 시에도 반드시 재검사. 없으면 깨끗한 이미지로 통과 후 유해물로 교체 가능.
      setContentChecking(true)
      const blocked = await runContentCheck()
      setContentChecking(false)
      if (blocked) { setErrorMsg(blocked); return }

      let exteriorUrl: string | null = selectedCell.exterior_image_url ?? null
      const extFile = await buildExteriorFile()
      if (extFile) exteriorUrl = await uploadImage(extFile, `${userId}/exterior-${selectedCell.address}.jpg`)
      let interiorUrl: string | null = selectedCell.interior_image_url ?? null
      const intFile = await buildInteriorFile()
      if (intFile) interiorUrl = await uploadImage(intFile, `${userId}/interior-${selectedCell.address}.jpg`)

      const pwdFields = form.removePassword
        ? { password_hash: null, has_password: false }
        : form.password
          ? { password_hash: await hashPwd(form.password), has_password: true }
          : {}

      const { error } = await supabase.from('houses').update({
        name: form.name || null, nickname: form.nickname || null,
        description: form.description || null, link_url: safeUrl(form.linkUrl),
        exterior_image_url: exteriorUrl, interior_image_url: interiorUrl,
        border_effect: form.borderEffect,
        ...pwdFields,
      }).eq('address', selectedCell.address).eq('user_id', userId)
      if (error) { setErrorMsg(`저장 실패: ${toUserMessage(error)}`); return }
      clearDraft()
      setShowSuccess(true)
      setTimeout(() => { setShowSuccess(false); onSuccess() }, 2200)
    } catch { setErrorMsg('오류가 발생했습니다.') }
    finally { setLoading(false); setContentChecking(false) }
  }

  // 관리자 전용: 결제 없이 즉시 입주 (테스트/운영용). AI 검사도 건너뜀.
  const handleAdminMoveIn = async () => {
    if (!isAdmin) return
    setLoading(true); setErrorMsg(null)
    try {
      let exteriorUrl: string | null = selectedCell.exterior_image_url ?? null
      const extFile = await buildExteriorFile()
      if (extFile) exteriorUrl = await uploadImage(extFile, `${userId}/exterior-${selectedCell.address}.jpg`)
      let interiorUrl: string | null = selectedCell.interior_image_url ?? null
      const intFile = await buildInteriorFile()
      if (intFile) interiorUrl = await uploadImage(intFile, `${userId}/interior-${selectedCell.address}.jpg`)

      const expiresAt = form.days === PERMANENT_DAYS ? null : new Date(Date.now() + form.days * 86400000).toISOString()
      const occupiedAt = new Date().toISOString()
      const col = selectedCell.col, row = selectedCell.row
      const width = selectedCell.width ?? 1, height = selectedCell.height ?? 1
      const pwdHash = form.password ? await hashPwd(form.password) : null

      const { error } = await supabase.from('houses').update({
        user_id: userId, name: form.name || null, nickname: form.nickname || null,
        description: form.description || null, link_url: safeUrl(form.linkUrl),
        exterior_image_url: exteriorUrl, interior_image_url: interiorUrl,
        border_effect: form.borderEffect, status: 'occupied', is_visible: true,
        width, height, occupied_at: occupiedAt, expires_at: expiresAt,
        is_permanent: form.days === PERMANENT_DAYS,
        password_hash: pwdHash, has_password: !!pwdHash,
        parent_address: null,   // 부모 칸은 항상 parent_address 비움 (고아/자기참조 방지)
      }).eq('address', selectedCell.address)
      if (error) { setErrorMsg(`저장 실패: ${toUserMessage(error)}`); setLoading(false); return }

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

      await supabase.from('payments').insert({
        user_id: userId, house_address: selectedCell.address,
        amount: 0, type: 'admin', method: 'admin', status: 'completed',
      })

      clearDraft()
      setShowSuccess(true)
      setTimeout(() => { setShowSuccess(false); onSuccess() }, 2200)
    } catch { setErrorMsg('오류가 발생했습니다. 다시 시도해주세요.') }
    finally { setLoading(false) }
  }

  // 1단계: AI 콘텐츠 검사 → 이미지 업로드 → DB orders 저장 → 포트원 결제창 오픈
  const handlePayment = async () => {
    setLoading(true); setErrorMsg(null)
    try {
      // ⚠️ 결제·업로드 전에 유해 콘텐츠 검사. 통과해야만 결제 진행.
      //    (실제 입주는 payment-redirect에서 일어나므로 반드시 결제 전에 걸러야 함)
      setContentChecking(true)
      const blocked = await runContentCheck()
      setContentChecking(false)
      if (blocked) { setErrorMsg(blocked); setLoading(false); return }

      // 이미지 먼저 업로드 (결제 리다이렉트 전에 완료해야 함)
      let exteriorUrl: string | null = selectedCell.exterior_image_url ?? null
      const extFile = await buildExteriorFile()
      if (extFile) exteriorUrl = await uploadImage(extFile, `${userId}/exterior-${selectedCell.address}.jpg`)
      let interiorUrl: string | null = selectedCell.interior_image_url ?? null
      const intFile = await buildInteriorFile()
      if (intFile) interiorUrl = await uploadImage(intFile, `${userId}/interior-${selectedCell.address}.jpg`)

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
        description: form.description || null, link_url: safeUrl(form.linkUrl),
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
      clearDraft()
      window.location.href = `${window.location.origin}/payment-redirect?paymentId=${orderId}`
    } catch (e: unknown) {
      setErrorMsg(toUserMessage(e))
      setLoading(false); setContentChecking(false)
    }
  }

  // 2단계: AI 콘텐츠 검사 + 실제 입주 처리
  const handleMoveIn = async () => {
    setLoading(true); setContentChecking(true); setErrorMsg(null)
    try {
      // AI 콘텐츠 검사 (Claude Vision). 통과해야만 업로드·입주가 진행된다.
      const blocked = await runContentCheck()
      setContentChecking(false)
      if (blocked) { setErrorMsg(blocked); setLoading(false); return }

      // 이미지 업로드
      let exteriorUrl: string | null = selectedCell.exterior_image_url ?? null
      const extFile = await buildExteriorFile()
      if (extFile) exteriorUrl = await uploadImage(extFile, `${userId}/exterior-${selectedCell.address}.jpg`)
      let interiorUrl: string | null = selectedCell.interior_image_url ?? null
      const intFile = await buildInteriorFile()
      if (intFile) interiorUrl = await uploadImage(intFile, `${userId}/interior-${selectedCell.address}.jpg`)

      // 신규 입주 DB 업데이트
      const expiresAt = form.days === PERMANENT_DAYS ? null : new Date(Date.now() + form.days * 86400000).toISOString()
      const occupiedAt = new Date().toISOString()
      const col = selectedCell.col, row = selectedCell.row
      const width = selectedCell.width ?? 1, height = selectedCell.height ?? 1
      const pwdHash = form.password ? await hashPwd(form.password) : null

      const { error } = await supabase.from('houses').update({
        user_id: userId, name: form.name || null, nickname: form.nickname || null,
        description: form.description || null, link_url: safeUrl(form.linkUrl),
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

      clearDraft()
      setShowSuccess(true)
      setTimeout(() => { setShowSuccess(false); onSuccess() }, 2200)
    } catch { setErrorMsg('오류가 발생했습니다. 다시 시도해주세요.') }
    finally { setLoading(false); setContentChecking(false) }
  }

  const pwd = pwdChecks(form.password)
  const pwdOk = isPwdValid(form.password)

  const canNext = () => {
    if (step === 2 && !form.name.trim()) return false
    if (step === 2 && !isEdit && !form.password) return false
    // 비밀번호를 입력했다면(신규는 필수) 규칙 충족 + 확인 일치해야 통과
    if (step === 2 && form.password && !pwdOk) return false
    if (step === 2 && form.password && form.password !== form.passwordConfirm) return false
    // 결제 단계: 필수 동의 3개를 모두 체크해야 결제 버튼 활성화 (관리자 무료 입주는 예외)
    if (step === lastStep && !isEdit && !paymentDone && !allAgreed && !isAdmin) return false
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
        .af-modal input::placeholder, .af-modal textarea::placeholder { color:#97948f; }
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
            <div style={{ fontSize:13, color:'#6f6d6a', textAlign:'center', lineHeight:1.8 }}>
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
            <div style={{ fontSize:14, color:'#6f6d6a', textAlign:'center', lineHeight:1.8 }}>
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
              <div style={{ fontSize:12, color:'#6f6d6a', fontWeight:500, marginTop:3 }}>{isMultiZone ? '복합 구역' : zone.label} · {selectedCell.address} · {cellCount}칸</div>
            </div>
          </div>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:10, background:'#ffffff', border:'1px solid #e9e7e4', color:'#6f6d6a', fontSize:20, fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
        </div>

        {/* 스텝 인디케이터 */}
        <div style={{ display:'flex', background:'#ffffff', borderBottom:'1px solid #e9e7e4', flexShrink:0 }}>
          {STEPS.map((label, i) => {
            const s = (i + 1) as Step
            if (isEdit && (s === 1 || s === 5)) return null
            const isDone = step > s, isActive = step === s
            return (
              <div key={i} style={{ flex:1, padding:'12px 4px', textAlign:'center', fontSize:11, fontWeight:isActive?700:isDone?600:500, color:isActive?'#1a1a1a':isDone?'#1a1a1a':'#97948f', borderBottom:isActive?'2px solid #1a1a1a':'2px solid transparent' }}>
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
                    <span style={{ fontSize:13, color:'#6f6d6a' }}>{label}</span>
                    <span style={{ fontSize:13, fontWeight:700, color: color ?? '#1a1a1a' }}>{value}</span>
                  </div>
                ))}
                {isMultiZone && (
                  <div style={{ marginTop:10, padding:12, borderRadius:10, background:'#faf9f8', border:'1px solid #e9e7e4', fontSize:12, color:'#6f6d6a', lineHeight:1.8 }}>
                    <div style={{ fontWeight:700, marginBottom:4, color:'#1a1a1a' }}>구역별 구성</div>
                    {Object.entries(zoneBreakdown).map(([z, count]) => (
                      <div key={z} style={{ display:'flex', justifyContent:'space-between' }}>
                        <span style={{ color: ZONES[z as keyof typeof ZONES]?.color }}>{ZONES[z as keyof typeof ZONES]?.label}</span>
                        <span>{count}칸 × {formatKRW(ZONE_PRICES[z])}/칸</span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ marginTop:16, padding:14, borderRadius:10, background:'#faf9f8', border:'1px solid #e9e7e4', fontSize:12, color:'#6f6d6a', lineHeight:1.7 }}>
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
                {draftRestored && (
                  <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:10, background:'#faf9f8', border:'1px solid #e9e7e4', marginBottom:14 }}>
                    <div style={{ flex:1, fontSize:12, color:'#6f6d6a', lineHeight:1.6 }}>
                      <span style={{ fontWeight:700, color:'#1a1a1a' }}>이어서 작성 중인 내용을 불러왔어요.</span><br />
                      이미지와 비밀번호는 보안상 저장되지 않아 다시 선택해주세요.
                    </div>
                    <button type="button" onClick={resetDraft} style={{ flexShrink:0, padding:'7px 10px', borderRadius:8, border:'1px solid #e0ddd9', background:'#fff', color:'#1a1a1a', fontSize:11, fontWeight:600, cursor:'pointer' }}>초기화</button>
                  </div>
                )}
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
                  <div style={{ fontSize:11, color:'#6f6d6a', marginBottom:8 }}>집에 연결할 링크를 설정해주세요. (최대 1개)</div>
                  <Field label="집 놀러가기 링크" hint="">
                    <input style={inputStyle} placeholder="https://" type="url" value={form.linkUrl} onChange={e => setForm(f => ({ ...f, linkUrl: e.target.value }))} />
                  </Field>
                </div>

                <div style={{ marginTop:4, marginBottom:16 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, flexWrap:'wrap' }}>
                    <span style={{ fontSize:14, fontWeight:700, color:'#1a1a1a' }}>내부 인테리어 이미지 등록</span>
                    <span style={{ fontSize:11, color:'#6f6d6a', background:'#f4f3f1', padding:'3px 8px', borderRadius:8 }}>권장 비율 1:1 (정사각형)</span>
                  </div>
                  <div style={{ fontSize:11, color:'#6f6d6a', marginBottom:8, lineHeight:1.6 }}>
                    집을 열었을 때 가장 크게 보이는 사진이에요. 정사각형으로 잘려서 올라갑니다.
                  </div>
                  <label style={{ display:'block', cursor:'pointer', marginBottom: form.interiorPreview ? 12 : 0 }}>
                    <div style={{ height: form.interiorPreview ? 52 : 120, borderRadius:10, border:`1px dashed ${form.interiorPreview ? '#1a1a1a' : '#d5d2ce'}`, background:'#faf9f8', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
                      <div style={{ textAlign:'center', color:'#6f6d6a' }}>
                        <div style={{ fontSize:12, fontWeight:600 }}>{form.interiorPreview ? '다른 이미지 선택' : '이미지 선택 또는 드래그'}</div>
                        {!form.interiorPreview && <div style={{ fontSize:10, marginTop:3, color:'#97948f' }}>JPG, PNG, WEBP (최대 10MB)</div>}
                      </div>
                    </div>
                    <input type="file" accept="image/*" onChange={handleFile('interior')} style={{ display:'none' }} />
                  </label>

                  {/* 1:1 크롭 에디터 — 외관과 동일한 방식 */}
                  {form.interiorPreview && (
                    <div>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:'#1a1a1a' }}>위치 · 크기 조정 (1:1)</div>
                        {intCropEnabled && (
                          <button type="button" onClick={resetIntCrop} style={{ padding:'5px 10px', borderRadius:8, border:'1px solid #e0ddd9', background:'#fff', color:'#1a1a1a', fontSize:11, fontWeight:600, cursor:'pointer' }}>초기화</button>
                        )}
                      </div>
                      <div style={{ display:'flex', justifyContent:'center', marginBottom:10 }}>
                        {intCropEnabled ? (
                          <canvas
                            ref={intCropRef}
                            width={INT_EDIT}
                            height={INT_EDIT}
                            onPointerDown={onCropDown('interior')}
                            onPointerMove={onCropMove}
                            onPointerUp={onCropUp}
                            onPointerCancel={onCropUp}
                            style={{ width:INT_EDIT, height:INT_EDIT, maxWidth:'100%', aspectRatio:'1/1', borderRadius:10, border:'1px solid #e9e7e4', cursor:'grab', touchAction:'none', display:'block' }}
                          />
                        ) : (
                          <div style={{ width:INT_EDIT, maxWidth:'100%', aspectRatio:'1/1', borderRadius:10, border:'1px solid #e9e7e4', overflow:'hidden', background:'#faf9f8' }}>
                            <img src={form.interiorPreview} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
                          </div>
                        )}
                      </div>
                      {intCropEnabled && (
                        <>
                          <div style={{ fontSize:11, color:'#6f6d6a', textAlign:'center', marginBottom:10 }}>
                            드래그해서 위치를 옮기고, 슬라이더로 크기를 조절하세요.
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                            <span style={{ fontSize:11, color:'#6f6d6a', flexShrink:0 }}>축소</span>
                            <input
                              type="range" min={0.5} max={3} step={0.01}
                              value={form.interiorScale}
                              onChange={e => setForm(f => ({ ...f, interiorScale: Number(e.target.value) }))}
                              style={{ flex:1, accentColor:'#1c1c1e', cursor:'pointer' }}
                            />
                            <span style={{ fontSize:11, color:'#6f6d6a', flexShrink:0 }}>확대</span>
                            <span style={{ fontSize:11, fontWeight:600, color:'#1a1a1a', width:44, textAlign:'right', flexShrink:0 }}>
                              {form.interiorScale.toFixed(2)}×
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
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
                    {isEdit && <span style={{ fontSize:11, fontWeight:500, color:'#6f6d6a', marginLeft:6 }}>(변경 선택사항)</span>}
                  </div>
                  <div style={{ fontSize:11, color:'#6f6d6a', marginBottom:10, lineHeight:1.6 }}>
                    {isEdit ? '변경하려면 새 비밀번호를 입력하세요.' : '수정·삭제 시 필요한 비밀번호를 설정해주세요.'}<br />
                    영문 + 숫자 + 특수문자를 모두 포함해 10자 이상이어야 해요.
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
                        style={{ ...inputStyle, marginBottom:8, borderColor: form.password && !pwdOk ? '#dc2626' : '#e9e7e4' }}
                        placeholder={isEdit ? '새 비밀번호 (변경하려면 입력)' : '비밀번호 입력 (필수)'}
                        value={form.password}
                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      />
                      {form.password && (
                        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
                          {[
                            { ok: pwd.len, label: '10자 이상' },
                            { ok: pwd.alpha, label: '영문' },
                            { ok: pwd.num, label: '숫자' },
                            { ok: pwd.special, label: '특수문자' },
                          ].map(({ ok, label }) => (
                            <span key={label} style={{
                              fontSize:11, fontWeight:600, padding:'3px 8px', borderRadius:8,
                              border:`1px solid ${ok ? '#1a1a1a' : '#e0ddd9'}`,
                              background: ok ? '#1c1c1e' : '#fff',
                              color: ok ? '#fff' : '#97948f',
                            }}>{label}</span>
                          ))}
                        </div>
                      )}
                      {form.password && !pwdOk && (
                        <div style={{ fontSize:11, color:'#dc2626', marginBottom:8, lineHeight:1.6 }}>
                          영문 + 숫자 + 특수문자를 포함해 10자 이상으로 입력해주세요.
                        </div>
                      )}
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
                <div style={{ fontSize:11, fontWeight:600, color:'#6f6d6a', textAlign:'center' }}>집을 클릭하면 이렇게 보여요!</div>
                <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e9e7e4', overflow:'hidden', fontSize:12, position:'relative', boxShadow:'0 1px 3px rgba(0,0,0,0.05)' }}>
                  {/* 닫기 */}
                  <div style={{ position:'absolute', top:8, right:8, width:18, height:18, borderRadius:6, background:'#f4f3f1', display:'flex', alignItems:'center', justifyContent:'center', color:'#6f6d6a', fontSize:12, fontWeight:500 }}>×</div>
                  {/* 미리보기 헤더 */}
                  <div style={{ background:'#faf9f8', padding:'10px 28px 10px 10px', borderBottom:'1px solid #e9e7e4', display:'flex', alignItems:'center', gap:8 }}>
                    <div>
                      <div style={{ display:'flex', gap:4, marginBottom:3, flexWrap:'wrap' }}>
                        <span style={{ fontSize:9, padding:'2px 6px', borderRadius:6, background:'#f4f3f1', color:'#6f6d6a' }}>{selectedCell.address}</span>
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
                          <span style={{ fontSize:9, fontWeight:600, padding:'2px 6px', borderRadius:6, background:'#f4f3f1', color:'#6f6d6a', marginBottom:4, display:'inline-block' }}>소개글</span>
                          <div style={{ fontSize:11, color:'#6f6d6a', lineHeight:1.6, marginTop:4 }}>{form.description}</div>
                        </div>
                      )}
                      {form.linkUrl.trim() && (
                        <div>
                          <span style={{ fontSize:9, fontWeight:600, padding:'2px 6px', borderRadius:6, background:'#f4f3f1', color:'#6f6d6a', marginBottom:4, display:'inline-block' }}>링크</span>
                          <div style={{ marginTop:4 }}>
                            <span style={{
                              display:'inline-flex', alignItems:'center', gap:5, maxWidth:'100%',
                              fontSize:10, fontWeight:700, padding:'6px 9px', borderRadius:8,
                              background:'#1c1c1e', color:'#fff',
                            }}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}>
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                              </svg>
                              <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                {linkHost(form.linkUrl) ?? '집 놀러가기'}
                              </span>
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    {form.interiorPreview && (
                      <div style={{ width:80, padding:'8px 8px 8px 0', flexShrink:0 }}>
                        <div style={{ width:'100%', aspectRatio:'1/1', borderRadius:8, border:'1px solid #e9e7e4', overflow:'hidden', background:'#faf9f8' }}>
                          <img src={form.interiorPreview} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
                        </div>
                      </div>
                    )}
                  </div>
                  {/* 미리보기 통계 */}
                  <div style={{ display:'flex', borderTop:'1px solid #e9e7e4', background:'#faf9f8' }}>
                    <div style={{ flex:1, padding:'8px', textAlign:'center', fontSize:11, fontWeight:600, color:'#6f6d6a' }}>좋아요 0</div>
                    <div style={{ width:1, background:'#e9e7e4' }} />
                    <div style={{ flex:1, padding:'8px', textAlign:'center', fontSize:11, fontWeight:600, color:'#6f6d6a' }}>방문 0</div>
                    <div style={{ width:1, background:'#e9e7e4' }} />
                    <div style={{ flex:1, padding:'8px', textAlign:'center', fontSize:10, color:'#6f6d6a' }}>오늘</div>
                  </div>
                </div>
                <div style={{ fontSize:10, color:'#97948f', textAlign:'center', lineHeight:1.6 }}>
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
                <div style={{ fontSize:12, color:'#6f6d6a', marginBottom:16, lineHeight:1.6 }}>
                  사람들이 지도에서 가장 먼저 보게 되는 이미지예요.
                </div>

                <label style={{ display:'block', cursor:'pointer', marginBottom:16 }}>
                  <div style={{ height: form.exteriorPreview ? 56 : 160, borderRadius:10, border:`1px dashed ${form.exteriorPreview ? '#1a1a1a' : '#d5d2ce'}`, background:'#faf9f8', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
                    <div style={{ textAlign:'center', color:'#6f6d6a' }}>
                      <div style={{ fontSize:13, fontWeight:600 }}>{form.exteriorPreview ? '다른 이미지 선택' : '이미지 업로드'}</div>
                      {!form.exteriorPreview && <div style={{ fontSize:11, marginTop:4, color:'#97948f' }}>JPG, PNG, WEBP (최대 10MB)</div>}
                    </div>
                  </div>
                  <input type="file" accept="image/*" onChange={handleFile('exterior')} style={{ display:'none' }} />
                </label>

                {/* 크롭 에디터 — 드래그로 위치, 슬라이더로 크기 */}
                {cropEnabled && (
                  <div style={{ marginBottom:16 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'#1a1a1a' }}>위치 · 크기 조정</div>
                      <button type="button" onClick={resetCrop} style={{ padding:'5px 10px', borderRadius:8, border:'1px solid #e0ddd9', background:'#fff', color:'#1a1a1a', fontSize:11, fontWeight:600, cursor:'pointer' }}>초기화</button>
                    </div>

                    <div style={{ display:'flex', justifyContent:'center', marginBottom:10 }}>
                      <canvas
                        ref={cropRef}
                        width={editW}
                        height={editH}
                        onPointerDown={onCropDown('exterior')}
                        onPointerMove={onCropMove}
                        onPointerUp={onCropUp}
                        onPointerCancel={onCropUp}
                        style={{
                          width: editW, height: editH, maxWidth:'100%',
                          borderRadius:10, border:'1px solid #e9e7e4',
                          cursor: dragRef.current ? 'grabbing' : 'grab', touchAction:'none', display:'block',
                        }}
                      />
                    </div>
                    <div style={{ fontSize:11, color:'#6f6d6a', textAlign:'center', marginBottom:12 }}>
                      드래그해서 위치를 옮기고, 아래 슬라이더로 크기를 조절하세요. 보이는 그대로 지도에 올라갑니다.
                    </div>

                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ fontSize:11, color:'#6f6d6a', flexShrink:0 }}>축소</span>
                      <input
                        type="range" min={0.5} max={3} step={0.01}
                        value={form.exteriorScale}
                        onChange={e => setForm(f => ({ ...f, exteriorScale: Number(e.target.value) }))}
                        style={{ flex:1, accentColor:'#1c1c1e', cursor:'pointer' }}
                      />
                      <span style={{ fontSize:11, color:'#6f6d6a', flexShrink:0 }}>확대</span>
                      <span style={{ fontSize:11, fontWeight:600, color:'#1a1a1a', width:44, textAlign:'right', flexShrink:0 }}>
                        {form.exteriorScale.toFixed(2)}×
                      </span>
                    </div>
                  </div>
                )}

                {/* 권장 가이드 */}
                <div style={{ padding:12, borderRadius:10, background:'#faf9f8', border:'1px solid #e9e7e4', fontSize:12, color:'#6f6d6a', marginBottom:16 }}>
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
                    <div key={value} onClick={() => setForm(f => ({ ...f, exteriorFit: value as 'cover'|'contain', exteriorScale: 1, exteriorOffset: { x: 0, y: 0 } }))} style={{
                      display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:10, cursor:'pointer', marginBottom:8,
                      border:`1px solid ${active ? '#1a1a1a' : '#e9e7e4'}`,
                      background:'#fff',
                    }}>
                      <RadioDot active={active} />
                      <div>
                        <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a' }}>{label}</div>
                        <div style={{ fontSize:11, color:'#6f6d6a', marginTop:2 }}>{desc}</div>
                      </div>
                    </div>
                    )
                  })}
                </div>

                {/* 이미지 수정 정책 */}
                <div style={{ padding:12, borderRadius:10, background:'#faf9f8', border:'1px solid #e9e7e4', fontSize:12, color:'#6f6d6a' }}>
                  <div style={{ fontWeight:700, marginBottom:4, color:'#1a1a1a' }}>수정 정책</div>
                  <div>· 집 정보와 이미지는 언제든지 수정 가능합니다.</div>
                  <div>· 위치와 면적은 변경할 수 없습니다.</div>
                </div>
              </div>

              {/* 오른쪽: 지도 미리보기 */}
              <div className="af-col" style={{ width:300, flexShrink:0, padding:'20px', background:'#faf9f8' }}>
                <div style={{ fontSize:12, fontWeight:600, color:'#6f6d6a', marginBottom:10 }}>지도 미리보기</div>
                <div style={{ height:160, borderRadius:10, border:'1px solid #e9e7e4', background:'#fff', overflow:'hidden', marginBottom:12, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {cropEnabled ? (
                    <canvas ref={mapPreviewRef} width={pvW} height={pvH} style={{ width:pvW, height:pvH, maxWidth:'92%', maxHeight:'88%', borderRadius:6, border:'1px solid #e9e7e4', display:'block' }} />
                  ) : form.exteriorPreview ? (
                    <img src={form.exteriorPreview} alt="" style={{
                      maxWidth:'80%', maxHeight:'80%', objectFit: form.exteriorFit, borderRadius:8,
                      border: neonOn ? `${(2 * neonFrac).toFixed(2)}px solid ${neonPaintColor}` : '1px solid #e9e7e4',
                      boxShadow: neonOn ? `0 0 ${(8 * neonFrac).toFixed(1)}px ${neonPaintColor}, 0 0 ${(18 * neonFrac).toFixed(1)}px ${neonPaintColor}` : 'none',
                    }} />
                  ) : (
                    <div style={{
                      width:'82%', height:'76%', display:'flex', alignItems:'center', justifyContent:'center',
                      textAlign:'center', color:'#97948f', fontSize:12, lineHeight:1.6, borderRadius:8,
                      border: neonOn ? `${(2 * neonFrac).toFixed(2)}px solid ${neonPaintColor}` : '1px dashed #e0ddd9',
                      boxShadow: neonOn ? `0 0 ${(8 * neonFrac).toFixed(1)}px ${neonPaintColor}, 0 0 ${(18 * neonFrac).toFixed(1)}px ${neonPaintColor}` : 'none',
                    }}>
                      {neonOn ? <span>네온 테두리 적용 예시<br/>이미지를 올리면 함께 보여요</span> : <span>이미지를 업로드하면<br/>미리보기가 표시됩니다</span>}
                    </div>
                  )}
                </div>

                {/* 이펙트 */}
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'#1a1a1a', marginBottom:8 }}>
                    이펙트 추가 (선택) <span style={{ fontSize:11, fontWeight:600, color:'#6f6d6a' }}>· 네온 +{formatKRW(NEON_PRICE)}</span>
                  </div>
                  <div style={{ display:'flex', gap:9, alignItems:'center', flexWrap:'wrap' }}>
                    {/* 기본 (이펙트 없음) */}
                    <button onClick={() => setForm(f => ({ ...f, borderEffect: 'none' }))} style={{
                      padding:'9px 14px', borderRadius:10, cursor:'pointer',
                      border:`1px solid ${form.borderEffect === 'none' ? '#1c1c1e' : '#e9e7e4'}`,
                      background: form.borderEffect === 'none' ? '#1c1c1e' : '#fff',
                      color: form.borderEffect === 'none' ? '#fff' : '#1a1a1a',
                      fontSize:12, fontWeight:600,
                    }}>기본</button>
                    {/* 프리셋 색상 (현재 굵기 유지) */}
                    {NEON_PRESETS.map(p => {
                      const active = neonOn && neonColor(form.borderEffect).toLowerCase() === p.color.toLowerCase()
                      return (
                        <button key={p.color} onClick={() => setForm(f => ({ ...f, borderEffect: buildNeon(p.color, neonWidth(f.borderEffect)) }))}
                          title={p.label}
                          style={{
                            width:32, height:32, borderRadius:'50%', cursor:'pointer', flexShrink:0, padding:0,
                            background:p.color, border: p.color.toUpperCase()==='#FFFFFF' ? '1px solid #e0ddd9' : '2px solid #ffffff',
                            outline: active ? '2px solid #1c1c1e' : 'none', outlineOffset:2,
                            boxShadow: `0 0 8px ${p.color}${active ? '' : '99'}`,
                          }}
                        />
                      )
                    })}
                    {/* 직접 선택 (컬러 스펙트럼) */}
                    {(() => {
                      const curHex = neonOn ? neonColor(form.borderEffect) : DEFAULT_NEON
                      const isPreset = NEON_PRESETS.some(p => p.color.toLowerCase() === curHex.toLowerCase())
                      const customActive = neonOn && !isPreset
                      return (
                        <label title="직접 선택" style={{
                          position:'relative', width:32, height:32, borderRadius:'50%', cursor:'pointer', flexShrink:0,
                          background: customActive ? curHex : 'conic-gradient(from 0deg, #FF3B30, #FF9500, #FFCC00, #34C759, #00C7FF, #0A84FF, #AF52DE, #FF2D95, #FF3B30)',
                          border:'2px solid #ffffff',
                          outline: customActive ? '2px solid #1c1c1e' : 'none', outlineOffset:2,
                          boxShadow: customActive ? `0 0 8px ${curHex}` : '0 0 4px rgba(0,0,0,0.15)',
                          display:'flex', alignItems:'center', justifyContent:'center',
                        }}>
                          <span style={{ fontSize:13, filter:'drop-shadow(0 0 1px rgba(0,0,0,0.5))' }}>🎨</span>
                          <input type="color" value={customActive || isPreset ? curHex : DEFAULT_NEON}
                            onChange={e => setForm(f => ({ ...f, borderEffect: buildNeon(e.target.value, neonWidth(f.borderEffect)) }))}
                            style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:0, cursor:'pointer' }}
                          />
                        </label>
                      )
                    })()}
                  </div>

                  {/* 굵기 슬라이더 (네온 선택 시) */}
                  {neonOn && (
                    <div style={{ marginTop:12, display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ fontSize:11, color:'#6f6d6a', fontWeight:600, whiteSpace:'nowrap' }}>테두리 굵기</span>
                      <input
                        type="range" min={1} max={NEON_MAX_WIDTH} step={1}
                        value={neonWidth(form.borderEffect)}
                        onChange={e => setForm(f => ({ ...f, borderEffect: buildNeon(neonColor(f.borderEffect), parseInt(e.target.value, 10)) }))}
                        style={{ flex:1, accentColor: neonPaintColor, cursor:'pointer' }}
                      />
                      <span style={{ fontSize:11, color:'#1a1a1a', fontWeight:700, width:36, textAlign:'right' }}>
                        {neonWidth(form.borderEffect)} / {NEON_MAX_WIDTH}
                      </span>
                    </div>
                  )}
                  {effectPrice > 0 && (
                    <div style={{ marginTop:8, padding:'8px 10px', borderRadius:10, background:'#fff', border:'1px solid #e9e7e4', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontSize:11, color:'#6f6d6a' }}>이펙트 추가금</span>
                      <span style={{ fontSize:12, fontWeight:700, color:'#1a1a1a' }}>+{formatKRW(effectPrice)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 4: 신청 확인 ── */}
          {step === 4 && (
            <div className="af-row" style={{ display:'flex', gap:0, padding:0 }}>
              <div className="af-col" style={{ flex:1, padding:'24px 20px', overflowY:'auto', maxHeight:'calc(92vh - 160px)' }}>
                <SectionTitle>이렇게 보여요</SectionTitle>

                {/* 실제 집 미리보기 카드 (네온은 카드 전체가 아니라 대표이미지에만) */}
                <div style={{
                  borderRadius:14, border:'1px solid #e9e7e4', background:'#fff', overflow:'hidden', marginBottom:18,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}>
                  {/* 대표 이미지 (지도에 올라갈 모습 그대로) */}
                  <div style={{ padding:'10px 14px 0', display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:6, background:'#1c1c1e', color:'#fff' }}>대표 이미지</span>
                    <span style={{ fontSize:11, color:'#6f6d6a' }}>지도(메인 화면)에 보이는 이미지예요</span>
                  </div>
                  <div style={{ height:200, background:'#faf9f8', borderBottom:'1px solid #e9e7e4', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', padding:'12px 14px' }}>
                    {/* 대표이미지 래퍼 — 네온은 여기에만 (비율 유지) */}
                    <div style={{
                      position:'relative', display:'inline-flex', borderRadius:6, overflow:'hidden',
                      boxShadow: neonOn ? `0 0 ${(4*neonFrac).toFixed(1)}px ${neonPaintColor}, 0 0 ${(11*neonFrac).toFixed(1)}px ${neonPaintColor}, 0 0 ${(20*neonFrac).toFixed(1)}px ${neonPaintColor}, inset 0 0 ${(6*neonFrac).toFixed(1)}px ${neonPaintColor}` : 'none',
                      outline: neonOn ? `${Math.max(1, 2.4*neonFrac).toFixed(2)}px solid ${neonPaintColor}` : 'none',
                      outlineOffset:'-1px',
                    }}>
                      {cropEnabled ? (
                        <canvas ref={confirmRef} width={cfW} height={cfH} style={{ maxWidth:'100%', maxHeight:174, width:'auto', height:'auto', display:'block' }} />
                      ) : form.exteriorPreview ? (
                        <img src={form.exteriorPreview} alt="대표 이미지" style={{ maxWidth:'100%', maxHeight:174, width:'auto', height:'auto', objectFit: form.exteriorFit, display:'block' }} />
                      ) : (
                        <div style={{ fontSize:12, color:'#97948f', textAlign:'center', lineHeight:1.6, padding:'40px 20px' }}>대표 이미지가 없어요<br />이전 단계에서 등록할 수 있어요</div>
                      )}
                    </div>
                  </div>

                  {/* 정보 */}
                  <div style={{ padding:'14px 16px' }}>
                    <div style={{ display:'flex', gap:6, marginBottom:6, flexWrap:'wrap' }}>
                      <span style={{ fontSize:10, padding:'3px 7px', borderRadius:6, background:'#f4f3f1', color:'#6f6d6a', fontWeight:600 }}>{selectedCell.address}</span>
                      {form.nickname && <span style={{ fontSize:10, padding:'3px 7px', borderRadius:6, background:'#1c1c1e', color:'#fff', fontWeight:700 }}>{form.nickname}</span>}
                      {neonOn && <span style={{ fontSize:10, padding:'3px 7px', borderRadius:6, border:`1px solid ${neonPaintColor}`, color: neonPaintColor, fontWeight:700 }}>{effectLabel(form.borderEffect)}</span>}
                    </div>
                    <div style={{ fontSize:17, fontWeight:800, color:'#1a1a1a', marginBottom:6 }}>{form.name || '집 이름 없음'}</div>

                    <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, color: form.description ? '#6f6d6a' : '#97948f', lineHeight:1.7, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
                          {form.description || '소개글 없음'}
                        </div>
                        {form.linkUrl.trim() && (
                          <div style={{ marginTop:10 }}>
                            <span style={{ display:'inline-flex', alignItems:'center', gap:6, maxWidth:'100%', fontSize:11, fontWeight:700, padding:'7px 10px', borderRadius:8, background:'#1c1c1e', color:'#fff' }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}>
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                              </svg>
                              <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{linkHost(form.linkUrl) ?? '집 놀러가기'}</span>
                            </span>
                          </div>
                        )}
                      </div>
                      {form.interiorPreview && (
                        <div style={{ width:88, flexShrink:0 }}>
                          <div style={{ width:'100%', aspectRatio:'1/1', borderRadius:10, border:'1px solid #e9e7e4', overflow:'hidden', background:'#faf9f8' }}>
                            <img src={form.interiorPreview} alt="내관" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
                          </div>
                          <div style={{ fontSize:10, color:'#6f6d6a', textAlign:'center', marginTop:4, fontWeight:600 }}>내 집 내관</div>
                          <div style={{ fontSize:9, color:'#97948f', textAlign:'center', marginTop:1 }}>집을 클릭하면 보여요</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 텍스트 요약 */}
                <div style={{ fontSize:13, fontWeight:700, color:'#1a1a1a', marginBottom:6 }}>입력 내용 확인</div>
                {[
                  { label:'위치', value:`${selectedCell.address} (${zone.label})` },
                  { label:'크기', value:`${selectedCell.width??1} × ${selectedCell.height??1} (${cellCount}칸)` },
                  { label:'집 이름', value: form.name || '(없음)', highlight: !!form.name },
                  { label:'닉네임', value: form.nickname || '(없음)' },
                  { label:'소개글', value: form.description || '(없음)' },
                  { label:'링크', value: form.linkUrl || '(없음)' },
                  { label:'이펙트', value: effectPrice > 0 ? `${effectLabel(form.borderEffect)} (+${formatKRW(effectPrice)})` : effectLabel(form.borderEffect) },
                ].map(({ label, value, highlight }) => (
                  <InfoRow key={label} label={label} value={value} highlight={highlight} />
                ))}

                {!isEdit && (
                  <div style={{ marginTop:20, padding:'16px 18px', borderRadius:12, background:'#faf9f8', border:'1px solid #e9e7e4' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color:'#1a1a1a' }}>영구 입주</div>
                        <div style={{ fontSize:11, color:'#6f6d6a', marginTop:3 }}>한번 입주하면 영구적으로 유지됩니다.</div>
                      </div>
                      <div style={{ fontSize:18, fontWeight:800, color:'#1a1a1a' }}>{formatKRW(price)}</div>
                    </div>
                    {effectPrice > 0 && (
                      <div style={{ display:'flex', justifyContent:'space-between', marginTop:10, paddingTop:10, borderTop:'1px solid #e9e7e4', fontSize:12, color:'#6f6d6a' }}>
                        <span>입주비 {formatKRW(calcTotalPrice(form.days))} + {effectLabel(form.borderEffect)}</span>
                        <span style={{ fontWeight:700, color:'#1a1a1a' }}>+{formatKRW(effectPrice)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 유의사항 */}
              <div className="af-col" style={{ width:220, flexShrink:0, padding:'24px 16px', background:'#faf9f8', borderLeft:'1px solid #e9e7e4' }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#1a1a1a', marginBottom:12 }}>유의사항</div>
                <div style={{ fontSize:12, color:'#6f6d6a', lineHeight:1.8 }}>
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
                  { label:'입주비', value: formatKRW(calcTotalPrice(form.days)) },
                  ...(effectPrice > 0 ? [{ label:`이펙트 · ${effectLabel(form.borderEffect)}`, value: `+${formatKRW(effectPrice)}` }] : []),
                  { label:'금액', value: formatKRW(price), highlight: true },
                ].map(({ label, value, highlight }) => (
                  <InfoRow key={label} label={label} value={value} highlight={highlight} />
                ))}
                <div style={{ marginTop:16, fontSize:12, color:'#6f6d6a', lineHeight:1.8 }}>
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
                      <div style={{ fontSize:11, color:'#6f6d6a', marginTop:4 }}>이제 입주하기 버튼을 눌러주세요.</div>
                    </div>
                    <div style={{ padding:'10px 12px', borderRadius:10, background:'#fff', border:'1px solid #e9e7e4', fontSize:11, color:'#6f6d6a', lineHeight:1.7 }}>
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
          {/* 임시저장 (신규 입주만) */}
          {!isEdit && !paymentDone && (
            <button onClick={saveDraftNow} title="입력한 내용을 임시로 저장 (이미지 제외)" style={{
              padding:'13px 14px', borderRadius:10, cursor:'pointer',
              border:`1px solid ${draftSaved ? '#16a34a' : '#e0ddd9'}`,
              background:'#ffffff', color: draftSaved ? '#16a34a' : '#575654',
              fontSize:13, fontWeight:600, whiteSpace:'nowrap', flexShrink:0,
            }}>{draftSaved ? '저장됨 ✓' : '임시저장'}</button>
          )}
          {step > (isEdit ? 2 : 1) && !paymentDone && (
            <button onClick={() => setStep(s => (s - 1) as Step)} style={{ flex:1, padding:'13px', borderRadius:10, cursor:'pointer', border:'1px solid #e0ddd9', background:'#ffffff', color:'#1a1a1a', fontSize:14, fontWeight:600 }}>
              이전 단계
            </button>
          )}
          <button
            onClick={() => {
              if (step < lastStep) { setStep(s => (s + 1) as Step) }
              else if (isEdit) { handleEditSave() }
              else if (isAdmin) { handleAdminMoveIn() }   // 관리자: 결제 없이 즉시 입주
              else if (!paymentDone) { handlePayment() }
              else { handleMoveIn() }
            }}
            disabled={loading || !canNext()}
            style={{
              flex:2, padding:'13px', borderRadius:10, cursor: loading || !canNext() ? 'not-allowed' : 'pointer',
              background: loading || !canNext() ? '#e9e7e4' : '#1c1c1e',
              color: loading || !canNext() ? '#97948f' : '#ffffff', fontSize:14, fontWeight:700,
              border:'none',
            }}
          >
            {loading
              ? (contentChecking ? 'AI 검사 중...' : '처리 중...')
              : step < lastStep
              ? '다음 단계로'
              : isEdit
              ? '저장하기'
              : isAdmin
              ? '관리자 무료 입주'
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
        {hint && <span style={{ fontSize:11, color:'#6f6d6a' }}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function CharCount({ cur, max }: { cur: number; max: number }) {
  return <div style={{ fontSize:11, color: cur >= max ? '#dc2626' : '#97948f', textAlign:'right', marginTop:4 }}>{cur}/{max}</div>
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid #e9e7e4' }}>
      <span style={{ fontSize:13, color:'#6f6d6a' }}>{label}</span>
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
