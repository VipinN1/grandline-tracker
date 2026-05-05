import { useState } from 'react'
import { getCardImageUrl } from '../lib/optcgapi'

export default function CardImage({ cardId, alt, className = '', style = {} }) {
  const [errored, setErrored] = useState(false)

  if (!cardId || errored) {
    return (
      <div
        className={className}
        style={{
          background: '#1c2333',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#3a4560',
          fontSize: 11,
          fontWeight: 600,
          ...style,
        }}
      >
        {cardId ?? 'No Card'}
      </div>
    )
  }

  return (
    <img
      src={getCardImageUrl(cardId)}
      alt={alt ?? cardId}
      className={className}
      style={{ objectFit: 'cover', borderRadius: 8, ...style }}
      onError={() => setErrored(true)}
    />
  )
}