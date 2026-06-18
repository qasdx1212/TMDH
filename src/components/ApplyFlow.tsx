'use client'

import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { ZONES, DURATIONS, PERMANENT_DAYS, calcPrice, formatKRW, getAddress } from '@/lib/constants'
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
  days: number
  borderEffect: 'none' | 'neon'
}

const STEPS = ['위치 확인', '집 정보', '이미지', '확인', '결제']

export default function ApplyFlow({ selectedCell, userId, onClose, onSuccess }: ApplyFlowProps) {
  const [step, setStep] = useState<Step>(1)
  const [form, setForm] = useState<FormData>({
    name: '', description: '', linkUrl: '', nickname: '',
    exteriorImage: null, exteriorPreview: null,
    days: 30, borderEffect: 'none',
  })
  const [loading, setLoading] = useState(false)
  const [payMethod, setPayMethod] = useState('card')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const zone = ZONES[selectedCell.zone]
  const cellCount = (selectedCell.width ?? 1) * (selectedCell.height ?? 1)
  const price = calcPrice(selectedCell.zone, cellCount, form.days)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setForm(f => ({ ...f, exteriorImage: file, exteriorPreview: URL.createObjectURL(file) }))
  }

  const uploadImage = async (file: File, path: string): Promise<string | null> => {
    const { error } = await supabase.storage.from('house-images').upload(path, file, { upsert: true })
    if (error) return null
    const { data } = supabase.storage.from('house-images').getPublicUrl(path)
    return data.publicUrl
  }

  const handleSubmit = async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      let exteriorUrl: string | null = null
      if (form.exteriorImage) {
        exteriorUrl = await uploadImage(
          form.exteriorImage,
          `${userId}/exterior-${selectedCell.address}.${form.exteriorImage.name.split('.').pop()}`
        )
      }

      const expiresAt = form.days === PERMANENT_DAYS
        ? null
        : new Date(Date.now() + form.days * 86400000).toISOString()
      const occupiedAt = new Date().toISOString()
      const col = selectedCell.col, row = selectedCell.row
      const width = selectedCell.width ?? 1, height = selectedCell.height ?? 1

      const { error } = await supabase.from('houses').update({
        user_id: userId,
        name: form.name || null,
        nickname: form.nickname || null,
        description: form.description || null,
        link_url: form.linkUrl || null,
        exterior_image_url: exteriorUrl,
        border_effect: form.borderEffect,
        status: 'occupied',
        width, height,
        occupied_at: occupiedAt,
        expires_at: expiresAt,
        is_permanent: form.days === PERMANENT_DAYS,
      }).eq('address', selectedCell.address)

      if (error) { setErrorMsg(`저장 실패: ${error.message}`); return }

      if (width > 1 || height > 1) {
        for (let c = col; c < col + width; c++) {
          for (let r = row; r < row + height; r++) {
            if (c === col && r === row) continue
            await supabase.from('houses').update({
              user_id: userId, status: 'occupied',
              parent_address: selectedCell.address,
              occupied_at: occupiedAt, expires_at: expiresAt,
              is_permanent: form.days === PERMANENT_DAYS,
            }).eq('address', getAddress(c, r))
          }
        }
      }

      onSuccess()
    } catch {
      setErrorMsg('오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const canNext = () => {
    if (step === 2 && !form.name.trim()) return false
    return true
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 600,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)',
    }}>
      <div style={{
        width: 600, maxWidth: '96vw', maxHeight: '92vh',
        background: '#fdf6e3',
        borderRadius: 6,
        boxShadow: '0 0 0 3px #8b6914, 0 0 0 6px #c8a96e, 0 0 0 8px #5a3e1a, 0 24px 80px rgba(0,0,0,0.7)',
        fontFamily: '"Noto Sans KR", -apple-system, sans-serif',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* 헤더 */}
        <div style={{
          background: 'linear-gradient(135deg, #4a2e10, #2e1a08)',
          padding: '16px 20px',
          borderBottom: '3px solid #8b6914',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#fdf6e3' }}>🏠 입주 신청</div>
            <div style={{ fontSize: 11, color: zone.color, marginTop: 2, fontWeight: 600 }}>
              {zone.label} · {selectedCell.address} · {cellCount}칸
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: '50%',
            background: '#ef4444', border: '2px solid #b91c1c',
            color: '#fff', fontSize: 18, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>

        {/* 스텝 인디케이터 */}
        <div style={{
          display: 'flex', background: '#f5ead5',
          borderBottom: '2px solid #d4b483',
        }}>
          {STEPS.map((label, i) => {
            const s = (i + 1) as Step
            const isDone = step > s
            const isActive = step === s
            return (
              <div key={i} style={{
                flex: 1, padding: '10px 4px', textAlign: 'center',
                fontSize: 11, fontWeight: isActive ? 800 : isDone ? 600 : 400,
                color: isActive ? zone.color : isDone ? '#4a7c3f' : '#a08060',
                borderBottom: isActive ? `3px solid ${zone.color}` : '3px solid transparent',
                transition: 'all 0.12s',
              }}>
                {isDone ? '✓ ' : ''}{label}
              </div>
            )
          })}
        </div>

        {/* 본문 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

          {/* Step 1 */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <SectionTitle>선택한 위치 정보</SectionTitle>
              <InfoRow label="주소" value={selectedCell.address} highlight />
              <InfoRow label="구역" value={`${zone.label}`} />
              <InfoRow label="선택 크기" value={`${selectedCell.width ?? 1} × ${selectedCell.height ?? 1} 칸 (총 ${cellCount}칸)`} />
              <InfoRow label="기본 가격" value={`${formatKRW(calcPrice(selectedCell.zone, cellCount, 30))} / 1개월`} highlight />
              <div style={{ marginTop: 16, padding: 14, borderRadius: 8, background: '#fff8e8', border: '1.5px solid #d4b483', fontSize: 12, color: '#78614a', lineHeight: 1.7 }}>
                💡 선택한 위치와 면적은 이후 변경할 수 없어요. 확인 후 다음 단계로 이동해주세요.
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <SectionTitle>집 정보를 입력해주세요</SectionTitle>
              <Field label="집 이름 *" hint="최대 20자">
                <input
                  style={inputStyle}
                  placeholder="예) 토토의 작은 집"
                  maxLength={20}
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
                <CharCount cur={form.name.length} max={20} />
              </Field>
              <Field label="소개글" hint="최대 80자">
                <textarea
                  style={{ ...inputStyle, height: 84, resize: 'none' }}
                  placeholder="당신의 집을 소개해주세요!"
                  maxLength={80}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
                <CharCount cur={form.description.length} max={80} />
              </Field>
              <Field label="집 놀러가기 링크" hint="선택">
                <input
                  style={inputStyle}
                  placeholder="https://"
                  type="url"
                  value={form.linkUrl}
                  onChange={e => setForm(f => ({ ...f, linkUrl: e.target.value }))}
                />
              </Field>
              <Field label="닉네임" hint="최대 7자 · 지도에 표시됨">
                <input
                  style={inputStyle}
                  placeholder="사용할 닉네임"
                  maxLength={7}
                  value={form.nickname}
                  onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))}
                />
                <CharCount cur={form.nickname.length} max={7} />
              </Field>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <SectionTitle>건물 외관 이미지 등록</SectionTitle>
              <p style={{ margin: 0, fontSize: 12, color: '#78614a', lineHeight: 1.6 }}>
                지도에서 사람들이 가장 먼저 보게 되는 이미지예요. 선명할수록 더 좋게 표시돼요.
              </p>

              <label style={{ display: 'block', cursor: 'pointer' }}>
                <div style={{
                  height: 160, borderRadius: 10, overflow: 'hidden',
                  border: `2px dashed ${form.exteriorPreview ? zone.color : '#c8a96e'}`,
                  background: '#f5ead5',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}>
                  {form.exteriorPreview ? (
                    <img src={form.exteriorPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ textAlign: 'center', color: '#a08060' }}>
                      <div style={{ fontSize: 36, marginBottom: 8 }}>☁️</div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>클릭하여 이미지 업로드</div>
                      <div style={{ fontSize: 11, marginTop: 4 }}>JPG, PNG, WEBP (최대 10MB)</div>
                    </div>
                  )}
                </div>
                <input type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
              </label>

              {form.exteriorPreview && (
                <div style={{ padding: 12, borderRadius: 8, background: '#f0fdf4', border: '1.5px solid #4ade80', fontSize: 12, color: '#166534' }}>
                  ✅ 이미지가 선택됐어요. 지도에서 집 블록에 이 이미지가 표시됩니다.
                </div>
              )}

              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#4a2e10', marginBottom: 10 }}>✨ 이펙트</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {(['none', 'neon'] as const).map(effect => (
                    <button
                      key={effect}
                      onClick={() => setForm(f => ({ ...f, borderEffect: effect }))}
                      style={{
                        flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer',
                        border: `2px solid ${form.borderEffect === effect ? zone.color : '#c8a96e'}`,
                        background: form.borderEffect === effect ? zone.color + '15' : '#f5ead5',
                        color: form.borderEffect === effect ? zone.color : '#78614a',
                        fontSize: 12, fontWeight: 600,
                      }}
                    >
                      {effect === 'none' ? '기본 (없음)' : '🌟 네온 테두리'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 4 */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <SectionTitle>입력 내용 확인</SectionTitle>
              <InfoRow label="위치" value={`${selectedCell.address} (${zone.label})`} />
              <InfoRow label="집 이름" value={form.name || '(없음)'} highlight={!!form.name} />
              <InfoRow label="닉네임" value={form.nickname || '(없음)'} />
              <InfoRow label="소개글" value={form.description || '(없음)'} />
              <InfoRow label="링크" value={form.linkUrl || '(없음)'} />
              <InfoRow label="이미지" value={form.exteriorImage ? form.exteriorImage.name : '(없음)'} />
              <InfoRow label="이펙트" value={form.borderEffect === 'neon' ? '네온 테두리' : '기본'} />

              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#4a2e10', marginBottom: 10 }}>입주 기간 선택</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {DURATIONS.map(({ days: d, label }) => (
                    <PeriodBtn key={d} active={form.days === d} color={zone.color} onClick={() => setForm(f => ({ ...f, days: d }))}>
                      {label}<br /><span style={{ fontSize: 10, opacity: 0.8 }}>{formatKRW(calcPrice(selectedCell.zone, cellCount, d))}</span>
                    </PeriodBtn>
                  ))}
                  <PeriodBtn active={form.days === PERMANENT_DAYS} color={zone.color} onClick={() => setForm(f => ({ ...f, days: PERMANENT_DAYS }))}>
                    영구 보존<br /><span style={{ fontSize: 10, opacity: 0.8 }}>{formatKRW(calcPrice(selectedCell.zone, cellCount, PERMANENT_DAYS))}</span>
                  </PeriodBtn>
                </div>
              </div>
            </div>
          )}

          {/* Step 5 */}
          {step === 5 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <SectionTitle>결제</SectionTitle>
              <div style={{
                padding: '20px', borderRadius: 10,
                background: 'linear-gradient(135deg, #4a2e10, #2e1a08)',
                border: '2px solid #8b6914',
              }}>
                <div style={{ fontSize: 12, color: '#a08060', marginBottom: 6 }}>
                  {selectedCell.address} · {zone.label} · {form.days === PERMANENT_DAYS ? '영구보존' : `${form.days}일`}
                </div>
                <div style={{ fontSize: 36, fontWeight: 900, color: '#fdf6e3', letterSpacing: '-0.04em' }}>
                  {formatKRW(price)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#4a2e10', marginBottom: 10 }}>결제 수단</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { id: 'card', label: '💳 신용/체크카드' },
                    { id: 'kakaopay', label: '💛 카카오페이' },
                    { id: 'tosspay', label: '🔵 토스페이' },
                  ].map(m => (
                    <div
                      key={m.id}
                      onClick={() => setPayMethod(m.id)}
                      style={{
                        padding: '12px 16px', borderRadius: 8, cursor: 'pointer',
                        border: `2px solid ${payMethod === m.id ? zone.color : '#c8a96e'}`,
                        background: payMethod === m.id ? zone.color + '12' : '#f5ead5',
                        color: payMethod === m.id ? zone.color : '#78614a',
                        fontSize: 14, fontWeight: payMethod === m.id ? 700 : 500,
                        display: 'flex', alignItems: 'center', gap: 10,
                      }}
                    >
                      {payMethod === m.id && '✓ '}{m.label}
                    </div>
                  ))}
                </div>
              </div>

              {errorMsg && (
                <div style={{ padding: 12, borderRadius: 8, background: '#fef2f2', border: '1.5px solid #fca5a5', fontSize: 12, color: '#991b1b' }}>
                  ❌ {errorMsg}
                </div>
              )}

              <div style={{ padding: 12, borderRadius: 8, background: '#fffbeb', border: '1.5px solid #fde68a', fontSize: 12, color: '#92400e', lineHeight: 1.6 }}>
                ⚠️ 현재 결제는 테스트 모드입니다. 실제 결제 없이 입주 처리됩니다.
              </div>
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div style={{
          padding: '14px 24px', borderTop: '2px solid #d4b483',
          background: '#f5ead5', display: 'flex', gap: 10,
        }}>
          {step > 1 && (
            <button
              onClick={() => setStep(s => (s - 1) as Step)}
              style={{
                flex: 1, padding: '12px', borderRadius: 8, cursor: 'pointer',
                border: '2px solid #c8a96e', background: '#fdf6e3',
                color: '#78614a', fontSize: 14, fontWeight: 600,
              }}
            >← 이전</button>
          )}
          <button
            onClick={() => {
              if (step < 5) setStep(s => (s + 1) as Step)
              else handleSubmit()
            }}
            disabled={loading || !canNext()}
            style={{
              flex: 2, padding: '12px', borderRadius: 8, cursor: 'pointer',
              background: loading || !canNext()
                ? '#c8a96e'
                : `linear-gradient(180deg, ${zone.color}, ${zone.color}cc)`,
              color: '#fff', fontSize: 14, fontWeight: 800,
              border: `2px solid ${zone.color}`,
              boxShadow: loading || !canNext() ? 'none' : `0 4px 0 ${zone.color}88`,
            }}
          >
            {loading ? '처리 중...' : step === 5 ? `결제하기 ${formatKRW(price)} →` : '다음 단계로 →'}
          </button>
        </div>

        {/* 픽셀 잔디 하단 */}
        <div style={{
          height: 8,
          background: 'repeating-linear-gradient(90deg, #4a7c3f 0px, #4a7c3f 5px, #3d6b34 5px, #3d6b34 10px)',
          borderTop: '2px solid #2d5226',
        }} />
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8, boxSizing: 'border-box',
  border: '2px solid #d4b483', background: '#fdf6e3', color: '#3d2a18',
  fontSize: 14, outline: 'none', fontFamily: 'inherit',
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 15, fontWeight: 800, color: '#3d2a18', marginBottom: 16, paddingBottom: 10, borderBottom: '2px solid #e8d8bb' }}>
      {children}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#4a2e10' }}>{label}</span>
        {hint && <span style={{ fontSize: 11, color: '#a08060' }}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function CharCount({ cur, max }: { cur: number; max: number }) {
  return (
    <div style={{ fontSize: 11, color: cur >= max ? '#ef4444' : '#a08060', textAlign: 'right', marginTop: 4 }}>
      {cur}/{max}
    </div>
  )
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 0', borderBottom: '1px solid #e8d8bb',
    }}>
      <span style={{ fontSize: 13, color: '#78614a' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: highlight ? 800 : 600, color: highlight ? '#3d2a18' : '#78614a' }}>{value}</span>
    </div>
  )
}

function PeriodBtn({ children, active, color, onClick }: { children: React.ReactNode; active: boolean; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 16px', borderRadius: 8, cursor: 'pointer', textAlign: 'center', lineHeight: 1.5,
        border: `2px solid ${active ? color : '#c8a96e'}`,
        background: active ? color + '18' : '#f5ead5',
        color: active ? color : '#78614a',
        fontSize: 13, fontWeight: active ? 700 : 500,
      }}
    >
      {children}
    </button>
  )
}
