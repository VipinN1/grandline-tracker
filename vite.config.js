import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const cardImageProxy = {
  name: 'card-image-proxy',
  configureServer(server) {
    server.middlewares.use('/api/card-image', async (req, res) => {
      const qs = new URL(req.url, 'http://localhost').searchParams
      const id = qs.get('id')
      if (!id || !/^[A-Za-z0-9\-]+$/.test(id)) { res.statusCode = 400; res.end(); return }
      try {
        const r = await fetch(`https://optcgapi.com/media/static/Card_Images/${id}.jpg`)
        if (!r.ok) { res.statusCode = r.status; res.end(); return }
        const buf = Buffer.from(await r.arrayBuffer())
        res.setHeader('Content-Type', 'image/jpeg')
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.end(buf)
      } catch { res.statusCode = 502; res.end() }
    })
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    cardImageProxy,
  ],
})