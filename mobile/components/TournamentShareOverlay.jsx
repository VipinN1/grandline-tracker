// RN port of the `ShareOverlay` component inside src/components/TournamentModal.jsx
// — the compact "screenshot card" web generates when you tap Share on a
// tournament result. Kept as its own full-screen modal (separate from the
// tournament detail screen) so the detail screen's nicer full hero-banner
// browsing view isn't disturbed by what gets captured for sharing.
import { useRef, useState } from 'react'
import { Modal, View, Text, Image, TouchableOpacity, ScrollView } from 'react-native'
import { getCardImageUrl } from '../lib/optcgapi'
import { captureAndShare } from '../lib/shareImage'
import { colors, font, radius } from '../theme'
import { LEADER_COLORS } from './forms'

// Drop descriptive parentheticals like "(Alternate Art)" but keep card
// numbers like "(041)" — same rule as the tournament detail screen.
function cleanName(name) {
  return (name ?? '').replace(/\s*\(([^)]*[a-z][^)]*)\)/gi, '').trim()
}

function placementLabel(n) {
  if (n === 1) return '1st'
  if (n === 2) return '2nd'
  if (n === 3) return '3rd'
  return `${n}th`
}
function placementStyle(n) {
  if (n === 1) return { bg: 'rgba(200,162,74,0.15)', color: colors.gold, border: 'rgba(200,162,74,0.35)' }
  if (n === 2) return { bg: 'rgba(148,163,184,0.1)', color: '#94a3b8', border: 'rgba(148,163,184,0.3)' }
  if (n === 3) return { bg: 'rgba(251,146,60,0.1)', color: '#fb923c', border: 'rgba(251,146,60,0.3)' }
  return { bg: 'rgba(140,176,208,0.04)', color: colors.faint, border: 'rgba(140,176,208,0.08)' }
}

export default function TournamentShareOverlay({ tournament: t, onClose }) {
  const color = LEADER_COLORS[(t.leader_color ?? '').split(/[\s/]+/)[0]?.trim()] ?? colors.ocean
  const leaderName = cleanName(t.leader_name)
  const nameWords = leaderName ? leaderName.split(/\s+/).filter(Boolean) : []
  const multiWord = nameWords.length > 1
  const wordFontSize = multiWord ? 40 : 62

  const cardRef = useRef(null)
  const [sharing, setSharing] = useState(false)
  const [shareError, setShareError] = useState('')

  const rounds = (t.tournament_rounds ?? []).slice().sort((a, b) => a.round_number - b.round_number)
  const wentFirstWins = rounds.filter(r => r.went_first === true && r.result === 'win').length
  const wentFirstTotal = rounds.filter(r => r.went_first === true).length
  const wentSecondWins = rounds.filter(r => r.went_first === false && r.result === 'win').length
  const wentSecondTotal = rounds.filter(r => r.went_first === false).length
  const diceWins = rounds.filter(r => r.won_dice_roll === true && r.result === 'win').length
  const diceWon = rounds.filter(r => r.won_dice_roll === true).length
  const winRate = t.wins + t.losses > 0 ? Math.round((t.wins / (t.wins + t.losses)) * 100) : 0
  const hasRounds = rounds.length > 0
  const pStyle = placementStyle(t.placement)

  async function handleShare() {
    setShareError('')
    setSharing(true)
    try {
      await captureAndShare(cardRef, {
        fileName: `${(t.name ?? 'tournament').replace(/[^\w\- ]+/g, '').trim() || 'tournament'}.png`,
        title: t.name,
        text: 'Check out my tournament result on PirateTracker!',
      })
    } catch {
      setShareError('Could not generate the image. Try again.')
    }
    setSharing(false)
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.abyss }}>
        <ScrollView contentContainerStyle={{ alignItems: 'center', padding: 20, paddingTop: 50, paddingBottom: 40 }}>
          <Text style={{ fontSize: 13, fontFamily: font.bold, color: colors.text }}>📸 Screenshot to share</Text>
          <Text style={{ fontSize: 11, color: colors.faint, marginTop: 3, marginBottom: 16 }}>Tap Share below to save or send this image</Text>

          <View
            ref={cardRef}
            collapsable={false}
            style={{ width: '100%', maxWidth: 420, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.goldLine, backgroundColor: colors.abyss }}
          >
            {/* Header — compact leader portrait + title + result */}
            <View style={{ position: 'relative', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.line, overflow: 'hidden' }}>
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: color }} />

              {/* Ghosted leader name watermark — painted first so it sits behind the header content below */}
              {leaderName ? (
                <View pointerEvents="none" style={{ position: 'absolute', right: -10, top: 6, bottom: 6, width: '60%', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
                  {nameWords.map((w, i) => (
                    <Text
                      key={i}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.3}
                      style={{ fontFamily: font.bold, fontSize: wordFontSize, lineHeight: wordFontSize * 0.95, color: color + '1f', marginLeft: i * (wordFontSize * 0.3) }}
                    >
                      {w}
                    </Text>
                  ))}
                </View>
              ) : null}

              <View style={{ flexDirection: 'row', gap: 13, alignItems: 'center' }}>
                <View style={{ width: 58, borderRadius: 8, overflow: 'hidden', borderWidth: 2, borderColor: color }}>
                  <Image source={{ uri: getCardImageUrl(t.leader_id) }} style={{ width: '100%', aspectRatio: 63 / 88 }} resizeMode="cover" />
                  <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingVertical: 3, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.65)' }}>
                    <Text style={{ fontSize: 12, fontFamily: font.mono, color: '#fff' }}>{t.wins}-{t.losses}</Text>
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontSize: 17, fontFamily: font.bold, color: colors.text }}>{t.name}</Text>
                  <Text numberOfLines={1} style={{ fontSize: 11, color: colors.muted, marginTop: 3, fontFamily: font.body }}>
                    {t.date}{t.player_count ? ` · ${t.player_count} players` : ''}{t.location ? ` · ${t.location}` : ''}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 9, flexWrap: 'wrap' }}>
                    <View style={{ paddingVertical: 3, paddingHorizontal: 9, borderRadius: 6, backgroundColor: pStyle.bg, borderWidth: 1, borderColor: pStyle.border }}>
                      <Text style={{ fontSize: 11, fontFamily: font.bold, color: pStyle.color }}>{placementLabel(t.placement)}</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontFamily: font.mono }}>
                      <Text style={{ color: colors.emerald }}>{t.wins}W</Text>
                      <Text style={{ color: colors.faint }}> · </Text>
                      <Text style={{ color: colors.crimson }}>{t.losses}L</Text>
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.muted, fontFamily: font.body }}>{winRate}%</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Brand bar */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 18, backgroundColor: 'rgba(140,176,208,0.06)', borderBottomWidth: 1, borderBottomColor: colors.line }}>
              <Text style={{ fontSize: 12, fontFamily: font.bold, color: colors.ocean }}>PirateTracker</Text>
              <Text style={{ fontSize: 9.5, color: colors.faint }}>piratetracker.vercel.app</Text>
            </View>

            {/* Round-by-round table */}
            {hasRounds ? (
              <View style={{ padding: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.line }}>
                  <Text style={{ width: 22, fontSize: 8.5, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 0.6, color: colors.faint }}>Rd</Text>
                  <Text style={{ flex: 1, fontSize: 8.5, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 0.6, color: colors.faint }}>Opponent</Text>
                  <Text style={{ width: 38, textAlign: 'center', fontSize: 8.5, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 0.6, color: colors.faint }}>Dice</Text>
                  <Text style={{ width: 38, textAlign: 'center', fontSize: 8.5, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 0.6, color: colors.faint }}>Order</Text>
                  <Text style={{ width: 30, textAlign: 'center', fontSize: 8.5, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 0.6, color: colors.faint }}>Res</Text>
                </View>

                {rounds.map(r => {
                  const isBye = r.result === 'bye'
                  const oppColor = isBye ? colors.oceanBright : (LEADER_COLORS[r.opponent_leader_color] ?? '#94a3b8')
                  const isWin = r.result === 'win' || isBye
                  const switchedLeader = r.leader_id && r.leader_id !== t.leader_id
                  const switchColor = LEADER_COLORS[r.leader_color] ?? color
                  return (
                    <View key={r.id} style={{ marginTop: 5, borderRadius: 7, backgroundColor: isWin ? 'rgba(59,178,126,0.06)' : 'rgba(210,74,58,0.06)' }}>
                      <View style={{ position: 'relative', flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8 }}>
                        <Text style={{ width: 22, textAlign: 'center', fontSize: 12, fontFamily: font.mono, color: isWin ? colors.emerald : colors.crimson }}>{r.round_number}</Text>

                        {switchedLeader ? (
                          <Image
                            source={{ uri: getCardImageUrl(r.leader_id) }}
                            style={{ position: 'absolute', top: -5, left: 10, width: 17, height: 23, borderRadius: 4, borderWidth: 1.5, borderColor: switchColor, zIndex: 2 }}
                            resizeMode="cover"
                          />
                        ) : null}

                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          {r.opponent_leader_id ? (
                            <Image source={{ uri: getCardImageUrl(r.opponent_leader_id) }} style={{ width: 40, height: 56, borderRadius: 5, borderWidth: 1.5, borderColor: oppColor + '66' }} resizeMode="cover" />
                          ) : (
                            <View style={{ width: 40, height: 56, borderRadius: 5, backgroundColor: 'rgba(140,176,208,0.05)' }} />
                          )}
                          <Text numberOfLines={1} style={{ flex: 1, fontSize: 12.5, fontFamily: font.semi, color: oppColor }}>{isBye ? 'Bye' : (cleanName(r.opponent_leader_name) || 'Unknown')}</Text>
                        </View>

                        <View style={{ width: 38, alignItems: 'center' }}>
                          {r.won_dice_roll === null ? (
                            <Text style={{ color: '#3a526a', fontSize: 13 }}>—</Text>
                          ) : (
                            <View style={{ paddingVertical: 2, paddingHorizontal: 6, borderRadius: 5, backgroundColor: r.won_dice_roll ? 'rgba(59,178,126,0.16)' : 'rgba(210,74,58,0.16)' }}>
                              <Text style={{ fontSize: 9, fontFamily: font.mono, color: r.won_dice_roll ? colors.emerald : colors.crimson }}>🎲{r.won_dice_roll ? 'W' : 'L'}</Text>
                            </View>
                          )}
                        </View>

                        <View style={{ width: 38, alignItems: 'center' }}>
                          {r.went_first === null ? (
                            <Text style={{ color: '#3a526a', fontSize: 13 }}>—</Text>
                          ) : (
                            <View style={{ width: 20, height: 20, borderRadius: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: r.went_first ? 'rgba(200,162,74,0.16)' : 'rgba(82,169,205,0.16)' }}>
                              <Text style={{ fontSize: 10, fontFamily: font.mono, color: r.went_first ? colors.gold : colors.oceanBright }}>{r.went_first ? '1' : '2'}</Text>
                            </View>
                          )}
                        </View>

                        <View style={{ width: 30, alignItems: 'center' }}>
                          <View style={{ width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: isBye ? 'rgba(82,169,205,0.18)' : isWin ? 'rgba(59,178,126,0.18)' : 'rgba(210,74,58,0.18)' }}>
                            <Text style={{ fontSize: isBye ? 6.5 : 12, fontFamily: font.bold, color: isBye ? colors.oceanBright : isWin ? colors.emerald : colors.crimson }}>{isBye ? 'BYE' : isWin ? '✓' : '✕'}</Text>
                          </View>
                        </View>
                      </View>
                      {r.notes ? (
                        <Text style={{ fontSize: 11, color: colors.faint, fontStyle: 'italic', fontFamily: font.body, paddingHorizontal: 8, paddingLeft: 40, paddingBottom: 8, marginTop: -2 }}>{r.notes}</Text>
                      ) : null}
                    </View>
                  )
                })}
              </View>
            ) : null}

            {/* Stats footer */}
            {hasRounds ? (
              <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.line }}>
                {[
                  { label: 'Going 1st', value: wentFirstTotal > 0 ? `${Math.round(wentFirstWins / wentFirstTotal * 100)}%` : '—', sub: `${wentFirstWins}/${wentFirstTotal}` },
                  { label: 'Going 2nd', value: wentSecondTotal > 0 ? `${Math.round(wentSecondWins / wentSecondTotal * 100)}%` : '—', sub: `${wentSecondWins}/${wentSecondTotal}` },
                  { label: 'Dice Won', value: diceWon > 0 ? `${Math.round(diceWins / diceWon * 100)}%` : '—', sub: `${diceWins}/${diceWon}` },
                ].map((s, i) => (
                  <View key={s.label} style={{ flex: 1, paddingVertical: 8, alignItems: 'center', borderLeftWidth: i > 0 ? 1 : 0, borderLeftColor: colors.line }}>
                    <Text style={{ fontSize: 7.5, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 0.5, color: colors.faint, marginBottom: 3 }}>{s.label}</Text>
                    <Text style={{ fontSize: 14, fontFamily: font.mono, color: colors.oceanBright }}>{s.value}</Text>
                    <Text style={{ fontSize: 8.5, color: colors.faint, marginTop: 2 }}>{s.sub}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 22 }}>
            <TouchableOpacity
              onPress={handleShare}
              disabled={sharing}
              style={{ paddingVertical: 10, paddingHorizontal: 24, borderRadius: 10, borderWidth: 1, borderColor: colors.goldLine, backgroundColor: sharing ? 'rgba(200,162,74,0.08)' : 'rgba(200,162,74,0.14)' }}
            >
              <Text style={{ fontSize: 13, fontFamily: font.bold, color: colors.gold }}>{sharing ? 'Generating...' : '📤 Share / Save Image'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={{ paddingVertical: 10, paddingHorizontal: 24, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: 'rgba(140,176,208,0.05)' }}>
              <Text style={{ fontSize: 13, fontFamily: font.semi, color: colors.muted }}>✕ Close</Text>
            </TouchableOpacity>
          </View>
          {shareError ? <Text style={{ marginTop: 10, fontSize: 12, color: colors.crimson }}>{shareError}</Text> : null}
        </ScrollView>
      </View>
    </Modal>
  )
}
