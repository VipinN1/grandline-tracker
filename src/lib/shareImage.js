// Renders a DOM node to a PNG, then either opens the native share sheet
// (iOS Safari 16.4+, Android Chrome — this is what pops up the iOS share
// page) or, when that's not available, downloads it as an image file.
// Card art inside `node` must be served same-origin (see
// getProxiedCardImageUrl in lib/optcgapi.js) or the canvas will be tainted
// and toBlob() will throw.
export async function captureAndShare(node, { fileName = 'share.png', title = '', text = '' } = {}) {
  if (!node) throw new Error('Nothing to capture')

  // Loaded on demand — keeps html2canvas out of the main bundle (same
  // reasoning as the lazy-loaded CardScanner/tesseract.js in Navbar.jsx).
  const { default: html2canvas } = await import('html2canvas')

  const canvas = await html2canvas(node, {
    backgroundColor: null,
    useCORS: true,
    // Fixed, not tied to the viewing device's devicePixelRatio — a share
    // image should come out crisp even when captured on a plain 1x desktop
    // display, since it's meant to be viewed/zoomed elsewhere.
    scale: 3,
  })

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Failed to generate image')

  const file = new File([blob], fileName, { type: 'image/png' })

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text })
      return 'shared'
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled'
      // canShare() said yes but the share itself failed (e.g. no share
      // targets registered) — fall through to a plain download instead.
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return 'downloaded'
}
