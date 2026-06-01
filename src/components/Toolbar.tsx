'use client'

interface ToolbarProps {
  totalCells: number
  takenCells: number
  onClearSelection: () => void
}

export default function Toolbar({ totalCells, takenCells, onClearSelection }: ToolbarProps) {
  return (
    <div style={{
      height: 28,
      background: '#f0f0f0',
      borderBottom: '1px solid #aaa',
      display: 'flex',
      alignItems: 'center',
      flexShrink: 0,
      fontFamily: 'Arial, sans-serif',
    }}>
      <div style={{
        padding: '0 10px',
        borderRight: '1px solid #aaa',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        background: '#000',
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 13,
        letterSpacing: '0.1em',
      }}>
        CELLAR
      </div>

      <div style={{
        padding: '0 12px',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        borderRight: '1px solid #e0e0e0',
        fontSize: 10,
        color: '#666',
        fontFamily: 'Courier New, monospace',
        gap: 2,
      }}>
        총 <b style={{ color: '#c00', margin: '0 2px' }}>{totalCells.toLocaleString()}</b>칸
        &nbsp;|&nbsp;
        점유 <b style={{ color: '#c00', margin: '0 2px' }}>{takenCells.toLocaleString()}</b>
        &nbsp;|&nbsp;
        잔여 <b style={{ color: '#007700', margin: '0 2px' }}>{(totalCells - takenCells).toLocaleString()}</b>
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', height: '100%' }}>
        <div
          onClick={onClearSelection}
          style={{
            padding: '0 12px',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            borderLeft: '1px solid #e0e0e0',
            color: '#333',
            fontSize: 11,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#e4e4e4')}
          onMouseLeave={e => (e.currentTarget.style.background = '')}
        >
          선택 해제
        </div>
      </div>
    </div>
  )
}
