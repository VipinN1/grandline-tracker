import { useState, useEffect } from 'react'
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

function Avatar({ profile, size = 44, radius = 10 }) {
  const initials = profile?.username?.slice(0, 2).toUpperCase() ?? '??'
  return (
    <div style={{ width: size, height: size, borderRadius: radius, background: '#3d7fff22', border: '1px solid #3d7fff44', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.3, fontWeight: 700, color: '#3d7fff', flexShrink: 0, overflow: 'hidden' }}>
      {profile?.avatar_url
        ? <img src={profile.avatar_url} alt={initials} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initials
      }
    </div>
  )
}

function ProfileModal({ profile, session, onClose, onFriendAction, isMobile }) {
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTournament, setSelectedTournament] = useState(null)
  const [friendStatus, setFriendStatus] = useState(null)

  useEffect(() => {
    async function load() {
      const [{ data: tData }, { data: fData }] = await Promise.all([
        supabase.from('tournaments').select('*, decklists(*)').eq('user_id', profile.id).order('date', { ascending: false }),
        supabase.from('friends').select('*').or(`and(user_id.eq.${session.user.id},friend_id.eq.${profile.id}),and(user_id.eq.${profile.id},friend_id.eq.${session.user.id})`)
      ])
      setTournaments(tData ?? [])
      if (fData && fData.length > 0) {
        const rel = fData[0]
        if (rel.status === 'accepted') setFriendStatus('accepted')
        else if (rel.user_id === session.user.id) setFriendStatus('pending_sent')
        else setFriendStatus('pending_received')
      }
      setLoading(false)
    }
    load()
  }, [profile.id])

  const totalWins = tournaments.reduce((s, t) => s + t.wins, 0)
  const totalLosses = tournaments.reduce((s, t) => s + t.losses, 0)
  const winRate = totalWins + totalLosses > 0 ? Math.round((totalWins / (totalWins + totalLosses)) * 100) : 0
  const topEights = tournaments.filter(t => t.placement <= 8).length

  async function sendFriendRequest() {
    const { error } = await supabase.from('friends').insert({ user_id: session.user.id, friend_id: profile.id, status: 'pending' })
    if (!error) { setFriendStatus('pending_sent'); onFriendAction?.() }
  }

  async function acceptRequest() {
    await supabase.from('friends').update({ status: 'accepted' }).eq('user_id', profile.id).eq('friend_id', session.user.id)
    setFriendStatus('accepted')
    onFriendAction?.()
  }

  async function removeFriend() {
    await supabase.from('friends').delete().or(`and(user_id.eq.${session.user.id},friend_id.eq.${profile.id}),and(user_id.eq.${profile.id},friend_id.eq.${session.user.id})`)
    setFriendStatus(null)
    onFriendAction?.()
  }

  function FriendButton() {
    if (friendStatus === 'accepted') return (
      <button onClick={removeFriend} style={{ fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 8, border: '1px solid rgba(240,82,82,0.3)', background: 'rgba(240,82,82,0.08)', color: '#f05252', cursor: 'pointer', fontFamily: 'inherit' }}>Remove Friend</button>
    )
    if (friendStatus === 'pending_sent') return (
      <button disabled style={{ fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#6b7a99', cursor: 'default', fontFamily: 'inherit' }}>Request Sent</button>
    )
    if (friendStatus === 'pending_received') return (
      <button onClick={acceptRequest} style={{ fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 8, border: 'none', background: '#34d399', color: '#0f1117', cursor: 'pointer', fontFamily: 'inherit' }}>Accept Request</button>
    )
    return (
      <button onClick={sendFriendRequest} style={{ fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 8, border: 'none', background: '#3d7fff', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>+ Add Friend</button>
    )
  }

  const modalBox = {
    background: '#161b27',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: isMobile ? '16px 16px 0 0' : 16,
    width: isMobile ? '100%' : 580,
    maxHeight: isMobile ? '95vh' : '88vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    animation: isMobile ? 'slideUp 0.25s ease-out' : undefined,
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }}>
      <div onClick={e => e.stopPropagation()} style={modalBox}>

        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          <Avatar profile={profile} size={52} radius={12} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#f0f2f5' }}>{profile.username}</div>
            {profile.location && <div style={{ fontSize: 12, color: '#6b7a99', marginTop: 2 }}>{profile.location}</div>}
          </div>
          <FriendButton />
          <button onClick={onClose} style={{ marginLeft: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#6b7a99', fontSize: 16, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          {[['Win Rate', `${winRate}%`], ['Events', tournaments.length], ['Top 8s', topEights]].map(([label, val]) => (
            <div key={label} style={{ flex: 1, padding: '12px 16px', borderRight: '1px solid rgba(255,255,255,0.07)', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#6b7a99', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#f0f2f5' }}>{val}</div>
            </div>
          ))}
        </div>

        <div style={{ overflowY: 'auto', padding: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#3a4560', marginBottom: 12 }}>
            Tournament History — click to view deck
          </div>
          {loading ? (
            <div style={{ fontSize: 13, color: '#6b7a99', textAlign: 'center', padding: 20 }}>Loading...</div>
          ) : tournaments.length === 0 ? (
            <div style={{ fontSize: 13, color: '#3a4560', textAlign: 'center', padding: 20 }}>No tournaments logged yet</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tournaments.map(t => (
                <div key={t.id} onClick={() => setSelectedTournament(t)} style={{ display: 'grid', gridTemplateColumns: isMobile ? '34px 1fr auto' : '40px 1fr auto auto', alignItems: 'center', gap: 12, background: '#1c2333', borderRadius: 10, padding: '10px 14px', cursor: 'pointer', border: '1px solid transparent', transition: 'all 0.1s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.background = '#212d40' }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = '#1c2333' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, ...placementStyle(t.placement) }}>
                    {placementLabel(t.placement)}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f2f5' }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: '#6b7a99', marginTop: 1 }}>{t.date} · {t.player_count} players</div>
                  </div>
                  {!isMobile && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <img src={getCardImageUrl(t.leader_id)} alt={t.leader_name} style={{ width: 24, height: 33, objectFit: 'cover', objectPosition: 'top', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)' }} onError={e => { e.target.style.display = 'none' }} />
                      <div style={{ fontSize: 11, color: COLORS[t.leader_color] ?? '#6b7a99' }}>{t.leader_name}</div>
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
        </div>
      </div>

      {selectedTournament && (
        <div onClick={() => setSelectedTournament(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.12)', borderRadius: isMobile ? '16px 16px 0 0' : 16, width: isMobile ? '100%' : 400, maxHeight: isMobile ? '90vh' : '80vh', overflow: 'auto', padding: 24, animation: isMobile ? 'slideUp 0.25s ease-out' : undefined }}>
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
    </div>
  )
}

export default function Friends({ session }) {
  const [friends, setFriends] = useState([])
  const [pendingRequests, setPendingRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedProfile, setSelectedProfile] = useState(null)
  const [addUsername, setAddUsername] = useState('')
  const [addError, setAddError] = useState('')
  const [addSuccess, setAddSuccess] = useState('')
  const [activeTab, setActiveTab] = useState('friends')
  const { isMobile } = useWindowSize()

  useEffect(() => {
    if (!session) return
    loadAll()
  }, [session])

  async function loadAll() {
    const [{ data: friendsData }, { data: requestsData }] = await Promise.all([
      supabase.from('friends').select('*, profiles!friends_friend_id_fkey(*)').eq('user_id', session.user.id).eq('status', 'accepted'),
      supabase.from('friends').select('*, profiles!friends_user_id_fkey(*)').eq('friend_id', session.user.id).eq('status', 'pending'),
    ])
    setFriends(friendsData ?? [])
    setPendingRequests(requestsData ?? [])
    setLoading(false)
  }

  async function handleAddFriend() {
    setAddError('')
    setAddSuccess('')
    if (!addUsername.trim()) return

    const { data: profile, error } = await supabase.from('profiles').select('*').eq('username', addUsername.trim()).single()

    if (error || !profile) { setAddError('User not found'); return }
    if (profile.id === session.user.id) { setAddError("You can't add yourself"); return }

    const { error: friendError } = await supabase.from('friends').insert({ user_id: session.user.id, friend_id: profile.id, status: 'pending' })

    if (friendError) {
      setAddError('Request already sent or you are already friends')
    } else {
      setAddSuccess(`Friend request sent to ${profile.username}!`)
      setAddUsername('')
    }
  }

  async function acceptRequest(request) {
    await supabase.from('friends').update({ status: 'accepted' }).eq('id', request.id)
    await supabase.from('friends').insert({ user_id: session.user.id, friend_id: request.user_id, status: 'accepted' })
    loadAll()
  }

  async function declineRequest(request) {
    await supabase.from('friends').delete().eq('id', request.id)
    loadAll()
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

      {/* Add friend bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="text" placeholder="Search friends..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 120, background: '#161b27', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '8px 12px', color: '#f0f2f5', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
        <input type="text" placeholder="Add by username..." value={addUsername} onChange={e => setAddUsername(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddFriend()} style={{ flex: 1, minWidth: 120, background: '#161b27', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '8px 12px', color: '#f0f2f5', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
        <button onClick={handleAddFriend} style={{ fontSize: 12, fontWeight: 600, padding: '8px 16px', borderRadius: 8, cursor: 'pointer', border: 'none', background: '#3d7fff', color: '#fff', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>Send Request</button>
        {addError && <div style={{ fontSize: 12, color: '#f05252', width: '100%' }}>{addError}</div>}
        {addSuccess && <div style={{ fontSize: 12, color: '#34d399', width: '100%' }}>{addSuccess}</div>}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        {[['friends', 'Friends'], ['requests', `Requests${pendingRequests.length > 0 ? ` (${pendingRequests.length})` : ''}`]].map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: activeTab === tab ? '#161b27' : 'transparent', color: activeTab === tab ? (tab === 'requests' && pendingRequests.length > 0 ? '#fbbf24' : '#f0f2f5') : '#6b7a99', borderBottom: activeTab === tab ? '2px solid #3d7fff' : '2px solid transparent', transition: 'all 0.1s' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Friends tab */}
      {activeTab === 'friends' && (
        loading ? (
          <div style={{ fontSize: 13, color: '#6b7a99', textAlign: 'center', padding: 40 }}>Loading...</div>
        ) : friends.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: '#3a4560' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>👥</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#6b7a99', marginBottom: 6 }}>No friends yet</div>
            <div style={{ fontSize: 13 }}>Add friends by their username to see their tournament history</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12 }}>
            {filtered.map(f => (
              <div key={f.id} onClick={() => setSelectedProfile(f.profiles)} style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 18, cursor: 'pointer', transition: 'all 0.15s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.transform = 'translateY(-2px)' }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.transform = 'translateY(0)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar profile={f.profiles} size={44} radius={10} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f2f5' }}>{f.profiles?.username}</div>
                    {f.profiles?.location && <div style={{ fontSize: 11, color: '#6b7a99', marginTop: 2 }}>{f.profiles.location}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Requests tab */}
      {activeTab === 'requests' && (
        pendingRequests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: '#3a4560' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📬</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#6b7a99', marginBottom: 6 }}>No pending requests</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingRequests.map(req => (
              <div key={req.id} style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <Avatar profile={req.profiles} size={44} radius={10} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f2f5' }}>{req.profiles?.username}</div>
                  {req.profiles?.location && <div style={{ fontSize: 12, color: '#6b7a99', marginTop: 2 }}>{req.profiles.location}</div>}
                  <div style={{ fontSize: 11, color: '#3a4560', marginTop: 2 }}>Sent {new Date(req.created_at).toLocaleDateString()}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => acceptRequest(req)} style={{ fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 8, border: 'none', background: '#34d399', color: '#0f1117', cursor: 'pointer', fontFamily: 'inherit' }}>Accept</button>
                  <button onClick={() => declineRequest(req)} style={{ fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#6b7a99', cursor: 'pointer', fontFamily: 'inherit' }}>Decline</button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {selectedProfile && (
        <ProfileModal
          profile={selectedProfile}
          session={session}
          onClose={() => setSelectedProfile(null)}
          onFriendAction={loadAll}
          isMobile={isMobile}
        />
      )}
    </div>
  )
}
