import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiDevice, ApiDeviceLive, ApiExtensionConfig } from '../http/api.service';
import { WS, provideApiTesting, settle, signIn } from '../../testing/api-testing';
import { migrateSettings } from '../ext/lib/shared.js';
import { CampaignsStore } from './campaigns.store';

const DEVICE: ApiDevice = {
  id: 'dev-1',
  name: 'Shop PC',
  browser: 'Chrome 130',
  version: '2.1.0',
  createdAt: '2026-10-01T00:00:00Z',
  lastSeenAt: '2026-10-03T00:00:00Z',
  online: true,
  accountId: 'acc-1',
  jobsPaused: false,
};
const BASE = `/api/workspaces/${WS}/devices/${DEVICE.id}`;

function settingsWith(name: string, extra: object = {}) {
  return {
    version: 2,
    global: { minGapMin: 3, telegram: { enabled: false } },
    campaigns: [
      {
        id: 'c1',
        name,
        enabled: true,
        groups: [
          { url: 'https://www.facebook.com/groups/1/', name: 'G1', text: '#A1', enabled: true },
        ],
        posts: [{ id: 'p1', text: 'สวัสดี', imageIds: [], groupUrls: [] }],
        config: { groupDelayMin: 4 },
        ...extra,
      },
    ],
  };
}

function config(revision: number, name: string): ApiExtensionConfig {
  return {
    deviceId: DEVICE.id,
    revision,
    settings: settingsWith(name),
    updatedAt: '2026-10-03T00:00:00Z',
    updatedByDevice: true,
    hasContent: true,
  };
}

function live(revision: number, state: object | null = { running: false }): ApiDeviceLive {
  return {
    deviceId: DEVICE.id,
    online: true,
    lastSeenAt: '2026-10-03T00:00:00Z',
    version: '2.1.0',
    state,
    stateAt: '2026-10-03T00:00:00Z',
    revision,
    logs: [{ t: 1, level: 'info', msg: 'เริ่มทำงาน' }],
  };
}

describe('CampaignsStore', () => {
  let http: HttpTestingController;
  let store: CampaignsStore;

  beforeEach(async () => {
    http = provideApiTesting();
    store = TestBed.inject(CampaignsStore);
    await signIn(http);
    http.expectOne(`/api/workspaces/${WS}/devices`).flush([DEVICE]);
    await settle();
    store.ensureDevice();
    await settle();
    http.expectOne(`${BASE}/config`).flush(config(3, 'ชุด A'));
    http.expectOne(`${BASE}/live`).flush(live(3));
    await settle();
  });

  afterEach(() => {
    vi.useRealTimers();
    http.verify();
  });

  it('shows the settings the extension uploaded, normalized like the extension does', () => {
    expect(store.deviceId()).toBe(DEVICE.id);
    expect(store.revision()).toBe(3);
    const c = store.campaign()!;
    expect(c.name).toBe('ชุด A');
    expect(c.groups[0]).toEqual({
      url: 'https://www.facebook.com/groups/1/',
      name: 'G1',
      text: '#A1',
      enabled: true,
      dailyMax: 0,
    });
    // Missing config keys get the extension's defaults.
    expect(c.config.groupDelayMin).toBe(4);
    expect(c.config.groupDelayMax).toBe(8);
    expect(store.global()!.telegram.onSuccess).toBe(true);
    expect(store.logs().map((l) => l.msg)).toEqual(['เริ่มทำงาน']);
  });

  it('saves edits shortly after the last change, against the revision they started from', async () => {
    vi.useFakeTimers();
    store.change((s) => (s.campaigns[0].name = 'ชุด B'));
    store.change((s) => (s.campaigns[0].config.groupDelayMax = 12));
    expect(store.saveState()).toBe('dirty');
    await vi.advanceTimersByTimeAsync(900);
    const put = http.expectOne(`${BASE}/config`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body.baseRevision).toBe(3);
    expect(put.request.body.settings.campaigns[0].name).toBe('ชุด B');
    expect(put.request.body.settings.campaigns[0].config.groupDelayMax).toBe(12);
    put.flush({ revision: 4, updatedAt: '2026-10-03T00:01:00Z' });
    await settle();
    expect(store.revision()).toBe(4);
    expect(store.saveState()).toBe('saved');
  });

  it('loads the newer settings when the browser saved first (409)', async () => {
    store.change((s) => (s.campaigns[0].name = 'ชุด B'));
    const done = store.flush();
    http
      .expectOne(`${BASE}/config`)
      .flush({ title: 'ถูกแก้ไปก่อนแล้ว' }, { status: 409, statusText: 'Conflict' });
    await settle();
    http.expectOne(`${BASE}/config`).flush(config(5, 'จากเครื่อง'));
    await done;
    expect(store.campaign()!.name).toBe('จากเครื่อง');
    expect(store.revision()).toBe(5);
    expect(store.reloadedAt()).not.toBeNull();
  });

  it('keeps edits that could not be saved and sends them again', async () => {
    vi.useFakeTimers();
    store.change((s) => (s.campaigns[0].name = 'ชุด C'));
    await vi.advanceTimersByTimeAsync(900);
    http
      .expectOne(`${BASE}/config`)
      .flush({ title: 'down' }, { status: 503, statusText: 'Unavailable' });
    await settle();
    expect(store.saveState()).toBe('error');
    expect(store.unsaved()).toBe(true);
    await vi.advanceTimersByTimeAsync(5000);
    const again = http.expectOne(`${BASE}/config`);
    expect(again.request.body.settings.campaigns[0].name).toBe('ชุด C');
    again.flush({ revision: 4, updatedAt: '' });
    await settle();
    expect(store.saveState()).toBe('saved');
  });

  it('picks up a newer revision from the browser while nothing is being edited', async () => {
    const done = store.refreshLive();
    http.expectOne(`${BASE}/live`).flush(live(6, { running: true }));
    await settle();
    http.expectOne(`${BASE}/config`).flush(config(6, 'แก้ในเครื่อง'));
    await done;
    expect(store.campaign()!.name).toBe('แก้ในเครื่อง');
    expect(store.running()).toBe(true);
  });

  it('sends a command and waits for the browser to answer', async () => {
    vi.useFakeTimers();
    const done = store.command('runNow', { campaignId: 'c1' });
    await settle();
    const post = http.expectOne(`${BASE}/commands`);
    expect(post.request.body).toEqual({ cmd: 'runNow', args: { campaignId: 'c1' } });
    post.flush({ id: 'k1', cmd: 'runNow', status: 'pending', result: null, createdAt: '' });
    await vi.advanceTimersByTimeAsync(2000);
    http
      .expectOne(`${BASE}/commands/k1`)
      .flush({ id: 'k1', cmd: 'runNow', status: 'sent', result: null, createdAt: '' });
    await vi.advanceTimersByTimeAsync(2000);
    http.expectOne(`${BASE}/commands/k1`).flush({
      id: 'k1',
      cmd: 'runNow',
      status: 'done',
      result: { ok: false, error: 'ยังไม่ได้กดเริ่ม' },
      createdAt: '',
    });
    await settle();
    http.expectOne(`${BASE}/live`).flush(live(3));
    expect(await done).toEqual({ ok: false, error: 'ยังไม่ได้กดเริ่ม' });
  });

  it('reports a command nobody took as expired', async () => {
    vi.useFakeTimers();
    const done = store.command('start');
    await settle();
    http
      .expectOne(`${BASE}/commands`)
      .flush({ id: 'k2', cmd: 'start', status: 'pending', result: null, createdAt: '' });
    await vi.advanceTimersByTimeAsync(2000);
    http
      .expectOne(`${BASE}/commands/k2`)
      .flush({ id: 'k2', cmd: 'start', status: 'expired', result: null, createdAt: '' });
    expect(await done).toEqual({ ok: false, error: 'expired' });
  });

  it('imports a backup as new campaigns: media uploaded under new ids, then saved', async () => {
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    const parsed = {
      settings: migrateSettings(settingsWith('นำเข้า', { leadImageIds: ['old1'] })),
      images: { old1: { name: 'a.png', type: 'image/png', data: png } },
    };
    const done = store.importParsed(parsed, 'merge');
    await settle();
    const put = http.expectOne(
      (r) => r.method === 'PUT' && r.url.startsWith(`/api/workspaces/${WS}/extension-images/`),
    );
    const newId = decodeURIComponent(put.request.url.split('/').pop()!);
    expect(newId).not.toBe('old1');
    expect(put.request.body).toEqual({ name: 'a.png', type: 'image/png', data: png });
    put.flush(null);
    await settle();
    const save = http.expectOne(`${BASE}/config`);
    const camps = save.request.body.settings.campaigns;
    expect(camps.map((c: { name: string }) => c.name)).toEqual(['ชุด A', 'นำเข้า']);
    expect(camps[1].id).not.toBe('c1');
    expect(camps[1].leadImageIds).toEqual([newId]);
    save.flush({ revision: 4, updatedAt: '' });
    const r = await done;
    expect(r.firstId).toBe(camps[1].id);
    expect(store.campaign()!.name).toBe('นำเข้า');
  });
});
