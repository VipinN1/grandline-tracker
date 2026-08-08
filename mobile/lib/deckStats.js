// Shared by DeckModal.jsx and DeckShareOverlay.jsx — RN port of the
// computeStats() helper in src/pages/DecklistPage.jsx (web).
export function computeDeckStats(cards) {
  const costBuckets = {}
  let charCount = 0, eventCount = 0, stageCount = 0
  const colorCounts = {}
  for (const c of cards) {
    if (c.cost != null) {
      const bucket = Math.min(c.cost, 10)
      costBuckets[bucket] = (costBuckets[bucket] ?? 0) + c.count
    }
    if (c.type === 'Character') charCount += c.count
    else if (c.type === 'Event') eventCount += c.count
    else if (c.type === 'Stage') stageCount += c.count
    if (c.color) {
      for (const col of c.color.split(/[\s/]+/).filter(Boolean)) {
        colorCounts[col] = (colorCounts[col] ?? 0) + c.count
      }
    }
  }
  return { costBuckets, charCount, eventCount, stageCount, colorCounts }
}
