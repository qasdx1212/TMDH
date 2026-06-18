'use client'

import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { ZONES, DURATIONS, PERMANENT_DAYS, calcPrice, formatKRW } from '@/lib/constants'
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
  interiorImage: File | null
  interiorPreview: string | null
  days: number
  borderEffect: 'none' | 'neon'
}

export default function ApplyFlow({ selectedCell, userId, onClose, onSuccess }: ApplyFlowProps) {
  const [step, setStep] = useState<Step>(1)
  const [form, setForm] = useState<FormData>({
    name: '', description: '', linkUrl: '', nickname: '',
    exteriorImage: null, exteriorPreview: null,
    interiorImage: null, interiorPreview: null,
    days: 30, borderEffect: 'none',
  })
  const [loading, setLoading] = useState(false)
  const [payMethod, setPayMethod] = useState<string>('card')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const extImgRef = useRef<HTMLInputElement>(null)
  const intImgRef = useRef<HTMLInputElement>(null)

  const zone = ZONES[selectedCell.zone]
  const cellCount = (selectedCell.width ?? 1) * (selectedCell.height ?? 1)
  const price = calcPrice(selectedCell.zone, cellCount, form.days)

  const handleFile = (type: 'exterior' | 'interior') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    if (type === 'exterior') setForm(f => ({ ...f, exteriorImage: file, exteriorPreview: url }))
    else setForm(f => ({ ...f, interiorImage: file, interiorPreview: url }))
    e.target.value = ''
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
      let interiorUrl: string | null = null

      if (form.exteriorImage) {
        exteriorUrl = await uploadImage(form.exteriorImage, `${userId}/exterior-${selectedCell.address}.${form.exteriorImage.name.split('.').pop()}`)
      }
      if (form.interiorImage) {
        interiorUrl = await uploadImage(form.interiorImage, `${userId}/interior-${selectedCell.address}.${form.interiorImage.name.split('.').pop()}`)
      }

      const expiresAt = form.days === PERMANENT_DAYS
        ? null
        : new Date(Date.now() + form.days * 86400000).toISOString()

      const { error, count } = await supabase
        .from('houses')
        .update({
          user_id: userId,
          name: form.name || null,
          nickname: form.nickname || null,
          description: form.description || null,
          link_url: form.linkUrl || null,
          exterior_image_url: exteriorUrl,
          interior_image_url: interiorUrl,
          border_effect: form.borderEffect,
          status: 'occupied',
          occupied_at: new Date().toISOString(),
          expires_at: expiresAt,
          is_permanent: form.days === PERMANENT_DAYS,
        })
        .eq('address', selectedCell.address)

      if (error) {
        console.error('Supabase update error:', error)
        setErrorMsg(`저장 실패: ${error.message}`)
        return
      }
      onSuccess()
    } catch (err) {
      console.error('Submit error:', err)
      setErrorMsg('오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none',
    background: '#f8fafc', color: '#0f172a', fontFamily: 'inherit',
    boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6, display: 'block',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 600,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        width: 560, maxWidth: '95vw', maxHeight: '90vh',
        background: '#fff', borderRadius: 16, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        fontFamily: '"Noto Sans KR", -apple-system, sans-serif',
      }}>
        {/* 헤더 */}
        <div style={{
          padding: '20px 24px 16px',
          background: `linear-gradient(135deg, ${zone.bg}, #1a1a2e)`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>입주 신청</div>
            <div style={{ fontSize: 12, color: zone.color, marginTop: 2 }}>
              {zone.label} · {selectedCell.address}
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: '50%', border: 'none',
            background: '#ffffff20', color: '#fff', fontSize: 18, cursor: 'pointer',
          }}>×</button>
        </div>

        {/* 스텝 인디케이터 */}
        <div style={{ display: 'flex', padding: '0 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          {['위치', '집 정보', '외관 이미지', '확인', '결제'].map((label, i) => (
            <div key={i} style={{
              flex: 1, padding: '12px 0', textAlign: 'center',
              fontSize: 11, fontWeight: step === i + 1 ? 700 : 400,
              color: step === i + 1 ? zone.color : step > i + 1 ? '#22c55e' : '#94a3b8',
              borderBottom: step === i + 1 ? `2px solid ${zone.color}` : '2px solid transparent',
            }}>
              {step > i + 1 ? '✓ ' : ''}{label}
            </div>
          ))}
        </div>

        {/* 본문 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

          {/* Step 1: 위치 확인 */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>선택한 위치 정보</div>
              {[
                ['선택한 주소', selectedCell.address],
                ['구역', zone.label],
                ['선택 크기', `${selectedCell.width ?? 1} × ${selectedCell.height ?? 1} 칸 (총 ${cellCount}칸)`],
                ['기본 가격', formatKRW(calcPrice(selectedCell.zone, cellCount, 30)) + ' / 1개월'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: 13, color: '#64748b' }}>{k}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{v}</span>
                </div>
              ))}
            </div>
          )}

          {/* Step 2: 집 정보 */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>집 이름 <span style={{ color: '#94a3b8' }}>(최대 20자)</span></label>
                <input
                  style={inputStyle}
                  placeholder="예) 토토의 작은 집"
                  maxLength={20}
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
                <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'right', marginTop: 4 }}>{form.name.length}/20</div>
              </div>
              <div>
                <label style={labelStyle}>소개글 <span style={{ color: '#94a3b8' }}>(최대 80자)</span></label>
                <textarea
                  style={{ ...inputStyle, height: 80, resize: 'none' }}
                  placeholder="당신의 집을 소개해주세요!"
                  maxLength={80}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
                <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'right', marginTop: 4 }}>{form.description.length}/80</div>
              </div>
              <div>
                <label style={labelStyle}>집 놀러가기 링크 <span style={{ color: '#94a3b8' }}>(선택)</span></label>
                <input
                  style={inputStyle}
                  placeholder="https://"
                  type="url"
                  value={form.linkUrl}
                  onChange={e => setForm(f => ({ ...f, linkUrl: e.target.value }))}
                />
              </div>
              <div>
                <label style={labelStyle}>닉네임 <span style={{ color: '#94a3b8' }}>(최대 7자, 지도에 표시)</span></label>
                <input
                  style={inputStyle}
                  placeholder="사용할 닉네임"
                  maxLength={7}
                  value={form.nickname}
                  onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))}
                />
              </div>
            </div>
          )}

          {/* Step 3: 외관/내부 이미지 */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{ ...labelStyle, fontSize: 14, color: '#0f172a' }}>🏠 건물 외관 이미지</label>
                <p style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>지도에서 사람들이 가장 먼저 보게 되는 이미지예요.</p>
                <div
                  onClick={() => extImgRef.current?.click()}
                  style={{
                    height: 120, borderRadius: 10, border: '2px dashed #cbd5e1',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', background: '#f8fafc', overflow: 'hidden',
                  }}
                >
                  {form.exteriorPreview
                    ? <img src={form.exteriorPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                        <div style={{ fontSize: 28, marginBottom: 6 }}>☁️</div>
                        <div style={{ fontSize: 12 }}>클릭하여 이미지 업로드</div>
                        <div style={{ fontSize: 11 }}>JPG, PNG, WEBP (최대 10MB)</div>
                      </div>
                  }
                </div>
                <input ref={extImgRef} type="file" accept="image/*" onChange={handleFile('exterior')} style={{ display: 'none' }} />
              </div>

              <div>
                <label style={{ ...labelStyle, fontSize: 14, color: '#0f172a' }}>🖼️ 내부 인테리어 이미지</label>
                <p style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>집을 클릭했을 때 팝업에 보이는 이미지예요.</p>
                <div
                  onClick={() => intImgRef.current?.click()}
                  style={{
                    height: 100, borderRadius: 10, border: '2px dashed #cbd5e1',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', background: '#f8fafc', overflow: 'hidden',
                  }}
                >
                  {form.interiorPreview
                    ? <img src={form.interiorPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 12, color: '#94a3b8' }}>클릭하여 이미지 업로드 (선택)</span>
                  }
                </div>
                <input ref={intImgRef} type="file" accept="image/*" onChange={handleFile('interior')} style={{ display: 'none' }} />
              </div>

              <div>
                <label style={{ ...labelStyle, fontSize: 14, color: '#0f172a' }}>✨ 이펙트</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {(['none', 'neon'] as const).map(effect => (
                    <button
                      key={effect}
                      onClick={() => setForm(f => ({ ...f, borderEffect: effect }))}
                      style={{
                        flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer',
                        border: form.borderEffect === effect ? `2px solid ${zone.color}` : '2px solid #e2e8f0',
                        background: form.borderEffect === effect ? zone.color + '15' : '#f8fafc',
                        color: form.borderEffect === effect ? zone.color : '#475569',
                        fontSize: 12, fontWeight: 600,
                      }}
                    >
                      {effect === 'none' ? '기본 (이펙트 없음)' : '🌟 네온 테두리'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: 확인 */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>입력한 내용을 확인해주세요</div>
              {[
                ['위치', `${selectedCell.address} (${zone.label})`],
                ['집 이름', form.name || '(없음)'],
                ['닉네임', form.nickname || '(없음)'],
                ['소개글', form.description || '(없음)'],
                ['링크', form.linkUrl || '(없음)'],
                ['외관 이미지', form.exteriorImage ? form.exteriorImage.name : '(없음)'],
                ['내부 이미지', form.interiorImage ? form.interiorImage.name : '(없음)'],
                ['이펙트', form.borderEffect === 'neon' ? '네온 테두리' : '기본'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: 13, color: '#64748b', width: 90, flexShrink: 0 }}>{k}</span>
                  <span style={{ fontSize: 13, color: '#0f172a', wordBreak: 'break-all' }}>{v}</span>
                </div>
              ))}

              {/* 기간 선택 */}
              <div style={{ marginTop: 8 }}>
                <label style={labelStyle}>입주 기간</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {DURATIONS.map(({ days: d, label }) => (
                    <button key={d} onClick={() => setForm(f => ({ ...f, days: d }))} style={{
                      padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                      border: form.days === d ? `1.5px solid ${zone.color}` : '1.5px solid #e2e8f0',
                      background: form.days === d ? zone.color + '15' : '#f8fafc',
                      color: form.days === d ? zone.color : '#475569',
                    }}>
                      {label}<br />
                      <span style={{ fontSize: 10, opacity: 0.75 }}>{formatKRW(calcPrice(selectedCell.zone, 1, d))}</span>
                    </button>
                  ))}
                  <button onClick={() => setForm(f => ({ ...f, days: PERMANENT_DAYS }))} style={{
                    padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    border: form.days === PERMANENT_DAYS ? `1.5px solid ${zone.color}` : '1.5px solid #e2e8f0',
                    background: form.days === PERMANENT_DAYS ? zone.color + '15' : '#f8fafc',
                    color: form.days === PERMANENT_DAYS ? zone.color : '#475569',
                  }}>
                    영구<br /><span style={{ fontSize: 10, opacity: 0.75 }}>{formatKRW(calcPrice(selectedCell.zone, 1, PERMANENT_DAYS))}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: 결제 */}
          {step === 5 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ padding: 16, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>
                  {selectedCell.address} · {form.days === PERMANENT_DAYS ? '영구보존' : `${form.days}일`}
                </div>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em' }}>
                  {formatKRW(price)}
                </div>
              </div>

              <div>
                <label style={{ ...labelStyle, fontSize: 14 }}>결제 수단</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { id: 'card', label: '💳 신용/체크카드' },
                    { id: 'kakaopay', label: '💛 카카오페이' },
                    { id: 'tosspay', label: '🔵 토스페이' },
                  ].map(method => (
                    <div
                      key={method.id}
                      onClick={() => setPayMethod(method.id)}
                      style={{
                        padding: '12px 16px', borderRadius: 8, cursor: 'pointer',
                        border: payMethod === method.id ? `1.5px solid ${zone.color}` : '1.5px solid #e2e8f0',
                        background: payMethod === method.id ? zone.color + '12' : '#f8fafc',
                        fontSize: 14, color: payMethod === method.id ? zone.color : '#475569',
                        display: 'flex', alignItems: 'center', gap: 10, fontWeight: payMethod === method.id ? 600 : 400,
                        transition: 'all 0.15s',
                      }}
                    >
                      {payMethod === method.id ? '✓ ' : ''}{method.label}
                    </div>
                  ))}
                </div>
              </div>

              {errorMsg && (
                <div style={{ padding: 12, borderRadius: 8, background: '#fee2e2', border: '1px solid #fca5a5', fontSize: 12, color: '#991b1b' }}>
                  ❌ {errorMsg}
                </div>
              )}

              <div style={{ padding: 12, borderRadius: 8, background: '#fef3c7', border: '1px solid #fde68a', fontSize: 12, color: '#92400e' }}>
                ⚠️ 현재 결제는 테스트 모드입니다. 실제 결제 없이 입주 처리됩니다.
              </div>
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid #f1f5f9',
          display: 'flex', gap: 10,
        }}>
          {step > 1 && (
            <button
              onClick={() => setStep(s => (s - 1) as Step)}
              style={{
                flex: 1, padding: '12px', borderRadius: 10,
                border: '1.5px solid #e2e8f0', background: '#f8fafc',
                color: '#475569', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >← 이전</button>
          )}
          <button
            onClick={() => {
              if (step < 5) setStep(s => (s + 1) as Step)
              else handleSubmit()
            }}
            disabled={loading}
            style={{
              flex: 2, padding: '12px', borderRadius: 10, border: 'none',
              background: zone.color, color: '#fff',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '처리 중...' : step === 5 ? `결제하기 ${formatKRW(price)} →` : '다음 단계로 →'}
          </button>
        </div>
      </div>
    </div>
  )
}
