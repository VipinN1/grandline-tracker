const BASE = 'https://optcgapi.com/api'
const CACHE_KEY = 'optcg_card_cache'
const ST_CACHE_KEY = 'optcg_st_cards'
const PROMO_CACHE_KEY = 'optcg_promo_cards'
const CACHE_TTL = 86400000 // 24 hours

function getCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') }
  catch { return {} }
}

function setCache(cache) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)) }
  catch {}
}

// Matches: OP14-120, ST01-001, P-001, EB02-052
function looksLikeCardId(query) {
  return /^[a-zA-Z]{1,3}[0-9]{0,3}-[0-9]+/i.test(query.trim())
}

// OP14-120 → OP14, ST01-001 → ST01, P-001 → P, EB02-052 → EB02
function extractSetPrefix(cardId) {
  const match = cardId.toUpperCase().match(/^([A-Z]{1,3}[0-9]{0,3})-/)
  return match ? match[1] : null
}

// TTL-aware localStorage helpers
function readTTLCache(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Handle legacy plain-array format (before TTL was added)
    if (Array.isArray(parsed)) return parsed
    if (parsed.data && (Date.now() - parsed.cachedAt) < CACHE_TTL) return parsed.data
    return null // expired
  } catch { return null }
}

function writeTTLCache(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ data, cachedAt: Date.now() })) }
  catch {}
}

async function getSTCards() {
  try {
    const cached = readTTLCache(ST_CACHE_KEY)
    if (cached) return cached

    const res = await fetch(`${BASE}/allSTCards/`)
    if (!res.ok) return []
    const data = await res.json()

    const cardCache = getCache()
    data.forEach(card => { if (card.card_set_id) cardCache[card.card_set_id] = card })
    setCache(cardCache)
    writeTTLCache(ST_CACHE_KEY, data)
    return data
  } catch { return [] }
}

export async function getPromoCards() {
  try {
    const cached = readTTLCache(PROMO_CACHE_KEY)
    if (cached) return cached

    const res = await fetch(`${BASE}/promos/`)
    if (!res.ok) return []
    const data = await res.json()

    const cardCache = getCache()
    data.forEach(card => { if (card.card_set_id) cardCache[card.card_set_id] = card })
    setCache(cardCache)
    writeTTLCache(PROMO_CACHE_KEY, data)
    return data
  } catch { return [] }
}

// Fetch and cache all cards from a specific booster set (e.g. "OP14")
async function getSetCards(setId) {
  const cacheKey = `optcg_set_${setId}`
  try {
    const cached = readTTLCache(cacheKey)
    if (cached) return cached

    const res = await fetch(`${BASE}/sets/${setId}/`)
    if (!res.ok) return []
    const data = await res.json()

    const cardCache = getCache()
    data.forEach(card => { if (card.card_set_id) cardCache[card.card_set_id] = card })
    setCache(cardCache)
    writeTTLCache(cacheKey, data)
    return data
  } catch { return [] }
}

export async function getCard(cardId) {
  const cache = getCache()
  if (cache[cardId]) return cache[cardId]

  const [stCards, promoCards] = await Promise.all([getSTCards(), getPromoCards()])

  const stMatch = stCards.find(c => c.card_set_id === cardId)
  if (stMatch) { cache[cardId] = stMatch; setCache(cache); return stMatch }

  const promoMatch = promoCards.find(c => c.card_set_id === cardId)
  if (promoMatch) { cache[cardId] = promoMatch; setCache(cache); return promoMatch }

  let res = await fetch(`${BASE}/sets/card/${cardId}/`)
  if (!res.ok) res = await fetch(`${BASE}/sets/card/${cardId.toUpperCase()}/`)

  if (!res.ok) {
    // Last resort: fetch the whole set and find the card within it
    const setPrefix = extractSetPrefix(cardId)
    if (setPrefix) {
      const setCards = await getSetCards(setPrefix)
      const found = setCards.find(c => c.card_set_id?.toUpperCase() === cardId.toUpperCase())
      if (found) { cache[cardId] = found; setCache(cache); return found }
    }
    throw new Error(`Card not found: ${cardId}`)
  }

  const data = await res.json()
  const card = data[0]
  if (card) { cache[cardId] = card; setCache(cache) }
  return card
}

export async function enrichCards(cards) {
  await getSTCards()

  const cache = getCache()
  const promoCards = await getPromoCards()
  const toFetch = cards.filter(c => !cache[c.id]).map(c => c.id)

  if (toFetch.length > 0) {
    await Promise.all(
      toFetch.map(async id => {
        try {
          const promoMatch = promoCards.find(c => c.card_set_id === id)
          if (promoMatch) { cache[id] = promoMatch; return }

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
  if (!query || query.trim().length < 2) return []

  const q = query.trim()
  const results = []
  const seen = new Set()

  function addResult(card) {
    if (card.card_type !== 'Leader') return
    if (!seen.has(card.card_set_id)) {
      seen.add(card.card_set_id)
      results.push(card)
    }
  }

  const stCards = await getSTCards()

  if (looksLikeCardId(q)) {
    const normalizedId = q.toUpperCase()
    const setPrefix = normalizedId.split('-')[0]

    try {
      const exactRes = await fetch(`${BASE}/sets/card/${normalizedId}/`)
      if (exactRes.ok) {
        const exactData = await exactRes.json()
        if (exactData?.[0]) {
          addResult(exactData[0])
          const cardName = exactData[0].card_name
          const nameRes = await fetch(`${BASE}/sets/filtered/?card_name=${encodeURIComponent(cardName)}&card_type=Leader`)
          if (nameRes.ok) {
            const nameData = await nameRes.json()
            ;(nameData ?? []).filter(c => c.card_set_id.startsWith(setPrefix)).forEach(addResult)
            ;(nameData ?? []).filter(c => !c.card_set_id.startsWith(setPrefix)).forEach(addResult)
          }
        }
      }
    } catch {}

    stCards
      .filter(c => c.card_set_id?.toUpperCase() === normalizedId || c.card_set_id?.toUpperCase().startsWith(setPrefix))
      .forEach(addResult)

  } else {
    const ql = q.toLowerCase()
    const normalizedQ = ql.replace(/[^a-z0-9]/g, '')

    try {
      const nameRes = await fetch(`${BASE}/sets/filtered/?card_name=${encodeURIComponent(q)}&card_type=Leader`)
      if (nameRes.ok) {
        const nameData = await nameRes.json()
        ;(nameData ?? []).forEach(addResult)
      }
    } catch {}

    stCards
      .filter(card =>
        card.card_type === 'Leader' && (
          card.card_name?.toLowerCase().replace(/[^a-z0-9]/g, '').includes(normalizedQ) ||
          card.card_set_id?.toLowerCase().includes(ql) ||
          card.set_name?.toLowerCase().includes(ql)
        )
      )
      .forEach(addResult)
  }

  return results
}

export async function searchCards(query) {
  if (!query || query.trim().length < 2) return []

  const q = query.trim()
  const results = []
  const seen = new Set()

  function addResult(card) {
    if (card && card.card_set_id && !seen.has(card.card_set_id)) {
      seen.add(card.card_set_id)
      results.push(card)
    }
  }

  function addResults(cards) {
    ;(cards ?? []).forEach(addResult)
  }

  const [stCards, promoCards] = await Promise.all([getSTCards(), getPromoCards()])

  if (looksLikeCardId(q)) {
    const normalizedId = q.toUpperCase().replace(/\s/g, '')
    const setPrefix = extractSetPrefix(normalizedId)

    // 1. Check main card cache (instant, no network)
    const cardCache = getCache()
    if (cardCache[normalizedId]) addResult(cardCache[normalizedId])

    // 2. Try exact API lookup
    if (!seen.has(normalizedId)) {
      try {
        const res = await fetch(`${BASE}/sets/card/${normalizedId}/`)
        if (res.ok) {
          const data = await res.json()
          if (data?.[0]) addResult(data[0])
        }
      } catch {}
    }

    // 3. Fetch entire set — guarantees we find the card even if exact lookup fails.
    //    Also discovers alt art variants with the same number (e.g. OP14-120 SP).
    if (setPrefix && !setPrefix.startsWith('ST') && setPrefix !== 'P') {
      try {
        const setCards = await getSetCards(setPrefix)
        const exactInSet = setCards.find(c => c.card_set_id?.toUpperCase() === normalizedId)
        if (exactInSet) addResult(exactInSet)
        const baseNum = normalizedId.split('-')[1]
        if (baseNum) {
          addResults(setCards.filter(c => {
            const cNum = c.card_set_id?.split('-')[1]
            return cNum === baseNum && c.card_set_id?.toUpperCase() !== normalizedId
          }))
        }
      } catch {}
    }

    // 4. Check ST cards when querying an ST ID
    if (setPrefix?.startsWith('ST')) {
      addResults(stCards.filter(c =>
        c.card_set_id?.toUpperCase() === normalizedId ||
        c.card_set_id?.toUpperCase().startsWith(setPrefix)
      ))
    }

    // 5. Check promo cards when querying a promo ID
    if (setPrefix === 'P' || normalizedId.startsWith('P-')) {
      addResults(promoCards.filter(c => c.card_set_id?.toUpperCase() === normalizedId))
    }

    // 6. If we found the card, search by name for other versions in the same set
    if (results.length > 0 && setPrefix) {
      const firstName = results[0].card_name
      if (firstName) {
        try {
          const nameRes = await fetch(`${BASE}/sets/filtered/?card_name=${encodeURIComponent(firstName)}`)
          if (nameRes.ok) {
            const nameData = await nameRes.json()
            addResults((nameData ?? []).filter(c => c.card_set_id?.toUpperCase().startsWith(setPrefix)))
          }
        } catch {}
      }
    }

  } else {
    // Name-based search
    const normalizedQ = q.toLowerCase().replace(/[^a-z0-9]/g, '')

    // 1. API name search (booster sets)
    try {
      const res = await fetch(`${BASE}/sets/filtered/?card_name=${encodeURIComponent(q)}`)
      if (res.ok) addResults(await res.json())
    } catch {}

    // 2. ST cards by name or ID
    addResults(stCards.filter(card =>
      card.card_name?.toLowerCase().replace(/[^a-z0-9]/g, '').includes(normalizedQ) ||
      card.card_set_id?.toLowerCase().includes(q.toLowerCase())
    ))

    // 3. Promo cards by name or ID
    addResults(promoCards.filter(card =>
      card.card_name?.toLowerCase().replace(/[^a-z0-9]/g, '').includes(normalizedQ) ||
      card.card_set_id?.toLowerCase().includes(q.toLowerCase())
    ))
  }

  return results.slice(0, 30)
}

export function getCardImageUrl(cardId) {
  return `https://optcgapi.com/media/static/Card_Images/${cardId}.jpg`
}
