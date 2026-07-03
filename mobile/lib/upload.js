// Image upload helper: expo-image-picker → Supabase storage.
// Hermes provides global atob, so we decode base64 to an ArrayBuffer directly.
import * as ImagePicker from 'expo-image-picker'
import { supabase } from './supabase'

function base64ToArrayBuffer(b64) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

// Opens the photo library; returns the public URL of the uploaded file, or null.
export async function pickAndUploadImage({ bucket, path, quality = 0.7 }) {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality,
    base64: true,
  })
  if (result.canceled || !result.assets?.[0]?.base64) return null

  const asset = result.assets[0]
  const ext = (asset.fileName?.split('.').pop() ?? 'jpg').toLowerCase()
  const contentType = asset.mimeType ?? 'image/jpeg'
  const fullPath = `${path}.${ext}`

  const { error } = await supabase.storage
    .from(bucket)
    .upload(fullPath, base64ToArrayBuffer(asset.base64), { contentType, upsert: true })
  if (error) throw error

  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fullPath)
  return publicUrl
}
