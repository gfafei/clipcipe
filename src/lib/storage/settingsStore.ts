// The API base URL is compiled in from .env (VITE_API_BASE_URL) since it
// rarely changes. The auth token stays here in chrome.storage.local instead,
// specifically so it's never baked into a static build artifact and can be
// rotated without a rebuild — see PLAN.md's "Local storage" section.
const STORAGE_KEY = 'clipcipe:settings';

interface Settings {
  authToken: string;
}

export async function getAuthToken(): Promise<string | undefined> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const settings = stored[STORAGE_KEY] as Settings | undefined;
  return settings?.authToken || undefined;
}

export async function setAuthToken(authToken: string): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: { authToken } satisfies Settings });
}
