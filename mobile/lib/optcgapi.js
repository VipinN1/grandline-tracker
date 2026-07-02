// Port of src/lib/optcgapi.js (web). localStorage is replaced with an
// in-memory cache hydrated from AsyncStorage — RN has no synchronous storage.
import AsyncStorage from '@react-native-async-storage/async-storage'

const BASE = 'https://optcgapi.com/api'
const CACHE_KEY = 'optcg_card_cache'
const ST_CACHE_KEY = 'optcg_st_cards'
const PROMO_CACHE_KEY = 'optcg_promo_cards'
const CACHE_TTL = 86400000 // 24 hours

// ── storage shim ─────────────────────────────────────────────────────────────
const mem = new Map()
let hydration = null

// Load all optcg_* keys from AsyncStorage into memory once per app launch.
export function hydrateCardCache() {
  if (!hydration) {
    hydration = AsyncStorage.getAllKeys()
      .then(keys => AsyncStorage.multiGet(keys.filter(k => k.startsWith('optcg_'))))
      .then(pairs => { pairs.forEach(([k, v]) => { if (!mem.has(k)) mem.set(k, v) }) })
      .catch(() => {})
  }
  return hydration
}

const storage = {
  getItem: k => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => {
    mem.set(k, v)
    AsyncStorage.setItem(k, v).catch(() => {})
  },
}

function getCache() {
  try { return JSON.parse(storage.getItem(CACHE_KEY) ?? '{}') }
  catch { return {} }
}

function setCache(cache) {
  try { storage.setItem(CACHE_KEY, JSON.stringify(cache)) }
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

// TTL-aware cache helpers
function readTTLCache(key) {
  try {
    const raw = storage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
    if (parsed.data && (Date.now() - parsed.cachedAt) < CACHE_TTL) return parsed.data
    return null // expired
  } catch { return null }
}

function writeTTLCache(key, data) {
  try { storage.setItem(key, JSON.stringify({ data, cachedAt: Date.now() })) }
  catch {}
}

async function getSTCards() {
  await hydrateCardCache()
  try {
    const cached = readTTLCache(ST_CACHE_KEY)
    if (cached) return cached

    const res = await fetch(`${BASE}/allSTCards/`)
    if (!res.ok) return []
    const data = await res.json()

    const cardCache = getCache()
    data.forEach(card => {
      if (card.card_image_id) cardCache[card.card_image_id] = card
      if (card.card_set_id && !cardCache[card.card_set_id]) cardCache[card.card_set_id] = card
    })
    setCache(cardCache)
    writeTTLCache(ST_CACHE_KEY, data)
    return data
  } catch { return [] }
}

export async function getPromoCards() {
  await hydrateCardCache()
  try {
    const cached = readTTLCache(PROMO_CACHE_KEY)
    if (cached) return cached

    const res = await fetch(`${BASE}/promos/`)
    if (!res.ok) return []
    const data = await res.json()

    const cardCache = getCache()
    data.forEach(card => {
      if (card.card_image_id) cardCache[card.card_image_id] = card
      if (card.card_set_id && !cardCache[card.card_set_id]) cardCache[card.card_set_id] = card
    })
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
    let data = res.ok ? await res.json() : []

    // EB04 was released split across OP14 and OP15 — no standalone API endpoint exists
    if (setId === 'EB04' && data.length === 0) {
      const [op14, op15] = await Promise.all([getSetCards('OP14'), getSetCards('OP15')])
      data = [...op14, ...op15].filter(c => c.card_set_id?.toUpperCase().startsWith('EB04'))
    }

    // Some sets use a hyphenated endpoint format (e.g. EB03 → EB-03); try that if primary returned nothing
    if (data.length === 0) {
      const m = setId.match(/^([A-Z]+)(\d+)$/i)
      if (m) {
        const res2 = await fetch(`${BASE}/sets/${m[1].toUpperCase()}-${m[2]}/`)
        if (res2.ok) data = (await res2.json()) ?? []
      }
    }

    if (data.length === 0) return []

    const cardCache = getCache()
    data.forEach(card => {
      if (card.card_image_id) cardCache[card.card_image_id] = card
      if (card.card_set_id && !cardCache[card.card_set_id]) cardCache[card.card_set_id] = card
    })
    setCache(cardCache)
    writeTTLCache(cacheKey, data)
    return data
  } catch { return [] }
}

export async function getCard(cardId) {
  await hydrateCardCache()
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

// Return every art variant sharing a card_set_id (base + Parallel / SP / TR / Manga…).
export async function getCardVariants(cardId) {
  await hydrateCardCache()
  const id = cardId.toUpperCase()
  try {
    const res = await fetch(`${BASE}/sets/card/${id}/`)
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        const cache = getCache()
        data.forEach(c => { if (c.card_image_id) cache[c.card_image_id] = c })
        if (data[0] && !cache[id]) cache[id] = data[0]
        setCache(cache)
        return data
      }
    }
  } catch { /* fall through */ }

  try {
    const single = await getCard(id)
    return single ? [single] : []
  } catch {
    return []
  }
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
            const data = await res.json() ?? []
            data.forEach(card => { if (card.card_image_id) cache[card.card_image_id] = card })
            if (data[0] && !cache[id]) cache[id] = data[0]
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
  await hydrateCardCache()

  const q = query.trim()
  const results = []
  const seen = new Set()

  function addResult(card) {
    if (card.card_type !== 'Leader') return
    const key = card.card_image_id ?? card.card_set_id
    if (key && !seen.has(key)) {
      seen.add(key)
      results.push(card)
    }
  }

  // Fetch all art variants (parallel, SP, alt art, etc.) for each unique card_set_id
  async function fetchVariants(cards) {
    const uniqueIds = [...new Set(cards.map(c => c.card_set_id).filter(Boolean))]
    await Promise.all(
      uniqueIds.map(async id => {
        try {
          const res = await fetch(`${BASE}/sets/card/${id}/`)
          if (res.ok) (await res.json() ?? []).forEach(addResult)
        } catch {}
      })
    )
  }

  const stCards = await getSTCards()

  if (looksLikeCardId(q)) {
    const normalizedId = q.toUpperCase()
    const setPrefix = normalizedId.split('-')[0]

    try {
      const exactRes = await fetch(`${BASE}/sets/card/${normalizedId}/`)
      if (exactRes.ok) {
        const exactData = await exactRes.json() ?? []
        exactData.forEach(addResult) // all art variants of the exact ID
        if (exactData[0]) {
          const cardName = exactData[0].card_name
          const nameRes = await fetch(`${BASE}/sets/filtered/?card_name=${encodeURIComponent(cardName)}&card_type=Leader`)
          if (nameRes.ok) {
            const nameData = await nameRes.json() ?? []
            nameData.filter(c => c.card_set_id.startsWith(setPrefix)).forEach(addResult)
            nameData.filter(c => !c.card_set_id.startsWith(setPrefix)).forEach(addResult)
            await fetchVariants(nameData)
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
        const nameData = await nameRes.json() ?? []
        nameData.forEach(addResult)
        await fetchVariants(nameData) // fetch alt arts for each result
      }
    } catch {}

    // The API's card_name filter is a literal substring match, so multi-word
    // queries with spaces won't match names that use periods (e.g. "Monkey D
    // Luffy" vs "Monkey.D.Luffy"). For multi-word queries, re-query by the first
    // token and filter locally on the normalized full query.
    const firstToken = q.split(/\s+/)[0]
    if (firstToken && firstToken.toLowerCase() !== ql) {
      try {
        const nameRes = await fetch(`${BASE}/sets/filtered/?card_name=${encodeURIComponent(firstToken)}&card_type=Leader`)
        if (nameRes.ok) {
          const nameData = (await nameRes.json() ?? []).filter(card =>
            card.card_name?.toLowerCase().replace(/[^a-z0-9]/g, '').includes(normalizedQ)
          )
          nameData.forEach(addResult)
          await fetchVariants(nameData)
        }
      } catch {}
    }

    stCards
      .filter(card =>
        card.card_type === 'Leader' && (
          card.card_name?.toLowerCase().replace(/[^a-z0-9]/g, '').includes(normalizedQ) ||
          card.card_set_id?.toLowerCase().includes(ql) ||
          card.set_name?.toLowerCase().includes(ql)
        )
      )
      .forEach(addResult)

    // Scan main card cache for any previously fetched leaders matching by name
    const mainCache = getCache()
    Object.values(mainCache)
      .filter(card =>
        typeof card === 'object' &&
        card.card_name?.toLowerCase().replace(/[^a-z0-9]/g, '').includes(normalizedQ)
      )
      .forEach(addResult)
  }

  return results
}

export async function searchCards(query) {
  if (!query || query.trim().length < 2) return []
  await hydrateCardCache()

  const q = query.trim()
  const results = []
  const seen = new Set()

  function addResult(card) {
    const key = card?.card_image_id ?? card?.card_set_id
    if (card && key && !seen.has(key)) {
      seen.add(key)
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

    // 2. Try exact API lookup — endpoint returns all variants sharing this card_set_id
    try {
      const res = await fetch(`${BASE}/sets/card/${normalizedId}/`)
      if (res.ok) addResults(await res.json())
    } catch {}

    // 3. Fetch entire set — guarantees we find the card even if exact lookup fails.
    if (setPrefix && !setPrefix.startsWith('ST') && setPrefix !== 'P') {
      try {
        const setCards = await getSetCards(setPrefix)
        addResults(setCards.filter(c => c.card_set_id?.toUpperCase() === normalizedId))
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

    try {
      const res = await fetch(`${BASE}/sets/filtered/?card_name=${encodeURIComponent(q)}`)
      if (res.ok) addResults(await res.json())
    } catch {}

    const firstToken = q.split(/\s+/)[0]
    if (firstToken && firstToken.toLowerCase() !== q.toLowerCase()) {
      try {
        const res = await fetch(`${BASE}/sets/filtered/?card_name=${encodeURIComponent(firstToken)}`)
        if (res.ok) {
          addResults((await res.json() ?? []).filter(card =>
            card.card_name?.toLowerCase().replace(/[^a-z0-9]/g, '').includes(normalizedQ)
          ))
        }
      } catch {}
    }

    // ST cards by name or ID
    addResults(stCards.filter(card =>
      card.card_name?.toLowerCase().replace(/[^a-z0-9]/g, '').includes(normalizedQ) ||
      card.card_set_id?.toLowerCase().includes(q.toLowerCase())
    ))

    // Promo cards by name or ID
    addResults(promoCards.filter(card =>
      card.card_name?.toLowerCase().replace(/[^a-z0-9]/g, '').includes(normalizedQ) ||
      card.card_set_id?.toLowerCase().includes(q.toLowerCase())
    ))

    // Scan main card cache for any previously fetched cards matching by name
    const mainCache = getCache()
    addResults(
      Object.values(mainCache).filter(card =>
        typeof card === 'object' && card.card_name &&
        card.card_name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(normalizedQ)
      )
    )
  }

  return results.slice(0, 250)
}

export function getCardImageUrl(cardOrId) {
  if (!cardOrId) return ''
  if (typeof cardOrId === 'object') {
    if (cardOrId.card_image) return cardOrId.card_image
    const id = cardOrId.card_image_id ?? cardOrId.card_set_id ?? ''
    return `https://optcgapi.com/media/static/Card_Images/${id}.jpg`
  }
  const cached = getCache()[cardOrId]
  if (cached?.card_image) return cached.card_image
  return `https://optcgapi.com/media/static/Card_Images/${cardOrId}.jpg`
}
