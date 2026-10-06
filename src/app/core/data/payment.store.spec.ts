import { TestBed } from '@angular/core/testing';
import { ApiService } from '../http/api.service';
import { PaymentStatus } from '../payments/payment.types';
import { PaymentStore } from './payment.store';

const USER = {
  id: 'u-1',
  email: 'owner@shop.co',
  name: 'owner',
  role: 'user' as const,
  plan: 'free' as const,
  cycle: 'month' as const,
  status: 'active' as const,
};

function status(state: PaymentStatus['status']): PaymentStatus {
  return {
    id: 'pi_1',
    status: state,
    method: null,
    failureMessage: null,
    amount: 790,
    flow: 'prepaid',
    user: USER,
  };
}

describe('PaymentStore', () => {
  let api: { paymentConfig: ReturnType<typeof vi.fn>; confirmPayment: ReturnType<typeof vi.fn> };
  let store: PaymentStore;

  beforeEach(() => {
    api = { paymentConfig: vi.fn(), confirmPayment: vi.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: api }] });
    store = TestBed.inject(PaymentStore);
  });

  afterEach(() => vi.useRealTimers());

  it('loads the publishable key once and says whether the in-app checkout can run', async () => {
    expect(store.ready()).toBe(false);
    api.paymentConfig.mockResolvedValue({ publishableKey: 'pk_test_1', currency: 'thb' });

    await store.loadConfig();
    await store.loadConfig();

    expect(api.paymentConfig).toHaveBeenCalledTimes(1);
    expect(store.ready()).toBe(true);
  });

  it('is not ready when the server has no key for the browser', async () => {
    api.paymentConfig.mockResolvedValue({ publishableKey: null, currency: 'thb' });
    await store.loadConfig();
    expect(store.ready()).toBe(false);
  });

  it('asks again while the payment is pending and stops when the server says it is settled', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    api.confirmPayment
      .mockResolvedValueOnce(status('pending'))
      .mockResolvedValueOnce(status('pending'))
      .mockResolvedValueOnce(status('succeeded'));

    const done = store.settle('pi_1', { intervalMs: 2000 });
    await vi.advanceTimersByTimeAsync(0);
    expect(api.confirmPayment).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(api.confirmPayment).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2000);

    expect((await done).status).toBe('succeeded');
    expect(api.confirmPayment).toHaveBeenCalledTimes(3);
  });

  it('answers a failed payment at once and keeps trying through a look that failed on the network', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    api.confirmPayment
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(status('failed'));

    const done = store.settle('pi_1', { intervalMs: 1000 });
    await vi.advanceTimersByTimeAsync(1000);

    expect((await done).status).toBe('failed');
    expect(api.confirmPayment).toHaveBeenCalledTimes(2);
  });

  it('gives back the last status (still pending) when the time is up, and stops when told to', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    api.confirmPayment.mockResolvedValue(status('pending'));

    const slow = store.settle('pi_1', { intervalMs: 1000, timeoutMs: 3500 });
    await vi.advanceTimersByTimeAsync(5000);
    expect((await slow).status).toBe('pending');
    const calls = api.confirmPayment.mock.calls.length;
    expect(calls).toBeGreaterThanOrEqual(3);
    expect(calls).toBeLessThanOrEqual(5);

    const abort = new AbortController();
    api.confirmPayment.mockClear();
    const stopped = store.settle('pi_1', { intervalMs: 1000, signal: abort.signal });
    await vi.advanceTimersByTimeAsync(0);
    abort.abort();
    await vi.advanceTimersByTimeAsync(0);
    expect((await stopped).status).toBe('pending');
    expect(api.confirmPayment).toHaveBeenCalledTimes(1);
  });

  it('rejects when the server cannot be asked at all', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    api.confirmPayment.mockRejectedValue(new Error('down'));

    const failed = store.settle('pi_1', { intervalMs: 1000, timeoutMs: 2500 });
    const caught = failed.catch((e: Error) => e.message);
    await vi.advanceTimersByTimeAsync(4000);

    expect(await caught).toBe('down');
  });
});
