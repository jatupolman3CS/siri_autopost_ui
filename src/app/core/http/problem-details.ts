import { HttpErrorResponse } from '@angular/common/http';

// RFC 7807 body the API returns for every error (see the backend's ExceptionHandlingMiddleware).
export interface ProblemDetails {
  title?: string;
  status?: number;
  detail?: string;
  errors?: Record<string, string[]>;
}

export function problemOf(err: unknown): ProblemDetails | null {
  if (!(err instanceof HttpErrorResponse)) return null;
  return typeof err.error === 'object' && err.error !== null ? (err.error as ProblemDetails) : null;
}

/** The first field message of a validation answer (`errors`, Thai, one list per field), else null. */
export function firstFieldError(p: ProblemDetails | null): string | null {
  for (const messages of Object.values(p?.errors ?? {}))
    for (const m of messages ?? []) if (m) return m;
  return null;
}

/** What to tell the user about a refused request: the first field message, else the API's title. */
export function problemMessage(err: unknown): string | null {
  const p = problemOf(err);
  return firstFieldError(p) ?? p?.title ?? null;
}

/** Field messages of a validation answer by lower-cased field name ("email", "password"), first one each. */
export function fieldErrors(err: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [field, messages] of Object.entries(problemOf(err)?.errors ?? {})) {
    const m = (messages ?? []).find(Boolean);
    if (m) out[field.toLowerCase()] = m;
  }
  return out;
}
