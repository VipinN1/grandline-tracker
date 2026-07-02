import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Image, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../lib/auth'
import { getCardImageUrl } from '../../lib/optcgapi'
import { colors, font, radius, card } from '../../theme'
import { LEADER_COLORS, baseCardId } from '../../components/forms'

function Pill({ text, color }) {
  return (
    <View style={{ paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999, backgroundColor: color + '1f', borderWidth: 1, borderColor: color + '52' }}>
      <Text style={{ fontSize: 10, fontFamily: font.bold, letterSpacing: 0.4, textTransform: 'uppercase', color }}>{text}</Text>
    </View>
  )
}

export default function TournamentDetail() {
  const { id } = useLocalSearchParams()
  const { session } = useSession()
  const [t, setT] = useState(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('tournaments')
        .select('*, tournament_rounds(*)')
        .eq('id', id)
        .single()
      setT(data)
      setLoading(false)
    }
    load()
  }, [id])

  function confirmDelete() {
    Alert.alert('Delete tournament', `Delete "${t.name}" and all its rounds? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          setDeleting(true)
          await supabase.from('tournament_rounds').delete().eq('tournament_id', t.id)
          const { error } = await supabase.from('tournaments').delete().eq('id', t.id)
          setDeleting(false)
          if (error) Alert.alert('Delete failed', error.message)
          else router.back()
        },
      },
    ])
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.abyss, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.gold} />
      </View>
    )
  }

  if (!t) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.abyss, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontSize: 15, color: colors.muted, fontFamily: font.body }}>Tournament not found.</Text>
      </View>
    )
  }

  const rounds = (t.tournament_rounds ?? []).slice().sort((a, b) => a.round_number - b.round_number)
  const isMine = session?.user?.id === t.user_id
  const leaderColor = LEADER_COLORS[t.leader_color] ?? colors.muted

  return (
    <>
      <Stack.Screen options={{
        headerShown: true,
        title: t.name,
        headerStyle: { backgroundColor: '#08101b' },
        headerTitleStyle: { fontFamily: font.display, fontSize: 17, color: colors.parchment },
        headerTintColor: colors.parchment,
      }} />
      <ScrollView style={{ flex: 1, backgroundColor: colors.abyss }} contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 12 }}>

        {/* Summary */}
        <View style={{ ...card, padding: 16 }}>
          <View style={{ flexDirection: 'row', gap: 14 }}>
            <Image
              source={{ uri: getCardImageUrl(t.leader_id) }}
              style={{ width: 72, height: 100, borderRadius: 8, borderWidth: 1.5, borderColor: leaderColor + '88' }}
              resizeMode="cover"
            />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontSize: 17, fontFamily: font.display, color: colors.text }}>{t.name}</Text>
              <Text style={{ fontSize: 12, color: colors.muted, fontFamily: font.body }}>{t.date}{t.location ? ` · ${t.location}` : ''}</Text>
              <Text style={{ fontSize: 12, color: leaderColor, fontFamily: font.semi }}>
                {t.leader_name} · {baseCardId(t.leader_id)}
              </Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                <Pill text={`#${t.placement}${t.player_count ? ` of ${t.player_count}` : ''}`} color={colors.gold} />
                <Pill text={`${t.wins}W - ${t.losses}L`} color={t.wins >= t.losses ? colors.emerald : colors.crimson} />
                {t.is_practice ? <Pill text="Practice" color={colors.oceanBright} /> : null}
              </View>
            </View>
          </View>
        </View>

        {/* Rounds */}
        <View style={{ ...card, padding: 16 }}>
          <Text style={{ fontSize: 12, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 1, color: colors.faint, marginBottom: 12 }}>
            Rounds ({rounds.length})
          </Text>
          {rounds.length === 0 ? (
            <Text style={{ fontSize: 13, color: colors.faint, fontFamily: font.body }}>No round data recorded.</Text>
          ) : (
            <View style={{ gap: 8 }}>
              {rounds.map(r => {
                const win = r.result === 'win'
                return (
                  <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: colors.line }}>
                    <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: win ? 'rgba(59,178,126,0.14)' : 'rgba(210,74,58,0.14)', borderWidth: 1, borderColor: win ? 'rgba(59,178,126,0.4)' : 'rgba(210,74,58,0.4)', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 13, fontFamily: font.bold, color: win ? colors.emerald : colors.crimson }}>{win ? 'W' : 'L'}</Text>
                    </View>
                    {r.opponent_leader_id ? (
                      <Image source={{ uri: getCardImageUrl(r.opponent_leader_id) }} style={{ width: 30, height: 41, borderRadius: 4 }} resizeMode="cover" />
                    ) : null}
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.semi, color: colors.text }}>
                        R{r.round_number} · {r.opponent_leader_name ?? 'Unknown opponent'}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.muted, fontFamily: font.body, marginTop: 2 }}>
                        {[
                          r.won_dice_roll === true ? 'Won dice' : r.won_dice_roll === false ? 'Lost dice' : null,
                          r.went_first === true ? 'Went 1st' : r.went_first === false ? 'Went 2nd' : null,
                        ].filter(Boolean).join(' · ') || '—'}
                      </Text>
                      {r.notes ? (
                        <Text style={{ fontSize: 11, color: colors.faint, fontFamily: font.body, marginTop: 3 }}>{r.notes}</Text>
                      ) : null}
                    </View>
                  </View>
                )
              })}
            </View>
          )}
        </View>

        {/* Notes */}
        {t.notes ? (
          <View style={{ ...card, padding: 16 }}>
            <Text style={{ fontSize: 12, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 1, color: colors.faint, marginBottom: 8 }}>Notes</Text>
            <Text style={{ fontSize: 13, color: colors.textSoft, fontFamily: font.body, lineHeight: 19 }}>{t.notes}</Text>
          </View>
        ) : null}

        {isMine ? (
          <TouchableOpacity
            onPress={confirmDelete}
            disabled={deleting}
            style={{ borderWidth: 1, borderColor: 'rgba(210,74,58,0.34)', borderRadius: radius.sm, paddingVertical: 12, alignItems: 'center', opacity: deleting ? 0.5 : 1 }}
          >
            <Text style={{ fontSize: 13, fontFamily: font.semi, color: colors.crimson }}>{deleting ? 'Deleting...' : 'Delete Tournament'}</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </>
  )
}
