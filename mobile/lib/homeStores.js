// Computes the stores a player most frequently logs *locals*-tier events
// at — the default "Home Locals" shown on their profile when they haven't
// manually picked their own list (see components/HomeStoresModal.jsx).
// Grouped by store_id when a tournament was linked to a real store row,
// falling back to the flattened location text for entries that predate a
// store selection (or were typed as a one-off venue name).
export function computeTopStores(tournaments, limit = 3) {
  const counts = {}
  for (const t of tournaments ?? []) {
    if (t.is_practice) continue
    if ((t.tier ?? 'locals') !== 'locals') continue
    if (!t.location) continue
    const key = t.store_id ?? `loc:${t.location}`
    if (!counts[key]) counts[key] = { id: t.store_id ?? null, name: t.location, count: 0 }
    counts[key].count++
  }
  return Object.values(counts)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}
