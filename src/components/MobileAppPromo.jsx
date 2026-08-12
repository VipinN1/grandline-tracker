import { useState, useEffect } from 'react'

const APP_STORE_URL = 'https://apps.apple.com/us/app/piratetracker/id6787367138'
const STORAGE_KEY = 'pt_mobile_app_promo_seen'

export default function MobileAppPromo() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setShow(true)
      }
    } catch {
      // localStorage unavailable — just skip the popup
    }
  }, [])

  function dismiss() {
    setShow(false)
    try { localStorage.setItem(STORAGE_KEY, '1') } catch {}
  }

  if (!show) return null

  return (
    <div
      onClick={dismiss}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#0f1f33', border: '1px solid rgba(200,162,74,0.25)', borderRadius: 16, width: 400, maxWidth: '100%', padding: 26, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14 }}
      >
        <button
          onClick={dismiss}
          style={{ alignSelf: 'flex-end', marginTop: -8, marginRight: -8, background: 'none', border: 'none', color: '#9db2c6', cursor: 'pointer', fontSize: 18, padding: 4, lineHeight: 1 }}
        >
          ✕
        </button>
        <img
          src="/apple-touch-icon.png"
          alt="PirateTracker app icon"
          style={{ width: 72, height: 72, borderRadius: 18, marginTop: -12, boxShadow: '0 6px 18px rgba(0,0,0,0.4)' }}
        />
        <div style={{ fontSize: 18, fontWeight: 700, color: '#e9f1f8' }}>
          PirateTracker is now on the App Store! ⚓
        </div>
        <div style={{ fontSize: 13, color: '#9db2c6', lineHeight: 1.6 }}>
          Track matches, decks, and tournaments on the go. Grab the iOS app now.
        </div>
        <a
          href={APP_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={dismiss}
          style={{ width: '100%', boxSizing: 'border-box', marginTop: 4, padding: 12, borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #2f7da3, #1b4a66)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none', display: 'inline-block' }}
        >
          Get it on the App Store
        </a>
        <button
          onClick={dismiss}
          style={{ background: 'none', border: 'none', color: '#9db2c6', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: 4 }}
        >
          Maybe later
        </button>
      </div>
    </div>
  )
}
