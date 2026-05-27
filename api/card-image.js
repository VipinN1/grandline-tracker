export default async function handler(req, res) {
  const { id } = req.query

  if (!id || !/^[A-Za-z0-9\-]+$/.test(id)) {
    return res.status(400).end()
  }

  try {
    const upstream = await fetch(`https://optcgapi.com/media/static/Card_Images/${id}.jpg`)
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
