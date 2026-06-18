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

const ZONE_BADGE: Record<string, string> = {
  neon: '🌃', riverside: '🌿', oldtown: '🏮', artdistrict: '🎨',
}

export default function HousePopup({ house, currentUserId, onClose, onBuy }: HousePopupProps) {
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(house.like_count)
  const [likeLoading, setLikeLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const zone = ZONES[house.zone]
  const isAvailable = house.status === 'available'

  const handleShare = () => {
    navigator.clipboard.writeText(`${window.location.origin}?house=${house.address}`).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  useEffect(() => {
    if (!currentUserId || !house.id) return
    supabase.from('likes').select('id').eq('user_id', currentUserId).eq('house_id', house.id).maybeSingle()
      .then(({ data }) => setLiked(!!data))
  }, [currentUserId, house.id])

  useEffect(() => {
    if (!house.id || isAvailable) return
    supabase.from('visits').insert({ house_id: house.id, visitor_ip: null })
  }, [house.id, isAvailable])

  const toggleLike = async () => {
    if (!currentUserId || !house.id) return
    setLikeLoading(true)
    if (liked) {
      await supabase.from('likes').delete().eq('user_id', currentUserId).eq('house_id', house.id)
      setLiked(false); setLikeCount(c => Math.max(0, c - 1))
    } else {
      await supabase.from('likes').insert({ user_id: currentUserId, house_id: house.id })
      setLiked(true); setLikeCount(c => c + 1)
    }
    setLikeLoading(false)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 560, maxWidth: '96vw',
          background: '#fdf6e3',
          borderRadius: 6,
          // Pixel-art wooden multi-border
          boxShadow: `
            0 0 0 3px #8b6914,
            0 0 0 6px #c8a96e,
            0 0 0 8px #5a3e1a,
            0 20px 60px rgba(0,0,0,0.65),
            0 0 60px ${zone.color}33
          `,
          fontFamily: '"Noto Sans KR", -apple-system, sans-serif',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 12, right: 12, zIndex: 10,
            width: 30, height: 30, borderRadius: '50%',
            background: '#ef4444', border: '2px solid #b91c1c',
            color: '#fff', fontSize: 18, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1,
          }}
        >×</button>

        {/* 헤더 */}
        <div style={{
          background: 'linear-gradient(135deg, #4a2e10, #2e1a08)',
          padding: '16px 56px 16px 20px',
          borderBottom: '3px solid #8b6914',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{ fontSize: 40, lineHeight: 1, flexShrink: 0 }}>🏠</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 5 }}>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 3,
                background: '#ffffff18', color: '#d4b47a', border: '1px solid #8b691444',
              }}>{house.address}</span>
              {house.nickname && (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 3,
                  background: zone.color + '30', color: zone.color, border: `1px solid ${zone.color}55`,
                }}>{house.nickname}</span>
              )}
              <span style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 3,
                background: '#ffffff12', color: '#a08060',
              }}>{ZONE_BADGE[house.zone]} {zone.label}</span>
            </div>
            <div style={{
              fontSize: 20, fontWeight: 800, color: '#fff',
              letterSpacing: '-0.02em', lineHeight: 1.2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {isAvailable ? '빈 공간' : (house.name ?? '이름 없는 집')}
            </div>
          </div>
        </div>

        {/* 바디 */}
        <div style={{ padding: '20px', maxHeight: '60vh', overflowY: 'auto' }}>
          {isAvailable ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🏗️</div>
              <div style={{ fontSize: 14, color: '#78614a', lineHeight: 1.8, marginBottom: 24 }}>
                아직 아무도 살지 않는 빈 공간이에요.<br />당신만의 공간으로 꾸며보세요!
              </div>
              <button
                onClick={() => onBuy(house)}
                style={{
                  padding: '12px 36px', borderRadius: 8,
                  background: '#6b4c2a', color: '#fdf6e3',
                  border: '2px solid #8b6914',
                  boxShadow: '0 4px 0 #4a3010',
                  fontSize: 15, fontWeight: 700, cursor: 'pointer',
                }}
              >
                입주 신청하기 →
              </button>
            </div>
          ) : (
            <>
              {/* 소개글 + 이미지 */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {house.description && (
                    <div style={{ marginBottom: 14 }}>
                      <Tag label="소개글" />
                      <div style={{ fontSize: 14, color: '#3d2a18', lineHeight: 1.75, marginTop: 6 }}>
                        {house.description}
                      </div>
                    </div>
                  )}
                  {house.link_url && (
                    <div>
                      <Tag label="링크" />
                      <div style={{ marginTop: 8 }}>
                        <a
                          href={house.link_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '7px 16px', borderRadius: 6,
                            background: zone.color, color: '#fff',
                            fontSize: 12, fontWeight: 700, textDecoration: 'none',
                            border: `2px solid ${zone.color}`,
                            boxShadow: `0 3px 0 ${zone.color}88`,
                          }}
                        >
                          🌐 공식 홈페이지 ↗
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {house.exterior_image_url && (
                  <img
                    src={house.exterior_image_url}
                    alt={house.name ?? ''}
                    style={{
                      width: 160, height: 120, objectFit: 'cover',
                      flexShrink: 0, borderRadius: 6,
                      border: '2px solid #c8a96e',
                      boxShadow: '0 3px 10px rgba(0,0,0,0.18)',
                    }}
                  />
                )}
              </div>

              {/* 통계 바 */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                padding: '10px 14px',
                background: '#f5ead5',
                border: '1.5px solid #d4b483',
                borderRadius: 8,
              }}>
                <StatBtn
                  onClick={toggleLike}
                  disabled={likeLoading || !currentUserId}
                  active={liked}
                  color="#ef4444"
                >
                  {liked ? '❤️' : '🤍'} {likeCount.toLocaleString()}
                </StatBtn>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#78614a', display: 'flex', alignItems: 'center', gap: 4 }}>
                  👣 {house.visit_count.toLocaleString()}
                </div>
                {house.occupied_at && (
                  <div style={{ fontSize: 12, color: '#a08060', display: 'flex', alignItems: 'center', gap: 4 }}>
                    📅 입주일 {house.occupied_at.slice(0, 10)}
                  </div>
                )}
                <StatBtn onClick={handleShare} active={copied} color="#22c55e" style={{ marginLeft: 'auto' }}>
                  {copied ? '✅ 복사됨!' : '🔗 공유'}
                </StatBtn>
              </div>
            </>
          )}
        </div>

        {/* 픽셀 아트 잔디 하단 */}
        <div style={{
          height: 10,
          background: 'repeating-linear-gradient(90deg, #4a7c3f 0px, #4a7c3f 5px, #3d6b34 5px, #3d6b34 10px)',
          borderTop: '2px solid #2d5226',
        }} />
      </div>
    </div>
  )
}

function Tag({ label }: { label: string }) {
  return (
    <span style={{
      display: 'inline-block', fontSize: 11, fontWeight: 700,
      padding: '2px 8px', borderRadius: 4,
      background: '#e8d8bb', color: '#6b4c2a',
      border: '1px solid #c8a96e',
    }}>{label}</span>
  )
}

function StatBtn({
  children, onClick, disabled, active, color, style,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  active?: boolean
  color: string
  style?: React.CSSProperties
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '5px 12px', borderRadius: 6, cursor: disabled ? 'default' : 'pointer',
        background: active ? color + '18' : '#fff',
        border: `1.5px solid ${active ? color : '#d4b483'}`,
        fontSize: 13, fontWeight: 700,
        color: active ? color : '#78614a',
        ...style,
      }}
    >
      {children}
    </button>
  )
}
