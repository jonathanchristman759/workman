// Workman — api.ts
// apps/web/src/lib/api.ts
// Typed API client — thin wrapper around fetch that points at the backend.
// All requests include credentials (cookies) automatically.

const BASE_URL = 'http://localhost:4000/api'

async function request<T>(
  method:  string,
  path:    string,
  body?:   unknown
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: 'include', // send HttpOnly cookie on every request
    headers: {
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(error.error ?? `Request failed: ${res.status}`)
  }

  return res.json()
}

export const api = {
  get:    <T>(path: string)                 => request<T>('GET',    path),
  post:   <T>(path: string, body: unknown)  => request<T>('POST',   path, body),
  patch:  <T>(path: string, body: unknown)  => request<T>('PATCH',  path, body),
  delete: <T>(path: string)                 => request<T>('DELETE', path),
}
