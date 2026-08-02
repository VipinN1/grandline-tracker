import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getCardImageUrl, enrichCards } from '../lib/optcgapi'
import { decklistToText } from '../lib/articles'
import { supabase } from '../lib/supabase'
import { useWindowSize } from '../hooks/useWindowSize'
import CardPreview from '../components/CardPreview'
import DeckShareOverlay from '../components/DeckShareOverlay'
import { colors, radius, shadow, font, btnPrimary, btnGhost } from '../theme'

const LEADER_COLORS = {
  Red: '#d24a3a', Blue: '#3f8fd6', Green: '#3bb27e',
  Purple: '#8d7ae6', Yellow: '#dcb35e', Black: '#94a3b8',
}

function computeStats(cards) {
  const costBuckets = {}
  let charCount = 0, eventCount = 0, stageCount = 0
  const colorCounts = {}
  for (const c of cards) {
    if (c.cost != null) {
      const bucket = Math.min(c.cost, 10)
      costBuckets[bucket] = (costBuckets[bucket] ?? 0) + c.count
    }
    if (c.type === 'Character') charCount += c.count
    else if (c.type === 'Event') eventCount += c.count
    else if (c.type === 'Stage') stageCount += c.count
    if (c.color) {
      for (const col of c.color.split(/[\s/]+/).filter(Boolean)) {
        colorCounts[col] = (colorCounts[col] ?? 0) + c.count
      }
    }
  }
  return { costBuckets, charCount, eventCount, stageCount, colorCounts }
}

export default function DecklistPage({ session }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isMobile } = useWindowSize()

  const [deck, setDeck] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [selectedCard, setSelectedCard] = useState(null)
  const [showShare, setShowShare] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedText, setCopiedText] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data } = await supabase.from('decklists').select('*').eq('id', id).single()
      if (cancelled) return
      if (!data) { setNotFound(true); setLoading(false); return }
      const enriched = await enrichCards(data.cards ?? [])
      if (cancelled) return
      setDeck({ ...data, cards: enriched })
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [id])

  function copyLink() {
    navigator.clipboard?.writeText(window.location.href).catch(() => {})
    setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000)
  }

  function copyText() {
    navigator.clipboard?.writeText(decklistToText(deck.cards)).catch(() => {})
    setCopiedText(true); setTimeout(() => setCopiedText(false), 2000)
  }

  function editDeck() {
    navigate('/deck-builder', { state: { deck } })
  }

  async function saveToProfile() {
    if (!session) { navigate('/login'); return }
    setSaving(true)
    const { data, error } = await supabase.from('decklists').insert({
      user_id: session.user.id,
      name: deck.name,
      leader_id: deck.leader_id,
      leader_name: deck.leader_name,
      leader_color: deck.leader_color,
      cards: deck.cards.map(c => ({ id: c.id, name: c.name, count: c.count, type: c.type, color: c.color, image: c.image, cost: c.cost })),
    }).select().single()
    setSaving(false)
    if (!error && data) navigate(`/decklists/${data.id}`)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <div style={{ fontSize: 13, color: colors.muted }}>Loading decklist...</div>
      </div>
    )
  }

  if (notFound || !deck) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', color: colors.faint }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🃏</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: colors.muted, marginBottom: 6 }}>Decklist not found</div>
        <div style={{ fontSize: 13 }}>It may have been deleted, or the link is incorrect.</div>
      </div>
    )
  }

  const color = LEADER_COLORS[deck.leader_color] ?? colors.ocean
  const cards = deck.cards
  const totalCards = cards.reduce((s, c) => s + c.count, 0)
  const isOwner = session && session.user.id === deck.user_id
  const stats = computeStats(cards)
  const maxCostCount = Math.max(1, ...Object.values(stats.costBuckets))

  const characters = cards.filter(c => c.type === 'Character')
  const events = cards.filter(c => c.type === 'Event')
  const stages = cards.filter(c => c.type === 'Stage')
  const others = cards.filter(c => !['Character', 'Event', 'Stage'].includes(c.type))

  return (
    <div>
      {/* Header banner */}
      <div style={{ position: 'relative', height: isMobile ? 160 : 220, borderRadius: radius.lg, overflow: 'hidden', marginBottom: 16, border: `1px solid ${colors.line}`, boxShadow: shadow.md }}>
        <img src={getCardImageUrl(deck.leader_id)} alt={deck.leader_name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 22%' }} onError={e => { e.target.style.opacity = '0.2' }} />
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top, ${colors.abyss} 5%, rgba(6,16,27,0.35) 60%, rgba(6,16,27,0.15) 100%)` }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: color }} />
        <div style={{ position: 'absolute', bottom: 16, left: 20, right: 20 }}>
          <div style={{ fontSize: isMobile ? 20 : 26, fontWeight: 700, color: colors.text, fontFamily: font.display, letterSpacing: '-0.3px' }}>{deck.name}</div>
          <div style={{ fontSize: 13, color: colors.textSoft, marginTop: 2 }}>{deck.leader_name} · {deck.leader_id} · {totalCards} cards</div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {isOwner ? (
          <button onClick={editDeck} style={{ ...btnPrimary }}>✎ Edit Decklist</button>
        ) : (
          <button onClick={saveToProfile} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1, cursor: saving ? 'default' : 'pointer' }}>
            {saving ? 'Saving...' : '+ Save to My Decklists'}
          </button>
        )}
        <button onClick={() => setShowShare(true)} style={btnGhost}>↗ Share Image</button>
        <button onClick={copyLink} style={btnGhost}>{copiedLink ? '✓ Link Copied' : '🔗 Copy Link'}</button>
        <button onClick={copyText} style={btnGhost}>{copiedText ? '✓ Copied' : 'Copy Decklist'}</button>
      </div>

      {/* Stats strip */}
      <div style={{ background: colors.surface, border: `1px solid ${colors.line}`, borderRadius: radius.md, padding: isMobile ? 16 : 20, marginBottom: 20 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: colors.faint, marginBottom: 12 }}>Deck Stats</div>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 20 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: colors.faint, marginBottom: 8 }}>Cost Curve</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 60 }}>
              {Array.from({ length: 11 }, (_, cost) => {
                const n = stats.costBuckets[cost] ?? 0
                return (
                  <div key={cost} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                    <div title={`Cost ${cost}: ${n}`} style={{ width: '100%', height: `${Math.max(n > 0 ? 8 : 0, (n / maxCostCount) * 48)}px`, background: n > 0 ? `linear-gradient(180deg, ${colors.oceanBright}, ${colors.ocean})` : 'transparent', borderRadius: '3px 3px 0 0' }} />
                    <div style={{ fontSize: 10, color: colors.faint, marginTop: 4, fontFamily: font.mono }}>{cost}</div>
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {[
              { label: 'Character', value: stats.charCount },
              { label: 'Event', value: stats.eventCount },
              { label: 'Stage', value: stats.stageCount },
            ].map(s => (
              <div key={s.label} style={{ background: 'rgba(140,176,208,0.04)', borderRadius: radius.sm, padding: '10px 14px', textAlign: 'center', minWidth: 76 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: colors.text, fontFamily: font.mono }}>{s.value}</div>
                <div style={{ fontSize: 9.5, color: colors.faint, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {Object.keys(stats.colorCounts).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${colors.line}` }}>
            {Object.entries(stats.colorCounts).sort((a, b) => b[1] - a[1]).map(([col, n]) => (
              <div key={col} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(140,176,208,0.04)', borderRadius: radius.pill, padding: '4px 10px' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: LEADER_COLORS[col] ?? colors.faint }} />
                <span style={{ fontSize: 11, color: colors.textSoft }}>{col}</span>
                <span style={{ fontSize: 11, color: colors.faint, fontFamily: font.mono }}>{n}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* All cards grid */}
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: colors.faint, marginBottom: 10 }}>
        All Cards ({totalCards}) — click to enlarge
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
        {cards.flatMap(card =>
          Array.from({ length: card.count }, (_, i) => (
            <div key={`${card.id}-${i}`} onClick={() => setSelectedCard(card)} style={{ cursor: 'pointer', borderRadius: 6, transition: 'transform 0.1s' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.07)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
              <img src={getCardImageUrl(card.id)} alt={card.name} style={{ width: isMobile ? 56 : 70, borderRadius: 6, border: `1px solid ${colors.line}`, display: 'block' }} onError={e => { e.target.style.opacity = '0.15' }} />
            </div>
          ))
        )}
      </div>

      {[['Characters', characters], ['Events', events], ['Stages', stages], ['Other', others]].map(([label, group]) =>
        group.length > 0 ? (
          <div key={label} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: colors.faint, marginBottom: 6, paddingBottom: 4, borderBottom: `1px solid ${colors.line}` }}>
              {label} ({group.reduce((s, c) => s + c.count, 0)})
            </div>
            {group.map(card => (
              <div key={card.id} onClick={() => setSelectedCard(card)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', borderRadius: 6, cursor: 'pointer', transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(140,176,208,0.04)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: colors.ocean, fontFamily: font.mono, minWidth: 20 }}>{card.count}×</span>
                  <span style={{ fontSize: 13, color: colors.text }}>{card.name ?? card.id}</span>
                </div>
                <span style={{ fontSize: 11, color: colors.faint, fontFamily: font.mono }}>{card.id}</span>
              </div>
            ))}
          </div>
        ) : null
      )}

      {selectedCard && (
        <CardPreview
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          onSearchMarketplace={() => { navigate('/marketplace', { state: { search: selectedCard.name } }); setSelectedCard(null) }}
        />
      )}

      {showShare && (
        <DeckShareOverlay deck={deck} stats={stats} onClose={() => setShowShare(false)} isMobile={isMobile} />
      )}
    </div>
  )
}
