// RN port of src/components/BugReportModal.jsx — free-text bug report,
// works logged out. `page` is the mobile screen name (web uses pathname).
import { useState } from 'react'
import { Modal, View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/auth'
import { colors, font, radius } from '../theme'
import { fieldInput } from './forms'
import { GlassButton } from './glass'

export default function BugReportModal({ page = 'unknown', onClose }) {
  const { session } = useSession()
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!message.trim() || sending) return
    setSending(true)
    setError('')

    // Prefer the profile username (matches web behavior), fall back to metadata.
    let username = session?.user?.user_metadata?.username ?? null
    if (session) {
      const { data } = await supabase.from('profiles').select('username').eq('id', session.user.id).maybeSingle()
      if (data?.username) username = data.username
    }

    const { error: err } = await supabase.from('bug_reports').insert({
      message: message.trim(),
      user_id: session?.user?.id ?? null,
      username,
      page,
    })
    setSending(false)
    if (err) { setError('Could not send the report. Please try again.'); return }
    setSent(true)
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, borderColor: colors.lineStrong, padding: 20, paddingBottom: 36, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 16, fontFamily: font.bold, color: colors.text }}>🐞 Report a Bug</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8} style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: 'rgba(140,176,208,0.05)', borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.muted, fontSize: 14 }}>✕</Text>
            </TouchableOpacity>
          </View>

          {sent ? (
            <View style={{ alignItems: 'center', paddingVertical: 20, gap: 10 }}>
              <Text style={{ fontSize: 34 }}>⚓</Text>
              <Text style={{ fontSize: 15, fontFamily: font.bold, color: colors.emerald }}>Thanks for the report!</Text>
              <Text style={{ fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19, fontFamily: font.body }}>
                Your report helps keep PirateTracker sailing smooth. We'll take a look soon.
              </Text>
              <GlassButton onPress={onClose} pad={{ paddingVertical: 10, paddingHorizontal: 28 }} style={{ marginTop: 6 }}>
                <Text style={{ fontSize: 13, fontFamily: font.semi, color: colors.textSoft }}>Close</Text>
              </GlassButton>
            </View>
          ) : (
            <>
              <Text style={{ fontSize: 12, color: colors.muted, fontFamily: font.body, lineHeight: 18 }}>
                Something broken or acting weird? Describe what happened — no account needed.
              </Text>
              <TextInput
                placeholder="What went wrong? What were you doing when it happened?"
                placeholderTextColor={colors.faint}
                value={message}
                onChangeText={setMessage}
                multiline
                autoFocus
                style={{ ...fieldInput, minHeight: 110, textAlignVertical: 'top' }}
              />
              {error ? <Text style={{ fontSize: 12, color: colors.crimson, fontFamily: font.body }}>{error}</Text> : null}
              <GlassButton onPress={submit} disabled={sending || !message.trim()} tint={colors.gold} pad={{ paddingVertical: 12, paddingHorizontal: 18 }}>
                <Text style={{ fontSize: 14, fontFamily: font.bold, color: colors.onAccent }}>{sending ? 'Sending...' : 'Send Report'}</Text>
              </GlassButton>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}
