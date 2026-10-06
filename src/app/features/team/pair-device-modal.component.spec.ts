import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DevicesStore } from '../../core/data/devices.store';
import { ApiDevice } from '../../core/http/api.service';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
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
    await signIn(http, { devices: [device('d1', 'Old PC')] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

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

  describe('names are unique in a workspace', () => {
    const t = () => TestBed.inject(I18nService).t().api;
    const doc = () => document;
    const q = (id: string) => doc().querySelector<HTMLElement>(`[data-testid="${id}"]`);
    const CODE = { code: 'K7QF-2MXP', maxDevices: 3 };

    async function openModal() {
      const fixture = TestBed.createComponent(PairDeviceModalComponent);
      fixture.componentRef.setInput('open', true);
      fixture.detectChanges();
      await settle();
      http
        .expectOne({ method: 'POST', url: `/api/workspaces/${WS}/devices/pairing` })
        .flush({ ...CODE, expiresAt: new Date(Date.now() + 10 * 60000).toISOString() });
      await settle();
      fixture.detectChanges();
      return fixture;
    }
    const nameInput = () => doc().querySelector<HTMLInputElement>('.su-modal-body label input')!;
    async function typeName(fixture: { detectChanges(): void }, name: string) {
      nameInput().value = name;
      nameInput().dispatchEvent(new Event('input'));
      await settle();
      fixture.detectChanges();
    }

    it('hints that the name must be unique and what is added when it is taken', async () => {
      await openModal();
      expect(doc().querySelector('.su-modal-body')!.textContent).toContain(t().engine.pairNameHint);
      expect(t().engine.pairNameHint).toContain('(2)');
      expect(nameInput().getAttribute('aria-describedby')).toBe('pair-name-hint');
      // The default name (this Chrome and today) is not taken yet.
      expect(q('pair-name-taken')).toBeNull();
    });

    it('says the name the extension will get when another one has it, ignoring case and spaces', async () => {
      const fixture = await openModal();
      await typeName(fixture, '  old pc ');
      expect(q('pair-name-taken')!.textContent).toBe(
        fmt(t().engine.pairNameTaken, { d: 'old pc (2)' }),
      );
      await typeName(fixture, 'Old PC');
      expect(q('pair-name-taken')!.textContent).toContain('Old PC (2)');
      await typeName(fixture, 'Shop PC');
      expect(q('pair-name-taken')).toBeNull();
    });

    it('goes on to (3) when (2) is taken too', async () => {
      const fixture = await openModal();
      TestBed.inject(DevicesStore).list.update((l) => [...l, device('d2', 'Old PC (2)')]);
      await typeName(fixture, 'Old PC');
      expect(q('pair-name-taken')!.textContent).toContain('Old PC (3)');
    });

    it('says the name the extension really got in the toast when it is not the one asked for', async () => {
      const fixture = await openModal();
      await typeName(fixture, 'Old PC');
      vi.spyOn(window, 'open').mockReturnValue(null);
      q('pair-connect')!.click();
      await vi.advanceTimersByTimeAsync(3000);
      http
        .expectOne(`/api/workspaces/${WS}/devices`)
        .flush([device('d1', 'Old PC'), device('d2', 'Old PC (2)')]);
      await settle();
      const messages = TestBed.inject(NotificationService)
        .toasts()
        .map((x) => x.message);
      expect(messages).toEqual([fmt(t().engine.pairedRenamed, { d: 'Old PC (2)', w: 'Old PC' })]);
      expect(messages[0]).toContain('Old PC (2)');
      expect(fixture.componentInstance).toBeTruthy();
    });

    it('keeps the plain toast when the name was free', async () => {
      const fixture = await openModal();
      await typeName(fixture, 'Shop PC');
      vi.spyOn(window, 'open').mockReturnValue(null);
      q('pair-connect')!.click();
      await vi.advanceTimersByTimeAsync(3000);
      http
        .expectOne(`/api/workspaces/${WS}/devices`)
        .flush([device('d1', 'Old PC'), device('d2', 'Shop PC')]);
      await settle();
      expect(
        TestBed.inject(NotificationService)
          .toasts()
          .map((x) => x.message),
      ).toEqual([fmt(t().paired, { d: 'Shop PC' })]);
    });
  });

  describe('another computer or Chrome profile', () => {
    const t = () => TestBed.inject(I18nService).t().api;
    const q = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    let writeText: ReturnType<typeof vi.fn>;

    async function openModal() {
      const fixture = TestBed.createComponent(PairDeviceModalComponent);
      fixture.componentRef.setInput('open', true);
      fixture.detectChanges();
      await settle();
      http.expectOne({ method: 'POST', url: `/api/workspaces/${WS}/devices/pairing` }).flush({
        code: 'K7QF-2MXP',
        expiresAt: new Date(Date.now() + 10 * 60000).toISOString(),
        maxDevices: 3,
      });
      await settle();
      fixture.detectChanges();
      return fixture;
    }

    afterEach(() => {
      Reflect.deleteProperty(navigator, 'clipboard');
    });

    it('does not assume the browser that pairs is this one: the steps say it needs no sign-in', async () => {
      await openModal();
      const steps = [...document.querySelectorAll('.su-modal-body ol li')].map(
        (l) => l.textContent,
      );
      expect(steps).toEqual([t().pairStep1, t().pairStep2, t().pairStep3]);
      expect(t().pairStep3).toContain('ไม่ต้องล็อกอิน');
      expect(t().pairStep3).toContain('เชื่อมต่อสำเร็จ');
      expect(t().pairStep1).toContain('เครื่องไหนก็ได้');
      TestBed.inject(I18nService).setLang('en');
      expect(t().pairStep3).toMatch(/does not need to be signed in/);
      expect(t().pairStep3).toMatch(/connected successfully/);
      TestBed.inject(I18nService).setLang('th');
    });

    it('copies the connect link, with the code and the name, for another browser', async () => {
      writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      const fixture = await openModal();
      const input = document.querySelector<HTMLInputElement>('.su-modal-body label input')!;
      input.value = 'Office PC';
      input.dispatchEvent(new Event('input'));
      await settle();
      fixture.detectChanges();
      expect(q('pair-copy')!.textContent).toContain(t().engine.pairCopy);
      q('pair-copy')!.click();
      await settle();
      fixture.detectChanges();
      expect(writeText).toHaveBeenCalledTimes(1);
      const url = writeText.mock.calls[0][0] as string;
      expect(url.startsWith(`${location.origin}/connect-extension#`)).toBe(true);
      const params = new URLSearchParams(url.split('#')[1]);
      expect(params.get('ap-pair')).toBe('1');
      expect(params.get('code')).toBe('K7QF-2MXP');
      expect(params.get('name')).toBe('Office PC');
      expect(params.get('ws')).toBe('Shop');
      // It says so, and that the extension is being waited for (nothing was opened in this browser).
      expect(q('pair-copy')!.textContent).toContain(t().copied);
      expect(document.querySelector('.su-modal-body')!.textContent).toContain(t().pairWaiting);
      expect(document.querySelector('.su-modal-body')!.textContent).toContain(
        t().engine.pairCopyHint,
      );
      expect(q('pair-link')).toBeNull();
    });

    it('shows the link to copy by hand when the browser does not allow copying', async () => {
      writeText = vi.fn().mockRejectedValue(new Error('denied'));
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      const fixture = await openModal();
      q('pair-copy')!.click();
      await settle();
      fixture.detectChanges();
      const box = q('pair-link') as HTMLInputElement;
      expect(box.readOnly).toBe(true);
      expect(box.value).toContain('/connect-extension#ap-pair=1');
      expect(box.value).toContain('code=K7QF-2MXP');
      expect(q('pair-copy')!.textContent).not.toContain(t().copied);
    });

    it('closes when the other browser pairs, wherever it was opened, and says its name', async () => {
      writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      const fixture = await openModal();
      let closed = 0;
      fixture.componentInstance.closed.subscribe(() => closed++);
      q('pair-copy')!.click();
      await settle();
      await vi.advanceTimersByTimeAsync(3000);
      http
        .expectOne(`/api/workspaces/${WS}/devices`)
        .flush([device('d1', 'Old PC'), device('d2', 'Office PC')]);
      await settle();
      expect(closed).toBe(1);
    });

    it('switches the link off once the code has expired', async () => {
      const fixture = await openModal();
      await vi.advanceTimersByTimeAsync(11 * 60000);
      http.match(`/api/workspaces/${WS}/devices`);
      fixture.detectChanges();
      expect((q('pair-copy') as HTMLButtonElement).disabled).toBe(true);
      expect((q('pair-connect') as HTMLButtonElement).disabled).toBe(true);
    });
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
