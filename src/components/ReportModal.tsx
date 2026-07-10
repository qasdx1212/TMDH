'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { CellData } from '@/types/cell'

const REASONS = [
  { value: 'inappropriate_image', label: '부적절한 이미지' },
  { value: 'illegal_ad', label: '불법 광고' },
  { value: 'copyright', label: '저작권 침해' },
  { value: 'impersonation', label: '사칭' },
  { value: 'other', label: '기타' },
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
      style={{ position: 'fixed', inset: 0, zIndex: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 440, maxWidth: '92vw', maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
          background: '#ffffff', borderRadius: 14,
          border: '1px solid #e9e7e4',
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e9e7e4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>신고하기</div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 10, background: '#f4f3f1', border: '1px solid #e9e7e4', color: '#6f6d6a', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          {done ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>신고가 접수되었어요</div>
              <div style={{ fontSize: 13, color: '#6f6d6a', marginTop: 8 }}>검토 후 적절한 조치를 취하겠습니다.</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 13, color: '#6f6d6a', marginBottom: 16, padding: '10px 14px', background: '#f4f3f1', borderRadius: 10, border: '1px solid #e9e7e4' }}>
                신고 대상: <strong style={{ color: '#1a1a1a', fontWeight: 600 }}>{house.name ?? house.address}</strong>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>신고 이유 선택</div>
                {REASONS.map(r => (
                  <div
                    key={r.value}
                    onClick={() => setReason(r.value)}
                    style={{
                      padding: '11px 14px', borderRadius: 10, cursor: 'pointer', marginBottom: 6,
                      border: `1px solid ${reason === r.value ? '#d5d2ce' : '#e9e7e4'}`,
                      background: reason === r.value ? '#f4f3f1' : '#ffffff',
                      color: '#1a1a1a',
                      fontSize: 14, fontWeight: reason === r.value ? 600 : 400,
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}
                  >
                    <span style={{
                      width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                      border: `2px solid ${reason === r.value ? '#1a1a1a' : '#d5d2ce'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {reason === r.value && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1a1a1a' }} />}
                    </span>
                    {r.label}
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 6 }}>상세 내용 (선택)</div>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="신고 내용을 자세히 적어주세요..."
                  maxLength={300}
                  style={{ width: '100%', height: 80, padding: '10px 12px', borderRadius: 10, boxSizing: 'border-box', border: '1px solid #e0ddd9', background: '#ffffff', color: '#1a1a1a', fontSize: 13, outline: 'none', resize: 'none' }}
                />
                <div style={{ fontSize: 11, color: '#97948f', textAlign: 'right', marginTop: 2 }}>{description.length}/300</div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid #e0ddd9', background: '#ffffff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>취소</button>
                <button
                  onClick={handleSubmit}
                  disabled={!reason || submitting}
                  style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none', background: '#dc2626', color: '#ffffff', cursor: reason && !submitting ? 'pointer' : 'default', fontSize: 13, fontWeight: 600, opacity: reason && !submitting ? 1 : 0.5 }}
                >{submitting ? '신고 중...' : '신고 접수'}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
