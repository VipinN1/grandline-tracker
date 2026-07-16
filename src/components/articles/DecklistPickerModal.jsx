import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { getCardImageUrl } from '../../lib/optcgapi'
import { parseDecklistText } from '../../lib/articles'
import { useWindowSize } from '../../hooks/useWindowSize'
import { colors, radius, input as inputStyle, btnPrimary } from '../../theme'

const LEADER_COLORS = {
  Red: '#d24a3a', Blue: '#3f8fd6', Green: '#3bb27e',
  Purple: '#8d7ae6', Yellow: '#dcb35e', Black: '#94a3b8',
}

// Pick one of the user's saved decklists, or paste a raw list.
// onSelect receives { name, leaderId, leaderName, leaderColor, cards: [{id, name, count}] }
export default function DecklistPickerModal({ session, onClose, onSelect }) {
  const [tab, setTab] = useState(session ? 'saved' : 'paste')
  const [decklists, setDecklists] = useState([])
  const [loading, setLoading] = useState(!!session)
  const [search, setSearch] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [pasteName, setPasteName] = useState('')
  const { isMobile } = useWindowSize()

  useEffect(() => {
    if (!session) return
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

  const parsed = parseDecklistText(pasteText)
  const parsedTotal = parsed.cards.reduce((s, c) => s + c.count, 0)

  function pickSaved(deck) {
    onSelect({
      name: deck.name,
      leaderId: deck.leader_id,
      leaderName: deck.leader_name,
      leaderColor: deck.leader_color,
      cards: (deck.cards ?? []).map(c => ({ id: c.id, name: c.name ?? null, count: c.count ?? 1 })),
    })
    onClose()
  }

  function pickPasted() {
    if (parsed.cards.length === 0) return
    onSelect({
      name: pasteName.trim() || 'Decklist',
      leaderId: null,
      leaderName: null,
      leaderColor: null,
      cards: parsed.cards,
    })
    onClose()
  }

  const tabBtn = active => ({
    flex: 1,
    padding: '10px 12px',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.4px',
    textTransform: 'uppercase',
    color: active ? colors.gold : colors.faint,
    background: active ? colors.goldSoft : 'transparent',
    border: 'none',
    borderBottom: active ? `2px solid ${colors.brass}` : '2px solid transparent',
    cursor: 'pointer',
    fontFamily: 'inherit',
  })

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#161b27',
          border: `1px solid ${colors.line}`,
          borderRadius: isMobile ? '16px 16px 0 0' : radius.lg,
          width: isMobile ? '100%' : 680,
          maxHeight: isMobile ? '85vh' : '80vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '18px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.6px', color: colors.gold, marginBottom: 2 }}>Builds</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: colors.text, letterSpacing: '-0.3px' }}>Embed a Decklist</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(0,0,0,0.5)', border: `1px solid ${colors.lineStrong}`, borderRadius: 6, color: colors.text, fontSize: 16, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        <div style={{ display: 'flex', borderBottom: `1px solid ${colors.line}`, marginTop: 12, flexShrink: 0 }}>
          <button style={tabBtn(tab === 'saved')} onClick={() => setTab('saved')}>My Decklists</button>
          <button style={tabBtn(tab === 'paste')} onClick={() => setTab('paste')}>Paste a List</button>
        </div>

        {tab === 'saved' ? (
          <>
            <div style={{ padding: '12px 24px', borderBottom: `1px solid ${colors.line}`, flexShrink: 0 }}>
              <input type="text" placeholder="Search by leader or name..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, fontSize: 13 }} />
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: 16 }}>
              {!session ? (
                <div style={{ textAlign: 'center', padding: '50px 20px', color: colors.faint, fontSize: 13 }}>Log in to use your saved decklists.</div>
              ) : loading ? (
                <div style={{ textAlign: 'center', padding: '50px 20px', fontSize: 13, color: colors.muted }}>Loading decklists…</div>
              ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px 20px', color: colors.faint }}>
                  <div style={{ fontSize: 30, marginBottom: 10 }}>🃏</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: colors.muted }}>
                    {search ? 'No decklists match your search.' : 'No saved decklists — try pasting a list instead.'}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 10 }}>
                  {filtered.map(deck => {
                    const color = LEADER_COLORS[deck.leader_color] ?? colors.ocean
                    return (
                      <div
                        key={deck.id}
                        onClick={() => pickSaved(deck)}
                        style={{ background: 'rgba(140,176,208,0.05)', border: `1px solid ${colors.line}`, borderRadius: 14, overflow: 'hidden', cursor: 'pointer', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = colors.lineStrong; e.currentTarget.style.transform = 'translateY(-2px)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = colors.line; e.currentTarget.style.transform = 'translateY(0)' }}
                      >
                        <div style={{ position: 'relative', height: 100, background: 'rgba(140,176,208,0.03)', overflow: 'hidden' }}>
                          <img src={getCardImageUrl(deck.leader_id)} alt={deck.leader_name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} onError={e => { e.target.style.opacity = '0.1' }} />
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: color }} />
                        </div>
                        <div style={{ padding: '9px 11px' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: colors.text, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deck.name}</div>
                          <div style={{ fontSize: 11, color: colors.muted }}>{deck.leader_name} · {deck.leader_id}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ overflowY: 'auto', flex: 1, padding: '16px 24px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.7px', color: colors.muted, marginBottom: 6, display: 'block' }}>Decklist Name</label>
              <input type="text" placeholder="e.g. Red Shanks — Regional Top 8" value={pasteName} onChange={e => setPasteName(e.target.value)} style={{ ...inputStyle, fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.7px', color: colors.muted, marginBottom: 6, display: 'block' }}>Paste List</label>
              <textarea
                placeholder={'One card per line, e.g.\n1xOP05-098\n4xOP01-016\n4 ST01-006'}
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                rows={9}
                style={{ ...inputStyle, fontSize: 13, fontFamily: "'Space Mono', ui-monospace, monospace", resize: 'vertical', lineHeight: 1.5 }}
              />
            </div>
            {pasteText.trim() && (
              <div style={{ fontSize: 12, color: parsed.cards.length ? colors.emerald : colors.crimson }}>
                {parsed.cards.length
                  ? `Parsed ${parsed.cards.length} unique cards · ${parsedTotal} total`
                  : 'No cards recognized — expected lines like "4xOP01-016".'}
                {parsed.errors.length > 0 && (
                  <span style={{ color: colors.orange }}> · {parsed.errors.length} line{parsed.errors.length > 1 ? 's' : ''} skipped</span>
                )}
              </div>
            )}
            <button
              onClick={pickPasted}
              disabled={parsed.cards.length === 0}
              style={{ ...btnPrimary, opacity: parsed.cards.length === 0 ? 0.45 : 1, cursor: parsed.cards.length === 0 ? 'default' : 'pointer', alignSelf: 'flex-start' }}
            >
              Embed Decklist
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
