import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { colors, radius, shadow, font, input as inputStyle, pageHeader, eyebrow } from '../theme'

const card = { background: `linear-gradient(180deg, ${colors.surface} 0%, ${colors.deep} 100%)`, border: `1px solid ${colors.line}`, borderRadius: radius.lg, boxShadow: shadow.md }

function CreatorTile({ entry }) {
  const profile = entry.profiles
  const initials = (profile?.username ?? '?').slice(0, 2).toUpperCase()
  return (
    <Link to={`/creators/${profile?.username}`} style={{ textDecoration: 'none', display: 'block', ...card, padding: 18, transition: 'transform 0.15s, border-color 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = colors.lineStrong }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = colors.line }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 46, height: 46, borderRadius: '50%', background: `linear-gradient(135deg, ${colors.oceanDeep}, ${colors.ocean})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: colors.parchment, flexShrink: 0, overflow: 'hidden', border: `2px solid ${colors.goldLine}` }}>
          {profile?.avatar_url ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.username}</div>
          {entry.tagline && <div style={{ fontSize: 12, color: colors.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.tagline}</div>}
        </div>
      </div>
    </Link>
  )
}

export default function CreatorsDirectory() {
  const [creators, setCreators] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('creators')
        .select('user_id, tagline, created_at, profiles(username, avatar_url, pronouns)')
        .order('created_at', { ascending: false })
      setCreators(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = creators.filter(c =>
    c.profiles?.username?.toLowerCase().includes(search.toLowerCase()) ||
    c.tagline?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={eyebrow}>Community</div>
        <div style={{ ...pageHeader(), fontSize: 28, marginTop: 2, marginBottom: 2 }}>Creators</div>
        <div style={{ fontSize: 13, color: colors.muted, fontFamily: font.body }}>OPTCG content creators on PirateTracker</div>
      </div>

      <input
        type="text"
        placeholder="Search creators..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ ...inputStyle, marginBottom: '1.5rem' }}
      />

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
          <div style={{ fontSize: 13, color: colors.muted }}>Loading creators...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: colors.faint }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🎬</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: colors.muted }}>{search ? 'No creators match your search.' : 'No creator pages yet.'}</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {filtered.map(c => <CreatorTile key={c.user_id} entry={c} />)}
        </div>
      )}
    </div>
  )
}
