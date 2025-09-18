import { http } from "./http";
import type { Dataset, PaginatedResponse } from "../types";

const BASE_PATH = "/api/datasets";

export async function listDatasets(params?: { search?: string; tags?: string[]; page?: number }) {
  return http<PaginatedResponse<Dataset>>(BASE_PATH, {
    method: "GET",
    params: params as Record<string, string | number | boolean | undefined>,
  });
}

export async function getDataset(id: string) {
  return http<Dataset>(`${BASE_PATH}/${id}`, { method: "GET" });
}

export async function createDataset(payload: Partial<Dataset>) {
  const formData = new FormData();
  if (payload.name) formData.append("name", payload.name);
  if (payload.description) formData.append("description", payload.description);
  if (payload.tags) formData.append("tags", JSON.stringify(payload.tags));
  if ((payload as Record<string, File | undefined>).file) {
    formData.append("file", (payload as Record<string, File>).file!);
  }
  return http<Dataset>(BASE_PATH, {
    method: "POST",
    body: formData,
    headers: {},
  });
}

export async function previewDataset(id: string) {
  return http<Dataset>(`${BASE_PATH}/${id}/preview`, { method: "GET" });
}
