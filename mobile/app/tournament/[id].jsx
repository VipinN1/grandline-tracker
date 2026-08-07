// Tournament detail — modeled on the web share card (TournamentModal):
// zoomed leader-art hero, round table with dice/order/result columns,
// and a Going 1st / Going 2nd / Dice Won stats strip. Liquid Glass cards.
import { useState, useEffect, useRef } from 'react'
import { View, Text, ScrollView, Image, TouchableOpacity, ActivityIndicator, Alert, Share } from 'react-native'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../lib/auth'
import { getCardImageUrl } from '../../lib/optcgapi'
import { captureAndShare } from '../../lib/shareImage'
import { colors, font, radius } from '../../theme'
import { Glass, GlassButton } from '../../components/glass'
import { LEADER_COLORS, baseCardId } from '../../components/forms'
import DeckModal from '../../components/DeckModal'

// Drop descriptive parentheticals like "(Alternate Art)" but keep card
// numbers like "(041)".
function cleanName(name) {
  return (name ?? '').replace(/\s*\(([^)]*[a-z][^)]*)\)/gi, '').trim()
}

function Pill({ text, color }) {
  return (
    <View style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: color + '24', borderWidth: 1, borderColor: color + '55' }}>
      <Text style={{ fontSize: 11, fontFamily: font.bold, letterSpacing: 0.4, textTransform: 'uppercase', color }}>{text}</Text>
    </View>
  )
}

// Hero banner: the leader art blown up and framed on the upper-middle of the
// card, where the character's head usually sits.
function LeaderHero({ t, leaderColor }) {
  const [width, setWidth] = useState(0)
  const HEIGHT = 250
  const imgH = width * 1.4          // card aspect ratio 2.5 : 3.5
  const offsetY = imgH * 0.10       // crop starts ~10% down the card — head height

  return (
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ height: HEIGHT, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: leaderColor + '55', backgroundColor: colors.surface }}>
      {width > 0 && (
        <Image
          source={{ uri: getCardImageUrl(t.leader_id) }}
          style={{ position: 'absolute', top: -offsetY, width, height: imgH }}
          resizeMode="cover"
        />
      )}
      <LinearGradient
        colors={['rgba(6,16,27,0.05)', 'rgba(6,16,27,0.55)', 'rgba(6,16,27,1)']}
        locations={[0, 0.55, 1]}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: -1 }}
      />
      {/* Brand chip — keeps PirateTracker visible in screenshots */}
      <View style={{ position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(6,16,27,0.62)', borderWidth: 1, borderColor: 'rgba(200,162,74,0.4)' }}>
        <Text style={{ fontSize: 11 }}>🧭</Text>
        <Text style={{ fontSize: 10.5, fontFamily: font.bold, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.gold }}>PirateTracker</Text>
      </View>
      <View style={{ flex: 1, justifyContent: 'flex-end', padding: 16 }}>
        <Text numberOfLines={1} style={{ fontFamily: font.display, fontSize: 24, color: colors.text }}>{t.name}</Text>
        <Text style={{ fontSize: 12, color: colors.textSoft, fontFamily: font.body, marginTop: 2 }}>
          {t.date}{t.player_count ? ` · ${t.player_count} players` : ''}{t.location ? ` · ${t.location}` : ''}
        </Text>
        <Text numberOfLines={1} style={{ fontSize: 12, color: leaderColor, fontFamily: font.semi, marginTop: 3 }}>
          {cleanName(t.leader_name)} · {baseCardId(t.leader_id)}
        </Text>
      </View>
    </View>
  )
}

// Opponent thumb — square, zoomed into the upper art where the face sits.
const THUMB = 54

function OpponentThumb({ leaderId, color }) {
  if (!leaderId) {
    return <View style={{ width: THUMB, height: THUMB, borderRadius: 10, backgroundColor: 'rgba(140,176,208,0.05)' }} />
  }
  const imgH = THUMB * 1.4
  return (
    <View style={{ width: THUMB, height: THUMB, borderRadius: 10, overflow: 'hidden', borderWidth: 1.5, borderColor: color + '77', backgroundColor: colors.surface }}>
      <Image
        source={{ uri: getCardImageUrl(leaderId) }}
        style={{ width: THUMB, height: imgH, marginTop: -imgH * 0.12 }}
        resizeMode="cover"
      />
    </View>
  )
}

const colHeader = { fontSize: 10, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 0.8, color: colors.faint }

export default function TournamentDetail() {
  const { id } = useLocalSearchParams()
  const { session } = useSession()
  const [t, setT] = useState(null)
  const [decklists, setDecklists] = useState([])
  const [showDeck, setShowDeck] = useState(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [sharing, setSharing] = useState(false)
  const shareRef = useRef(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('tournaments')
        .select('*, tournament_rounds(*), tournament_decklists(decklists(*))')
        .eq('id', id)
        .single()
      setT(data)
      setLoading(false)
      const fromJoin = (data?.tournament_decklists ?? []).map(td => td.decklists).filter(Boolean)
      if (fromJoin.length > 0) {
        setDecklists(fromJoin)
      } else if (data?.decklist_id) {
        const { data: dl } = await supabase.from('decklists').select('*').eq('id', data.decklist_id).maybeSingle()
        if (dl) setDecklists([dl])
      }
    }
    load()
  }, [id])

  async function shareAsText() {
    const rounds = (t.tournament_rounds ?? []).slice().sort((a, b) => a.round_number - b.round_number)
    const lines = [
      `⚓ ${t.name} — ${t.date}`,
      `${cleanName(t.leader_name)} · #${t.placement}${t.player_count ? ` of ${t.player_count}` : ''}`,
      `Record: ${t.wins}W-${t.losses}L${t.wins + t.losses > 0 ? ` (${Math.round(t.wins / (t.wins + t.losses) * 100)}%)` : ''}`,
      '',
      ...rounds.map(r => `R${r.round_number}: ${r.result === 'win' ? 'W' : 'L'} vs ${cleanName(r.opponent_leader_name) || '?'}${r.went_first !== null ? ` (${r.went_first ? '1st' : '2nd'})` : ''}`),
      '',
      'Tracked with PirateTracker 🏴‍☠️',
    ]
    try { await Share.share({ message: lines.join('\n') }) } catch {}
  }

  async function handleShare() {
    if (sharing) return
    setSharing(true)
    try {
      await captureAndShare(shareRef, {
        fileName: `${(t.name ?? 'tournament').replace(/[^\w\- ]+/g, '').trim() || 'tournament'}.png`,
        title: t.name,
        text: 'Check out my tournament result on PirateTracker!',
      })
    } catch {
      // Image capture failed for any reason (e.g. no share provider) — a
      // plain text share still gets the result out.
      await shareAsText()
    }
    setSharing(false)
  }

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

  const screenOpts = {
    headerShown: true,
    title: t?.name ?? '',
    headerBackButtonDisplayMode: 'minimal',
    headerStyle: { backgroundColor: '#08101b' },
    headerTitleStyle: { fontFamily: font.display, fontSize: 17, color: colors.parchment },
    headerTintColor: colors.parchment,
  }

  if (loading) {
    return (
      <>
        <Stack.Screen options={screenOpts} />
        <View style={{ flex: 1, backgroundColor: colors.abyss, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.gold} />
        </View>
      </>
    )
  }

  if (!t) {
    return (
      <>
        <Stack.Screen options={screenOpts} />
        <View style={{ flex: 1, backgroundColor: colors.abyss, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ fontSize: 15, color: colors.muted, fontFamily: font.body }}>Tournament not found.</Text>
        </View>
      </>
    )
  }

  const rounds = (t.tournament_rounds ?? []).slice().sort((a, b) => a.round_number - b.round_number)
  const isMine = session?.user?.id === t.user_id
  const leaderColor = LEADER_COLORS[t.leader_color] ?? colors.muted
  const winPct = t.wins + t.losses > 0 ? Math.round((t.wins / (t.wins + t.losses)) * 100) : null

  // Dice / turn-order stats — same definitions as the web share card.
  const wentFirstWins = rounds.filter(r => r.went_first === true && r.result === 'win').length
  const wentFirstTotal = rounds.filter(r => r.went_first === true).length
  const wentSecondWins = rounds.filter(r => r.went_first === false && r.result === 'win').length
  const wentSecondTotal = rounds.filter(r => r.went_first === false).length
  const diceWins = rounds.filter(r => r.won_dice_roll === true && r.result === 'win').length
  const diceWon = rounds.filter(r => r.won_dice_roll === true).length
  const hasDiceData = wentFirstTotal + wentSecondTotal + diceWon > 0

  const diceStats = [
    { label: 'Going 1st', value: wentFirstTotal > 0 ? `${Math.round(wentFirstWins / wentFirstTotal * 100)}%` : '—', sub: `${wentFirstWins}/${wentFirstTotal}` },
    { label: 'Going 2nd', value: wentSecondTotal > 0 ? `${Math.round(wentSecondWins / wentSecondTotal * 100)}%` : '—', sub: `${wentSecondWins}/${wentSecondTotal}` },
    { label: 'Dice Won', value: diceWon > 0 ? `${Math.round(diceWins / diceWon * 100)}%` : '—', sub: `${diceWins}/${diceWon}` },
  ]

  return (
    <>
      <Stack.Screen options={screenOpts} />
      <ScrollView style={{ flex: 1, backgroundColor: colors.abyss }} contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 12 }}>

        {/* Everything inside this wrapper is what gets captured for the share
            image (mirrors the web ShareOverlay's cropped "screenshot zone")
            — decklist/notes/edit/delete stay outside it. collapsable={false}
            keeps Android from flattening the view out of the native tree,
            which would make it uncapturable. */}
        <View ref={shareRef} collapsable={false} style={{ gap: 12 }}>
          {/* Hero */}
          <LeaderHero t={t} leaderColor={leaderColor} />

          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Pill text={`#${t.placement}${t.player_count ? ` of ${t.player_count}` : ''}`} color={colors.gold} />
            <Pill text={`${t.wins}W · ${t.losses}L`} color={t.wins >= t.losses ? colors.emerald : colors.crimson} />
            {winPct !== null ? <Pill text={`${winPct}%`} color={colors.oceanBright} /> : null}
            {t.is_practice ? <Pill text="Practice" color={colors.muted} /> : null}
          </View>

          {/* Brand line above the rounds — can't be cropped out of a rounds screenshot */}
          <Text style={{ textAlign: 'center', fontSize: 13.5, fontFamily: font.body, letterSpacing: 0.4, color: colors.muted, marginTop: 2, marginBottom: -4 }}>
            piratetracker.vercel.app
          </Text>

          {/* Rounds table */}
        <Glass style={{ padding: 14 }}>
          <Text style={{ fontSize: 11, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 1, color: colors.gold, marginBottom: 10 }}>
            Rounds ({rounds.length})
          </Text>
          {rounds.length === 0 ? (
            <Text style={{ fontSize: 13, color: colors.faint, fontFamily: font.body }}>No round data recorded.</Text>
          ) : (
            <>
              {/* Column header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(140,176,208,0.07)' }}>
                <Text style={{ ...colHeader, width: 20 }}>Rd</Text>
                <Text style={{ ...colHeader, flex: 1 }}>Opponent</Text>
                <Text style={{ ...colHeader, width: 52, textAlign: 'center' }}>Dice</Text>
                <Text numberOfLines={1} style={{ ...colHeader, width: 36, textAlign: 'center' }}>Turn</Text>
                <Text style={{ ...colHeader, width: 34, textAlign: 'center' }}>Res</Text>
              </View>

              {rounds.map(r => {
                const isWin = r.result === 'win'
                const oppColor = LEADER_COLORS[r.opponent_leader_color] ?? '#94a3b8'
                const switchedLeader = r.leader_id && r.leader_id !== t.leader_id
                const switchColor = LEADER_COLORS[r.leader_color] ?? colors.muted
                return (
                  <View key={r.id} style={{ marginTop: 7, borderRadius: 12, backgroundColor: isWin ? 'rgba(59,178,126,0.07)' : 'rgba(210,74,58,0.07)', paddingVertical: 10, paddingHorizontal: 8, ...(switchedLeader ? { borderWidth: 1, borderColor: switchColor + '33' } : null) }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text style={{ width: 20, textAlign: 'center', fontSize: 14, fontFamily: font.mono, color: isWin ? colors.emerald : colors.crimson }}>{r.round_number}</Text>
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <OpponentThumb leaderId={r.opponent_leader_id} color={oppColor} />
                        <Text numberOfLines={2} style={{ flex: 1, fontSize: 13.5, fontFamily: font.semi, color: oppColor }}>
                          {cleanName(r.opponent_leader_name) || 'Unknown'}
                        </Text>
                      </View>
                      <View style={{ width: 52, alignItems: 'center' }}>
                        {r.won_dice_roll === null ? (
                          <Text style={{ color: '#3a526a', fontSize: 15 }}>—</Text>
                        ) : (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 8, backgroundColor: r.won_dice_roll ? 'rgba(59,178,126,0.18)' : 'rgba(210,74,58,0.18)' }}>
                            <Text style={{ fontSize: 13 }}>🎲</Text>
                            <Text style={{ fontSize: 14, fontFamily: font.bold, color: r.won_dice_roll ? colors.emerald : colors.crimson }}>{r.won_dice_roll ? 'W' : 'L'}</Text>
                          </View>
                        )}
                      </View>
                      <View style={{ width: 36, alignItems: 'center' }}>
                        {r.went_first === null ? (
                          <Text style={{ color: '#3a526a', fontSize: 15 }}>—</Text>
                        ) : (
                          <View style={{ width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: r.went_first ? 'rgba(200,162,74,0.18)' : 'rgba(82,169,205,0.18)' }}>
                            <Text style={{ fontSize: 14, fontFamily: font.bold, color: r.went_first ? colors.gold : colors.oceanBright }}>{r.went_first ? '1' : '2'}</Text>
                          </View>
                        )}
                      </View>
                      <View style={{ width: 34, alignItems: 'center' }}>
                        <View style={{ width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: isWin ? 'rgba(59,178,126,0.2)' : 'rgba(210,74,58,0.2)' }}>
                          <Text style={{ fontSize: 15, fontFamily: font.bold, color: isWin ? colors.emerald : colors.crimson }}>{isWin ? '✓' : '✕'}</Text>
                        </View>
                      </View>
                    </View>
                    {switchedLeader ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: switchColor + '33', borderStyle: 'dashed' }}>
                        <Image source={{ uri: getCardImageUrl(r.leader_id) }} style={{ width: 26, height: 36, borderRadius: 5, borderWidth: 1.5, borderColor: switchColor }} resizeMode="cover" />
                        <View>
                          <Text style={{ fontSize: 8.5, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 0.5, color: colors.faint }}>Switched leader this round</Text>
                          <Text style={{ fontSize: 12, fontFamily: font.bold, color: switchColor, marginTop: 1 }}>{r.leader_name}</Text>
                        </View>
                      </View>
                    ) : null}
                    {r.notes ? (
                      <Text style={{ fontSize: 11, color: colors.faint, fontFamily: font.body, marginTop: 7, marginLeft: 30 }}>{r.notes}</Text>
                    ) : null}
                  </View>
                )
              })}
            </>
          )}
        </Glass>

        {/* Dice stats strip */}
        {hasDiceData && (
          <Glass style={{ flexDirection: 'row' }}>
            {diceStats.map((s, i) => (
              <View key={s.label} style={{ flex: 1, paddingVertical: 16, alignItems: 'center', borderLeftWidth: i > 0 ? 1 : 0, borderLeftColor: 'rgba(140,176,208,0.08)' }}>
                <Text style={{ fontSize: 10, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 0.7, color: colors.faint, marginBottom: 6 }}>{s.label}</Text>
                <Text style={{ fontSize: 22, fontFamily: font.mono, color: colors.oceanBright }}>{s.value}</Text>
                <Text style={{ fontSize: 11, color: colors.faint, fontFamily: font.body, marginTop: 3 }}>{s.sub}</Text>
              </View>
            ))}
          </Glass>
        )}
        </View>

        {/* Attached decklists — a tournament can have more than one when the
            player swapped decks mid-event alongside a leader switch. */}
        {decklists.length > 0 ? (
          <Glass style={{ padding: 14 }}>
            <Text style={{ fontSize: 11, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 1, color: colors.gold, marginBottom: 10 }}>
              {decklists.length > 1 ? `Decklists (${decklists.length})` : 'Decklist'}
            </Text>
            <View style={{ gap: decklists.length > 1 ? 10 : 0 }}>
              {decklists.map(dl => (
                <TouchableOpacity key={dl.id} onPress={() => setShowDeck(dl)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Image source={{ uri: getCardImageUrl(dl.leader_id) }} style={{ width: 40, height: 56, borderRadius: 5 }} resizeMode="cover" />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.bold, color: colors.text }}>{dl.name}</Text>
                    <Text numberOfLines={1} style={{ fontSize: 11, color: colors.muted, marginTop: 2, fontFamily: font.body }}>
                      {dl.leader_name} · {(dl.cards ?? []).reduce((s, c) => s + c.count, 0)} cards
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, fontFamily: font.semi, color: colors.oceanBright }}>View ›</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Glass>
        ) : null}

        {/* Notes */}
        {t.notes ? (
          <Glass style={{ padding: 16 }}>
            <Text style={{ fontSize: 11, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 1, color: colors.gold, marginBottom: 8 }}>Notes</Text>
            <Text style={{ fontSize: 13, color: colors.textSoft, fontFamily: font.body, lineHeight: 19 }}>{t.notes}</Text>
          </Glass>
        ) : null}

        <GlassButton onPress={handleShare} disabled={sharing} pad={{ paddingVertical: 12, paddingHorizontal: 16 }}>
          <Text style={{ fontSize: 13, fontFamily: font.semi, color: colors.oceanBright }}>{sharing ? 'Preparing image...' : '📤 Share Result'}</Text>
        </GlassButton>

        {isMine ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <GlassButton
              onPress={() => router.push({ pathname: '/(tabs)/log', params: { edit: t.id } })}
              pad={{ paddingVertical: 12, paddingHorizontal: 16 }}
              style={{ flex: 1 }}
            >
              <Text style={{ fontSize: 13, fontFamily: font.semi, color: colors.gold }}>✏️ Edit</Text>
            </GlassButton>
            <GlassButton onPress={confirmDelete} disabled={deleting} pad={{ paddingVertical: 12, paddingHorizontal: 16 }} style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontFamily: font.semi, color: colors.crimson }}>{deleting ? 'Deleting...' : 'Delete'}</Text>
            </GlassButton>
          </View>
        ) : null}
      </ScrollView>
      {showDeck && <DeckModal deck={showDeck} onClose={() => setShowDeck(null)} />}
    </>
  )
}
