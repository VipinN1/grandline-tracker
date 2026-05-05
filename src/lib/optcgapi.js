const BASE = 'https://optcgapi.com/api'
const CACHE_KEY = 'optcg_card_cache'
const ST_CACHE_KEY = 'optcg_st_cards'

function getCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') }
  catch { return {} }
}

function setCache(cache) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)) }
  catch {}
}

// Fetch and cache all ST cards once
async function getSTCards() {
  try {
    const cached = localStorage.getItem(ST_CACHE_KEY)
    if (cached) return JSON.parse(cached)

    const res = await fetch(`${BASE}/allSTCards/`)
    if (!res.ok) return []
    const data = await res.json()

    // Also store each card in the main card cache by card_set_id
    const cardCache = getCache()
    data.forEach(card => {
      if (card.card_set_id) cardCache[card.card_set_id] = card
    })
    setCache(cardCache)
    localStorage.setItem(ST_CACHE_KEY, JSON.stringify(data))
    return data
  } catch {
    return []
  }
}

export async function getCard(cardId) {
  const cache = getCache()
  if (cache[cardId]) return cache[cardId]

  // Try sets endpoint first
  let res = await fetch(`${BASE}/sets/card/${cardId}/`)
  if (!res.ok) {
    // Fall back to checking ST cache
    const stCards = await getSTCards()
    const found = stCards.find(c => c.card_set_id === cardId)
    if (found) return found
    throw new Error(`Card not found: ${cardId}`)
  }

  const data = await res.json()
  const card = data[0]
  const cardCache = getCache()
  cardCache[cardId] = card
  setCache(cardCache)
  return card
}

export async function enrichCards(cards) {
  // Make sure ST cards are cached first
  await getSTCards()

  const cache = getCache()
  const toFetch = cards.filter(c => !cache[c.id]).map(c => c.id)

  if (toFetch.length > 0) {
    await Promise.all(
      toFetch.map(async id => {
        try {
          const res = await fetch(`${BASE}/sets/card/${id}/`)
          if (res.ok) {
            const data = await res.json()
            if (data[0]) cache[id] = data[0]
          }
        } catch {}
      })
    )
    setCache(cache)
  }

  return cards.map(card => ({
    ...card,
    name: cache[card.id]?.card_name ?? card.name ?? card.id,
    color: cache[card.id]?.card_color ?? null,
    type: cache[card.id]?.card_type ?? null,
    image: cache[card.id]?.card_image ?? null,
  }))
}

export async function searchLeaders(query) {
  const q = query.toLowerCase()

  // Run both in parallel — ST cache fetch and sets API search
  const [setsRes, stCards] = await Promise.all([
    fetch(`${BASE}/sets/filtered/?card_name=${encodeURIComponent(query)}&card_type=Leader`),
    getSTCards(),
  ])

  const setsData = setsRes.ok ? await setsRes.json() : []

  // Search ST leaders locally — check both name AND card_set_id
  const stLeaders = stCards.filter(card =>
    card.card_type === 'Leader' && (
      card.card_name?.toLowerCase().includes(q) ||
      card.card_set_id?.toLowerCase().includes(q) ||
      card.set_name?.toLowerCase().includes(q)
    )
  )

  // Merge and deduplicate by card_set_id
  const merged = [...(setsData ?? []), ...stLeaders]
  const seen = new Set()
  return merged.filter(card => {
    const key = card.card_set_id
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function searchCards(query) {
  const res = await fetch(`${BASE}/sets/filtered/?card_name=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error('Search failed')
  return res.json()
}

export function getCardImageUrl(cardId) {
  return `https://optcgapi.com/media/static/Card_Images/${cardId}.jpg`
}