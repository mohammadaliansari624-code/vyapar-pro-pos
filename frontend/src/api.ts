export const API: string = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

// Called when the server says the session is gone (401) on a normal request.
let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(fn: (() => void) | null) { onUnauthorized = fn }

// FastAPI sends `detail` as a string, or as a list for validation errors (422).
function messageFrom(data: unknown, fallback: string): string {
  const detail = (data as { detail?: unknown } | null)?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((d: { loc?: unknown[]; msg?: string }) => {
        const field = Array.isArray(d.loc) ? String(d.loc[d.loc.length - 1]) : ''
        return field && field !== 'body' ? `${field}: ${d.msg ?? 'invalid value'}` : d.msg ?? 'invalid value'
      })
      .join('; ')
  }
  return fallback
}

type Options = { method?: string; json?: unknown; headers?: Record<string, string> }

export async function api<T = unknown>(path: string, options: Options = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API}${path}`, {
      method: options.method ?? 'GET',
      credentials: 'include',
      headers: { ...(options.json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
      body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
    })
  } catch {
    throw new ApiError('Cannot reach the server. Check that the backend is running and try again.', 0)
  }
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/api/auth/')) onUnauthorized?.()
    throw new ApiError(messageFrom(data, `Request failed (${response.status})`), response.status)
  }
  return data as T
}

export async function downloadInvoicesCsv(): Promise<void> {
  const response = await fetch(`${API}/api/analytics/export`, { credentials: 'include' })
  if (!response.ok) throw new ApiError('Export failed. Please try again.', response.status)
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = 'vyapar-invoices.csv'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong')
