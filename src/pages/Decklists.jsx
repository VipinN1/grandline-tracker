import { useState, useEffect } from 'react'
import { getCardImageUrl } from '../lib/optcgapi'
import { supabase } from '../lib/supabase'

const COLORS = {
  Red: '#f05252',
  Blue: '#3d7fff',
  Green: '#34d399',
  Purple: '#a78bfa',
  Yellow: '#fbbf24',
  Black: '#94a3b8',
}

function CardPreview({ card, onClose }) {
  if (!card) return null
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <img src={getCardImageUrl(card.id)} alt={card.name} style={{ width: 300, borderRadius: 14, border: '2px solid rgba(255,255,255,0.15)' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f2f5' }}>{card.name}</div>
          <div style={{ fontSize: 12, color: '#6b7a99', marginTop: 3, fontFamily: 'monospace' }}>{card.id}</div>
        </div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#f0f2f5', fontSize: 13, fontWeight: 600, padding: '7px 24px', cursor: 'pointer', fontFamily: 'inherit' }}>Close</button>
      </div>
    </div>
  )
}

function DeckModal({ deck, onClose }) {
  const [selectedCard, setSelectedCard] = useState(null)
  if (!deck) return null
  const color = COLORS[deck.leader_color] ?? '#3d7fff'
  const cards = deck.cards ?? []
  const characters = cards.filter(c => c.type === 'Character')
  const events = cards.filter(c => c.type === 'Event')
  const stages = cards.filter(c => c.type === 'Stage')
  const others = cards.filter(c => !['Character', 'Event', 'Stage'].includes(c.type))

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div onClick={e => e.stopPropagation()} style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, width: 700, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ position: 'relative', height: 120, background: '#1c2333', flexShrink: 0 }}>
            <img src={getCardImageUrl(deck.leader_id)} alt={deck.leader_name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 20%, #161b27 100%)' }} />
            <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: '#f0f2f5', fontSize: 16, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            <div style={{ position: 'absolute', bottom: 14, left: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f2f5' }}>{deck.name}</div>
              <div style={{ fontSize: 12, color: '#6b7a99' }}>{deck.leader_name} · {deck.leader_id}</div>
            </div>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: color }} />
          </div>

          <div style={{ overflowY: 'auto', padding: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#3a4560', marginBottom: 10 }}>
              All Cards ({cards.reduce((s, c) => s + c.count, 0)}) — click to enlarge
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
              {cards.flatMap(card =>
                Array.from({ length: card.count }, (_, i) => (
                  <div key={`${card.id}-${i}`} onClick={() => setSelectedCard(card)} style={{ cursor: 'pointer', borderRadius: 6, transition: 'transform 0.1s' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.07)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                    <img src={getCardImageUrl(card.id)} alt={card.name} style={{ width: 70, borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', display: 'block' }} onError={e => { e.target.style.opacity = '0.15' }} />
                  </div>
                ))
              )}
            </div>

            {[['Characters', characters], ['Events', events], ['Stages', stages], ['Other', others]].map(([label, group]) =>
              group.length > 0 ? (
                <div key={label} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#3a4560', marginBottom: 6, paddingBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {label} ({group.reduce((s, c) => s + c.count, 0)})
                  </div>
                  {group.map(card => (
                    <div key={card.id} onClick={() => setSelectedCard(card)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', borderRadius: 6, cursor: 'pointer', transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#3d7fff', fontFamily: 'monospace', minWidth: 20 }}>{card.count}×</span>
                        <span style={{ fontSize: 13, color: '#f0f2f5' }}>{card.name ?? card.id}</span>
                      </div>
                      <span style={{ fontSize: 11, color: '#3a4560', fontFamily: 'monospace' }}>{card.id}</span>
                    </div>
                  ))}
                </div>
              ) : null
            )}
          </div>

          <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
            <button style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#f0f2f5', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Copy Decklist
            </button>
          </div>
        </div>
      </div>
      {selectedCard && <CardPreview card={selectedCard} onClose={() => setSelectedCard(null)} />}
    </>
  )
}

function LeaderCard({ deck, onClick, onDelete }) {
  const [errored, setErrored] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const color = COLORS[deck.leader_color] ?? '#3d7fff'

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
      style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', transition: 'all 0.15s', position: 'relative' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      <div style={{ position: 'relative', height: 160, background: '#1c2333', overflow: 'hidden' }}>
        {!errored ? (
          <img src={getCardImageUrl(deck.leader_id)} alt={deck.leader_name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} onError={() => setErrored(true)} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 13, color, fontWeight: 600 }}>{deck.leader_name}</div>
          </div>
        )}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: color }} />
        <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.6)', border: `1px solid ${color}44`, borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700, color }}>
          {deck.leader_color}
        </div>
        <button
          onClick={handleDelete}
          style={{
            position: 'absolute', top: 10, left: 10,
            background: confirmDelete ? 'rgba(240,82,82,0.9)' : 'rgba(0,0,0,0.6)',
            border: `1px solid ${confirmDelete ? '#f05252' : 'rgba(255,255,255,0.15)'}`,
            borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700,
            color: '#fff', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
          }}
        >
          {confirmDelete ? 'Confirm?' : '✕'}
        </button>
      </div>

      <div style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f2f5', marginBottom: 2 }}>{deck.name}</div>
        <div style={{ fontSize: 12, color: '#6b7a99', marginBottom: 10 }}>{deck.leader_name} · {deck.leader_id}</div>
        <div style={{ fontSize: 11, color: '#3a4560' }}>
          Updated {new Date(deck.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
      </div>
    </div>
  )
}

export default function Decklists({ session }) {
  const [decks, setDecks] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDeck, setSelectedDeck] = useState(null)
  const [search, setSearch] = useState('')

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
        <div style={{ fontSize: 13, color: '#6b7a99' }}>Loading decklists...</div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#3d7fff', marginBottom: 4 }}>Builds</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#f0f2f5', letterSpacing: '-0.4px', marginBottom: 2 }}>Decklists</div>
        <div style={{ fontSize: 13, color: '#6b7a99' }}>Your saved competitive builds</div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: '1.5rem', alignItems: 'center' }}>
        <input type="text" placeholder="Search by leader or name..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, maxWidth: 300, background: '#161b27', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '8px 12px', color: '#f0f2f5', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
        <button style={{ fontSize: 12, fontWeight: 600, padding: '8px 16px', borderRadius: 8, cursor: 'pointer', border: 'none', background: '#3d7fff', color: '#fff', fontFamily: 'inherit' }}>+ New Decklist</button>
      </div>

      {decks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#3a4560' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🃏</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#6b7a99', marginBottom: 6 }}>No decklists saved yet</div>
          <div style={{ fontSize: 13 }}>Save a decklist when logging a tournament result</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {filtered.map(deck => (
            <LeaderCard key={deck.id} deck={deck} onClick={setSelectedDeck} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {selectedDeck && <DeckModal deck={selectedDeck} onClose={() => setSelectedDeck(null)} />}
    </div>
  )
}