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

function wrColor(wr) {
  if (wr >= 65) return '#34d399'
  if (wr >= 50) return '#6b7a99'
  return '#f05252'
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

function FriendModal({ friend, onClose }) {
  const [tournaments, setTournaments] = useState([])
  const [selectedTournament, setSelectedTournament] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('tournaments')
        .select('*, decklists(*)')
        .eq('user_id', friend.id)
        .order('date', { ascending: false })
      setTournaments(data ?? [])
      setLoading(false)
    }
    load()
  }, [friend.id])

  const totalWins = tournaments.reduce((s, t) => s + t.wins, 0)
  const totalLosses = tournaments.reduce((s, t) => s + t.losses, 0)
  const winRate = totalWins + totalLosses > 0 ? Math.round((totalWins / (totalWins + totalLosses)) * 100) : 0
  const topEights = tournaments.filter(t => t.placement <= 8).length
  const initials = friend.username.slice(0, 2).toUpperCase()

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div onClick={e => e.stopPropagation()} style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, width: 580, maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
            <div style={{ width: 52, height: 52, borderRadius: 12, background: '#3d7fff22', border: '1px solid #3d7fff44', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#3d7fff', flexShrink: 0 }}>
              {initials}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#f0f2f5' }}>{friend.username}</div>
              {friend.location && <div style={{ fontSize: 12, color: '#6b7a99', marginTop: 2 }}>{friend.location}</div>}
            </div>
            <button onClick={onClose} style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#6b7a99', fontSize: 16, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>

          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
            {[['Win Rate', `${winRate}%`], ['Events', tournaments.length], ['Top 8s', topEights]].map(([label, val]) => (
              <div key={label} style={{ flex: 1, padding: '12px 16px', borderRight: '1px solid rgba(255,255,255,0.07)', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#6b7a99', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: label === 'Win Rate' ? wrColor(winRate) : '#f0f2f5' }}>{val}</div>
              </div>
            ))}
          </div>

          <div style={{ overflowY: 'auto', padding: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#3a4560', marginBottom: 12 }}>
              Tournament History — click a result to view deck
            </div>
            {loading ? (
              <div style={{ fontSize: 13, color: '#6b7a99', textAlign: 'center', padding: 20 }}>Loading...</div>
            ) : tournaments.length === 0 ? (
              <div style={{ fontSize: 13, color: '#3a4560', textAlign: 'center', padding: 20 }}>No tournaments logged yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tournaments.map(t => (
                  <div key={t.id} onClick={() => setSelectedTournament(t)} style={{ display: 'grid', gridTemplateColumns: '40px 1fr auto auto', alignItems: 'center', gap: 12, background: '#1c2333', borderRadius: 10, padding: '10px 14px', cursor: 'pointer', border: '1px solid transparent', transition: 'all 0.1s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.background = '#212d40' }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = '#1c2333' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, ...placementStyle(t.placement) }}>
                      {placementLabel(t.placement)}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f2f5' }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: '#6b7a99', marginTop: 1 }}>{t.date} · {t.player_count} players</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <img src={getCardImageUrl(t.leader_id)} alt={t.leader_name} style={{ width: 24, height: 33, objectFit: 'cover', objectPosition: 'top', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)' }} onError={e => { e.target.style.display = 'none' }} />
                      <div style={{ fontSize: 11, color: COLORS[t.leader_color] ?? '#6b7a99' }}>{t.leader_name}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      <span style={{ color: '#34d399' }}>{t.wins}W</span>
                      <span style={{ color: '#3a4560', margin: '0 3px' }}>·</span>
                      <span style={{ color: '#f05252' }}>{t.losses}L</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedTournament && (
        <div onClick={() => setSelectedTournament(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, width: 400, padding: 24 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f2f5', marginBottom: 4 }}>{selectedTournament.name}</div>
            <div style={{ fontSize: 12, color: '#6b7a99', marginBottom: 16 }}>{selectedTournament.leader_name} · {selectedTournament.leader_id}</div>
            {selectedTournament.decklists?.cards?.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {selectedTournament.decklists.cards.flatMap((card, i) =>
                  Array.from({ length: card.count }, (_, j) => (
                    <img key={`${i}-${j}`} src={getCardImageUrl(card.id)} alt={card.name} style={{ width: 60, borderRadius: 5, border: '1px solid rgba(255,255,255,0.08)' }} onError={e => { e.target.style.opacity = '0.15' }} />
                  ))
                )}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: '#3a4560' }}>No decklist attached.</div>
            )}
            <button onClick={() => setSelectedTournament(null)} style={{ marginTop: 16, width: '100%', padding: 9, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#f0f2f5', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Close</button>
          </div>
        </div>
      )}
    </>
  )
}

export default function Friends({ session }) {
  const [friends, setFriends] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedFriend, setSelectedFriend] = useState(null)
  const [addUsername, setAddUsername] = useState('')
  const [addError, setAddError] = useState('')
  const [addSuccess, setAddSuccess] = useState('')

  useEffect(() => {
    if (!session) return
    loadFriends()
  }, [session])

  async function loadFriends() {
    const { data } = await supabase
      .from('friends')
      .select('*, profiles!friends_friend_id_fkey(*)')
      .eq('user_id', session.user.id)
      .eq('status', 'accepted')
    setFriends(data ?? [])
    setLoading(false)
  }

  async function handleAddFriend() {
    setAddError('')
    setAddSuccess('')
    if (!addUsername.trim()) return

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', addUsername.trim())
      .single()

    if (error || !profile) {
      setAddError('User not found')
      return
    }

    if (profile.id === session.user.id) {
      setAddError("You can't add yourself")
      return
    }

    const { error: friendError } = await supabase
      .from('friends')
      .insert({ user_id: session.user.id, friend_id: profile.id, status: 'accepted' })

    if (friendError) {
      setAddError('Already friends or request pending')
    } else {
      setAddSuccess(`Added ${profile.username}!`)
      setAddUsername('')
      loadFriends()
    }
  }

  const filtered = friends.filter(f =>
    f.profiles?.username?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#3d7fff', marginBottom: 4 }}>Network</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#f0f2f5', letterSpacing: '-0.4px', marginBottom: 2 }}>Friends</div>
        <div style={{ fontSize: 13, color: '#6b7a99' }}>Your crew's performance and results</div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="text" placeholder="Search friends..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, maxWidth: 220, background: '#161b27', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '8px 12px', color: '#f0f2f5', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
        <input type="text" placeholder="Add by username..." value={addUsername} onChange={e => setAddUsername(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddFriend()} style={{ flex: 1, maxWidth: 200, background: '#161b27', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '8px 12px', color: '#f0f2f5', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
        <button onClick={handleAddFriend} style={{ fontSize: 12, fontWeight: 600, padding: '8px 16px', borderRadius: 8, cursor: 'pointer', border: 'none', background: '#3d7fff', color: '#fff', fontFamily: 'inherit' }}>+ Add Friend</button>
        {addError && <div style={{ fontSize: 12, color: '#f05252', width: '100%' }}>{addError}</div>}
        {addSuccess && <div style={{ fontSize: 12, color: '#34d399', width: '100%' }}>{addSuccess}</div>}
      </div>

      {loading ? (
        <div style={{ fontSize: 13, color: '#6b7a99', textAlign: 'center', padding: 40 }}>Loading...</div>
      ) : friends.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#3a4560' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>👥</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#6b7a99', marginBottom: 6 }}>No friends added yet</div>
          <div style={{ fontSize: 13 }}>Add friends by their username to see their tournament history</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {filtered.map(f => {
            const profile = f.profiles
            const initials = profile?.username?.slice(0, 2).toUpperCase() ?? '??'
            return (
              <div key={f.id} onClick={() => setSelectedFriend(profile)} style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 18, cursor: 'pointer', transition: 'all 0.15s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.transform = 'translateY(-2px)' }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.transform = 'translateY(0)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: '#3d7fff22', border: '1px solid #3d7fff44', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#3d7fff', flexShrink: 0 }}>
                    {initials}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f2f5' }}>{profile?.username}</div>
                    {profile?.location && <div style={{ fontSize: 11, color: '#6b7a99', marginTop: 2 }}>{profile.location}</div>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selectedFriend && <FriendModal friend={selectedFriend} onClose={() => setSelectedFriend(null)} />}
    </div>
  )
}