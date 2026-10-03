import { HttpErrorResponse } from '@angular/common/http';
import { isTransient, loadWithRetry } from './loading';

const http = (status: number) => new HttpErrorResponse({ status });

describe('loadWithRetry', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('calls the loader again after a server failure and reports success', async () => {
    const run = vi.fn().mockRejectedValueOnce(http(503)).mockResolvedValue(undefined);
    const result = loadWithRetry(run, () => true, [10, 20]);
    await vi.advanceTimersByTimeAsync(10);
    expect(await result).toBe(true);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('gives up after the last pause and never rejects', async () => {
    const run = vi.fn().mockRejectedValue(http(0));
    const result = loadWithRetry(run, () => true, [10, 20]);
    await vi.advanceTimersByTimeAsync(30);
    expect(await result).toBe(false);
    expect(run).toHaveBeenCalledTimes(3);
  });

  it('does not repeat a refusal (4xx)', async () => {
    const run = vi.fn().mockRejectedValue(http(403));
    expect(await loadWithRetry(run, () => true, [10])).toBe(false);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('stops repeating once the data is no longer wanted', async () => {
    let wanted = true;
    const run = vi.fn().mockImplementation(async () => {
      wanted = false;
      throw http(500);
    });
    expect(await loadWithRetry(run, () => wanted, [10, 20])).toBe(false);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('tells transient failures from refusals', () => {
    expect([0, 408, 429, 500, 502].every((s) => isTransient(http(s)))).toBe(true);
    expect([400, 401, 403, 404, 409, 422].some((s) => isTransient(http(s)))).toBe(false);
    expect(isTransient(new Error('x'))).toBe(false);
  });
});
