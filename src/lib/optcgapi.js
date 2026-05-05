const BASE = 'https://optcgapi.com/api'
const CACHE_KEY = 'optcg_card_cache'

function getCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function setCache(cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {}
}

export async function getCard(cardId) {
  const cache = getCache()
  if (cache[cardId]) return cache[cardId]

  // Try sets first, then starter decks
  let res = await fetch(`${BASE}/sets/card/${cardId}/`)
  if (!res.ok) res = await fetch(`${BASE}/decks/card/${cardId}/`)
  if (!res.ok) throw new Error(`Card not found: ${cardId}`)
  
  const data = await res.json()
  const card = data[0]
  cache[cardId] = card
  setCache(cache)
  return card
}

export async function getCardCached(cardId) {
  return getCard(cardId)
}

export async function enrichCards(cards) {
  const cache = getCache()
  const toFetch = cards.filter(c => !cache[c.id]).map(c => c.id)

  if (toFetch.length > 0) {
    await Promise.all(
      toFetch.map(async id => {
        try {
          // Try sets endpoint first, then decks endpoint
          let res = await fetch(`${BASE}/sets/card/${id}/`)
          if (!res.ok) res = await fetch(`${BASE}/decks/card/${id}/`)
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

export async function searchCards(query) {
  const res = await fetch(`${BASE}/sets/filtered/?card_name=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error('Search failed')
  return res.json()
}

export async function searchLeaders(query) {
  // Search both set cards and starter deck cards in parallel
  const [setsRes, decksRes] = await Promise.all([
    fetch(`${BASE}/sets/filtered/?card_name=${encodeURIComponent(query)}&card_type=Leader`),
    fetch(`${BASE}/decks/filtered/?card_name=${encodeURIComponent(query)}&card_type=Leader`),
  ])

  const [setsData, decksData] = await Promise.all([
    setsRes.ok ? setsRes.json() : [],
    decksRes.ok ? decksRes.json() : [],
  ])

  // Merge and deduplicate by card_set_id
  const merged = [...(setsData ?? []), ...(decksData ?? [])]
  const seen = new Set()
  return merged.filter(card => {
    if (seen.has(card.card_set_id)) return false
    seen.add(card.card_set_id)
    return true
  })
}

export function getCardImageUrl(cardId) {
  return `https://optcgapi.com/media/static/Card_Images/${cardId}.jpg`
}