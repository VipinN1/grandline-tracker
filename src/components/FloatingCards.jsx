import { useState } from 'react'
import { useWindowSize } from '../hooks/useWindowSize'

const SETS = [
  { prefix: 'OP01', count: 120 },
  { prefix: 'OP02', count: 126 },
  { prefix: 'OP03', count: 119 },
  { prefix: 'OP04', count: 124 },
  { prefix: 'OP05', count: 124 },
  { prefix: 'OP06', count: 120 },
  { prefix: 'OP07', count: 126 },
  { prefix: 'OP08', count: 126 },
  { prefix: 'OP09', count: 126 },
  { prefix: 'OP10', count: 120 },
  { prefix: 'OP11', count: 120 },
  { prefix: 'OP12', count: 120 },
  { prefix: 'OP13', count: 120 },
  { prefix: 'OP14', count: 120 },
  { prefix: 'EB01', count: 80 },
  { prefix: 'EB02', count: 90 },
  { prefix: 'EB03', count: 80 },
  { prefix: 'ST01', count: 17 },
  { prefix: 'ST02', count: 17 },
  { prefix: 'ST03', count: 17 },
  { prefix: 'ST10', count: 20 },
  { prefix: 'ST11', count: 20 },
  { prefix: 'ST12', count: 20 },
  { prefix: 'ST13', count: 20 },
  { prefix: 'ST15', count: 20 },
  { prefix: 'ST19', count: 20 },
  { prefix: 'ST21', count: 20 },
]

const ri = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const rf = (min, max) => Math.random() * (max - min) + min
const pick = arr => arr[Math.floor(Math.random() * arr.length)]

function generateCardIds(count) {
  const ids = new Set()
  while (ids.size < count) {
    const set = pick(SETS)
    const num = ri(1, set.count)
    ids.add(`${set.prefix}-${String(num).padStart(3, '0')}`)
  }
  return [...ids]
}

// Divide screen into a 4-column × 4-row grid so cards are guaranteed to spread out.
// Columns: far-left | left-edge | right-edge | far-right
// Each card gets a unique cell, then positions are shuffled so card sizes/delays feel random.
function generatePositions(count) {
  const COLS = [
    () => ({ left:  `${rf(0,   7).toFixed(1)}%` }),   // far left
    () => ({ left:  `${rf(10, 22).toFixed(1)}%` }),   // left
    () => ({ right: `${rf(10, 22).toFixed(1)}%` }),   // right
    () => ({ right: `${rf(0,   7).toFixed(1)}%` }),   // far right
  ]
  const numCols = COLS.length
  const numRows = Math.ceil(count / numCols)

  const positions = Array.from({ length: count }, (_, i) => {
    const col = i % numCols
    const row = Math.floor(i / numCols)
    const rowH = 92 / numRows
    const topMin = 2 + row * rowH
    const topMax = topMin + rowH - 4

    return {
      top:     `${rf(topMin, topMax).toFixed(1)}%`,
      rot:     `${rf(-20, 20).toFixed(1)}deg`,
      opacity: rf(0.10, 0.18),
      dur:     `${rf(8, 14).toFixed(1)}s`,
      delay:   `${rf(0, 6).toFixed(2)}s`,
      size:    ri(60, 118),
      ...COLS[col](),
    }
  })

  // Shuffle so column order doesn't map to predictable sizes
  return positions.sort(() => Math.random() - 0.5)
}

const CARD_COUNT = 16
const CARD_IDS   = generateCardIds(CARD_COUNT)
const POSITIONS  = generatePositions(CARD_COUNT)

function FloatingCard({ cardId, position }) {
  const [errored, setErrored] = useState(false)
  const { top, left, right, rot, opacity, dur, delay, size } = position
  const url = `https://optcgapi.com/media/static/Card_Images/${cardId}.jpg`

  const posStyle = {}
  if (top   !== undefined) posStyle.top   = top
  if (left  !== undefined) posStyle.left  = left
  if (right !== undefined) posStyle.right = right

  return (
    <div
      style={{
        position: 'fixed',
        zIndex: 1,
        pointerEvents: 'none',
        '--rot': rot,
        animation: `cardFloat ${dur} ease-in-out ${delay} infinite`,
        ...posStyle,
      }}
    >
      {errored ? (
        <div style={{ width: size, height: Math.round(size * 1.4), borderRadius: 8, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)', opacity }} />
      ) : (
        <img
          src={url}
          alt=""
          width={size}
          style={{ borderRadius: 8, opacity, border: '1px solid rgba(139,92,246,0.2)', display: 'block' }}
          onError={() => setErrored(true)}
        />
      )}
    </div>
  )
}

export default function FloatingCards() {
  const { isMobile, isTablet } = useWindowSize()
  const count = isMobile ? 4 : isTablet ? 8 : 16
  return (
    <>
      {CARD_IDS.slice(0, count).map((id, i) => (
        <FloatingCard key={id} cardId={id} position={POSITIONS[i]} />
      ))}
    </>
  )
}
