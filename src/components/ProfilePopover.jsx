import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useWindowSize } from '../hooks/useWindowSize'

export default function ProfilePopover({ profile, session, onClose, onFriendAction }) {
  const [stats, setStats] = useState(null)
  const [friendStatus, setFriendStatus] = useState(null)
  const navigate = useNavigate()
  const { isMobile } = useWindowSize()

  useEffect(() => {
    async function load() {
      const promises = [
        supabase.from('tournaments').select('placement, wins, losses').eq('user_id', profile.id).eq('is_practice', false),
      ]
      if (session) {
        promises.push(
          supabase.from('friends').select('*').or(
            `and(user_id.eq.${session.user.id},friend_id.eq.${profile.id}),and(user_id.eq.${profile.id},friend_id.eq.${session.user.id})`
          )
        )
      }
      const [{ data: tData }, fResult] = await Promise.all(promises)
      const tournaments = tData ?? []
      const totalWins = tournaments.reduce((s, t) => s + t.wins, 0)
      const totalLosses = tournaments.reduce((s, t) => s + t.losses, 0)
      setStats({
        winRate: totalWins + totalLosses > 0 ? Math.round((totalWins / (totalWins + totalLosses)) * 100) : 0,
        events: tournaments.length,
        topEights: tournaments.filter(t => t.placement <= 8).length,
      })
      const fData = fResult?.data
      if (session && fData && fData.length > 0) {
        const rel = fData[0]
        if (rel.status === 'accepted') setFriendStatus('accepted')
        else if (rel.user_id === session.user.id) setFriendStatus('pending_sent')
        else setFriendStatus('pending_received')
      }
    }
    load()
  }, [profile.id])

  async function sendFriendRequest() {
    const { error } = await supabase.from('friends').insert({ user_id: session.user.id, friend_id: profile.id, status: 'pending' })
    if (!error) { setFriendStatus('pending_sent'); onFriendAction?.() }
  }

  async function acceptRequest() {
    await supabase.from('friends').update({ status: 'accepted' }).eq('user_id', profile.id).eq('friend_id', session.user.id)
    await supabase.from('friends').insert({ user_id: session.user.id, friend_id: profile.id, status: 'accepted' })
    setFriendStatus('accepted')
    onFriendAction?.()
  }

  async function removeFriend() {
    await supabase.from('friends').delete().or(`and(user_id.eq.${session.user.id},friend_id.eq.${profile.id}),and(user_id.eq.${profile.id},friend_id.eq.${session.user.id})`)
    setFriendStatus(null)
    onFriendAction?.()
  }

  const initials = profile?.username?.slice(0, 2).toUpperCase() ?? '??'
  const isSelf = session?.user?.id === profile.id

  function FriendButton() {
    if (!session || isSelf) return null
    if (friendStatus === 'accepted') return (
      <button onClick={removeFriend} style={{ fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(210,74,58,0.3)', background: 'rgba(210,74,58,0.08)', color: '#d24a3a', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Remove Friend</button>
    )
    if (friendStatus === 'pending_sent') return (
      <button disabled style={{ fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(140,176,208,0.1)', background: 'transparent', color: '#9db2c6', cursor: 'default', fontFamily: 'inherit', flexShrink: 0 }}>Sent</button>
    )
    if (friendStatus === 'pending_received') return (
      <button onClick={acceptRequest} style={{ fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 8, border: 'none', background: '#3bb27e', color: '#0f1117', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Accept</button>
    )
    return (
      <button onClick={sendFriendRequest} style={{ fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #2f7da3, #1b4a66)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>+ Add Friend</button>
    )
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 200, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#0f1f33', border: '1px solid rgba(200,162,74,0.25)', borderRadius: isMobile ? '18px 18px 0 0' : 16, width: isMobile ? '100%' : 360, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 54, height: 54, borderRadius: 13, background: profile.avatar_url ? 'transparent' : '#2f7da3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff', flexShrink: 0, overflow: 'hidden', border: '2px solid rgba(140,176,208,0.08)' }}>
            {profile.avatar_url ? <img src={profile.avatar_url} alt={initials} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#e9f1f8' }}>{profile.username}</div>
            {profile.location && <div style={{ fontSize: 11, color: '#9db2c6', marginTop: 2 }}>📍 {profile.location}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'rgba(140,176,208,0.05)', border: '1px solid rgba(140,176,208,0.1)', borderRadius: 6, color: '#9db2c6', fontSize: 15, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
        </div>

        {profile.bio && (
          <div style={{ fontSize: 12, color: '#9db2c6', lineHeight: 1.55, padding: '8px 12px', background: 'rgba(140,176,208,0.03)', borderRadius: 8, border: '1px solid rgba(140,176,208,0.06)' }}>
            {profile.bio.length > 120 ? profile.bio.slice(0, 120) + '…' : profile.bio}
          </div>
        )}

        {stats ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[['Win Rate', `${stats.winRate}%`], ['Events', stats.events], ['Top 8s', stats.topEights]].map(([label, val]) => (
              <div key={label} style={{ textAlign: 'center', padding: '10px 6px', background: 'rgba(140,176,208,0.05)', border: '1px solid rgba(140,176,208,0.07)', borderRadius: 10 }}>
                <div style={{ fontSize: 10, color: '#9db2c6', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#e9f1f8' }}>{val}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '12px 0', color: '#9db2c6', fontSize: 12 }}>Loading stats…</div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <FriendButton />
          <button
            onClick={() => { onClose(); navigate(`/profile/${profile.id}`) }}
            style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(200,162,74,0.3)', background: 'rgba(140,176,208,0.08)', color: '#52a9cd', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            View Full Profile →
          </button>
        </div>
      </div>
    </div>
  )
}
