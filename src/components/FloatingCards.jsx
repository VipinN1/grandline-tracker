import { useState } from 'react'

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
  { prefix: 'ST04', count: 17 },
  { prefix: 'ST06', count: 17 },
  { prefix: 'ST10', count: 20 },
  { prefix: 'ST11', count: 20 },
  { prefix: 'ST12', count: 20 },
  { prefix: 'ST13', count: 20 },
  { prefix: 'ST15', count: 20 },
  { prefix: 'ST16', count: 20 },
  { prefix: 'ST17', count: 20 },
  { prefix: 'ST18', count: 20 },
  { prefix: 'ST19', count: 20 },
  { prefix: 'ST20', count: 20 },
  { prefix: 'ST21', count: 20 },
]

const ri = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const rf = (min, max) => (Math.random() * (max - min) + min)
const pick = arr => arr[Math.floor(Math.random() * arr.length)]

function generateCardIds(count) {
  const ids = new Set()
  let attempts = 0
  while (ids.size < count && attempts < count * 10) {
    const set = pick(SETS)
    const num = ri(1, set.count)
    ids.add(`${set.prefix}-${String(num).padStart(3, '0')}`)
    attempts++
  }
  return [...ids]
}

function generatePositions(count) {
  // Divide the screen into loose vertical bands to avoid clustering
  return Array.from({ length: count }, (_, i) => {
    const size = ri(52, 130)
    const useRight = Math.random() > 0.55
    const topPct = rf(2, 94)
    const pos = {
      top: `${topPct.toFixed(1)}%`,
      rot: `${rf(-24, 24).toFixed(1)}deg`,
      opacity: rf(0.04, 0.10),
      dur: `${rf(7, 15).toFixed(1)}s`,
      delay: `${rf(0, 6).toFixed(2)}s`,
      size,
    }
    if (useRight) {
      pos.right = `${rf(0, 11).toFixed(1)}%`
    } else {
      pos.left = `${rf(0, 13).toFixed(1)}%`
    }
    return pos
  })
}

const CARD_COUNT = 16
const CARD_IDS = generateCardIds(CARD_COUNT)
const POSITIONS = generatePositions(CARD_COUNT)

function FloatingCard({ cardId, position }) {
  const [errored, setErrored] = useState(false)
  const { top, left, right, bottom, rot, opacity, dur, delay, size } = position
  const url = `https://optcgapi.com/media/static/Card_Images/${cardId}.jpg`

  const posStyle = {}
  if (top !== undefined) posStyle.top = top
  if (left !== undefined) posStyle.left = left
  if (right !== undefined) posStyle.right = right
  if (bottom !== undefined) posStyle.bottom = bottom

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
  return (
    <>
      {CARD_IDS.map((id, i) => (
        <FloatingCard key={id} cardId={id} position={POSITIONS[i]} />
      ))}
    </>
  )
}
