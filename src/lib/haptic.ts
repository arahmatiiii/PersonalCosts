/** A short buzz on Android (WebView supports navigator.vibrate); no-op elsewhere. */
export function haptic(ms = 10): void {
  navigator.vibrate?.(ms);
}
