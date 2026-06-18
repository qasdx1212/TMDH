'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ZONES } from '@/lib/constants'
import type { CellData } from '@/types/cell'

interface HousePopupProps {
  house: CellData
  currentUserId?: string
  onClose: () => void
  onBuy: (house: CellData) => void
}

export default function HousePopup({ house, currentUserId, onClose, onBuy }: HousePopupProps) {
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(house.like_count)
  const [likeLoading, setLikeLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleShare = () => {
    const url = `${window.location.origin}?house=${house.address}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const zone = ZONES[house.zone]
  const isAvailable = house.status === 'available'

  // 내가 하트 눌렀는지 확인
  useEffect(() => {
    if (!currentUserId || !house.id) return
    supabase
      .from('likes')
      .select('id')
      .eq('user_id', currentUserId)
      .eq('house_id', house.id)
      .maybeSingle()
      .then(({ data }) => setLiked(!!data))
  }, [currentUserId, house.id])

  // 방문 카운트
  useEffect(() => {
    if (!house.id || isAvailable) return
    supabase.from('visits').insert({ house_id: house.id, visitor_ip: null })
  }, [house.id, isAvailable])

  const toggleLike = async () => {
    if (!currentUserId || !house.id) return
    setLikeLoading(true)
    if (liked) {
      await supabase.from('likes').delete().eq('user_id', currentUserId).eq('house_id', house.id)
      setLiked(false)
      setLikeCount(c => Math.max(0, c - 1))
    } else {
      await supabase.from('likes').insert({ user_id: currentUserId, house_id: house.id })
      setLiked(true)
      setLikeCount(c => c + 1)
    }
    setLikeLoading(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 480, maxWidth: '95vw', borderRadius: 16,
          background: '#fdf6e3',
          border: `3px solid ${zone.color}`,
          boxShadow: `0 0 40px ${zone.color}66, 0 20px 60px rgba(0,0,0,0.5)`,
          fontFamily: '"Noto Sans KR", -apple-system, sans-serif',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* 닫기 */}
        <button onClick={onClose} style={{
          position: 'absolute', top: 12, right: 12, zIndex: 10,
          width: 28, height: 28, borderRadius: '50%',
          background: '#ef4444', border: 'none', color: '#fff',
          fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>×</button>

        {/* 헤더 */}
        <div style={{
          background: `linear-gradient(135deg, ${zone.bg}, #1a1a2e)`,
          padding: '16px 20px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ fontSize: 32 }}>🏠</div>
          <div>
            <div style={{
              display: 'inline-block', fontSize: 10, fontWeight: 700,
              padding: '2px 8px', borderRadius: 4,
              background: zone.color + '33', color: zone.color,
              border: `1px solid ${zone.color}66`, marginBottom: 4,
            }}>{house.address}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>
              {isAvailable ? '비어있는 공간' : (house.name ?? '이름 없는 집')}
            </div>
          </div>
        </div>

        {/* 바디 */}
        <div style={{ padding: '20px' }}>
          {isAvailable ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🏗️</div>
              <div style={{ fontSize: 15, color: '#64748b', marginBottom: 20 }}>
                아직 아무도 살지 않는 빈 공간이에요.<br />당신의 공간으로 만들어보세요!
              </div>
              <button
                onClick={() => onBuy(house)}
                style={{
                  padding: '12px 32px', borderRadius: 10, border: 'none',
                  background: zone.color, color: '#fff',
                  fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  boxShadow: `0 4px 20px ${zone.color}66`,
                }}
              >
                입주 신청하기 →
              </button>
            </div>
          ) : (
            <>
              {/* 내부 이미지 + 소개글 */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  {house.description && (
                    <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, marginBottom: 12 }}>
                      {house.description}
                    </div>
                  )}
                  {house.link_url && (
                    <a
                      href={house.link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '6px 14px', borderRadius: 8,
                        background: zone.color, color: '#fff',
                        fontSize: 12, fontWeight: 600, textDecoration: 'none',
                      }}
                    >
                      🌐 집 놀러가기
                    </a>
                  )}
                </div>
                {house.exterior_image_url && (
                  <img
                    src={house.exterior_image_url}
                    alt={house.name ?? ''}
                    style={{ width: 140, height: 100, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
                  />
                )}
              </div>

              {/* 통계 */}
              <div style={{
                display: 'flex', gap: 20, padding: '12px 16px',
                borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb',
                marginBottom: 12,
              }}>
                <button
                  onClick={toggleLike}
                  disabled={likeLoading || !currentUserId}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'none', border: 'none', cursor: currentUserId ? 'pointer' : 'default',
                    fontSize: 14, color: liked ? '#ef4444' : '#6b7280',
                    fontWeight: 600, padding: 0,
                  }}
                >
                  {liked ? '❤️' : '🤍'} {likeCount.toLocaleString()}
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: '#6b7280' }}>
                  👣 {house.visit_count.toLocaleString()}
                </div>
                {house.occupied_at && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: '#6b7280' }}>
                    📅 {house.occupied_at.slice(0, 10)}
                  </div>
                )}
                <button
                  onClick={handleShare}
                  style={{
                    marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4,
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 13, color: copied ? '#22c55e' : '#6b7280',
                    fontWeight: 600, padding: 0,
                  }}
                >
                  {copied ? '✅ 복사됨!' : '🔗 공유'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
