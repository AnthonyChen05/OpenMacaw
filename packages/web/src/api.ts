export const API_BASE = import.meta.env.VITE_API_URL || window.location.origin;

export async function apiFetch(endpoint: string, options?: RequestInit) {
  // Ensure endpoint starts with a slash
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return fetch(`${API_BASE}${path}`, options);
}

export function getWsUrl(endpoint: string) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  
  if (import.meta.env.VITE_API_URL) {
    const url = new URL(import.meta.env.VITE_API_URL);
    return `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  }

  return `${protocol}//${window.location.host}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
}
