import { apiFetch } from './client';

// templateId/fields only apply to a template-driven extraction — the
// standalone element picker clips a single picked element with no template
// involved, so both are optional here.
export interface ClipUploadRequest {
  markdown: string;
  sourceUrl: string;
  title: string;
  clippedAt: string;
  templateId?: string;
  fields?: Record<string, string>;
  metadata: { extensionVersion: string };
}

export interface ClipUploadResponse {
  id: string;
  createdAt: string;
}

export async function uploadClip(payload: ClipUploadRequest): Promise<ClipUploadResponse> {
  return apiFetch<ClipUploadResponse>('/clips', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
