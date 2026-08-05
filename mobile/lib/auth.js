import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext({ session: null, loading: true, bannedMessage: null })

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [bannedMessage, setBannedMessage] = useState(null)

  // Apple UGC guideline 1.2: an ejected (banned) user must be signed out and
  // kept out, even if their device still holds a valid session token — e.g.
  // an admin banned them while they were already logged in on another device.
  const applySession = useCallback(async (nextSession) => {
    if (!nextSession) { setSession(null); return }
    const { data: profile } = await supabase
      .from('profiles')
      .select('banned_at, ban_reason')
      .eq('id', nextSession.user.id)
      .single()
    if (profile?.banned_at) {
      setBannedMessage(profile.ban_reason
        ? `Your account was suspended for violating our community guidelines: ${profile.ban_reason}`
        : 'Your account was suspended for violating our community guidelines.')
      await supabase.auth.signOut()
      setSession(null)
      return
    }
    setBannedMessage(null)
    setSession(nextSession)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session).finally(() => setLoading(false))
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session)
    })
    return () => subscription.unsubscribe()
  }, [applySession])

  return (
    <AuthContext.Provider value={{ session, loading, bannedMessage }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useSession() {
  return useContext(AuthContext)
}
