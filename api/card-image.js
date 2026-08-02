export default async function handler(req, res) {
  const { id, url } = req.query

  let target
  if (url) {
    // Accept an already-resolved image URL too (some cards — promos,
    // certain variants — don't live at the naive {id}.jpg path). Restrict
    // to the known card-art host so this can't be used as an open proxy.
    let parsed
    try { parsed = new URL(url) } catch { return res.status(400).end() }
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'optcgapi.com') return res.status(400).end()
    target = parsed.toString()
  } else if (id && /^[A-Za-z0-9_-]+$/.test(id)) {
    target = `https://optcgapi.com/media/static/Card_Images/${id}.jpg`
  } else {
    return res.status(400).end()
  }

  try {
    const upstream = await fetch(target)
    if (!upstream.ok) return res.status(upstream.status).end()

    const buffer = Buffer.from(await upstream.arrayBuffer())
    res.setHeader('Content-Type', 'image/jpeg')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800')
    res.end(buffer)
  } catch {
    res.status(502).end()
  }
}
