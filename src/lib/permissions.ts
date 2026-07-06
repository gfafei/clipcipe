// Shared by every API call site (Sync now, Upload) and by page extraction —
// `chrome.permissions.request` only succeeds during a user gesture, so this
// must always be invoked directly inside a click handler's call chain.
export async function ensureOriginPermission(url: string): Promise<void> {
  const origin = `${new URL(url).origin}/*`;
  const alreadyGranted = await chrome.permissions.contains({ origins: [origin] });
  if (alreadyGranted) return;
  const granted = await chrome.permissions.request({ origins: [origin] });
  if (!granted) {
    throw new Error(`Permission to access ${origin} was denied.`);
  }
}
