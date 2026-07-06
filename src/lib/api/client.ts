import { getAuthToken } from '../storage/settingsStore';
import { ensureOriginPermission } from '../permissions';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function getApiBaseUrl(): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('VITE_API_BASE_URL is not configured — set it in .env and rebuild.');
  }
  return baseUrl.replace(/\/+$/, '');
}

// Every request routes through here so host-permission and auth-header
// handling stay in one place — see PLAN.md's REST API contract section.
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const baseUrl = getApiBaseUrl();
  await ensureOriginPermission(baseUrl);
  const token = await getAuthToken();

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    const detail = body?.errors ? ` ${JSON.stringify(body.errors)}` : '';
    throw new ApiError(response.status, `Request to ${path} failed (${response.status}).${detail}`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
