// Helpers for the Articles feature: slugs, excerpts, and decklist parsing.

export const CATEGORIES = [
  { value: 'devlog', label: 'Dev Log', devOnly: true },
  { value: 'deck_guide', label: 'Deck Guide' },
  { value: 'strategy', label: 'Strategy' },
  { value: 'tournament_report', label: 'Tournament Report' },
  { value: 'news', label: 'News' },
  { value: 'other', label: 'Other' },
]

export function categoryLabel(value) {
  return CATEGORIES.find(c => c.value === value)?.label ?? value
}

// "Luffy's OP01 Deck Guide!" → "luffys-op01-deck-guide-x7k2p"
// A random suffix keeps slugs unique without a round-trip to the database.
export function slugify(title) {
  const base = (title ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
    .replace(/^-|-$/g, '')
  const suffix = Math.random().toString(36).slice(2, 7)
  return base ? `${base}-${suffix}` : suffix
}

// Walk a TipTap JSON document and collect plain text.
export function extractText(node) {
  if (!node) return ''
  if (node.type === 'text') return node.text ?? ''
  const inner = (node.content ?? []).map(extractText).join(' ')
  return inner
}

export function makeExcerpt(doc, max = 200) {
  const text = extractText(doc).replace(/\s+/g, ' ').trim()
  if (text.length <= max) return text
  return text.slice(0, max).replace(/\s+\S*$/, '') + '…'
}

// Find the first embedded card in the document (used as a default cover).
export function firstCardId(node) {
  if (!node) return null
  if (node.type === 'cardEmbed' && node.attrs?.cardId) return node.attrs.cardId
  if (node.type === 'decklistEmbed') {
    const leader = node.attrs?.leaderId
    if (leader) return leader
    const first = node.attrs?.cards?.[0]?.id
    if (first) return first
  }
  for (const child of node.content ?? []) {
    const found = firstCardId(child)
    if (found) return found
  }
  return null
}

// Parse a pasted decklist. Accepts the common formats:
//   4xOP01-016            (sim export)
//   4 OP01-016
//   4x Nami OP01-016
//   OP01-016 x4
// Returns { cards: [{ id, name, count }], errors: [line, ...] }
export function parseDecklistText(text) {
  const cards = []
  const errors = []
  const byId = new Map()

  for (const raw of (text ?? '').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue

    let count
    let rest

    // Leading count: "4x ..." or "4 ..."
    const lead = line.match(/^(\d+)\s*x?\s*(.*)$/i)
    // Trailing count: "... x4"
    const trail = line.match(/^(.*?)\s*x\s*(\d+)$/i)

    const idPattern = /([A-Z]{1,3}[0-9]{0,3}-\d{2,3})/i

    if (lead && idPattern.test(lead[2])) {
      count = parseInt(lead[1], 10)
      rest = lead[2]
    } else if (trail && idPattern.test(trail[1])) {
      count = parseInt(trail[2], 10)
      rest = trail[1]
    } else if (idPattern.test(line)) {
      count = 1
      rest = line
    } else {
      errors.push(line)
      continue
    }

    const idMatch = rest.match(idPattern)
    const id = idMatch[1].toUpperCase()
    const name = rest.replace(idPattern, '').replace(/[()·,-]+\s*$/, '').trim() || null

    if (byId.has(id)) {
      byId.get(id).count += count
    } else {
      const card = { id, name, count }
      byId.set(id, card)
      cards.push(card)
    }
  }

  return { cards, errors }
}

export function decklistToText(cards) {
  return (cards ?? []).map(c => `${c.count}x${c.id}`).join('\n')
}
