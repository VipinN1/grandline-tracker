// Report a post or comment (Apple UGC guideline 1.2). Inserts into content_reports;
// reviewed by the admin in app/reports.jsx.
import { useState } from 'react'
import { Modal, View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/auth'
import { colors, font, radius } from '../theme'
import { fieldInput } from './forms'
import { GlassButton } from './glass'

const REASONS = ['Spam', 'Harassment', 'Inappropriate content', 'Other']

export default function ReportModal({ contentType, contentId, contentOwnerId, onClose }) {
  const { session } = useSession()
  const [reason, setReason] = useState(null)
  const [details, setDetails] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!reason || sending || !session) return
    setSending(true)
    setError('')

    const { error: err } = await supabase.from('content_reports').insert({
      reporter_id: session.user.id,
      content_type: contentType,
      content_id: contentId,
      content_owner_id: contentOwnerId ?? null,
      reason,
      details: details.trim() || null,
    })
    setSending(false)
    if (err) {
      // 23505 = unique violation: this user already reported this content
      if (err.code === '23505') { setSent(true); return }
      setError('Could not send the report. Please try again.')
      return
    }
    setSent(true)
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, borderColor: colors.lineStrong, padding: 20, paddingBottom: 36, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 16, fontFamily: font.bold, color: colors.text }}>🚩 Report {contentType === 'comment' ? 'Comment' : 'Post'}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8} style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: 'rgba(140,176,208,0.05)', borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.muted, fontSize: 14 }}>✕</Text>
            </TouchableOpacity>
          </View>

          {sent ? (
            <View style={{ alignItems: 'center', paddingVertical: 20, gap: 10 }}>
              <Text style={{ fontSize: 34 }}>⚓</Text>
              <Text style={{ fontSize: 15, fontFamily: font.bold, color: colors.emerald }}>Report received</Text>
              <Text style={{ fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19, fontFamily: font.body }}>
                Thanks for keeping the community safe. Reports are reviewed within 24 hours and violating content is removed.
              </Text>
              <GlassButton onPress={onClose} pad={{ paddingVertical: 10, paddingHorizontal: 28 }} style={{ marginTop: 6 }}>
                <Text style={{ fontSize: 13, fontFamily: font.semi, color: colors.textSoft }}>Close</Text>
              </GlassButton>
            </View>
          ) : (
            <>
              <Text style={{ fontSize: 12, color: colors.muted, fontFamily: font.body, lineHeight: 18 }}>
                Why are you reporting this? Reports are reviewed within 24 hours.
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {REASONS.map((r) => {
                  const active = reason === r
                  return (
                    <TouchableOpacity
                      key={r}
                      onPress={() => setReason(r)}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 14,
                        borderRadius: radius.pill,
                        borderWidth: 1,
                        borderColor: active ? 'rgba(210,74,58,0.5)' : colors.line,
                        backgroundColor: active ? 'rgba(210,74,58,0.12)' : 'rgba(140,176,208,0.05)',
                      }}
                    >
                      <Text style={{ fontSize: 13, fontFamily: font.semi, color: active ? colors.crimson : colors.textSoft }}>{r}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
              <TextInput
                placeholder="Anything else we should know? (optional)"
                placeholderTextColor={colors.faint}
                value={details}
                onChangeText={setDetails}
                multiline
                style={{ ...fieldInput, minHeight: 80, textAlignVertical: 'top' }}
              />
              {error ? <Text style={{ fontSize: 12, color: colors.crimson, fontFamily: font.body }}>{error}</Text> : null}
              <GlassButton onPress={submit} disabled={sending || !reason} tint={colors.gold} pad={{ paddingVertical: 12, paddingHorizontal: 18 }}>
                <Text style={{ fontSize: 14, fontFamily: font.bold, color: colors.onAccent }}>{sending ? 'Sending...' : 'Submit Report'}</Text>
              </GlassButton>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}
