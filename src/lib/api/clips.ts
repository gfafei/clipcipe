import { apiFetch } from './client';

// PLAN.md's `fields` sub-object only lists author/date/tags as an example —
// generalized here to the extracted template's full field set, since a
// template can define any keys, not just those three.
export interface ClipUploadRequest {
  markdown: string;
  sourceUrl: string;
  title: string;
  clippedAt: string;
  templateId: string;
  fields: Record<string, string>;
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
