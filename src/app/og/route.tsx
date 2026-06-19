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
          background: '#1a0f05',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* 격자 배경 */}
        <div style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.12,
          backgroundImage:
            'repeating-linear-gradient(0deg, #8b6914 0px, #8b6914 1px, transparent 1px, transparent 24px),' +
            'repeating-linear-gradient(90deg, #8b6914 0px, #8b6914 1px, transparent 1px, transparent 24px)',
          display: 'flex',
        }} />

        {/* 구역 색상 코너 */}
        <div style={{ position:'absolute', top:0, left:0, width:240, height:240, background:'#c084fc18', display:'flex' }} />
        <div style={{ position:'absolute', top:0, right:0, width:240, height:240, background:'#34d39918', display:'flex' }} />
        <div style={{ position:'absolute', bottom:0, left:0, width:240, height:240, background:'#fbbf2418', display:'flex' }} />
        <div style={{ position:'absolute', bottom:0, right:0, width:240, height:240, background:'#f8717118', display:'flex' }} />

        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'0px', zIndex:1 }}>
          <div style={{ fontSize:'88px', display:'flex', marginBottom:'4px' }}>🏠</div>
          <div style={{ fontSize:'86px', fontWeight:900, color:'#fdf6e3', letterSpacing:'-3px', display:'flex', lineHeight:'1' }}>ZIP.zip</div>
          <div style={{ fontSize:'26px', color:'#a08060', marginTop:'18px', display:'flex' }}>Your Digital Home on the Map</div>
          <div style={{
            marginTop:'28px',
            padding:'14px 44px',
            borderRadius:'14px',
            border:'2.5px solid #8b6914',
            background:'rgba(139,105,20,0.18)',
            fontSize:'22px',
            color:'#c8a96e',
            display:'flex',
            gap:'32px',
          }}>
            <span>100 × 100 Grid</span>
            <span style={{ color:'#5a3e1a' }}>·</span>
            <span>10,000 Houses</span>
            <span style={{ color:'#5a3e1a' }}>·</span>
            <span>cellar-sigma.vercel.app</span>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
