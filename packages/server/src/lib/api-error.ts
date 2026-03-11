import type { Context } from "hono";
import type { StatusCode } from "hono/utils/http-status";

/**
 * Standard API error shape: { error, code?, details? }.
 * Use with jsonError() for consistent error responses.
 */
export interface ApiErrorBody {
  error: string;
  code?: string;
  details?: unknown;
}

/**
 * Return a standardized JSON error response.
 * @param c Hono context
 * @param message Human-readable error message
 * @param status HTTP status (default 500)
 * @param code Optional machine-readable code (e.g. "NOT_FOUND", "VALIDATION_FAILED")
 * @param details Optional extra info (e.g. validation errors)
 */
export function jsonError(
  c: Context,
  message: string,
  status: StatusCode = 500,
  code?: string,
  details?: unknown,
): Response {
  const body: ApiErrorBody = {
    error: message,
    ...(code && { code }),
    ...(details !== undefined && { details }),
  };
  return c.json(
    body,
    status as 200 | 400 | 403 | 404 | 500,
  );
}
