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
