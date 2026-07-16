// Shared card-search filtering: used by the Deck Builder search panel and the
// article editor's card search modal so both filter identically.

export const COLORS = { Red: '#e05545', Blue: '#3f8fd6', Green: '#3bb27e', Purple: '#8d7ae6', Yellow: '#e6b84f', Black: '#94a3b8' }
export const CARD_COLORS = ['Red', 'Blue', 'Green', 'Purple', 'Yellow', 'Black']

export const BOOSTER_SETS = ['OP01', 'OP02', 'OP03', 'OP04', 'OP05', 'OP06', 'OP07', 'OP08', 'OP09', 'OP10', 'OP11', 'OP12', 'OP13', 'OP14', 'OP15', 'OP16', 'EB01', 'EB02', 'EB03', 'EB04', 'PRB01', 'PRB02']

export const ALT_ART_OPTIONS = [
  ['', 'All'],
  ['parallel', 'Parallel'],
  ['sp', 'SP'],
  ['manga', 'Manga'],
  ['tr', 'TR'],
]

export const ALT_ART_ACCENTS = { parallel: '#d56a9c', sp: '#3bb27e', manga: '#38bdf8', tr: '#e08a3c' }

export function pillStyle(isActive, accentColor) {
  return {
    padding: '3px 9px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    border: isActive && accentColor ? `1px solid ${accentColor}66` : isActive ? '1px solid rgba(200,162,74,0.5)' : '1px solid rgba(140,176,208,0.15)',
    background: isActive && accentColor ? `${accentColor}26` : isActive ? 'rgba(140,176,208,0.2)' : 'transparent',
    color: isActive && accentColor ? accentColor : isActive ? '#52a9cd' : '#9db2c6',
  }
}

export function getAltArtType(card) {
  const name = (card.card_name ?? '').toLowerCase()
  const rarity = (card.card_rarity ?? '').toLowerCase()
  if (/\bsp\b/.test(name) || rarity === 'sp') return 'sp'
  if (/\btr\b/.test(name) || rarity === 'tr') return 'tr'
  if (/\bmanga\b/.test(name) || rarity === 'manga') return 'manga'
  if (/parallel|alt[\s_]art|alternate[\s_]art/.test(name) || rarity === 'parallel' || rarity === 'p') return 'parallel'
  return null
}

// filters: { colors: [], type: '', source: '', altArt: '', cost: null }
export function filterCards(cards, { colors = [], type = '', source = '', altArt = '', cost = null }) {
  return cards.filter(card => {
    if (colors.length > 0) {
      const cc = (card.card_color ?? '').split(/[\s/]+/).map(c => c.trim()).filter(Boolean)
      if (!colors.some(fc => cc.some(c => c.toLowerCase() === fc.toLowerCase()))) return false
    }
    if (type && card.card_type !== type) return false
    const id = card.card_set_id ?? ''
    if (source === 'ST' && !/^ST/i.test(id)) return false
    if (source === 'Promos' && !/^P-/i.test(id)) return false
    if (source && source !== 'ST' && source !== 'Promos' && !id.toUpperCase().startsWith(source)) return false
    if (altArt && getAltArtType(card) !== altArt) return false
    if (cost !== null && String(card.card_cost ?? '') !== String(cost)) return false
    return true
  })
}
