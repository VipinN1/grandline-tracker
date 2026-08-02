import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCardImageUrl } from '../lib/optcgapi'
import { supabase } from '../lib/supabase'
import { useWindowSize } from '../hooks/useWindowSize'

const COLORS = {
  Red: '#d24a3a',
  Blue: '#3f8fd6',
  Green: '#3bb27e',
  Purple: '#8d7ae6',
  Yellow: '#dcb35e',
  Black: '#94a3b8',
}

function LeaderCard({ deck, onClick, onDelete }) {
  const [errored, setErrored] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const color = COLORS[deck.leader_color] ?? '#2f7da3'

  async function handleDelete(e) {
    e.stopPropagation()
    if (!confirmDelete) {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 3000)
      return
    }
    await onDelete(deck.id)
  }

  return (
    <div
      onClick={() => onClick(deck)}
      style={{ background: 'rgba(140,176,208,0.05)', border: '1px solid rgba(140,176,208,0.07)', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', transition: 'all 0.15s', position: 'relative' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(140,176,208,0.15)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(140,176,208,0.07)'; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      <div style={{ position: 'relative', height: 160, background: 'rgba(140,176,208,0.03)', overflow: 'hidden' }}>
        {!errored ? (
          <img src={getCardImageUrl(deck.leader_id)} alt={deck.leader_name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} onError={() => setErrored(true)} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 13, color, fontWeight: 600 }}>{deck.leader_name}</div>
          </div>
        )}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: color }} />
        <button
          onClick={handleDelete}
          style={{
            position: 'absolute', top: 10, left: 10,
            background: confirmDelete ? 'rgba(210,74,58,0.9)' : 'rgba(0,0,0,0.6)',
            border: `1px solid ${confirmDelete ? '#d24a3a' : 'rgba(140,176,208,0.15)'}`,
            borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700,
            color: '#fff', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
          }}
        >
          {confirmDelete ? 'Confirm?' : '✕'}
        </button>
      </div>

      <div style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#e9f1f8', marginBottom: 2 }}>{deck.name}</div>
        <div style={{ fontSize: 12, color: '#9db2c6', marginBottom: 10 }}>{deck.leader_name} · {deck.leader_id}</div>
        <div style={{ fontSize: 11, color: '#67809a' }}>
          Updated {new Date(deck.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
      </div>
    </div>
  )
}

export default function Decklists({ session }) {
  const [decks, setDecks] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const { isMobile } = useWindowSize()
  const navigate = useNavigate()

  useEffect(() => {
    if (!session) return
    loadDecks()
  }, [session])

  async function loadDecks() {
    const { data } = await supabase
      .from('decklists')
      .select('*')
      .eq('user_id', session.user.id)
      .order('updated_at', { ascending: false })
    setDecks(data ?? [])
    setLoading(false)
  }

  async function handleDelete(id) {
    await supabase.from('decklists').delete().eq('id', id)
    setDecks(prev => prev.filter(d => d.id !== id))
  }

  const filtered = decks.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.leader_name.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <div style={{ fontSize: 13, color: '#9db2c6' }}>Loading decklists...</div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.6px', color: '#dcb35e', marginBottom: 4 }}>Builds</div>
        <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 28, fontWeight: 600, color: '#e9f1f8', letterSpacing: '-0.3px', marginBottom: 2 }}>Decklists</div>
        <div style={{ fontSize: 13, color: '#9db2c6' }}>Your saved competitive builds</div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: '1.5rem', alignItems: 'center', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
        <input type="text" placeholder="Search by leader or name..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 0, background: 'rgba(140,176,208,0.05)', border: '1px solid rgba(140,176,208,0.07)', borderRadius: 8, padding: '8px 12px', color: '#e9f1f8', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
        <button onClick={() => navigate('/deck-builder')} style={{ fontSize: 12, fontWeight: 600, padding: '8px 16px', borderRadius: 8, cursor: 'pointer', border: 'none', background: 'linear-gradient(135deg, #2f7da3, #1b4a66)', color: '#fff', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>+ New Decklist</button>
      </div>

      {decks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#67809a' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🃏</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#9db2c6', marginBottom: 6 }}>No decklists saved yet</div>
          <div style={{ fontSize: 13 }}>Save a decklist when logging a tournament result</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12 }}>
          {filtered.map(deck => (
            <LeaderCard key={deck.id} deck={deck} onClick={d => navigate(`/decklists/${d.id}`)} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
