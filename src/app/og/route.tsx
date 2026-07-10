import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f4f3f1',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* 격자 배경 */}
        <div style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.5,
          backgroundImage:
            'repeating-linear-gradient(0deg, #e0ddd9 0px, #e0ddd9 1px, transparent 1px, transparent 24px),' +
            'repeating-linear-gradient(90deg, #e0ddd9 0px, #e0ddd9 1px, transparent 1px, transparent 24px)',
          display: 'flex',
        }} />

        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'0px', zIndex:1 }}>
          <div style={{ fontSize:'86px', fontWeight:800, color:'#1a1a1a', letterSpacing:'-3px', display:'flex', lineHeight:'1' }}>집.zip</div>
          <div style={{ fontSize:'26px', color:'#6f6d6a', marginTop:'18px', display:'flex' }}>Your Digital Home on the Map</div>
          <div style={{
            marginTop:'28px',
            padding:'14px 44px',
            borderRadius:'12px',
            border:'1px solid #e0ddd9',
            background:'#ffffff',
            fontSize:'22px',
            color:'#575654',
            display:'flex',
            gap:'32px',
          }}>
            <span>400 × 200 Grid</span>
            <span style={{ color:'#97948f' }}>·</span>
            <span>80,000 Houses</span>
            <span style={{ color:'#97948f' }}>·</span>
            <span>zipzipworld.com</span>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
