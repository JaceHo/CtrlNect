// API base URL - uses relative path in dev, configurable in prod
import { API_BASE } from "./api";

export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, options);
}
