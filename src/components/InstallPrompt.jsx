import { useState, useEffect } from 'react'

const DISMISS_KEY = 'pt-install-dismissed'

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

// A small dismissible banner that helps mobile users add the app to their home
// screen. On Android/Chrome it uses the native install prompt; on iOS Safari
// (which has no programmatic install) it shows the Share → Add to Home Screen
// instructions.
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [show, setShow] = useState(false)
  const [ios, setIos] = useState(false)

  useEffect(() => {
    // Already installed, or user dismissed before — stay hidden.
    if (isStandalone() || localStorage.getItem(DISMISS_KEY)) return

    const onMobile = window.matchMedia('(max-width: 768px)').matches
    if (!onMobile) return

    if (isIOS()) {
      setIos(true)
      setShow(true)
      return
    }

    // Android / desktop Chrome: wait for the browser's install signal.
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    const installed = () => setShow(false)
    window.addEventListener('appinstalled', installed)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installed)
    }
  }, [])

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setShow(false)
  }

  const install = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    setShow(false)
  }

  if (!show) return null

  return (
    <div
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 'calc(12px + env(safe-area-inset-bottom))',
        zIndex: 1000,
        background: 'rgba(20, 14, 34, 0.96)',
        border: '1px solid rgba(134, 59, 255, 0.4)',
        borderRadius: 16,
        padding: 14,
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontFamily: "'Space Grotesk', system-ui, sans-serif",
        color: '#f0f2f5',
      }}
    >
      <img
        src="/icon.svg"
        alt=""
        width={40}
        height={40}
        style={{ borderRadius: 10, flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Add PirateTracker to your home screen</div>
        {ios ? (
          <div style={{ fontSize: 12, color: '#b9aee0', marginTop: 2, lineHeight: 1.4 }}>
            Tap the Share{' '}
            <span aria-hidden style={{ display: 'inline-block', transform: 'translateY(2px)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#b9aee0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M8 8l4-4 4 4"/><path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/></svg>
            </span>{' '}
            button, then <strong style={{ color: '#f0f2f5' }}>Add to Home Screen</strong>.
          </div>
        ) : (
          <div style={{ fontSize: 12, color: '#b9aee0', marginTop: 2 }}>
            Install for a faster, full-screen experience.
          </div>
        )}
      </div>
      {!ios && (
        <button
          onClick={install}
          style={{
            background: '#863bff',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '9px 14px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            flexShrink: 0,
            fontFamily: 'inherit',
          }}
        >
          Install
        </button>
      )}
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          background: 'transparent',
          border: 'none',
          color: '#8b7fb0',
          fontSize: 20,
          lineHeight: 1,
          cursor: 'pointer',
          padding: 4,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  )
}
