const BASE = 'https://optcgapi.com/api'

export async function getCard(cardId) {
  const res = await fetch(`${BASE}/sets/card/${cardId}/`)
  if (!res.ok) throw new Error(`Card not found: ${cardId}`)
  const data = await res.json()
  return data[0]
}

export async function searchCards(query) {
  const res = await fetch(`${BASE}/sets/filtered/?card_name=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error('Search failed')
  return res.json()
}

export async function getSet(setId) {
  const res = await fetch(`${BASE}/sets/${setId}/`)
  if (!res.ok) throw new Error(`Set not found: ${setId}`)
  return res.json()
}

export function getCardImageUrl(cardId) {
  return `https://optcgapi.com/media/static/Card_Images/${cardId}.jpg`
}