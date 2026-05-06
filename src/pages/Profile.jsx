import { useState, useEffect, useRef } from 'react'
import { getCardImageUrl } from '../lib/optcgapi'
import { supabase } from '../lib/supabase'
import { useWindowSize } from '../hooks/useWindowSize'

const COLORS = {
  Red: '#f05252',
  Blue: '#3d7fff',
  Green: '#34d399',
  Purple: '#a78bfa',
  Yellow: '#fbbf24',
  Black: '#94a3b8',
}

function placementLabel(n) {
  if (n === 1) return '1st'
  if (n === 2) return '2nd'
  if (n === 3) return '3rd'
  return `${n}th`
}

function placementStyle(n) {
  if (n === 1) return { background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }
  if (n === 2) return { background: 'rgba(148,163,184,0.1)', color: '#94a3b8' }
  if (n === 3) return { background: 'rgba(251,146,60,0.1)', color: '#fb923c' }
  return { background: 'rgba(255,255,255,0.04)', color: '#3a4560' }
}

function CardPreview({ card, onClose }) {
  if (!card) return null
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <img src={getCardImageUrl(card.id)} alt={card.name} style={{ width: 300, maxWidth: '85vw', borderRadius: 14, border: '2px solid rgba(255,255,255,0.15)' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f2f5' }}>{card.name}</div>
          <div style={{ fontSize: 12, color: '#6b7a99', marginTop: 3, fontFamily: 'monospace' }}>{card.id}</div>
        </div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#f0f2f5', fontSize: 13, fontWeight: 600, padding: '7px 24px', cursor: 'pointer', fontFamily: 'inherit' }}>Close</button>
      </div>
    </div>
  )
}

function TournamentDeckModal({ tournament, onClose, isMobile }) {
  const [selectedCard, setSelectedCard] = useState(null)
  if (!tournament) return null
  const color = COLORS[tournament.leader_color] ?? '#3d7fff'
  const cards = tournament.decklists?.cards ?? []

  const modalBox = {
    background: '#161b27',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: isMobile ? '16px 16px 0 0' : 16,
    width: isMobile ? '100%' : 560,
    maxHeight: isMobile ? '95vh' : '85vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    animation: isMobile ? 'slideUp 0.25s ease-out' : undefined,
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }}>
        <div onClick={e => e.stopPropagation()} style={modalBox}>
          <div style={{ position: 'relative', height: 120, background: '#1c2333', flexShrink: 0 }}>
            <img src={getCardImageUrl(tournament.leader_id)} alt={tournament.leader_name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 20%, #161b27 100%)' }} />
            <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: '#f0f2f5', fontSize: 16, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            <div style={{ position: 'absolute', bottom: 14, left: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f2f5' }}>{tournament.deck_name ?? 'Untitled Deck'}</div>
              <div style={{ fontSize: 12, color: '#6b7a99' }}>{tournament.leader_name} · {tournament.leader_id}</div>
            </div>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: color }} />
          </div>

          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0, ...placementStyle(tournament.placement) }}>
              {placementLabel(tournament.placement)}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f2f5' }}>{tournament.name}</div>
              <div style={{ fontSize: 11, color: '#6b7a99' }}>{tournament.date} · {tournament.player_count} players</div>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>
              <span style={{ color: '#34d399' }}>{tournament.wins}W</span>
              <span style={{ color: '#3a4560', margin: '0 3px' }}>·</span>
              <span style={{ color: '#f05252' }}>{tournament.losses}L</span>
            </div>
          </div>

          <div style={{ overflowY: 'auto', padding: 20 }}>
            {cards.length > 0 ? (
              <>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#3a4560', marginBottom: 10 }}>
                  Decklist — {cards.reduce((s, c) => s + c.count, 0)} cards · click to enlarge
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 20 }}>
                  {cards.flatMap(card =>
                    Array.from({ length: card.count }, (_, i) => (
                      <div key={`${card.id}-${i}`} onClick={() => setSelectedCard(card)} style={{ cursor: 'pointer', borderRadius: 6, transition: 'transform 0.1s' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.07)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                        <img src={getCardImageUrl(card.id)} alt={card.name} style={{ width: isMobile ? 56 : 72, borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', display: 'block' }} onError={e => { e.target.style.opacity = '0.15' }} />
                      </div>
                    ))
                  )}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#3a4560', marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Card List</div>
                {cards.map(card => (
                  <div key={card.id} onClick={() => setSelectedCard(card)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderRadius: 6, cursor: 'pointer', transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#3d7fff', fontFamily: 'monospace', minWidth: 20 }}>{card.count}×</span>
                      <span style={{ fontSize: 13, color: '#f0f2f5' }}>{card.name ?? card.id}</span>
                    </div>
                    <span style={{ fontSize: 11, color: '#3a4560', fontFamily: 'monospace' }}>{card.id}</span>
                  </div>
                ))}
              </>
            ) : (
              <div style={{ fontSize: 13, color: '#3a4560', textAlign: 'center', padding: '20px 0' }}>No decklist attached to this tournament.</div>
            )}
          </div>
        </div>
      </div>
      {selectedCard && <CardPreview card={selectedCard} onClose={() => setSelectedCard(null)} />}
    </>
  )
}

function AvatarUpload({ session, profile, onUpdate }) {
  const [uploading, setUploading] = useState(false)
  const [hovered, setHovered] = useState(false)
  const fileRef = useRef(null)

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)

    const ext = file.name.split('.').pop()
    const path = `${session.user.id}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(path)

    const urlWithBust = `${publicUrl}?t=${Date.now()}`

    await supabase
      .from('profiles')
      .update({ avatar_url: urlWithBust })
      .eq('id', session.user.id)

    onUpdate(urlWithBust)
    setUploading(false)
  }

  const initials = profile?.username?.slice(0, 2).toUpperCase() ?? 'VP'
  const avatarUrl = profile?.avatar_url

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div
        onClick={() => fileRef.current?.click()}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ width: 64, height: 64, borderRadius: 14, background: avatarUrl ? 'transparent' : '#3d7fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: '#fff', cursor: 'pointer', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.1)', position: 'relative' }}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          initials
        )}
        {hovered && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>{uploading ? '...' : 'Edit'}</span>
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} />
    </div>
  )
}

export default function Profile({ session }) {
  const [profile, setProfile] = useState(null)
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTournament, setSelectedTournament] = useState(null)
  const [activeTab, setActiveTab] = useState('history')
  const [avatarUrl, setAvatarUrl] = useState(null)
  const { isMobile } = useWindowSize()

  useEffect(() => {
    if (!session) return
    async function load() {
      setLoading(true)
      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      const { data: tournamentData } = await supabase.from('tournaments').select('*, decklists(*)').eq('user_id', session.user.id).order('date', { ascending: false })
      setProfile(profileData)
      setAvatarUrl(profileData?.avatar_url ?? null)
      setTournaments(tournamentData ?? [])
      setLoading(false)
    }
    load()
  }, [session])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <div style={{ fontSize: 13, color: '#6b7a99' }}>Loading profile...</div>
      </div>
    )
  }

  const totalWins = tournaments.reduce((s, t) => s + t.wins, 0)
  const totalLosses = tournaments.reduce((s, t) => s + t.losses, 0)
  const winRate = totalWins + totalLosses > 0 ? Math.round((totalWins / (totalWins + totalLosses)) * 100) : 0
  const topEights = tournaments.filter(t => t.placement <= 8).length
  const bestFinish = tournaments.length > 0 ? Math.min(...tournaments.map(t => t.placement)) : null
  const username = profile?.username ?? session?.user?.user_metadata?.username ?? 'Player'

  const leaderCounts = tournaments.reduce((acc, t) => {
    if (!acc[t.leader_id]) acc[t.leader_id] = { name: t.leader_name, color: t.leader_color, count: 0 }
    acc[t.leader_id].count++
    return acc
  }, {})

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : ''

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#3d7fff', marginBottom: 4 }}>Player</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#f0f2f5', letterSpacing: '-0.4px', marginBottom: 2 }}>Profile</div>
        <div style={{ fontSize: 13, color: '#6b7a99' }}>Your public player page</div>
      </div>

      {/* Profile header — row on desktop, column on mobile */}
      <div style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: isMobile ? 16 : 24, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? 14 : 20, flexDirection: isMobile ? 'row' : 'row' }}>
          <AvatarUpload
            session={session}
            profile={{ ...profile, avatar_url: avatarUrl }}
            onUpdate={url => setAvatarUrl(url)}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: isMobile ? 17 : 20, fontWeight: 700, color: '#f0f2f5', letterSpacing: '-0.3px' }}>{username}</div>
            <div style={{ fontSize: 12, color: '#6b7a99', marginTop: 3 }}>
              {profile?.location && `${profile.location} · `}
              {memberSince && `Since ${memberSince}`}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {bestFinish === 1 && <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>1st Place</span>}
              <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, background: 'rgba(61,127,255,0.1)', color: '#3d7fff', border: '1px solid rgba(61,127,255,0.2)' }}>{tournaments.length} Events</span>
              {topEights > 0 && <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>Top 8 ×{topEights}</span>}
              {/* Win rate badge on mobile instead of separate block */}
              {isMobile && <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', color: '#f0f2f5', border: '1px solid rgba(255,255,255,0.1)' }}>{winRate}% WR</span>}
            </div>
          </div>
          {!isMobile && (
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: '#f0f2f5', letterSpacing: '-1px', lineHeight: 1 }}>{winRate}%</div>
              <div style={{ fontSize: 12, color: '#6b7a99', marginTop: 4 }}>win rate</div>
              <div style={{ fontSize: 13, color: '#3a4560', marginTop: 2, fontFamily: 'monospace' }}>{totalWins}W · {totalLosses}L</div>
            </div>
          )}
        </div>
      </div>

      {/* Stats row — 2×2 on mobile, 4×1 on desktop */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
        {[
          { label: 'Tournaments', value: tournaments.length },
          { label: 'Top 8s', value: topEights },
          { label: 'Best Finish', value: bestFinish ? placementLabel(bestFinish) : '—' },
          { label: 'Fav. Leader', value: Object.values(leaderCounts).sort((a, b) => b.count - a.count)[0]?.name.split(' ').slice(-1)[0] ?? '—' },
        ].map(s => (
          <div key={s.label} style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: isMobile ? '12px 14px' : '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#6b7a99', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: '#f0f2f5', letterSpacing: '-0.5px' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, borderBottom: '1px solid rgba(255,255,255,0.07)', flexWrap: 'wrap' }}>
        {[['history', 'Tournament History'], ['leaders', 'Leaders Played']].map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: activeTab === tab ? '#161b27' : 'transparent', color: activeTab === tab ? '#f0f2f5' : '#6b7a99', borderBottom: activeTab === tab ? '2px solid #3d7fff' : '2px solid transparent', transition: 'all 0.1s' }}>
            {label}
          </button>
        ))}
        <button style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 8, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#6b7a99', fontFamily: 'inherit', alignSelf: 'center' }}>
          Export CSV
        </button>
      </div>

      {tournaments.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#3a4560' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏆</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#6b7a99', marginBottom: 6 }}>No tournaments logged yet</div>
          <div style={{ fontSize: 13 }}>Head to Log Result to record your first event</div>
        </div>
      )}

      {/* History tab */}
      {activeTab === 'history' && tournaments.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tournaments.map(t => (
            <div
              key={t.id}
              onClick={() => setSelectedTournament(t)}
              style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: isMobile ? '10px 12px' : '12px 16px', display: 'grid', gridTemplateColumns: isMobile ? '36px 1fr auto' : '44px 1fr auto auto', alignItems: 'center', gap: isMobile ? 10 : 16, cursor: 'pointer', transition: 'all 0.1s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.background = '#1c2333' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.background = '#161b27' }}
            >
              <div style={{ width: isMobile ? 30 : 36, height: isMobile ? 30 : 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? 11 : 13, fontWeight: 700, flexShrink: 0, ...placementStyle(t.placement) }}>
                {placementLabel(t.placement)}
              </div>
              <div>
                <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 600, color: '#f0f2f5' }}>{t.name}</div>
                <div style={{ fontSize: 11, color: '#6b7a99', marginTop: 1 }}>{t.date} · {t.player_count} players</div>
              </div>
              {!isMobile && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#1c2333', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '6px 12px 6px 8px' }}>
                  <img src={getCardImageUrl(t.leader_id)} alt={t.leader_name} style={{ width: 28, height: 38, objectFit: 'cover', objectPosition: 'top', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)' }} onError={e => { e.target.style.display = 'none' }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#f0f2f5' }}>{t.leader_name}</div>
                    <div style={{ fontSize: 11, color: COLORS[t.leader_color] ?? '#6b7a99' }}>{t.leader_color} · {t.leader_id}</div>
                  </div>
                </div>
              )}
              <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                <span style={{ color: '#34d399' }}>{t.wins}W</span>
                <span style={{ color: '#3a4560', margin: '0 3px' }}>·</span>
                <span style={{ color: '#f05252' }}>{t.losses}L</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Leaders tab — 1 column on mobile, 3 on desktop */}
      {activeTab === 'leaders' && tournaments.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12 }}>
          {Object.entries(leaderCounts).map(([id, data]) => {
            const leaderTournaments = tournaments.filter(t => t.leader_id === id)
            return (
              <div key={id} style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden', transition: 'all 0.15s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.transform = 'translateY(-2px)' }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.transform = 'translateY(0)' }}>
                <div style={{ position: 'relative', height: isMobile ? 100 : 140 }}>
                  <img src={getCardImageUrl(id)} alt={data.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: COLORS[data.color] ?? '#3d7fff' }} />
                  <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.6)', border: `1px solid ${COLORS[data.color]}44`, borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700, color: COLORS[data.color] }}>{data.color}</div>
                </div>
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f2f5' }}>{data.name}</div>
                  <div style={{ fontSize: 11, color: '#6b7a99', marginTop: 2, fontFamily: 'monospace' }}>{id}</div>
                  <div style={{ fontSize: 12, color: '#3a4560', marginTop: 6, marginBottom: 10 }}>
                    <span style={{ color: '#6b7a99', fontWeight: 600 }}>{data.count}</span> events played
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {leaderTournaments.map(t => (
                      <div key={t.id} onClick={() => setSelectedTournament(t)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderRadius: 6, background: '#1c2333', cursor: 'pointer', transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.background = '#212d40'} onMouseLeave={e => e.currentTarget.style.background = '#1c2333'}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#f0f2f5' }}>{t.name}</div>
                          <div style={{ fontSize: 10, color: '#6b7a99', marginTop: 1 }}>{t.date}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          <div style={{ width: 24, height: 24, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, ...placementStyle(t.placement) }}>
                            {placementLabel(t.placement)}
                          </div>
                          <div style={{ fontSize: 11, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                            <span style={{ color: '#34d399' }}>{t.wins}W</span>
                            <span style={{ color: '#3a4560', margin: '0 2px' }}>·</span>
                            <span style={{ color: '#f05252' }}>{t.losses}L</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selectedTournament && (
        <TournamentDeckModal tournament={selectedTournament} onClose={() => setSelectedTournament(null)} isMobile={isMobile} />
      )}
    </div>
  )
}
