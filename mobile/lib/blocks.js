// Block list (Apple UGC guideline 1.2). Loaded once per session; consumers filter
// blocked users' posts/comments/DMs client-side.
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { useSession } from './auth'

const BlocksContext = createContext({ blockedIds: new Set(), block: async () => {}, unblock: async () => {}, refresh: async () => {} })

export function BlocksProvider({ children }) {
  const { session } = useSession()
  const [blockedIds, setBlockedIds] = useState(new Set())

  const refresh = useCallback(async () => {
    if (!session) { setBlockedIds(new Set()); return }
    const { data } = await supabase.from('blocked_users').select('blocked_id').eq('blocker_id', session.user.id)
    setBlockedIds(new Set((data ?? []).map(r => r.blocked_id)))
  }, [session])

  useEffect(() => { refresh() }, [refresh])

  const block = useCallback(async (userId, reportReason) => {
    if (!session || userId === session.user.id) return
    const { error } = await supabase.from('blocked_users').insert({ blocker_id: session.user.id, blocked_id: userId })
    // 23505 = already blocked
    if (error && error.code !== '23505') return
    // Blocking also severs any friendship (both directions of the dual-row model).
    await supabase.from('friends').delete().eq('user_id', session.user.id).eq('friend_id', userId)
    await supabase.from('friends').delete().eq('user_id', userId).eq('friend_id', session.user.id)
    setBlockedIds(prev => new Set(prev).add(userId))
    // Apple UGC guideline 1.2: blocking must also notify the developer of the
    // inappropriate content. File it as a content_report so it lands in the
    // admin's Content Reports queue (app/reports.jsx) for 24h review.
    await supabase.from('content_reports').insert({
      reporter_id: session.user.id,
      content_type: 'user',
      content_id: userId,
      content_owner_id: userId,
      reason: reportReason || 'Blocked user',
    })
  }, [session])

  const unblock = useCallback(async (userId) => {
    if (!session) return
    await supabase.from('blocked_users').delete().match({ blocker_id: session.user.id, blocked_id: userId })
    setBlockedIds(prev => {
      const next = new Set(prev)
      next.delete(userId)
      return next
    })
  }, [session])

  return (
    <BlocksContext.Provider value={{ blockedIds, block, unblock, refresh }}>
      {children}
    </BlocksContext.Provider>
  )
}

export function useBlocks() {
  return useContext(BlocksContext)
}
