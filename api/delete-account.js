import { createClient } from '@supabase/supabase-js'

// Permanently deletes the calling user's account and data.
// Required for Apple App Store Guideline 5.1.1(v).
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set in Vercel (server-only,
// never VITE_/EXPO_PUBLIC_ prefixed).
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return res.status(500).json({ error: 'Server not configured' })

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Missing auth token' })

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  const { data: { user }, error: authError } = await admin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Invalid auth token' })
  const userId = user.id

  // Best-effort cleanup: some tables cascade from auth.users, others don't have
  // checked-in schemas, so delete explicitly and ignore per-table errors.
  const deletions = [
    ['comment_likes', ['user_id']],
    ['post_likes', ['user_id']],
    ['comments', ['user_id']],
    ['posts', ['user_id']],
    ['content_reports', ['reporter_id']],
    ['blocked_users', ['blocker_id', 'blocked_id']],
    ['bug_reports', ['user_id']],
    ['direct_messages', ['sender_id', 'receiver_id']],
    ['friends', ['user_id', 'friend_id']],
    ['marketplace_messages', ['sender_id', 'receiver_id']],
    ['want_messages', ['sender_id', 'receiver_id']],
    ['marketplace_listings', ['user_id']],
    ['marketplace_wants', ['user_id']],
    ['sim_match_messages', ['user_id', 'sender_id']],
    ['sim_tournament_players', ['user_id']],
    ['sim_tournament_admins', ['user_id']],
    ['storefront_messages', ['sender_id', 'receiver_id']],
    ['storefronts', ['user_id']],
    ['tournaments', ['user_id']],
    ['decklists', ['user_id']],
    ['profiles', ['id']],
  ]
  for (const [table, cols] of deletions) {
    for (const col of cols) {
      try {
        await admin.from(table).delete().eq(col, userId)
      } catch {
        // table/column may not exist or may already cascade — keep going
      }
    }
  }

  // Purge uploaded files under the user's storage prefixes.
  const prefixes = [
    ['avatars', userId],
    ['card-photos', userId],
    ['card-photos', `dm/${userId}`],
  ]
  for (const [bucket, prefix] of prefixes) {
    try {
      const { data: files } = await admin.storage.from(bucket).list(prefix, { limit: 1000 })
      if (files?.length) {
        await admin.storage.from(bucket).remove(files.map((f) => `${prefix}/${f.name}`))
      }
    } catch {
      // bucket/prefix may not exist — keep going
    }
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
  if (deleteError && !/not.*found/i.test(deleteError.message || '')) {
    return res.status(500).json({ error: 'Failed to delete account' })
  }

  return res.status(200).json({ ok: true })
}
