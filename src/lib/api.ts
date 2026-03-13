import { getRuntimeApiUrl } from "@/lib/runtime-config";
const API_URL = getRuntimeApiUrl();

/** Standard API error shape returned by the server. */
export interface ApiErrorBody {
  error: string;
  code?: string;
  details?: unknown;
}

/**
 * Error thrown by fetchApi when the API returns an error.
 * Carries the standardized { error, code?, details? } body.
 */
export class ApiError extends Error {
  readonly code?: string;
  readonly details?: unknown;
  readonly status?: number;

  constructor(
    message: string,
    opts?: { code?: string; details?: unknown; status?: number },
  ) {
    super(message);
    this.name = "ApiError";
    this.code = opts?.code;
    this.details = opts?.details;
    this.status = opts?.status;
  }
}

async function parseErrorResponse(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => ({}))) as ApiErrorBody;
  const message = body?.error ?? res.statusText ?? `Request failed: ${res.status}`;
  return new ApiError(message, {
    code: body?.code,
    details: body?.details,
    status: res.status,
  });
}

/**
 * Generic fetch wrapper with credentials and JSON handling.
 * Throws ApiError (with error, code?, details?) when res.ok is false.
 */
export async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    throw await parseErrorResponse(res);
  }
  return res.json() as Promise<T>;
}

/**
 * Fetch a list resource that returns Content-Range header for total count.
 * Throws ApiError when res.ok is false.
 */
export async function fetchApiList<T>(
  path: string,
  options?: RequestInit,
): Promise<{ data: T[]; total: number }> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
  });
  if (!res.ok) {
    throw await parseErrorResponse(res);
  }
  const contentRange = res.headers.get("Content-Range");
  const total = contentRange ? parseInt(contentRange.split("/")[1] ?? "0", 10) : 0;
  const data = (await res.json()) as T[];
  return { data, total };
}
