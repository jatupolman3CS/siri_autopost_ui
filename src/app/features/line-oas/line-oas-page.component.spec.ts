import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DeviceEventsService } from '../../core/data/device-events.service';
import { DevicesStore } from '../../core/data/devices.store';
import { LineOasStore } from '../../core/data/line-oas.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { ApiLineOa } from '../../core/http/api.service';
import { I18nService } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.line';
import { WS, provideApiTesting, settle, signIn } from '../../testing/api-testing';
import { FakeDeviceEvents } from '../../testing/fake-events';
import { apiLineDevice, apiLineOa } from '../../testing/line.fixtures';
import { LineOasPageComponent } from './line-oas-page.component';

// The master list of LINE OAs: the web chooses which OA the browser works for ("use this OA") and can force a read of the
// customers at any time.

describe('LineOasPageComponent', () => {
  let http: HttpTestingController;

  async function open(lineOas: ApiLineOa[]) {
    http = provideApiTesting({
      imports: [LineOasPageComponent],
      providers: [{ provide: DeviceEventsService, useClass: FakeDeviceEvents }],
    });
    TestBed.inject(WorkspaceStore);
    TestBed.inject(DevicesStore);
    TestBed.inject(LineOasStore);
    await signIn(http, { lineOas, devices: [apiLineDevice()] });
    const fixture = TestBed.createComponent(LineOasPageComponent);
    fixture.detectChanges();
    await settle();
    // ngOnInit reads the devices and the OAs again.
    for (const r of http.match(`/api/workspaces/${WS}/devices`)) r.flush([apiLineDevice()]);
    for (const r of http.match(`/api/workspaces/${WS}/line/oas`)) r.flush(lineOas);
    await settle();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const t = () => TestBed.inject(I18nService).t().api.line;
  const buttons = (el: HTMLElement, text: string) =>
    [...el.querySelectorAll<HTMLButtonElement>('section.oa button')].filter((b) =>
      b.textContent?.includes(text),
    );

  beforeEach(() => localStorage.clear());
  afterEach(() => {
    try {
      http?.verify();
    } finally {
      localStorage.clear();
    }
  });

  it('offers "use this OA" only on an OA the browser is not working for', async () => {
    const el = await open([
      apiLineOa({ id: 'a', name: 'LINE · Flowers', active: true }),
      apiLineOa({ id: 'b', name: 'LINE · Cakes', active: false }),
    ]);
    expect(buttons(el, t().oaUse).length).toBe(1);
    expect(el.textContent).toContain(t().oaActive);
    expect(el.textContent).toContain(t().oaInactive);
  });

  it('"use this OA" tells the API to switch the browser', async () => {
    const el = await open([apiLineOa({ id: 'b', active: false })]);
    buttons(el, t().oaUse)[0].click();
    const req = http.expectOne(`/api/workspaces/${WS}/line/oas/b/use`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
    await settle();
  });

  it('has a "force sync" button on every OA', async () => {
    const el = await open([apiLineOa({ id: 'a' }), apiLineOa({ id: 'b', active: false })]);
    expect(buttons(el, t().oaSync).length).toBe(2);
    buttons(el, t().oaSync)[1].click();
    const req = http.expectOne(`/api/workspaces/${WS}/line/oas/b/sync`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
    await settle();
  });
});
