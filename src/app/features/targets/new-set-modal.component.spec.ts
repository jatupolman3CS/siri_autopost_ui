import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AccountsStore } from '../../core/data/accounts.store';
import { DeviceEventsService } from '../../core/data/device-events.service';
import { DevicesStore } from '../../core/data/devices.store';
import { LineOasStore } from '../../core/data/line-oas.store';
import { LinkSetsStore } from '../../core/data/link-sets.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { ApiAccount } from '../../core/http/api.service';
import { I18nService } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';
import { provideApiTesting, settle, signIn } from '../../testing/api-testing';
import { FakeDeviceEvents } from '../../testing/fake-events';
import { FB_CONNECTED, apiDevice, apiLinkSet } from '../../testing/link-sets.fixtures';
import { NewSetModalComponent } from './new-set-modal.component';

// "New link set": with two or more extensions the person picks the extension that posts the set (no "automatic");
// with one the API names it.

const LAPTOP: ApiAccount = { ...FB_CONNECTED, id: 'acc-fb2', name: 'Facebook · Laptop' };

describe('NewSetModalComponent', () => {
  let http: HttpTestingController;

  async function open(accounts: ApiAccount[]) {
    http = provideApiTesting({
      imports: [NewSetModalComponent],
      providers: [{ provide: DeviceEventsService, useClass: FakeDeviceEvents }],
    });
    TestBed.inject(WorkspaceStore);
    TestBed.inject(AccountsStore);
    TestBed.inject(DevicesStore);
    TestBed.inject(LinkSetsStore);
    TestBed.inject(LineOasStore);
    await signIn(http, {
      devices: [apiDevice(), apiDevice({ id: 'dev-2', name: 'Laptop', accountId: 'acc-fb2' })],
    });
    TestBed.inject(AccountsStore).list.set(accounts);
    const fixture = TestBed.createComponent(NewSetModalComponent);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    return { fixture, el: document.body as HTMLElement };
  }

  const t = () => TestBed.inject(I18nService).t();

  function type(el: HTMLElement, name: string) {
    const input = el.querySelector<HTMLInputElement>('app-modal input')!;
    input.value = name;
    input.dispatchEvent(new Event('input'));
  }

  const create = (el: HTMLElement) =>
    [...el.querySelectorAll<HTMLButtonElement>('app-modal button.su-btn-primary')].at(-1)!;

  beforeEach(() => localStorage.clear());
  afterEach(() => {
    try {
      http?.verify();
    } finally {
      http = undefined!;
      TestBed.resetTestingModule();
      localStorage.clear();
    }
  });

  it('asks for the extension when two are connected, and will not create the set without one', async () => {
    const { fixture, el } = await open([FB_CONNECTED, LAPTOP]);
    const select = el.querySelector<HTMLSelectElement>('app-modal select')!;
    expect([...select.options].map((o) => o.textContent?.trim())).toEqual([
      t().api.flow.postAsPick,
      'Shop PC',
      'Laptop',
    ]);
    type(el, 'ร้าน');
    create(el).click();
    fixture.detectChanges();
    await settle();
    expect(el.textContent).toContain(t().api.flow.newSetExtErr);
    http.expectNone('/api/workspaces/ws-1/link-sets');
  });

  it('sends the chosen extension with the new set', async () => {
    const { fixture, el } = await open([FB_CONNECTED, LAPTOP]);
    const select = el.querySelector<HTMLSelectElement>('app-modal select')!;
    select.value = 'acc-fb2';
    select.dispatchEvent(new Event('change'));
    type(el, 'ร้าน');
    fixture.detectChanges();
    create(el).click();
    await settle();
    const req = http.expectOne('/api/workspaces/ws-1/link-sets');
    expect(req.request.body).toMatchObject({ name: 'ร้าน', postAsAccountId: 'acc-fb2' });
    req.flush(apiLinkSet({ id: 'new', name: 'ร้าน', postAsAccountId: 'acc-fb2' }));
    await settle();
  });

  it('does not ask while only one extension is connected: the API names it', async () => {
    const { fixture, el } = await open([FB_CONNECTED]);
    expect(el.querySelector('app-modal select')).toBeNull();
    type(el, 'ร้าน');
    fixture.detectChanges();
    create(el).click();
    await settle();
    const req = http.expectOne('/api/workspaces/ws-1/link-sets');
    expect(req.request.body.postAsAccountId ?? null).toBeNull();
    req.flush(apiLinkSet({ id: 'new', name: 'ร้าน', postAsAccountId: 'acc-fb' }));
    await settle();
  });
});
