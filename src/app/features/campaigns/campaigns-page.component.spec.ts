import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CampaignsStore } from '../../core/data/campaigns.store';
import { assistStorage } from '../../core/auth/token';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { WORKSPACE, WS, provideApiTesting, settle, signIn } from '../../testing/api-testing';
import { CampaignsPageComponent } from './campaigns-page.component';

const BASE = `/api/workspaces/${WS}/devices/dev-1`;
const DEVICE = {
  id: 'dev-1',
  name: 'Shop PC',
  browser: 'Chrome',
  version: '2.1.0',
  createdAt: '',
  lastSeenAt: null,
  online: true,
  accountId: null,
  jobsPaused: false,
};
const SETTINGS = {
  campaigns: [
    {
      id: 'c1',
      name: 'ขายของ',
      groups: [
        { url: 'https://www.facebook.com/groups/1/', name: 'G1', text: '#A1', dailyMax: 1 },
        { url: 'not a link', name: 'Bad' },
      ],
      posts: [{ id: 'p1', text: 'สวัสดี {{code}}' }],
    },
    { id: 'c2', name: 'รับสมัคร', enabled: false, groups: [], posts: [] },
  ],
};

describe('CampaignsPageComponent', () => {
  let http: HttpTestingController;

  async function render() {
    const fixture = TestBed.createComponent(CampaignsPageComponent);
    fixture.detectChanges();
    await settle();
    for (const r of http.match(`${BASE}/live`))
      r.flush({
        deviceId: 'dev-1',
        online: true,
        lastSeenAt: null,
        version: '2.1.0',
        state: { running: true },
        stateAt: null,
        revision: 2,
        logs: [],
      });
    http.expectOne(`${BASE}/config`).flush({
      deviceId: 'dev-1',
      revision: 2,
      settings: SETTINGS,
      updatedAt: null,
      updatedByDevice: true,
      hasContent: true,
    });
    await settle();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    http = provideApiTesting({
      imports: [CampaignsPageComponent],
      providers: [provideRouter([{ path: '**', children: [] }])],
    });
    TestBed.inject(CampaignsStore);
    await signIn(http, { devices: [DEVICE] });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('shows every campaign of the browser and the groups of the selected one', async () => {
    const el = await render();
    const tabs = [...el.querySelectorAll('.ext-tabs .tab')].map((t) => t.textContent!.trim());
    expect(tabs.slice(0, 2)).toEqual(['ขายของ', 'รับสมัคร']);
    const rows = el.querySelectorAll('app-camp-groups .grow-row');
    expect(rows.length).toBe(2);
    expect(rows[1].classList).toContain('invalid');
    expect(el.querySelector('.ext-badge')!.textContent!.trim()).toBe('ทำงานอยู่');
    // Running: start is off, stop is on.
    expect(el.querySelector<HTMLButtonElement>('.page-head .su-btn-primary')!.disabled).toBe(true);
    expect(el.querySelector<HTMLButtonElement>('.page-head .su-btn-danger')!.disabled).toBe(false);
  });

  it('lets a viewer look but not edit', async () => {
    const ws = TestBed.inject(WorkspaceStore);
    ws.list.set([{ ...WORKSPACE, members: 2, role: 'viewer' }]);
    const el = await render();
    const editor = el.querySelector<HTMLFieldSetElement>('fieldset.ext-fs')!;
    expect(editor.disabled).toBe(true);
    expect(el.querySelector<HTMLButtonElement>('.page-head .su-btn-danger')!.disabled).toBe(true);
  });

  it('is read-only for an admin looking at the customer app (assist mode)', async () => {
    TestBed.resetTestingModule();
    http = provideApiTesting({
      imports: [CampaignsPageComponent],
      providers: [provideRouter([{ path: '**', children: [] }])],
    });
    assistStorage.set({
      adminToken: 'a',
      customerId: 'u-1',
      email: 'owner@shop.co',
      expiresAt: '2099-01-01T00:00:00Z',
    });
    TestBed.inject(CampaignsStore);
    await signIn(http, { devices: [DEVICE] });
    const el = await render();
    expect(el.querySelector<HTMLFieldSetElement>('fieldset.ext-fs')!.disabled).toBe(true);
    expect(el.querySelector<HTMLButtonElement>('.page-head .su-btn-danger')!.disabled).toBe(true);
    expect(el.querySelector('.callout .ph-eye')).not.toBeNull();
  });

  describe('Telegram bot token', () => {
    const tokenInput = (el: HTMLElement) =>
      el.querySelector<HTMLInputElement>('app-camp-global input[type=password]')!;

    it('can be seen and changed by an admin', async () => {
      TestBed.inject(WorkspaceStore).list.set([{ ...WORKSPACE, role: 'admin' }]);
      const el = await render();
      expect(tokenInput(el).disabled).toBe(false);
    });

    it('is disabled with a hint for an editor: the API hides it and keeps the stored one', async () => {
      TestBed.inject(WorkspaceStore).list.set([{ ...WORKSPACE, role: 'editor' }]);
      const el = await render();
      expect(tokenInput(el).disabled).toBe(true);
      expect(tokenInput(el).placeholder).not.toBe('123456789:AA...');
      const hints = [...el.querySelectorAll('app-camp-global .ext-hint')].map((h) => h.textContent);
      expect(hints.some((h) => /Bot Token/.test(h ?? '') && /ผู้ดูแล/.test(h ?? ''))).toBe(true);
    });
  });
});
