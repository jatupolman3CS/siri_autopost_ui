import { HttpErrorResponse } from '@angular/common/http';

/** Pauses between the attempts of a loader that keeps failing (ms). */
export const RETRY_DELAYS_MS = [2000, 5000, 15_000];

/** A failure worth another try: the server was unreachable, busy or broken (a 4xx is a refusal). */
export function isTransient(e: unknown): boolean {
  if (!(e instanceof HttpErrorResponse)) return false;
  return e.status === 0 || e.status === 408 || e.status === 429 || e.status >= 500;
}

/**
 * Runs a loader and repeats it, with growing pauses, while it fails for a transient reason and the data is
 * still wanted (`wanted()`: the workspace or user has not changed meanwhile). Never rejects; resolves to
 * whether the data arrived, so the caller sets its `loaded` flag from it.
 */
export async function loadWithRetry(
  run: () => Promise<void>,
  wanted: () => boolean = () => true,
  delays: readonly number[] = RETRY_DELAYS_MS,
): Promise<boolean> {
  for (let attempt = 0; ; attempt++) {
    try {
      await run();
      return true;
    } catch (e) {
      if (!wanted() || !isTransient(e) || attempt >= delays.length) return false;
      await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
      if (!wanted()) return false;
    }
  }
}
