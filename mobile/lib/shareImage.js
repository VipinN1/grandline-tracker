// RN counterpart to src/lib/shareImage.js — captures a view to a PNG and
// hands it to the native share sheet. Where web renders a DOM node to canvas
// with html2canvas, RN renders a real native view to an image with
// react-native-view-shot, so there's no CORS/tainted-canvas trick needed here
// (see getProxiedCardImageUrl on web) — remote images just work.
import { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'
import { Share } from 'react-native'

// `ref` is a React ref to the native view to capture (e.g. a <View
// collapsable={false}> wrapping the shareable card). Returns 'shared',
// 'cancelled', or throws if capture itself fails (caller should fall back
// to a plain text share in that case).
export async function captureAndShare(ref, { fileName = 'share.png', title = '', text = '' } = {}) {
  if (!ref?.current) throw new Error('Nothing to capture')

  const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' })

  if (await Sharing.isAvailableAsync()) {
    try {
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: title || text, UTI: 'public.png' })
      return 'shared'
    } catch (err) {
      if (err?.message?.toLowerCase().includes('cancel')) return 'cancelled'
      throw err
    }
  }

  // Fallback for the rare device without a share sheet provider registered.
  const result = await Share.share({ url: uri, message: text, title })
  return result.action === Share.dismissedAction ? 'cancelled' : 'shared'
}
