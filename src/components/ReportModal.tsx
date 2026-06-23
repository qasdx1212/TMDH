'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { CellData } from '@/types/cell'

const REASONS = [
  { value: 'inappropriate_image', label: '🔞 부적절한 이미지' },
  { value: 'illegal_ad', label: '🚫 불법 광고' },
  { value: 'copyright', label: '📋 저작권 침해' },
  { value: 'impersonation', label: '🎭 사칭' },
  { value: 'other', label: '💬 기타' },
]

interface ReportModalProps {
  house: CellData
  userId: string
  onClose: () => void
}

export default function ReportModal({ house, userId, onClose }: ReportModalProps) {
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async () => {
    if (!reason) return
    setSubmitting(true)
    await supabase.from('reports').insert({
      reporter_id: userId,
      house_id: house.id,
      reason,
      description: description.trim() || null,
    })
    setSubmitting(false)
    setDone(true)
    setTimeout(onClose, 2200)
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 440, maxWidth: '92vw',
          background: '#fdf6e3', borderRadius: 12,
          border: '4px solid #7a4f1a',
          boxShadow: '0 0 0 2px #e8c97a, 0 0 0 5px #7a4f1a, 0 24px 70px rgba(0,0,0,0.7)',
          fontFamily: '"Noto Sans KR", sans-serif', overflow: 'hidden',
        }}
      >
        <div style={{ background: 'linear-gradient(180deg,#f5ead5,#ecdcc0)', padding: '14px 20px', borderBottom: '3px solid #c8a96e', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#2a1505' }}>🚨 신고하기</div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: '50%', background: '#ef4444', border: '2px solid #b91c1c', color: '#fff', fontSize: 16, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        <div style={{ padding: 20 }}>
          {done ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#166534' }}>신고가 접수되었어요</div>
              <div style={{ fontSize: 12, color: '#78614a', marginTop: 8 }}>검토 후 적절한 조치를 취하겠습니다.</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: '#78614a', marginBottom: 16, padding: '10px 14px', background: '#fffbeb', borderRadius: 8, border: '1.5px solid #fde68a' }}>
                신고 대상: <strong>{house.name ?? house.address}</strong>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#3d2a18', marginBottom: 8 }}>신고 이유 선택 *</div>
                {REASONS.map(r => (
                  <div
                    key={r.value}
                    onClick={() => setReason(r.value)}
                    style={{
                      padding: '9px 14px', borderRadius: 8, cursor: 'pointer', marginBottom: 6,
                      border: `2px solid ${reason === r.value ? '#ef4444' : '#d4b483'}`,
                      background: reason === r.value ? '#fef2f2' : '#f5ead5',
                      color: reason === r.value ? '#ef4444' : '#78614a',
                      fontSize: 13, fontWeight: reason === r.value ? 700 : 400,
                    }}
                  >{r.label}</div>
                ))}
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#3d2a18', marginBottom: 6 }}>상세 내용 (선택)</div>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="신고 내용을 자세히 적어주세요..."
                  maxLength={300}
                  style={{ width: '100%', height: 80, padding: '10px 12px', borderRadius: 8, boxSizing: 'border-box', border: '2px solid #d4b483', background: '#fdf6e3', color: '#3d2a18', fontSize: 13, outline: 'none', fontFamily: 'inherit', resize: 'none' }}
                />
                <div style={{ fontSize: 11, color: '#a08060', textAlign: 'right', marginTop: 2 }}>{description.length}/300</div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 8, border: '2px solid #c8a96e', background: '#f5ead5', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#78614a' }}>취소</button>
                <button
                  onClick={handleSubmit}
                  disabled={!reason || submitting}
                  style={{ flex: 2, padding: '11px', borderRadius: 8, border: '2px solid #ef4444', background: reason && !submitting ? '#ef4444' : '#e0c8a8', color: '#fff', cursor: reason && !submitting ? 'pointer' : 'default', fontSize: 13, fontWeight: 700 }}
                >{submitting ? '신고 중...' : '신고 접수'}</button>
              </div>
            </>
          )}
        </div>

        <div style={{ height: 8, background: 'repeating-linear-gradient(90deg,#4a7c3f 0,#4a7c3f 5px,#3d6b34 5px,#3d6b34 10px)', borderTop: '2px solid #2d5226' }} />
      </div>
    </div>
  )
}
