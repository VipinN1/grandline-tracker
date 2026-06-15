import { useState, useRef, useEffect, useCallback } from 'react'
import { createWorker, PSM } from 'tesseract.js'
import { getCard } from '../lib/optcgapi'
import CardImage from './CardImage'

// One Piece card IDs: OP14-120, ST01-001, P-001, EB02-052.
// Allow optional spaces around the hyphen (OCR sometimes inserts them).
const CARD_ID_RE = /([A-Z]{1,3}\d{0,3})\s*-\s*(\d{2,4})/g
const OCR_WHITELIST = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'
const SCAN_INTERVAL = 900 // ms between OCR passes

// Pull all card-ID-shaped tokens out of an OCR text blob, normalized + deduped.
function extractCardIds(text) {
  const ids = new Set()
  const upper = (text ?? '').toUpperCase()
  let m
  CARD_ID_RE.lastIndex = 0
  while ((m = CARD_ID_RE.exec(upper)) !== null) {
    const prefix = m[1]
    // Number part: zero-pad to 3 (the DB format), keep 4-digit IDs as-is.
    const num = m[2].length < 3 ? m[2].padStart(3, '0') : m[2]
    ids.add(`${prefix}-${num}`)
  }
  return [...ids]
}

export default function CardScanner({ onClose }) {
  const videoRef = useRef(null)
  const workerRef = useRef(null)
  const streamRef = useRef(null)
  const runningRef = useRef(false) // scan loop alive
  const busyRef = useRef(false) // an OCR pass is in flight
  const triedRef = useRef(new Set()) // card IDs already looked up and missed
  const timerRef = useRef(null)

  const [phase, setPhase] = useState('starting') // starting | scanning | found | denied | error
  const [status, setStatus] = useState('Starting camera…')
  const [result, setResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  // Grab the bottom strip of the framing guide (where the card number prints),
  // upscaled, as a canvas for OCR.
  const captureNumberStrip = useCallback(() => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return null

    const vw = video.videoWidth
    const vh = video.videoHeight

    // Framing guide: centered portrait card (aspect w/h ≈ 0.714).
    let guideW = vw * 0.84
    let guideH = guideW / 0.714
    if (guideH > vh * 0.9) {
      guideH = vh * 0.9
      guideW = guideH * 0.714
    }
    const guideX = (vw - guideW) / 2
    const guideY = (vh - guideH) / 2

    // Bottom ~22% of the card — the collector-number band.
    const stripH = guideH * 0.22
    const stripY = guideY + guideH - stripH

    // Upscale to a fixed width to help OCR on small text.
    const targetW = 1000
    const scale = targetW / guideW
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(guideW * scale)
    canvas.height = Math.round(stripH * scale)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(
      video,
      guideX, stripY, guideW, stripH,
      0, 0, canvas.width, canvas.height,
    )
    return canvas
  }, [])

  const handleMatch = useCallback((card) => {
    runningRef.current = false
    if (timerRef.current) clearTimeout(timerRef.current)
    setResult(card)
    setPhase('found')
    setStatus('')
    // Release the camera while showing the result.
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [])

  const scanOnce = useCallback(async () => {
    if (!runningRef.current || busyRef.current) return
    const worker = workerRef.current
    const canvas = captureNumberStrip()
    if (!worker || !canvas) return

    busyRef.current = true
    try {
      const { data } = await worker.recognize(canvas)
      const candidates = extractCardIds(data.text).filter(id => !triedRef.current.has(id))
      for (const id of candidates) {
        if (!runningRef.current) break
        triedRef.current.add(id)
        try {
          const card = await getCard(id)
          if (card) { handleMatch({ ...card, _scannedId: id }); return }
        } catch {
          // Not a real card (OCR noise) — keep scanning.
        }
      }
    } catch {
      // Transient OCR failure — ignore and let the loop retry.
    } finally {
      busyRef.current = false
    }
  }, [captureNumberStrip, handleMatch])

  // Drive the scan loop.
  useEffect(() => {
    if (phase !== 'scanning') return
    let cancelled = false
    async function tick() {
      if (cancelled || !runningRef.current) return
      await scanOnce()
      if (cancelled || !runningRef.current) return
      timerRef.current = setTimeout(tick, SCAN_INTERVAL)
    }
    tick()
    return () => {
      cancelled = true
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [phase, scanOnce])

  // Boot: request camera + init OCR worker.
  const start = useCallback(async () => {
    setPhase('starting')
    setStatus('Starting camera…')
    setErrorMsg('')
    triedRef.current = new Set()
    setResult(null)

    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase('error')
      setErrorMsg('This device or browser does not support camera access.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        await video.play().catch(() => {})
      }
    } catch (err) {
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
        setPhase('denied')
      } else {
        setPhase('error')
        setErrorMsg(err?.message ?? 'Could not access the camera.')
      }
      return
    }

    setStatus('Loading scanner…')
    try {
      if (!workerRef.current) {
        const worker = await createWorker('eng')
        await worker.setParameters({
          tessedit_char_whitelist: OCR_WHITELIST,
          tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        })
        workerRef.current = worker
      }
    } catch {
      setPhase('error')
      setErrorMsg('Failed to load the text recognizer.')
      return
    }

    runningRef.current = true
    setPhase('scanning')
    setStatus('Point at the card — keep the number inside the box')
  }, [])

  useEffect(() => {
    // Defer so the bootstrap's setState calls don't run synchronously in the effect body.
    const bootId = setTimeout(start, 0)
    return () => {
      clearTimeout(bootId)
      runningRef.current = false
      if (timerRef.current) clearTimeout(timerRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      if (workerRef.current) {
        workerRef.current.terminate().catch(() => {})
        workerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function scanAgain() {
    setResult(null)
    runningRef.current = false
    if (timerRef.current) clearTimeout(timerRef.current)
    start()
  }

  return (
    <div style={overlay}>
      {/* Camera viewport */}
      <div style={viewport}>
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            display: phase === 'scanning' || phase === 'starting' ? 'block' : 'none',
          }}
        />

        {/* Framing guide */}
        {(phase === 'scanning' || phase === 'starting') && (
          <div style={guideWrap} aria-hidden>
            <div style={guideBox}>
              <div style={guideStrip} />
            </div>
          </div>
        )}

        {/* Result */}
        {phase === 'found' && result && (
          <div style={resultWrap}>
            <CardImage
              cardId={result.card_image_id ?? result._scannedId}
              alt={result.card_name}
              style={{ width: 200, maxWidth: '60vw', aspectRatio: '5 / 7', boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}
            />
            <div style={{ textAlign: 'center', marginTop: 18 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#f0f2f5' }}>
                {result.card_name ?? result._scannedId}
              </div>
              <div style={{ fontSize: 13, color: '#a78bfa', fontWeight: 600, marginTop: 4 }}>
                {result.card_set_id ?? result._scannedId}
                {result.card_type ? ` · ${result.card_type}` : ''}
                {result.card_color ? ` · ${result.card_color}` : ''}
              </div>
              {result.set_name && (
                <div style={{ fontSize: 12, color: '#7c6fa0', marginTop: 2 }}>{result.set_name}</div>
              )}
            </div>
          </div>
        )}

        {/* Denied / error states */}
        {(phase === 'denied' || phase === 'error') && (
          <div style={messageWrap}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📷</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f2f5', marginBottom: 6 }}>
              {phase === 'denied' ? 'Camera permission needed' : 'Something went wrong'}
            </div>
            <div style={{ fontSize: 13, color: '#7c6fa0', maxWidth: 280, lineHeight: 1.5 }}>
              {phase === 'denied'
                ? 'Allow camera access in your browser, then tap Retry to scan a card.'
                : errorMsg}
            </div>
            <button onClick={start} style={{ ...primaryBtn, marginTop: 20, paddingLeft: 28, paddingRight: 28, flex: 'none' }}>Retry</button>
          </div>
        )}
      </div>

      {/* Status bar */}
      {(phase === 'scanning' || phase === 'starting') && status && (
        <div style={statusBar}>
          <span style={spinnerDot} />
          {status}
        </div>
      )}

      {/* Bottom controls */}
      <div style={controls}>
        {phase === 'found' ? (
          <>
            <button onClick={scanAgain} style={primaryBtn}>Scan another</button>
            <button onClick={onClose} style={ghostBtn}>Done</button>
          </>
        ) : (
          <button onClick={onClose} style={ghostBtn}>Close</button>
        )}
      </div>
    </div>
  )
}

const overlay = {
  position: 'fixed', inset: 0, zIndex: 1000, background: '#0c0814',
  display: 'flex', flexDirection: 'column',
}
const viewport = {
  position: 'relative', flex: 1, overflow: 'hidden',
  background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const guideWrap = {
  position: 'absolute', inset: 0, display: 'flex',
  alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
}
const guideBox = {
  position: 'relative', width: '84%', maxWidth: 360, aspectRatio: '5 / 7',
  border: '2px solid rgba(167,139,250,0.9)', borderRadius: 14,
  boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
}
const guideStrip = {
  position: 'absolute', left: 0, right: 0, bottom: 0, height: '22%',
  borderTop: '2px dashed rgba(236,72,153,0.8)',
  background: 'rgba(236,72,153,0.08)',
  borderRadius: '0 0 12px 12px',
}
const resultWrap = {
  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', padding: 24,
}
const messageWrap = {
  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center',
}
const statusBar = {
  position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 16px)', left: '50%',
  transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8,
  background: 'rgba(12,8,20,0.85)', backdropFilter: 'blur(10px)',
  border: '1px solid rgba(139,92,246,0.2)', borderRadius: 20,
  padding: '8px 16px', fontSize: 12.5, fontWeight: 500, color: '#cdb8ff',
  maxWidth: '88%', textAlign: 'center',
}
const spinnerDot = {
  width: 7, height: 7, borderRadius: '50%', background: '#a78bfa',
  flexShrink: 0, animation: 'livePulse 1.5s ease-in-out infinite',
}
const controls = {
  display: 'flex', gap: 10, padding: '16px',
  paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
  background: 'rgba(12,8,20,0.9)', borderTop: '1px solid rgba(139,92,246,0.12)',
}
const primaryBtn = {
  flex: 1, padding: '13px', borderRadius: 10, border: 'none',
  background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff',
  fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
}
const ghostBtn = {
  flex: 1, padding: '13px', borderRadius: 10,
  border: '1px solid rgba(139,92,246,0.25)', background: 'transparent',
  color: '#a78bfa', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
}
