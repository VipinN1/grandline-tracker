import { useState, useRef, useEffect, useCallback } from 'react'
import { createWorker, createScheduler, PSM } from 'tesseract.js'
import { getCardVariants, searchCards } from '../lib/optcgapi'
import CardImage from './CardImage'

// Uppercase + digits + hyphen + space — covers both the set number and the card name.
const OCR_WHITELIST = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789- '
const WORKER_COUNT = 2
const BURST_FRAMES = 5
const BURST_GAP = 130 // ms between burst frames

let snapSeq = 0

// Known One Piece set prefixes. OCR'd prefixes are snapped to this list, which
// both corrects misreads (0P14→OP14, 5T01→ST01) and rejects garbage before it
// ever costs an API call.
const SET_PREFIXES = (() => {
  const s = new Set(['P'])
  const add = (p, n) => { for (let i = 1; i <= n; i++) s.add(p + String(i).padStart(2, '0')) }
  add('OP', 20); add('ST', 30); add('EB', 10); add('PRB', 6)
  return s
})()

// Characters Tesseract routinely swaps, applied per-zone: digits where we expect
// a number, letters where we expect the set code.
const AS_DIGIT = { O: '0', Q: '0', D: '0', U: '0', I: '1', L: '1', T: '7', S: '5', B: '8', Z: '2', G: '6', A: '4' }
const AS_LETTER = { '0': 'O', '1': 'I', '5': 'S', '8': 'B', '2': 'Z', '6': 'G', '4': 'A' }
// Letters that are really digits when they land in the number field.
const NUMISH = 'OISBZGAQDULT'

function confusable(a, b) {
  return a === b || AS_DIGIT[a] === b || AS_LETTER[a] === b || AS_DIGIT[b] === a || AS_LETTER[b] === a
}

// Snap an OCR'd prefix to a known set code, allowing per-character OCR confusion.
// Returns null for anything that can't be a real set (so we never query it).
function snapPrefix(raw) {
  const up = raw.toUpperCase()
  if (SET_PREFIXES.has(up)) return up
  for (const p of SET_PREFIXES) {
    if (p.length !== up.length) continue
    let ok = true
    for (let i = 0; i < p.length; i++) { if (!confusable(up[i], p[i])) { ok = false; break } }
    if (ok) return p
  }
  return null
}

// Pull every plausible card ID out of an OCR string — tolerant of missing or
// garbled separators (OP14 120, OP14·120, OP14120) and digit/letter confusion.
function extractCardIds(text) {
  const ids = []
  if (!text) return ids
  const cleaned = text.toUpperCase()
    .replace(/[‐-―–—_~/|\\·•.:]+/g, '-') // unify separator variants → '-'
    .replace(/[^A-Z0-9\- ]/g, ' ')
  // No trailing lookahead: the number is often glued to the rarity/block boxes
  // ("OP08-052R2"), and snapPrefix + the 3-digit clamp already keep this tight.
  const re = new RegExp(`([A-Z0-9]{1,4})[ \\-]{0,2}([0-9${NUMISH}]{2,4})`, 'g')
  let m
  while ((m = re.exec(cleaned)) !== null) {
    const prefix = snapPrefix(m[1])
    if (!prefix) continue
    const num = m[2].split('').map(c => AS_DIGIT[c] ?? c).join('')
    if (!/^\d+$/.test(num)) continue
    ids.push(`${prefix}-${num.length < 3 ? num.padStart(3, '0') : num.slice(0, 3)}`)
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

// Same classifier the deck builder / marketplace use, so labels stay consistent.
function getAltArtType(card) {
  const name = (card.card_name ?? '').toLowerCase()
  const rarity = (card.card_rarity ?? '').toLowerCase()
  if (/\bsp\b/.test(name) || rarity === 'sp') return 'sp'
  if (/\btr\b/.test(name) || rarity === 'tr') return 'tr'
  if (/\bmanga\b/.test(name) || rarity === 'manga') return 'manga'
  if (/parallel|alt[\s_]art|alternate[\s_]art/.test(name) || rarity === 'parallel' || rarity === 'p') return 'parallel'
  return null
}

function variantLabel(v) {
  switch (getAltArtType(v)) {
    case 'sp': return 'SP'
    case 'tr': return 'TR'
    case 'manga': return 'Manga'
    case 'parallel': return 'Alt art ★'
    default: return 'Base'
  }
}

// Build chooser options with unique, human labels (numbering any duplicates).
function variantOptions(variants) {
  const totals = {}
  variants.forEach(v => { const l = variantLabel(v); totals[l] = (totals[l] ?? 0) + 1 })
  const seen = {}
  return variants.map(v => {
    const base = variantLabel(v)
    let label = base
    if (totals[base] > 1) { seen[base] = (seen[base] ?? 0) + 1; label = `${base} ${seen[base]}` }
    return { value: v.card_image_id ?? v.card_set_id, label, variant: v }
  })
}

// Full variant lists keyed by set number, so repeat scans of the same card (a
// playset) reuse the result instead of re-hitting the API.
const variantsMemo = new Map()

export default function CardScanner({ onClose }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const schedulerRef = useRef(null)

  const [phase, setPhase] = useState('starting') // starting | ready | denied | error
  const [status, setStatus] = useState('Starting camera…')
  const [errorMsg, setErrorMsg] = useState('')
  const [snaps, setSnaps] = useState([]) // { id, thumb, status, card, scannedId, matchBy }
  const [flash, setFlash] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchOn, setTorchOn] = useState(false)

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

    // Bottom-RIGHT corner — where OPTCG prints the set number + rarity (e.g.
    // "OP08-052  R  ②"). A tight, high-signal crop that dodges the effect text
    // and the SAMPLE watermark, both of which swamp the full band.
    const cornerW = g.w * 0.5
    const cornerH = g.h * 0.11
    const cornerX = g.x + g.w * 0.49
    const cornerY = g.y + g.h - cornerH - g.h * 0.012
    const cScale = 1000 / cornerW
    const corner = document.createElement('canvas')
    corner.width = Math.round(cornerW * cScale)
    corner.height = Math.round(cornerH * cScale)
    const cctx = corner.getContext('2d')
    cctx.drawImage(video, cornerX, cornerY, cornerW, cornerH, 0, 0, corner.width, corner.height)
    try {
      const cimg = cctx.getImageData(0, 0, corner.width, corner.height)
      const cd = cimg.data
      for (let i = 0; i < cd.length; i += 4) {
        const gr = 0.299 * cd[i] + 0.587 * cd[i + 1] + 0.114 * cd[i + 2]
        const v = gr < 120 ? Math.max(0, gr - 40) : Math.min(255, gr + 40)
        cd[i] = cd[i + 1] = cd[i + 2] = v
      }
      cctx.putImageData(cimg, 0, 0)
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
    return { num, corner, full, focus, thumb }
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

  // All art variants for a number, memoised so repeat scans don't re-hit the API.
  const loadVariants = useCallback(async (cid) => {
    const cached = variantsMemo.get(cid)
    if (cached) return cached
    const variants = await getCardVariants(cid)
    if (variants.length) variantsMemo.set(cid, variants)
    return variants
  }, [])

  // Manual art switch from the snap tile.
  const selectVariant = useCallback((id, variant) => {
    updateSnap(id, { card: variant })
  }, [updateSnap])

  // Stage 1: vote the set number across the 2 sharpest corner crops (primary,
  //          weighted) plus the wider bottom band, then resolve to the full
  //          variant list and cap API calls to the top voted candidates.
  // Stage 2: full-card OCR fallback → re-read number, else name search.
  const resolveSnap = useCallback(async (id, frames) => {
    const ranked = [...frames].sort((a, b) => b.focus - a.focus)
    const rarityHints = []
    const votes = new Map()
    const addVotes = (ids, weight) => {
      for (const cid of ids) votes.set(cid, (votes.get(cid) ?? 0) + weight)
    }

    // Bottom-right corner crop on the 2 sharpest frames — the set number lives
    // here, so it's the primary, heaviest-weighted source. SP/TR rarity also
    // prints here, so detect the art hint from the same text.
    for (const f of ranked.slice(0, 2)) {
      const text = await ocr(f.corner)
      const hint = detectRarityHint(text)
      if (hint) rarityHints.push(hint)
      addVotes(extractCardIds(text), 2)
    }
    // Wider bottom band on the sharpest frame as a backup voter (handles slight
    // mis-framing where the number drifts out of the corner crop).
    const bandText = await ocr(ranked[0]?.num)
    const bandHint = detectRarityHint(bandText)
    if (bandHint) rarityHints.push(bandHint)
    addVotes(extractCardIds(bandText), 1)

    const ordered = [...votes.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]).slice(0, 4)
    const hint = rarityHints[0] ?? null

    // Resolve to the FULL variant list (so the user can switch art). Memoised by
    // number, so repeat scans of the same card cost no extra API calls. Top
    // voted candidates only.
    for (const cid of ordered) {
      const variants = await loadVariants(cid)
      if (variants.length) {
        updateSnap(id, { status: 'done', card: pickVariant(variants, hint), variants, scannedId: cid, matchBy: 'number' })
        return
      }
    }

    // Stage 2 — full card OCR fallback.
    const fullText = await ocr(ranked[0]?.full)
    const fullHint = detectRarityHint(fullText)
    for (const cid of extractCardIds(fullText)) {
      const variants = await loadVariants(cid)
      if (variants.length) {
        updateSnap(id, { status: 'done', card: pickVariant(variants, fullHint ?? hint), variants, scannedId: cid, matchBy: 'number' })
        return
      }
    }
    // Name search fallback.
    for (const line of nameLines(fullText)) {
      let results = []
      try { results = await searchCards(line) } catch { /* ignore */ }
      const hit = results.find(r => r.card_set_id)
      if (hit) {
        const variants = variantsMemo.get(hit.card_set_id) ?? [hit]
        updateSnap(id, { status: 'done', card: pickVariant(variants, fullHint ?? hint), variants, scannedId: hit.card_set_id, matchBy: 'name' })
        return
      }
    }

    updateSnap(id, { status: 'failed' })
  }, [ocr, updateSnap, loadVariants])

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

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks?.()[0]
    if (!track) return
    const next = !torchOn
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] })
      setTorchOn(next)
    } catch {
      // Device refused the torch constraint — drop the control so it isn't offered.
      setTorchSupported(false)
    }
  }, [torchOn])

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
      // Torch is only exposed on some (mostly Android) back-camera tracks.
      const track = stream.getVideoTracks()[0]
      setTorchSupported(!!track?.getCapabilities?.().torch)
      setTorchOn(false)
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
        <div style={{ fontSize: 15, fontWeight: 700, color: '#e9f1f8' }}>Scan Cards</div>
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

        {phase === 'ready' && torchSupported && (
          <button
            onClick={toggleTorch}
            style={{ ...torchBtn, ...(torchOn ? torchBtnOn : null) }}
            aria-label={torchOn ? 'Turn flashlight off' : 'Turn flashlight on'}
            aria-pressed={torchOn}
          >
            {torchOn ? '🔦' : '💡'}
          </button>
        )}

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
            <div style={{ fontSize: 16, fontWeight: 700, color: '#e9f1f8', marginBottom: 6 }}>
              {phase === 'denied' ? 'Camera permission needed' : 'Something went wrong'}
            </div>
            <div style={{ fontSize: 13, color: '#9db2c6', maxWidth: 280, lineHeight: 1.5 }}>
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
              <span style={{ color: '#3bb27e' }}>{doneCount} found</span>
              {pendingCount > 0 && <span style={{ color: '#52a9cd' }}> · {pendingCount} scanning</span>}
              {failedCount > 0 && <span style={{ color: '#d24a3a' }}> · {failedCount} missed</span>}
            </div>
            <div style={stripScroll}>
              {snaps.map(item => (
                <SnapTile key={item.id} item={item} onRemove={removeSnap} onSelectVariant={selectVariant} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function SnapTile({ item, onRemove, onSelectVariant }) {
  const options = item.status === 'done' && item.variants?.length > 1 ? variantOptions(item.variants) : null
  const selectedId = item.card?.card_image_id ?? item.scannedId

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
      {options && (
        <select
          value={selectedId}
          onChange={e => {
            const opt = options.find(o => o.value === e.target.value)
            if (opt) onSelectVariant(item.id, opt.variant)
          }}
          style={tileSelect}
          aria-label="Choose art"
        >
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
    </div>
  )
}

const overlay = {
  position: 'fixed', inset: 0, zIndex: 1000, background: '#06101b',
  display: 'flex', flexDirection: 'column',
}
const header = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 16px 12px',
  borderBottom: '1px solid rgba(140,176,208,0.12)',
}
const doneBtn = {
  fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
  background: 'linear-gradient(135deg, #2f7da3, #1b4a66)', border: 'none',
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
  border: '2px solid rgba(82,169,205,0.9)', borderRadius: 14,
  boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)',
}
const guideStrip = {
  position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%',
  borderTop: '2px dashed rgba(200,162,74,0.8)',
  background: 'rgba(200,162,74,0.08)', borderRadius: '0 0 12px 12px',
}
const torchBtn = {
  position: 'absolute', top: 14, right: 14, zIndex: 6,
  width: 44, height: 44, borderRadius: '50%', padding: 0, fontSize: 20, lineHeight: 1,
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  background: 'rgba(8,16,27,0.7)', border: '1px solid rgba(140,176,208,0.18)',
  backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
}
const torchBtnOn = {
  background: 'rgba(200,162,74,0.22)', border: '1px solid rgba(200,162,74,0.7)',
  boxShadow: '0 0 14px rgba(200,162,74,0.5)',
}
const loadingPill = {
  position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
  display: 'flex', alignItems: 'center', gap: 8,
  background: 'rgba(8,16,27,0.85)', border: '1px solid rgba(140,176,208,0.2)',
  borderRadius: 20, padding: '8px 16px', fontSize: 12.5, color: '#cdb8ff',
}
const spinnerDot = {
  width: 7, height: 7, borderRadius: '50%', background: '#52a9cd',
  flexShrink: 0, animation: 'livePulse 1.5s ease-in-out infinite',
}
const shutterWrap = {
  position: 'absolute', bottom: 18, left: 0, right: 0,
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, zIndex: 5,
}
const shutterBtn = {
  width: 70, height: 70, borderRadius: '50%', padding: 0,
  background: 'rgba(140,176,208,0.15)', border: '4px solid #fff',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const shutterInner = { width: 54, height: 54, borderRadius: '50%', background: '#fff' }
const shutterHint = {
  fontSize: 12, color: '#e0d6ff', fontWeight: 500,
  background: 'rgba(8,16,27,0.6)', padding: '4px 12px', borderRadius: 12,
}
const messageWrap = {
  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center',
}
const strip = {
  flexShrink: 0, borderTop: '1px solid rgba(140,176,208,0.12)',
  background: 'rgba(8,16,27,0.95)',
  padding: '10px 10px calc(env(safe-area-inset-bottom, 0px) + 10px)',
}
const emptyHint = {
  fontSize: 12, color: '#9db2c6', textAlign: 'center', padding: '14px 20px', lineHeight: 1.5,
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
  borderRadius: '50%', border: 'none', background: 'rgba(8,16,27,0.9)',
  color: '#c0b5d8', fontSize: 11, cursor: 'pointer', lineHeight: 1,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const tileImg = {
  position: 'relative', width: 76, aspectRatio: '5 / 7', borderRadius: 8, overflow: 'hidden',
  background: 'rgba(140,176,208,0.04)', border: '1px solid rgba(140,176,208,0.08)',
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
  fontSize: 10, fontWeight: 600, color: '#52a9cd', textAlign: 'center',
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
}
const tileSelect = {
  width: '100%', marginTop: 2, fontSize: 10, fontFamily: 'inherit', fontWeight: 600,
  color: '#e0d6ff', background: 'rgba(140,176,208,0.12)', border: '1px solid rgba(200,162,74,0.3)',
  borderRadius: 6, padding: '3px 4px', cursor: 'pointer', outline: 'none',
}
