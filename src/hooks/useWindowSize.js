import { useState, useEffect } from 'react'

export function useWindowSize() {
  const [width, setWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  )

  useEffect(() => {
    function handleResize() { setWidth(window.innerWidth) }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return {
    isMobile: width < 768,
    isTablet: width < 1024,
  }
}
