import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DevicesStore } from '../../core/data/devices.store';
import { ApiDevice } from '../../core/http/api.service';
import { WS, provideApiTesting, settle, signIn } from '../../testing/api-testing';
import { PairDeviceModalComponent } from './pair-device-modal.component';

const device = (id: string, name: string): ApiDevice => ({
  id,
  name,
  browser: 'Chrome 130',
  version: '2.0.0',
  createdAt: new Date().toISOString(),
  lastSeenAt: new Date().toISOString(),
  online: true,
  accountId: 'acc-' + id,
  jobsPaused: false,
});

describe('PairDeviceModalComponent', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    http = provideApiTesting({ imports: [PairDeviceModalComponent] });
    TestBed.inject(DevicesStore);
    await signIn(http);
    for (const r of http.match(`/api/workspaces/${WS}/devices`)) r.flush([device('d1', 'Old PC')]);
    await settle();
  });

  afterEach(() => vi.useRealTimers());

  it('shows a code, then closes when a new device pairs', async () => {
    const fixture = TestBed.createComponent(PairDeviceModalComponent);
    const paired: string[] = [];
    let closed = 0;
    fixture.componentInstance.paired.subscribe((n) => paired.push(n));
    fixture.componentInstance.closed.subscribe(() => closed++);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await settle();

    const expiresAt = new Date(Date.now() + 10 * 60000).toISOString();
    http
      .expectOne({ method: 'POST', url: `/api/workspaces/${WS}/devices/pairing` })
      .flush({ code: 'K7QF-2MXP', expiresAt, maxDevices: 3 });
    await settle();
    fixture.detectChanges();
    const code = (fixture.nativeElement as HTMLElement).ownerDocument.querySelector(
      '[data-testid="pair-code"]',
    );
    expect(code?.textContent).toContain('K7QF-2MXP');

    // "Connect this Chrome" opens the address the extension watches for, in a new tab.
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    (fixture.nativeElement as HTMLElement).ownerDocument
      .querySelector<HTMLButtonElement>('[data-testid="pair-connect"]')!
      .click();
    expect(open).toHaveBeenCalledTimes(1);
    const [url, target] = open.mock.calls[0] as [string, string];
    expect(target).toBe('_blank');
    expect(url.startsWith(`${location.origin}/connect-extension#`)).toBe(true);
    const params = new URLSearchParams(url.split('#')[1]);
    expect(params.get('ap-pair')).toBe('1');
    expect(params.get('code')).toBe('K7QF-2MXP');
    expect(params.get('ws')).toBe('Shop');
    open.mockRestore();

    // Nothing new yet.
    await vi.advanceTimersByTimeAsync(3000);
    http.expectOne(`/api/workspaces/${WS}/devices`).flush([device('d1', 'Old PC')]);
    await settle();
    expect(closed).toBe(0);

    // The extension paired.
    await vi.advanceTimersByTimeAsync(3000);
    http
      .expectOne(`/api/workspaces/${WS}/devices`)
      .flush([device('d1', 'Old PC'), device('d2', 'Shop PC')]);
    await settle();
    expect(paired).toEqual(['Shop PC']);
    expect(closed).toBe(1);
  });

  it('shows the plan limit when no device slot is left', async () => {
    const fixture = TestBed.createComponent(PairDeviceModalComponent);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await settle();
    http
      .expectOne(`/api/workspaces/${WS}/devices/pairing`)
      .flush(
        { title: 'แผนปัจจุบันผูกอุปกรณ์ได้สูงสุด 1 เครื่อง' },
        { status: 422, statusText: 'Unprocessable' },
      );
    await settle();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).ownerDocument.body.textContent).toContain(
      'สูงสุด 1 เครื่อง',
    );
  });
});
