import { useState, useRef, useEffect, useCallback } from 'react'
import { createWorker, createScheduler, PSM } from 'tesseract.js'
import { getCardVariants, searchCards } from '../lib/optcgapi'
import CardImage from './CardImage'

// One Piece card IDs: OP14-120, ST01-001, P-001, EB02-052.
const CARD_ID_RE = /([A-Z]{1,3}\d{0,3})\s*-\s*(\d{2,4})/g
// Uppercase + digits + hyphen + space — covers both the set number and the card name.
const OCR_WHITELIST = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789- '
const WORKER_COUNT = 2
const BURST_FRAMES = 5
const BURST_GAP = 130 // ms between burst frames

let snapSeq = 0

function extractCardIds(text) {
  const ids = []
  const upper = (text ?? '').toUpperCase()
  let m
  CARD_ID_RE.lastIndex = 0
  while ((m = CARD_ID_RE.exec(upper)) !== null) {
    const num = m[2].length < 3 ? m[2].padStart(3, '0') : m[2]
    ids.push(`${m[1]}-${num}`)
  }
  return ids
}

// SP / TR are printed in a labelled box — used to pick the right art variant.
function detectRarityHint(text) {
  const u = (text ?? '').toUpperCase()
  if (/\bSP\b/.test(u)) return 'SP'
  if (/\bTR\b/.test(u)) return 'TR'
  return null
}

// Candidate name lines from a full-card OCR pass (largest alpha lines first).
function nameLines(text) {
  return (text ?? '')
    .split('\n')
    .map(l => l.replace(/[^A-Z ]/gi, ' ').replace(/\s+/g, ' ').trim())
    .filter(l => l.replace(/[^A-Z]/gi, '').length >= 4)
    .sort((a, b) => b.length - a.length)
    .slice(0, 2)
}

function pickVariant(variants, hint) {
  if (!variants.length) return null
  if (hint) {
    const match = variants.find(v => (v.card_name ?? '').toUpperCase().includes(hint))
    if (match) return match
  }
  // Base art = image id with no variant suffix (equals the set id).
  const base = variants.find(v =>
    v.card_image_id && v.card_set_id &&
    v.card_image_id.toUpperCase() === v.card_set_id.toUpperCase())
  return base ?? variants[0]
}

export default function CardScanner({ onClose }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const schedulerRef = useRef(null)

  const [phase, setPhase] = useState('starting') // starting | ready | denied | error
  const [status, setStatus] = useState('Starting camera…')
  const [errorMsg, setErrorMsg] = useState('')
  const [snaps, setSnaps] = useState([]) // { id, thumb, status, card, scannedId, matchBy }
  const [flash, setFlash] = useState(false)

  const updateSnap = useCallback((id, patch) => {
    setSnaps(s => s.map(x => (x.id === id ? { ...x, ...patch } : x)))
  }, [])

  // Geometry of the framing guide in the live video's pixel space.
  const guideRect = useCallback(() => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return null
    const vw = video.videoWidth
    const vh = video.videoHeight
    let w = vw * 0.84
    let h = w / 0.714
    if (h > vh * 0.9) { h = vh * 0.9; w = h * 0.714 }
    return { vw, vh, w, h, x: (vw - w) / 2, y: (vh - h) / 2 }
  }, [])

  // Grab one frame: a high-zoom grayscaled number band, a raw full card, and a
  // focus score (gradient energy) so we can favour the sharpest frames.
  const grabFrame = useCallback((wantThumb) => {
    const video = videoRef.current
    const g = guideRect()
    if (!video || !g) return null

    // Number band — bottom 45%, grayscale + contrast, upscaled.
    const stripH = g.h * 0.45
    const stripY = g.y + g.h - stripH
    const sScale = 1100 / g.w
    const num = document.createElement('canvas')
    num.width = Math.round(g.w * sScale)
    num.height = Math.round(stripH * sScale)
    const nctx = num.getContext('2d')
    nctx.drawImage(video, g.x, stripY, g.w, stripH, 0, 0, num.width, num.height)

    let focus = 0
    try {
      const img = nctx.getImageData(0, 0, num.width, num.height)
      const d = img.data
      let prev = 0
      for (let i = 0; i < d.length; i += 4) {
        const gr = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
        const v = gr < 120 ? Math.max(0, gr - 40) : Math.min(255, gr + 40)
        d[i] = d[i + 1] = d[i + 2] = v
        if (i > 0) focus += Math.abs(v - prev)
        prev = v
      }
      nctx.putImageData(img, 0, 0)
    } catch { /* tainted canvas — keep raw */ }

    // Full card (raw) for the name fallback.
    const fScale = 850 / g.w
    const full = document.createElement('canvas')
    full.width = Math.round(g.w * fScale)
    full.height = Math.round(g.h * fScale)
    full.getContext('2d').drawImage(video, g.x, g.y, g.w, g.h, 0, 0, full.width, full.height)

    let thumb = null
    if (wantThumb) {
      const tScale = 130 / g.w
      const t = document.createElement('canvas')
      t.width = Math.round(g.w * tScale)
      t.height = Math.round(g.h * tScale)
      t.getContext('2d').drawImage(video, g.x, g.y, g.w, g.h, 0, 0, t.width, t.height)
      thumb = t.toDataURL('image/jpeg', 0.6)
    }
    return { num, full, focus, thumb }
  }, [guideRect])

  const ocr = useCallback(async (canvas) => {
    const scheduler = schedulerRef.current
    if (!scheduler || !canvas) return ''
    try {
      const { data } = await scheduler.addJob('recognize', canvas)
      return data.text ?? ''
    } catch {
      return ''
    }
  }, [])

  // Stage 1: vote the set number across the sharpest frames → variants → pick art.
  // Stage 2: full-card OCR on the sharpest frame → re-read number, else name search.
  const resolveSnap = useCallback(async (id, frames) => {
    const ranked = [...frames].sort((a, b) => b.focus - a.focus)
    const rarityHints = []

    // Stage 1 — number band, top 3 frames, voted.
    const votes = new Map()
    for (const f of ranked.slice(0, 3)) {
      const text = await ocr(f.num)
      const hint = detectRarityHint(text)
      if (hint) rarityHints.push(hint)
      for (const cid of extractCardIds(text)) votes.set(cid, (votes.get(cid) ?? 0) + 1)
    }
    const byVotes = [...votes.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0])
    for (const cid of byVotes) {
      const variants = await getCardVariants(cid)
      if (variants.length) {
        const card = pickVariant(variants, rarityHints[0] ?? null)
        updateSnap(id, { status: 'done', card, scannedId: cid, matchBy: 'number' })
        return
      }
    }

    // Stage 2 — full card OCR on the sharpest frame.
    const fullText = await ocr(ranked[0]?.full)
    const fullHint = detectRarityHint(fullText)
    for (const cid of extractCardIds(fullText)) {
      const variants = await getCardVariants(cid)
      if (variants.length) {
        const card = pickVariant(variants, fullHint ?? rarityHints[0] ?? null)
        updateSnap(id, { status: 'done', card, scannedId: cid, matchBy: 'number' })
        return
      }
    }
    // Name search fallback.
    for (const line of nameLines(fullText)) {
      let results = []
      try { results = await searchCards(line) } catch { /* ignore */ }
      const hit = results.find(r => r.card_set_id)
      if (hit) {
        updateSnap(id, { status: 'done', card: hit, scannedId: hit.card_set_id, matchBy: 'name' })
        return
      }
    }

    updateSnap(id, { status: 'failed' })
  }, [ocr, updateSnap])

  const snap = useCallback(async () => {
    if (phase !== 'ready') return
    const first = grabFrame(true)
    if (!first) return
    const id = ++snapSeq
    setSnaps(s => [{ id, thumb: first.thumb, status: 'pending', card: null, scannedId: null }, ...s])
    setFlash(true)
    setTimeout(() => setFlash(false), 130)

    const frames = [first]
    for (let i = 1; i < BURST_FRAMES; i++) {
      await new Promise(r => setTimeout(r, BURST_GAP))
      const f = grabFrame(false)
      if (f) frames.push(f)
    }
    resolveSnap(id, frames)
  }, [phase, grabFrame, resolveSnap])

  const removeSnap = useCallback((id) => setSnaps(s => s.filter(x => x.id !== id)), [])

  const start = useCallback(async () => {
    setPhase('starting')
    setStatus('Starting camera…')
    setErrorMsg('')

    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase('error')
      setErrorMsg('This device or browser does not support camera access.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        await video.play().catch(() => {})
      }
    } catch (err) {
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') setPhase('denied')
      else { setPhase('error'); setErrorMsg(err?.message ?? 'Could not access the camera.') }
      return
    }

    setStatus('Loading scanner…')
    try {
      if (!schedulerRef.current) {
        const scheduler = createScheduler()
        await Promise.all(
          Array.from({ length: WORKER_COUNT }, async () => {
            const worker = await createWorker('eng')
            await worker.setParameters({
              tessedit_char_whitelist: OCR_WHITELIST,
              tessedit_pageseg_mode: PSM.SPARSE_TEXT,
            })
            scheduler.addWorker(worker)
          })
        )
        schedulerRef.current = scheduler
      }
    } catch {
      setPhase('error')
      setErrorMsg('Failed to load the text recognizer.')
      return
    }

    setPhase('ready')
    setStatus('')
  }, [])

  useEffect(() => {
    const bootId = setTimeout(start, 0)
    return () => {
      clearTimeout(bootId)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      if (schedulerRef.current) {
        schedulerRef.current.terminate().catch(() => {})
        schedulerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const doneCount = snaps.filter(s => s.status === 'done').length
  const pendingCount = snaps.filter(s => s.status === 'pending').length
  const failedCount = snaps.filter(s => s.status === 'failed').length

  return (
    <div style={overlay}>
      <div style={header}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f2f5' }}>Scan Cards</div>
        <button onClick={onClose} style={doneBtn}>
          Done{snaps.length > 0 ? ` (${doneCount})` : ''}
        </button>
      </div>

      <div style={viewport}>
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            display: phase === 'ready' || phase === 'starting' ? 'block' : 'none',
          }}
        />

        {flash && <div style={flashOverlay} />}

        {(phase === 'ready' || phase === 'starting') && (
          <div style={guideWrap} aria-hidden>
            <div style={guideBox}><div style={guideStrip} /></div>
          </div>
        )}

        {phase === 'starting' && (
          <div style={loadingPill}><span style={spinnerDot} />{status}</div>
        )}

        {(phase === 'ready' || phase === 'starting') && (
          <div style={shutterWrap}>
            <button
              onClick={snap}
              disabled={phase !== 'ready'}
              style={{ ...shutterBtn, opacity: phase === 'ready' ? 1 : 0.4 }}
              aria-label="Snap card"
            >
              <span style={shutterInner} />
            </button>
            <div style={shutterHint}>
              {pendingCount > 0 ? `Scanning ${pendingCount}…` : 'Tap to snap — number inside the box'}
            </div>
          </div>
        )}

        {(phase === 'denied' || phase === 'error') && (
          <div style={messageWrap}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📷</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f2f5', marginBottom: 6 }}>
              {phase === 'denied' ? 'Camera permission needed' : 'Something went wrong'}
            </div>
            <div style={{ fontSize: 13, color: '#7c6fa0', maxWidth: 280, lineHeight: 1.5 }}>
              {phase === 'denied'
                ? 'Allow camera access in your browser, then tap Retry.'
                : errorMsg}
            </div>
            <button onClick={start} style={{ ...doneBtn, marginTop: 20, padding: '10px 28px' }}>Retry</button>
          </div>
        )}
      </div>

      <div style={strip}>
        {snaps.length === 0 ? (
          <div style={emptyHint}>
            Snap each card — they identify in the background while you keep shooting.
          </div>
        ) : (
          <>
            <div style={stripHeader}>
              <span style={{ color: '#34d399' }}>{doneCount} found</span>
              {pendingCount > 0 && <span style={{ color: '#a78bfa' }}> · {pendingCount} scanning</span>}
              {failedCount > 0 && <span style={{ color: '#f05252' }}> · {failedCount} missed</span>}
            </div>
            <div style={stripScroll}>
              {snaps.map(item => (
                <SnapTile key={item.id} item={item} onRemove={removeSnap} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function SnapTile({ item, onRemove }) {
  return (
    <div style={tile}>
      <button onClick={() => onRemove(item.id)} style={tileClose} aria-label="Remove">✕</button>
      <div style={tileImg}>
        {item.status === 'done' ? (
          <CardImage
            cardId={item.card.card_image_id ?? item.scannedId}
            alt={item.card.card_name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <>
            <img src={item.thumb} alt="snap" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: item.status === 'failed' ? 0.4 : 0.75 }} />
            {item.status === 'pending' && <div style={tileSpinner}><span style={spinnerDot} /></div>}
            {item.status === 'failed' && <div style={tileFailed}>Not found</div>}
          </>
        )}
      </div>
      <div style={tileLabel} title={item.status === 'done' ? item.card.card_name : ''}>
        {item.status === 'done'
          ? (item.card.card_name ?? item.scannedId)
          : item.status === 'pending' ? 'scanning…' : '—'}
      </div>
    </div>
  )
}

const overlay = {
  position: 'fixed', inset: 0, zIndex: 1000, background: '#0c0814',
  display: 'flex', flexDirection: 'column',
}
const header = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 16px 12px',
  borderBottom: '1px solid rgba(139,92,246,0.12)',
}
const doneBtn = {
  fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
  background: 'linear-gradient(135deg, #7c3aed, #a855f7)', border: 'none',
  borderRadius: 8, padding: '8px 16px',
}
const viewport = {
  position: 'relative', flex: 1, overflow: 'hidden', background: '#000',
  display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0,
}
const flashOverlay = {
  position: 'absolute', inset: 0, background: '#fff', opacity: 0.7, zIndex: 6, pointerEvents: 'none',
}
const guideWrap = {
  position: 'absolute', inset: 0, display: 'flex',
  alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
}
const guideBox = {
  position: 'relative', width: '84%', maxWidth: 340, aspectRatio: '5 / 7',
  border: '2px solid rgba(167,139,250,0.9)', borderRadius: 14,
  boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)',
}
const guideStrip = {
  position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%',
  borderTop: '2px dashed rgba(236,72,153,0.8)',
  background: 'rgba(236,72,153,0.08)', borderRadius: '0 0 12px 12px',
}
const loadingPill = {
  position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
  display: 'flex', alignItems: 'center', gap: 8,
  background: 'rgba(12,8,20,0.85)', border: '1px solid rgba(139,92,246,0.2)',
  borderRadius: 20, padding: '8px 16px', fontSize: 12.5, color: '#cdb8ff',
}
const spinnerDot = {
  width: 7, height: 7, borderRadius: '50%', background: '#a78bfa',
  flexShrink: 0, animation: 'livePulse 1.5s ease-in-out infinite',
}
const shutterWrap = {
  position: 'absolute', bottom: 18, left: 0, right: 0,
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, zIndex: 5,
}
const shutterBtn = {
  width: 70, height: 70, borderRadius: '50%', padding: 0,
  background: 'rgba(255,255,255,0.15)', border: '4px solid #fff',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const shutterInner = { width: 54, height: 54, borderRadius: '50%', background: '#fff' }
const shutterHint = {
  fontSize: 12, color: '#e0d6ff', fontWeight: 500,
  background: 'rgba(12,8,20,0.6)', padding: '4px 12px', borderRadius: 12,
}
const messageWrap = {
  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center',
}
const strip = {
  flexShrink: 0, borderTop: '1px solid rgba(139,92,246,0.12)',
  background: 'rgba(12,8,20,0.95)',
  padding: '10px 10px calc(env(safe-area-inset-bottom, 0px) + 10px)',
}
const emptyHint = {
  fontSize: 12, color: '#7c6fa0', textAlign: 'center', padding: '14px 20px', lineHeight: 1.5,
}
const stripHeader = {
  fontSize: 11.5, fontWeight: 600, padding: '0 4px 8px', display: 'flex', gap: 2,
}
const stripScroll = { display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }
const tile = {
  position: 'relative', flexShrink: 0, width: 76, display: 'flex', flexDirection: 'column', gap: 4,
}
const tileClose = {
  position: 'absolute', top: -6, right: -6, zIndex: 2, width: 20, height: 20,
  borderRadius: '50%', border: 'none', background: 'rgba(12,8,20,0.9)',
  color: '#c0b5d8', fontSize: 11, cursor: 'pointer', lineHeight: 1,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const tileImg = {
  position: 'relative', width: 76, aspectRatio: '5 / 7', borderRadius: 8, overflow: 'hidden',
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
}
const tileSpinner = {
  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(0,0,0,0.3)',
}
const tileFailed = {
  position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)',
  color: '#ffb4b4', fontSize: 10, fontWeight: 600,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4, textAlign: 'center',
}
const tileLabel = {
  fontSize: 10, fontWeight: 600, color: '#a78bfa', textAlign: 'center',
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
}
