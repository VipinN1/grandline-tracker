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

function looksLikeCardId(query) {
  return /^[a-zA-Z0-9]+-[0-9]+/i.test(query.trim())
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

  // Check ST cache before hitting the API
  const stCards = await getSTCards()
  const stMatch = stCards.find(c => c.card_set_id === cardId)
  if (stMatch) {
    cache[cardId] = stMatch
    setCache(cache)
    return stMatch
  }

  let res = await fetch(`${BASE}/sets/card/${cardId}/`)
  if (!res.ok) {
    res = await fetch(`${BASE}/sets/card/${cardId.toUpperCase()}/`)
  }
  if (!res.ok) throw new Error(`Card not found: ${cardId}`)

  const data = await res.json()
  const card = data[0]
  if (card) {
    cache[cardId] = card
    setCache(cache)
  }
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
            const sameSet = (nameData ?? []).filter(c => c.card_set_id.startsWith(setPrefix))
            const otherSets = (nameData ?? []).filter(c => !c.card_set_id.startsWith(setPrefix))
            sameSet.forEach(addResult)
            otherSets.forEach(addResult)
          }
        }
      }
    } catch {}

    stCards
      .filter(c =>
        c.card_set_id?.toUpperCase() === normalizedId ||
        c.card_set_id?.toUpperCase().startsWith(setPrefix)
      )
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
          const exactCard = exactData[0]
          addResult(exactCard)

          // Cache the exact result immediately
          const cardCache = getCache()
          if (!cardCache[exactCard.card_set_id]) {
            cardCache[exactCard.card_set_id] = exactCard
            setCache(cardCache)
          }

          const cardName = exactCard.card_name
          const nameRes = await fetch(`${BASE}/sets/filtered/?card_name=${encodeURIComponent(cardName)}`)
          if (nameRes.ok) {
            const nameData = await nameRes.json()
            // Same-set variants first (e.g. OP09-119 SP alongside OP09-119)
            const sameSet = (nameData ?? []).filter(c => c.card_set_id.startsWith(setPrefix))
            const otherSets = (nameData ?? []).filter(c => !c.card_set_id.startsWith(setPrefix))
            sameSet.forEach(addResult)
            otherSets.forEach(addResult)
          }
        }
      }
    } catch {}

    // Also check ST cards for matching ID or set prefix
    stCards
      .filter(c =>
        c.card_set_id?.toUpperCase() === normalizedId ||
        c.card_set_id?.toUpperCase().startsWith(setPrefix)
      )
      .forEach(addResult)

  } else {
    const normalizedQ = q.toLowerCase().replace(/[^a-z0-9]/g, '')

    try {
      const nameRes = await fetch(`${BASE}/sets/filtered/?card_name=${encodeURIComponent(q)}`)
      if (nameRes.ok) {
        const nameData = await nameRes.json()
        ;(nameData ?? []).forEach(addResult)
      }
    } catch {}

    stCards
      .filter(card =>
        card.card_name?.toLowerCase().replace(/[^a-z0-9]/g, '').includes(normalizedQ) ||
        card.card_set_id?.toLowerCase().includes(q.toLowerCase())
      )
      .forEach(addResult)
  }

  return results.slice(0, 24)
}

export function getCardImageUrl(cardId) {
  return `https://optcgapi.com/media/static/Card_Images/${cardId}.jpg`
}
