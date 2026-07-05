// Base URL for the website's Vercel serverless functions (api/ in the repo root).
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://piratetracker.vercel.app'

export async function deleteAccount(accessToken) {
  const res = await fetch(`${API_URL}/api/delete-account`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed (${res.status})`)
  }
  return res.json()
}
