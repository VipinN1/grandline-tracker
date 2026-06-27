import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getCardImageUrl } from '../lib/optcgapi'
import { supabase } from '../lib/supabase'
import { useWindowSize } from '../hooks/useWindowSize'
import TournamentModal from '../components/TournamentModal'

const COLORS = { Red: '#e05545', Blue: '#3f8fd6', Green: '#3bb27e', Purple: '#8d7ae6', Yellow: '#e6b84f', Black: '#94a3b8' }

function placementLabel(n) {
  if (n === 1) return '1st'
  if (n === 2) return '2nd'
  if (n === 3) return '3rd'
  return `${n}th`
}

function placementStyle(n) {
  if (n === 1) return { background: 'rgba(200,162,74,0.12)', color: '#dcb35e' }
  if (n === 2) return { background: 'rgba(148,163,184,0.1)', color: '#94a3b8' }
  if (n === 3) return { background: 'rgba(251,146,60,0.1)', color: '#fb923c' }
  return { background: 'rgba(140,176,208,0.04)', color: '#67809a' }
}

export default function UserProfilePage({ session }) {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { isMobile } = useWindowSize()
  const [profile, setProfile] = useState(null)
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTournament, setSelectedTournament] = useState(null)
  const [activeTab, setActiveTab] = useState('history')
  const [friendStatus, setFriendStatus] = useState(null)
  const [friendLoading, setFriendLoading] = useState(false)

  useEffect(() => {
    if (!userId) return
    if (session && userId === session.user.id) {
      navigate('/profile', { replace: true })
      return
    }
    async function load() {
      setLoading(true)
      const promises = [
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('tournaments').select('*, decklists(*), tournament_rounds(*)').eq('user_id', userId).order('date', { ascending: false }),
      ]
      if (session) {
        promises.push(
          supabase.from('friends').select('*').or(
            `and(user_id.eq.${session.user.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${session.user.id})`
          )
        )
      }
      const [{ data: profileData }, { data: tournamentData }, fResult] = await Promise.all(promises)
      setProfile(profileData)
      setTournaments(tournamentData ?? [])
      const fData = fResult?.data
      if (session && fData && fData.length > 0) {
        const rel = fData[0]
        if (rel.status === 'accepted') setFriendStatus('accepted')
        else if (rel.user_id === session.user.id) setFriendStatus('pending_sent')
        else setFriendStatus('pending_received')
      }
      setLoading(false)
    }
    load()
  }, [userId, session])

  async function sendFriendRequest() {
    setFriendLoading(true)
    const { error } = await supabase.from('friends').insert({ user_id: session.user.id, friend_id: userId, status: 'pending' })
    if (!error) setFriendStatus('pending_sent')
    setFriendLoading(false)
  }

  async function acceptRequest() {
    setFriendLoading(true)
    await supabase.from('friends').update({ status: 'accepted' }).eq('user_id', userId).eq('friend_id', session.user.id)
    await supabase.from('friends').insert({ user_id: session.user.id, friend_id: userId, status: 'accepted' })
    setFriendStatus('accepted')
    setFriendLoading(false)
  }

  async function removeFriend() {
    setFriendLoading(true)
    await supabase.from('friends').delete().or(`and(user_id.eq.${session.user.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${session.user.id})`)
    setFriendStatus(null)
    setFriendLoading(false)
  }

  function FriendButton() {
    if (!session) return null
    if (friendStatus === 'accepted') return (
      <button onClick={removeFriend} disabled={friendLoading} style={{ fontSize: 12, fontWeight: 600, padding: '5px 14px', borderRadius: 8, border: '1px solid rgba(210,74,58,0.3)', background: 'rgba(210,74,58,0.08)', color: '#d24a3a', cursor: 'pointer', fontFamily: 'inherit', marginTop: 10 }}>Remove Friend</button>
    )
    if (friendStatus === 'pending_sent') return (
      <button disabled style={{ fontSize: 12, fontWeight: 600, padding: '5px 14px', borderRadius: 8, border: '1px solid rgba(140,176,208,0.1)', background: 'transparent', color: '#9db2c6', cursor: 'default', fontFamily: 'inherit', marginTop: 10 }}>Request Sent</button>
    )
    if (friendStatus === 'pending_received') return (
      <button onClick={acceptRequest} disabled={friendLoading} style={{ fontSize: 12, fontWeight: 600, padding: '5px 14px', borderRadius: 8, border: 'none', background: '#3bb27e', color: '#0f1117', cursor: 'pointer', fontFamily: 'inherit', marginTop: 10 }}>Accept Request</button>
    )
    return (
      <button onClick={sendFriendRequest} disabled={friendLoading} style={{ fontSize: 12, fontWeight: 600, padding: '5px 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #2f7da3, #1b4a66)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', marginTop: 10 }}>+ Add Friend</button>
    )
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <div style={{ fontSize: 13, color: '#9db2c6' }}>Loading profile…</div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#9db2c6', marginBottom: 8 }}>Profile not found</div>
        <button onClick={() => navigate(-1)} style={{ color: '#2f7da3', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>← Go back</button>
      </div>
    )
  }

  // Practice (voided) games are kept in history but excluded from all stats.
  const ranked = tournaments.filter(t => !t.is_practice)
  const totalWins = ranked.reduce((s, t) => s + t.wins, 0)
  const totalLosses = ranked.reduce((s, t) => s + t.losses, 0)
  const winRate = totalWins + totalLosses > 0 ? Math.round((totalWins / (totalWins + totalLosses)) * 100) : 0
  const topEights = ranked.filter(t => t.placement <= 8).length
  const bestFinish = ranked.length > 0 ? Math.min(...ranked.map(t => t.placement)) : null

  const leaderCounts = ranked.reduce((acc, t) => {
    if (!acc[t.leader_id]) acc[t.leader_id] = { name: t.leader_name, color: t.leader_color, count: 0 }
    acc[t.leader_id].count++
    return acc
  }, {})

  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : ''

  const initials = profile.username?.slice(0, 2).toUpperCase() ?? '??'

  return (
    <div>
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'rgba(140,176,208,0.05)', border: '1px solid rgba(140,176,208,0.1)', borderRadius: 8, color: '#9db2c6', fontSize: 13, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
        >
          ← Back
        </button>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.6px', color: '#dcb35e', marginBottom: 2 }}>Player</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#e9f1f8', letterSpacing: '-0.4px' }}>{profile.username}</div>
        </div>
      </div>

      <div style={{ background: 'rgba(140,176,208,0.05)', border: '1px solid rgba(140,176,208,0.07)', borderRadius: 14, padding: isMobile ? 16 : 24, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? 14 : 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: 14, background: profile.avatar_url ? 'transparent' : '#2f7da3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: '#fff', flexShrink: 0, overflow: 'hidden', border: '2px solid rgba(140,176,208,0.1)' }}>
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt={initials} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ fontSize: isMobile ? 17 : 20, fontWeight: 700, color: '#e9f1f8', letterSpacing: '-0.3px' }}>{profile.username}</div>
              {profile.pronouns && <div style={{ fontSize: isMobile ? 11 : 12, color: '#9db2c6' }}>Pronouns: <span style={{ color: '#52a9cd' }}>{profile.pronouns}</span></div>}
            </div>
            <div style={{ fontSize: 12, color: '#9db2c6', marginTop: 3 }}>
              {profile.location && `${profile.location} · `}
              {memberSince && `Since ${memberSince}`}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {bestFinish === 1 && <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, background: 'rgba(200,162,74,0.1)', color: '#dcb35e', border: '1px solid rgba(200,162,74,0.2)' }}>1st Place</span>}
              <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, background: 'rgba(140,176,208,0.1)', color: '#2f7da3', border: '1px solid rgba(140,176,208,0.2)' }}>{ranked.length} Events</span>
              {topEights > 0 && <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, background: 'rgba(59,178,126,0.1)', color: '#3bb27e', border: '1px solid rgba(59,178,126,0.2)' }}>Top 8 ×{topEights}</span>}
              {isMobile && <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: 'rgba(140,176,208,0.06)', color: '#e9f1f8', border: '1px solid rgba(140,176,208,0.1)' }}>{winRate}% WR</span>}
            </div>
            <FriendButton />
            {session && (
              <button onClick={() => navigate('/community', { state: { dmUserId: profile.id } })} style={{ fontSize: 12, fontWeight: 600, padding: '5px 14px', borderRadius: 8, border: '1px solid rgba(200,162,74,0.3)', background: 'rgba(140,176,208,0.1)', color: '#52a9cd', cursor: 'pointer', fontFamily: 'inherit', marginTop: 10, marginLeft: 8 }}>💬 Message</button>
            )}
          </div>
          {!isMobile && (
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: '#e9f1f8', letterSpacing: '-1px', lineHeight: 1 }}>{winRate}%</div>
              <div style={{ fontSize: 12, color: '#9db2c6', marginTop: 4 }}>win rate</div>
              <div style={{ fontSize: 13, color: '#67809a', marginTop: 2, fontFamily: 'monospace' }}>{totalWins}W · {totalLosses}L</div>
            </div>
          )}
        </div>

        {profile.bio && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(140,176,208,0.05)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#9db2c6', marginBottom: 6 }}>Bio</div>
            <div style={{ fontSize: 13, color: '#e9f1f8', lineHeight: 1.6 }}>{profile.bio}</div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
        {[
          { label: 'Tournaments', value: ranked.length },
          { label: 'Top 8s', value: topEights },
          { label: 'Best Finish', value: bestFinish ? placementLabel(bestFinish) : '—' },
          { label: 'Fav. Leader', value: Object.values(leaderCounts).sort((a, b) => b.count - a.count)[0]?.name.replace(/\s*\([^)]*\)$/, '').trim().split(' ').slice(-1)[0] ?? '—' },
        ].map(s => (
          <div key={s.label} style={{ background: 'rgba(140,176,208,0.05)', border: '1px solid rgba(140,176,208,0.07)', borderRadius: 12, padding: isMobile ? '12px 14px' : '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#9db2c6', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: '#e9f1f8', letterSpacing: '-0.5px' }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 14, borderBottom: '1px solid rgba(140,176,208,0.07)', flexWrap: 'wrap' }}>
        {[['history', 'Tournament History'], ['leaders', 'Leaders Played']].map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: activeTab === tab ? 'rgba(140,176,208,0.05)' : 'transparent', color: activeTab === tab ? '#e9f1f8' : '#9db2c6', borderBottom: activeTab === tab ? '2px solid #2f7da3' : '2px solid transparent', transition: 'all 0.1s' }}>
            {label}
          </button>
        ))}
      </div>

      {tournaments.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#67809a' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏆</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#9db2c6', marginBottom: 6 }}>No tournaments logged yet</div>
        </div>
      )}

      {activeTab === 'history' && tournaments.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tournaments.map(t => (
            <div
              key={t.id}
              onClick={() => setSelectedTournament(t)}
              style={{ background: 'rgba(140,176,208,0.05)', border: '1px solid rgba(140,176,208,0.07)', borderRadius: 12, padding: isMobile ? '10px 12px' : '12px 16px', display: 'grid', gridTemplateColumns: isMobile ? '36px 1fr auto' : '44px 1fr auto auto', alignItems: 'center', gap: isMobile ? 10 : 16, cursor: 'pointer', transition: 'all 0.1s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(140,176,208,0.12)'; e.currentTarget.style.background = 'rgba(140,176,208,0.03)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(140,176,208,0.07)'; e.currentTarget.style.background = 'rgba(140,176,208,0.05)' }}
            >
              <div style={{ width: isMobile ? 30 : 36, height: isMobile ? 30 : 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? 11 : 13, fontWeight: 700, flexShrink: 0, ...placementStyle(t.placement) }}>
                {placementLabel(t.placement)}
              </div>
              <div>
                <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 600, color: '#e9f1f8', display: 'flex', alignItems: 'center', gap: 7 }}>
                  {t.name}
                  {t.is_practice && <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', padding: '2px 6px', borderRadius: 5, background: 'rgba(82,169,205,0.12)', color: '#52a9cd', border: '1px solid rgba(82,169,205,0.3)' }}>Practice</span>}
                </div>
                <div style={{ fontSize: 11, color: '#9db2c6', marginTop: 1 }}>{t.date} · {t.player_count} players{t.location ? ` · ${t.location}` : ''}</div>
              </div>
              {!isMobile && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(140,176,208,0.03)', border: '1px solid rgba(140,176,208,0.07)', borderRadius: 8, padding: '6px 12px 6px 8px' }}>
                  <img src={getCardImageUrl(t.leader_id)} alt={t.leader_name} style={{ width: 28, height: 38, objectFit: 'cover', objectPosition: 'top', borderRadius: 3, border: '1px solid rgba(140,176,208,0.08)' }} onError={e => { e.target.style.display = 'none' }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#e9f1f8' }}>{t.leader_name}</div>
                    <div style={{ fontSize: 11, color: COLORS[t.leader_color] ?? '#9db2c6' }}>{t.leader_color} · {t.leader_id}</div>
                  </div>
                </div>
              )}
              <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                <span style={{ color: '#3bb27e' }}>{t.wins}W</span>
                <span style={{ color: '#67809a', margin: '0 3px' }}>·</span>
                <span style={{ color: '#d24a3a' }}>{t.losses}L</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'leaders' && tournaments.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12 }}>
          {Object.entries(leaderCounts).map(([id, data]) => {
            const leaderTournaments = ranked.filter(t => t.leader_id === id)
            return (
              <div key={id} style={{ background: 'rgba(140,176,208,0.05)', border: '1px solid rgba(140,176,208,0.07)', borderRadius: 14, overflow: 'hidden', transition: 'all 0.15s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(140,176,208,0.15)'; e.currentTarget.style.transform = 'translateY(-2px)' }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(140,176,208,0.07)'; e.currentTarget.style.transform = 'translateY(0)' }}>
                <div style={{ position: 'relative', height: isMobile ? 100 : 140 }}>
                  <img src={getCardImageUrl(id)} alt={data.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: COLORS[data.color] ?? '#2f7da3' }} />
                  <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.6)', border: `1px solid ${COLORS[data.color]}44`, borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700, color: COLORS[data.color] }}>{data.color}</div>
                </div>
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#e9f1f8' }}>{data.name}</div>
                  <div style={{ fontSize: 11, color: '#9db2c6', marginTop: 2, fontFamily: 'monospace' }}>{id}</div>
                  <div style={{ fontSize: 12, color: '#67809a', marginTop: 6, marginBottom: 10 }}>
                    <span style={{ color: '#9db2c6', fontWeight: 600 }}>{data.count}</span> events played
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {leaderTournaments.map(t => (
                      <div key={t.id} onClick={() => setSelectedTournament(t)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderRadius: 6, background: 'rgba(140,176,208,0.03)', cursor: 'pointer', transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.background = '#212d40'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(140,176,208,0.03)'}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#e9f1f8' }}>{t.name}</div>
                          <div style={{ fontSize: 10, color: '#9db2c6', marginTop: 1 }}>{t.date}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          <div style={{ width: 24, height: 24, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, ...placementStyle(t.placement) }}>
                            {placementLabel(t.placement)}
                          </div>
                          <div style={{ fontSize: 11, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                            <span style={{ color: '#3bb27e' }}>{t.wins}W</span>
                            <span style={{ color: '#67809a', margin: '0 2px' }}>·</span>
                            <span style={{ color: '#d24a3a' }}>{t.losses}L</span>
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
        <TournamentModal tournament={selectedTournament} onClose={() => setSelectedTournament(null)} isMobile={isMobile} onDelete={false} />
      )}
    </div>
  )
}
