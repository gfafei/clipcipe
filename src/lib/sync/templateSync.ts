import { templateRepository } from '../storage/templatesStore';
import {
  createTemplateOnApi,
  dtoToTemplate,
  fetchTemplatesFromApi,
  updateTemplateOnApi,
} from '../api/templates';

export interface SyncResult {
  pulled: number;
  pushed: number;
}

// Manual, one-shot, last-write-wins (see PLAN.md "Template sync with the
// external server"): pull overwrites any local template that has no local
// edits, then push everything still `modified` — a modified local edit
// always wins over whatever the pull just fetched, since push happens after
// pull. A template pushed for the first time gets re-keyed to whatever id
// the server assigns, since POST /templates returns a server-generated id
// that won't match the locally-generated one.
export async function syncTemplates(): Promise<SyncResult> {
  const local = await templateRepository.list();
  const remoteDtos = await fetchTemplatesFromApi();
  const remoteById = new Map(remoteDtos.map((dto) => [dto.id, dto]));

  let pulled = 0;
  const localIds = new Set(local.map((template) => template.id));
  for (const template of local) {
    if (template.syncStatus !== 'saved') continue;
    const remote = remoteById.get(template.id);
    if (!remote) continue;
    await templateRepository.replace(dtoToTemplate(remote));
    pulled++;
  }
  for (const dto of remoteDtos) {
    if (localIds.has(dto.id)) continue;
    await templateRepository.replace(dtoToTemplate(dto));
    pulled++;
  }

  let pushed = 0;
  const afterPull = await templateRepository.list();
  for (const template of afterPull) {
    if (template.syncStatus !== 'modified') continue;
    if (remoteById.has(template.id)) {
      const dto = await updateTemplateOnApi(template);
      await templateRepository.replace(dtoToTemplate(dto));
    } else {
      const dto = await createTemplateOnApi(template);
      await templateRepository.remove(template.id);
      await templateRepository.replace(dtoToTemplate(dto));
    }
    pushed++;
  }

  return { pulled, pushed };
}
