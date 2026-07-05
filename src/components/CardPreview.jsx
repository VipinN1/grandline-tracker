import { getCardImageUrl } from '../lib/optcgapi'

export default function CardPreview({ card, onClose, onSearchCommunity, onSearchMarketplace }) {
console.log('CardPreview rendering', { card, onSearchMarketplace })
  if (!card) return null
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, maxHeight: '90vh', overflowY: 'auto', padding: '20px 10px' }}>
        <img src={getCardImageUrl(card.id)} alt={card.name} style={{ width: 300, maxWidth: '85vw', borderRadius: 14, border: '2px solid rgba(255,255,255,0.15)' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f2f5' }}>{card.name}</div>
          <div style={{ fontSize: 12, color: '#7c6fa0', marginTop: 3, fontFamily: 'monospace' }}>{card.id}</div>
        </div>
<div style={{ display: 'flex', gap: 8 }}>
  <button onClick={onSearchCommunity} style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8, color: '#a78bfa', fontSize: 12, fontWeight: 600, padding: '7px 14px', cursor: 'pointer', fontFamily: 'inherit' }}>Search Community</button>
  <button onClick={onSearchMarketplace} style={{ background: 'rgba(47,125,163,0.1)', border: '1px solid rgba(47,125,163,0.3)', borderRadius: 8, color: '#52a9cd', fontSize: 12, fontWeight: 600, padding: '7px 14px', cursor: 'pointer', fontFamily: 'inherit' }}>Search Marketplace</button>
</div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#f0f2f5', fontSize: 13, fontWeight: 600, padding: '7px 24px', cursor: 'pointer', fontFamily: 'inherit' }}>Close</button>
      </div>
    </div>
  )
}