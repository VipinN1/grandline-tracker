import { useState } from 'react'

const CARD_IDS = [
  'OP01-001', 'OP01-060', 'OP02-001', 'OP03-001', 'OP04-001', 'OP05-001',
  'OP06-001', 'ST01-001', 'ST02-001', 'OP08-001', 'OP07-001', 'OP09-001',
]

const POSITIONS = [
  { top: '4%',  left: '1%',   rot: '-15deg', opacity: 0.07, dur: '8s',   delay: '0s',    size: 78 },
  { top: '12%', right: '2%',  rot: '12deg',  opacity: 0.05, dur: '11s',  delay: '1.2s',  size: 72 },
  { top: '38%', left: '3%',   rot: '-8deg',  opacity: 0.06, dur: '9s',   delay: '2.5s',  size: 82 },
  { top: '68%', left: '0%',   rot: '18deg',  opacity: 0.05, dur: '12s',  delay: '0.8s',  size: 70 },
  { top: '82%', right: '3%',  rot: '-12deg', opacity: 0.07, dur: '10s',  delay: '3s',    size: 76 },
  { top: '54%', right: '1%',  rot: '20deg',  opacity: 0.04, dur: '7s',   delay: '1.5s',  size: 68 },
  { top: '22%', left: '7%',   rot: '-5deg',  opacity: 0.06, dur: '9.5s', delay: '4s',    size: 80 },
  { top: '91%', left: '38%',  rot: '8deg',   opacity: 0.05, dur: '11s',  delay: '2s',    size: 74 },
  { top: '8%',  left: '52%',  rot: '-18deg', opacity: 0.04, dur: '8.5s', delay: '0.5s',  size: 70 },
  { top: '62%', left: '48%',  rot: '15deg',  opacity: 0.05, dur: '10s',  delay: '3.5s',  size: 76 },
  { top: '32%', right: '8%',  rot: '-10deg', opacity: 0.06, dur: '9s',   delay: '1s',    size: 80 },
  { top: '76%', left: '22%',  rot: '5deg',   opacity: 0.04, dur: '12s',  delay: '4.5s',  size: 72 },
]

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
