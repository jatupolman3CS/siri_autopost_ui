import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DeviceEventsService } from '../../core/data/device-events.service';
import { DevicesStore } from '../../core/data/devices.store';
import { PostsStore } from '../../core/data/posts.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { ApiDevice } from '../../core/http/api.service';
import { I18nService } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';
import { NotificationService } from '../../core/services/notification.service';
import { WS, provideApiTesting, settle, signIn } from '../../testing/api-testing';
import { FakeDeviceEvents } from '../../testing/fake-events';
import { device } from '../../testing/test-post.fixtures';
import { ScheduleDispatchComponent } from './schedule-dispatch.component';

describe('ScheduleDispatchComponent', () => {
  let http: HttpTestingController;

  async function render(devices: ApiDevice[], role: 'owner' | 'viewer' = 'owner') {
    http = provideApiTesting({
      imports: [ScheduleDispatchComponent],
      providers: [provideRouter([]), { provide: DeviceEventsService, useClass: FakeDeviceEvents }],
    });
    TestBed.inject(WorkspaceStore);
    TestBed.inject(DevicesStore);
    TestBed.inject(PostsStore);
    await signIn(http, { devices, workspace: { role } });
    const fixture = TestBed.createComponent(ScheduleDispatchComponent);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const t = () => TestBed.inject(I18nService).t().api.flow;
  const button = (el: HTMLElement, text: string) =>
    [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes(text),
    );

  afterEach(() => {
    try {
      http?.verify();
    } finally {
      http = undefined!;
      TestBed.resetTestingModule();
      localStorage.clear();
    }
  });

  it('shows nothing before a browser is paired: the schedules page says to pair one', async () => {
    const el = await render([]);
    expect(el.querySelector('section')).toBeNull();
  });

  it('says a connected browser is ready, that it posts what the schedule says, and links to the anti-ban page', async () => {
    const el = await render([device()]);
    expect(el.querySelector('.dev')!.textContent).toContain('Shop PC');
    expect(el.querySelector('.dev [role=status]')!.textContent).toBe(t().dispReady);
    expect(el.querySelector('.note')!.textContent).toContain(t().dispConfigNote);
    expect(el.querySelector('.note a')!.getAttribute('href')).toBe('/app/antiban');
    expect(button(el, t().dispTake)!.disabled).toBe(false);
  });

  it('no longer sends the person to an extension-settings page', async () => {
    const el = await render([device()]);
    expect(el.querySelector('a[href="/app/campaigns"]')).toBeNull();
    // The note says what the browser posts comes from the schedule and where its behaviour is set.
    expect(t().dispConfigNote).toContain('ตารางโพสต์');
    expect(t().dispConfigNote).toContain('ความปลอดภัยบัญชี');
    expect(t().dispConfigNote).not.toContain('ตั้งค่าส่วนขยาย');
  });

  it('lists every extension by its name, each with its own state', async () => {
    const el = await render([
      device({ id: 'dev-1', name: 'Shop PC' }),
      device({ id: 'dev-2', name: 'Laptop', online: false }),
      device({ id: 'dev-3', name: 'Office', jobsPaused: true }),
    ]);
    const rows = [...el.querySelectorAll('.dev')].map((r) => [
      r.querySelector('.fw6')!.textContent!.trim(),
      r.querySelector('[role=status]')!.textContent!.trim(),
    ]);
    expect(rows).toEqual([
      ['Shop PC', t().dispReady],
      ['Laptop', t().dispOffline],
      ['Office', t().dispPaused],
    ]);
  });

  it('tells an offline browser to stay open and does not offer to take jobs', async () => {
    const el = await render([device({ online: false })]);
    expect(el.querySelector('.dev [role=status]')!.textContent).toBe(t().dispOffline);
    expect(button(el, t().dispTake)!.disabled).toBe(true);
  });

  it('offers to resume a browser paused from the web', async () => {
    const el = await render([device({ jobsPaused: true })]);
    expect(el.querySelector('.dev [role=status]')!.textContent).toBe(t().dispPaused);
    expect(button(el, t().dispTake)).toBeUndefined();
    button(el, t().dispResume)!.click();
    await settle();
    const put = http.expectOne(
      (r) => r.method === 'PUT' && r.url === `/api/workspaces/${WS}/devices/dev-1`,
    );
    expect(put.request.body).toMatchObject({ jobsPaused: false });
    put.flush(device({ jobsPaused: false }));
    await settle();
  });

  it('says why a browser the engine paused takes no jobs', async () => {
    const until = new Date(Date.now() + 3600_000).toISOString();
    const el = await render([
      device({ autoPausedUntil: until, autoPauseReason: 'Facebook warning' }),
    ]);
    const line = el.querySelector('.dev [role=status]')!.textContent!;
    expect(line).toContain('Facebook warning');
    expect(button(el, t().dispTake)!.disabled).toBe(true);
  });

  it('sends takeJobs to that browser and says so', async () => {
    const el = await render([device()]);
    button(el, t().dispTake)!.click();
    await settle();
    const req = http.expectOne(`/api/workspaces/${WS}/devices/dev-1/commands`);
    expect(req.request.body).toEqual({ cmd: 'takeJobs', args: {} });
    req.flush({ id: 'cmd-1', cmd: 'takeJobs', status: 'pending' });
    await settle();
    expect(
      TestBed.inject(NotificationService)
        .toasts()
        .map((x) => x.message),
    ).toContain(t().dispTaken);
  });

  it('leaves the button off for a viewer', async () => {
    const el = await render([device()], 'viewer');
    expect(button(el, t().dispTake)!.disabled).toBe(true);
  });
});
