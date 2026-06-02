import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useWindowSize } from '../hooks/useWindowSize'
import ProfilePopover from '../components/ProfilePopover'

function Avatar({ profile, size = 44, radius = 10 }) {
  const initials = profile?.username?.slice(0, 2).toUpperCase() ?? '??'
  return (
    <div style={{ width: size, height: size, borderRadius: radius, background: '#8b5cf622', border: '1px solid #8b5cf644', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.3, fontWeight: 700, color: '#8b5cf6', flexShrink: 0, overflow: 'hidden' }}>
      {profile?.avatar_url
        ? <img src={profile.avatar_url} alt={initials} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initials
      }
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
  const [adminModal, setAdminModal] = useState(null) // friend object
  const [myTournaments, setMyTournaments] = useState([])
  const [adminGrants, setAdminGrants] = useState([]) // tournament_ids friend has admin on
  const [adminLoading, setAdminLoading] = useState(false)
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

  async function openAdminModal(e, friend) {
    e.stopPropagation()
    setAdminModal(friend)
    setAdminLoading(true)
    const [{ data: tours }, { data: grants }] = await Promise.all([
      supabase.from('sim_tournaments').select('id, name, status').eq('created_by', session.user.id).order('created_at', { ascending: false }),
      supabase.from('sim_tournament_admins').select('tournament_id').eq('user_id', friend.profiles.id),
    ])
    setMyTournaments(tours ?? [])
    setAdminGrants((grants ?? []).map(g => g.tournament_id))
    setAdminLoading(false)
  }

  async function toggleAdminGrant(tournamentId) {
    if (!adminModal) return
    const friendId = adminModal.profiles.id
    const hasGrant = adminGrants.includes(tournamentId)
    if (hasGrant) {
      await supabase.from('sim_tournament_admins').delete().eq('tournament_id', tournamentId).eq('user_id', friendId)
      setAdminGrants(prev => prev.filter(id => id !== tournamentId))
    } else {
      await supabase.from('sim_tournament_admins').insert({ tournament_id: tournamentId, user_id: friendId, granted_by: session.user.id })
      setAdminGrants(prev => [...prev, tournamentId])
    }
  }

  const filtered = friends.filter(f =>
    f.profiles?.username?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#8b5cf6', marginBottom: 4 }}>Network</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#f0f2f5', letterSpacing: '-0.4px', marginBottom: 2 }}>Friends</div>
        <div style={{ fontSize: 13, color: '#7c6fa0' }}>Your crew's performance and results</div>
      </div>

      {/* Add friend bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="text" placeholder="Search friends..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 120, background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '8px 12px', color: '#f0f2f5', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
        <input type="text" placeholder="Add by username..." value={addUsername} onChange={e => setAddUsername(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddFriend()} style={{ flex: 1, minWidth: 120, background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '8px 12px', color: '#f0f2f5', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
        <button onClick={handleAddFriend} style={{ fontSize: 12, fontWeight: 600, padding: '8px 16px', borderRadius: 8, cursor: 'pointer', border: 'none', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>Send Request</button>
        {addError && <div style={{ fontSize: 12, color: '#f05252', width: '100%' }}>{addError}</div>}
        {addSuccess && <div style={{ fontSize: 12, color: '#34d399', width: '100%' }}>{addSuccess}</div>}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        {[['friends', 'Friends'], ['requests', `Requests${pendingRequests.length > 0 ? ` (${pendingRequests.length})` : ''}`]].map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: activeTab === tab ? 'rgba(139,92,246,0.05)' : 'transparent', color: activeTab === tab ? (tab === 'requests' && pendingRequests.length > 0 ? '#fbbf24' : '#f0f2f5') : '#7c6fa0', borderBottom: activeTab === tab ? '2px solid #8b5cf6' : '2px solid transparent', transition: 'all 0.1s' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Friends tab */}
      {activeTab === 'friends' && (
        loading ? (
          <div style={{ fontSize: 13, color: '#7c6fa0', textAlign: 'center', padding: 40 }}>Loading...</div>
        ) : friends.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: '#3d2d6e' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>👥</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#7c6fa0', marginBottom: 6 }}>No friends yet</div>
            <div style={{ fontSize: 13 }}>Add friends by their username to see their tournament history</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12 }}>
            {filtered.map(f => (
              <div key={f.id} onClick={() => setSelectedProfile(f.profiles)} style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 18, cursor: 'pointer', transition: 'all 0.15s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.transform = 'translateY(-2px)' }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.transform = 'translateY(0)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar profile={f.profiles} size={44} radius={10} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f2f5' }}>{f.profiles?.username}</div>
                    {f.profiles?.location && <div style={{ fontSize: 11, color: '#7c6fa0', marginTop: 2 }}>{f.profiles.location}</div>}
                  </div>
                  <button
                    onClick={e => openAdminModal(e, f)}
                    title="Manage tournament admin"
                    style={{ flexShrink: 0, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 15, color: '#a78bfa', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.25)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.12)' }}
                  >🛡</button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Requests tab */}
      {activeTab === 'requests' && (
        pendingRequests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: '#3d2d6e' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📬</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#7c6fa0', marginBottom: 6 }}>No pending requests</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingRequests.map(req => (
              <div key={req.id} style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <Avatar profile={req.profiles} size={44} radius={10} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f2f5' }}>{req.profiles?.username}</div>
                  {req.profiles?.location && <div style={{ fontSize: 12, color: '#7c6fa0', marginTop: 2 }}>{req.profiles.location}</div>}
                  <div style={{ fontSize: 11, color: '#3d2d6e', marginTop: 2 }}>Sent {new Date(req.created_at).toLocaleDateString()}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => acceptRequest(req)} style={{ fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 8, border: 'none', background: '#34d399', color: '#0f1117', cursor: 'pointer', fontFamily: 'inherit' }}>Accept</button>
                  <button onClick={() => declineRequest(req)} style={{ fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#7c6fa0', cursor: 'pointer', fontFamily: 'inherit' }}>Decline</button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {selectedProfile && (
        <ProfilePopover
          profile={selectedProfile}
          session={session}
          onClose={() => setSelectedProfile(null)}
          onFriendAction={loadAll}
        />
      )}

      {adminModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setAdminModal(null)}>
          <div style={{ background: '#13091f', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400, maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <Avatar profile={adminModal.profiles} size={40} radius={10} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f2f5' }}>{adminModal.profiles?.username}</div>
                <div style={{ fontSize: 12, color: '#7c6fa0' }}>Tournament Admin Access</div>
              </div>
              <button onClick={() => setAdminModal(null)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#7c6fa0', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>

            {adminLoading ? (
              <div style={{ fontSize: 13, color: '#7c6fa0', textAlign: 'center', padding: 24 }}>Loading...</div>
            ) : myTournaments.length === 0 ? (
              <div style={{ fontSize: 13, color: '#7c6fa0', textAlign: 'center', padding: 24 }}>You haven't created any tournaments yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#7c6fa0', marginBottom: 4 }}>Your Tournaments</div>
                {myTournaments.map(t => {
                  const granted = adminGrants.includes(t.id)
                  const statusColor = t.status === 'completed' ? '#34d399' : t.status === 'active' ? '#fbbf24' : '#a78bfa'
                  return (
                    <div key={t.id} onClick={() => toggleAdminGrant(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, border: `1px solid ${granted ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.07)'}`, background: granted ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.02)', cursor: 'pointer', transition: 'all 0.15s' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f2f5' }}>{t.name}</div>
                        <div style={{ fontSize: 11, color: statusColor, marginTop: 2, textTransform: 'capitalize' }}>{t.status}</div>
                      </div>
                      <div style={{ width: 36, height: 20, borderRadius: 10, background: granted ? '#7c3aed' : 'rgba(255,255,255,0.1)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                        <div style={{ position: 'absolute', top: 2, left: granted ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
