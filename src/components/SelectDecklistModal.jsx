import { useState, useEffect } from 'react'
import { getCardImageUrl } from '../lib/optcgapi'
import { supabase } from '../lib/supabase'

const COLORS = {
  Red: '#f05252', Blue: '#3d7fff', Green: '#34d399',
  Purple: '#a78bfa', Yellow: '#fbbf24', Black: '#94a3b8',
}

function LeaderCard({ deck, onClick }) {
  const [errored, setErrored] = useState(false)
  const color = COLORS[deck.leader_color] ?? '#8b5cf6'

  return (
    <div
      onClick={() => onClick(deck)}
      style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', transition: 'all 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      <div style={{ position: 'relative', height: 120, background: 'rgba(255,255,255,0.03)', overflow: 'hidden' }}>
        {!errored ? (
          <img src={getCardImageUrl(deck.leader_id)} alt={deck.leader_name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} onError={() => setErrored(true)} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 13, color, fontWeight: 600 }}>{deck.leader_name}</div>
          </div>
        )}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: color }} />
      </div>
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f2f5', marginBottom: 2 }}>{deck.name}</div>
        <div style={{ fontSize: 11, color: '#7c6fa0' }}>{deck.leader_name} · {deck.leader_id}</div>
      </div>
    </div>
  )
}

export default function SelectDecklistModal({ session, onClose, onSelect, isMobile }) {
  const [decklists, setDecklists] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('decklists').select('*').eq('user_id', session.user.id).order('updated_at', { ascending: false })
      setDecklists(data ?? [])
      setLoading(false)
    }
    load()
  }, [session])

  const filtered = decklists.filter(d =>
    d.name?.toLowerCase().includes(search.toLowerCase()) ||
    d.leader_name?.toLowerCase().includes(search.toLowerCase())
  )

  const modalBox = {
    background: '#161b27',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: isMobile ? '16px 16px 0 0' : 16,
    width: isMobile ? '100%' : 680,
    maxHeight: isMobile ? '85vh' : '80vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    animation: isMobile ? 'slideUp 0.25s ease-out' : undefined,
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }}>
      <div onClick={e => e.stopPropagation()} style={modalBox}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#8b5cf6', marginBottom: 2 }}>Builds</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f2f5', letterSpacing: '-0.3px' }}>Select a Decklist</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: '#f0f2f5', fontSize: 16, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <input type="text" placeholder="Search by leader or name..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '8px 12px', color: '#f0f2f5', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>

        {/* Grid */}
        <div style={{ overflowY: 'auto', flex: 1, padding: 16 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
              <div style={{ fontSize: 13, color: '#7c6fa0' }}>Loading decklists...</div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#3d2d6e' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🃏</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#7c6fa0', marginBottom: 4 }}>{search ? 'No decklists match your search.' : 'No saved decklists found.'}</div>
              {!search && <div style={{ fontSize: 12 }}>Save a decklist when logging a tournament result</div>}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 10 }}>
              {filtered.map(deck => (
                <LeaderCard key={deck.id} deck={deck} onClick={deck => { onSelect(deck); onClose() }} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}