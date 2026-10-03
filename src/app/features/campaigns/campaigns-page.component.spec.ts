import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CampaignsStore } from '../../core/data/campaigns.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { WS, provideApiTesting, settle, signIn } from '../../testing/api-testing';
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
    http.expectOne(`/api/workspaces/${WS}/devices`).flush([DEVICE]);
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
    await signIn(http);
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
    ws.list.set([{ id: WS, name: 'Shop', posts7: 0, members: 2, role: 'viewer' }]);
    const el = await render();
    const editor = el.querySelector<HTMLFieldSetElement>('fieldset.ext-fs')!;
    expect(editor.disabled).toBe(true);
    expect(el.querySelector<HTMLButtonElement>('.page-head .su-btn-danger')!.disabled).toBe(true);
  });
});
