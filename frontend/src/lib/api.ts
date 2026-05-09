import { useMemo } from "react";

export const API_PREFIX = "/api/v1";

export type ApiClient = <T>(path: string, init?: RequestInit) => Promise<T>;

export function useApi(token: string | null) {
  return useMemo<ApiClient>(
    () => async <T,>(path: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      if (!(init.body instanceof FormData)) {
        headers.set("Content-Type", headers.get("Content-Type") || "application/json");
      }
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const response = await fetch(`${API_PREFIX}${path}`, { ...init, headers });
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      if (!response.ok) throw new Error(data.detail || data.error || "Request failed");
      return data as T;
    },
    [token],
  );
}
