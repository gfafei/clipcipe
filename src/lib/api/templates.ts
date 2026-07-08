import type { Field, Template } from '../types';
import { apiFetch } from './client';

// Mirrors PLAN.md's TemplateDTO — the same shape as Template minus the
// local-only syncStatus marker.
export interface TemplateDTO {
  id: string;
  name: string;
  urlPattern: string;
  fields: Field[];
  formatterTemplate: string;
  createdAt: string;
  updatedAt: string;
}

export function dtoToTemplate(dto: TemplateDTO): Template {
  return { ...dto, syncStatus: 'saved' };
}

export async function fetchTemplatesFromApi(): Promise<TemplateDTO[]> {
  const response = await apiFetch<{ templates: TemplateDTO[] }>('/templates');
  return response.templates;
}

export async function createTemplateOnApi(template: Template): Promise<TemplateDTO> {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, syncStatus: _syncStatus, ...body } = template;
  return apiFetch<TemplateDTO>('/templates', { method: 'POST', body: JSON.stringify(body) });
}

export async function updateTemplateOnApi(template: Template): Promise<TemplateDTO> {
  const { syncStatus: _syncStatus, ...dto } = template;
  return apiFetch<TemplateDTO>(`/templates/${template.id}`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  });
}

export async function deleteTemplateOnApi(id: string): Promise<void> {
  await apiFetch<void>(`/templates/${id}`, { method: 'DELETE' });
}
