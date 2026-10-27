import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AccountsStore } from '../../core/data/accounts.store';
import { DeviceEventsService } from '../../core/data/device-events.service';
import { DevicesStore } from '../../core/data/devices.store';
import { LinkSetsStore } from '../../core/data/link-sets.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { ApiAccount, ApiWorkspace } from '../../core/http/api.service';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';
import '../../core/i18n/i18n.line';
import { provideApiTesting, settle, signIn } from '../../testing/api-testing';
import { FakeDeviceEvents } from '../../testing/fake-events';
import { FB_CONNECTED, apiDevice, apiLinkSet } from '../../testing/link-sets.fixtures';
import { LINE_CONNECTED, apiLineDevice, apiLineSet } from '../../testing/line.fixtures';
import { NewSetModalComponent } from './new-set-modal.component';

// "New link set" chooses what the set posts to: Facebook groups, or LINE customer chats when the plan has them and a
// browser is logged in to a LINE Official Account. The extension select then lists the browsers of that kind.

const BRANCH_LINE: ApiAccount = { ...LINE_CONNECTED, id: 'acc-line2', name: 'LINE · Branch OA' };

describe('NewSetModalComponent: the channel', () => {
  let http: HttpTestingController;

  async function open(accounts: ApiAccount[], workspace: Partial<ApiWorkspace> = {}) {
    http = provideApiTesting({
      imports: [NewSetModalComponent],
      providers: [{ provide: DeviceEventsService, useClass: FakeDeviceEvents }],
    });
    TestBed.inject(WorkspaceStore);
    TestBed.inject(AccountsStore);
    TestBed.inject(DevicesStore);
    TestBed.inject(LinkSetsStore);
    await signIn(http, {
      workspace,
      devices: [apiLineDevice(), apiDevice({ id: 'dev-2', name: 'Laptop', accountId: 'acc-fb2' })],
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
  const radios = (el: HTMLElement) => [
    ...el.querySelectorAll<HTMLButtonElement>('app-modal [role=radio]'),
  ];
  const create = (el: HTMLElement) =>
    [...el.querySelectorAll<HTMLButtonElement>('app-modal button.su-btn-primary')].at(-1)!;
  function type(el: HTMLElement, name: string) {
    const input = el.querySelector<HTMLInputElement>('app-modal input')!;
    input.value = name;
    input.dispatchEvent(new Event('input'));
  }

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

  it('offers Facebook groups (chosen) and LINE chats, both on when the plan and a LINE account are there', async () => {
    const { el } = await open([FB_CONNECTED, LINE_CONNECTED]);
    const [fb, line] = radios(el);
    expect(fb.textContent?.trim()).toBe(t().api.line.chatChannelFb);
    expect(line.textContent?.trim()).toBe(t().api.line.chatChannelLine);
    expect(fb.getAttribute('aria-checked')).toBe('true');
    expect(line.getAttribute('aria-checked')).toBe('false');
    expect(line.disabled).toBe(false);
    expect(el.querySelector('app-modal .channel .su-field-help')).toBeNull();
  });

  it('turns LINE off with the reason when the owner’s plan has no LINE chats', async () => {
    const { el } = await open([FB_CONNECTED, LINE_CONNECTED], { lineChat: false });
    const line = radios(el)[1];
    expect(line.disabled).toBe(true);
    expect(el.querySelector('app-modal .channel .su-field-help')?.textContent).toBe(
      fmt(t().api.line.chatChannelLineLocked, { plan: t().plans.pro.name }),
    );
  });

  it('turns LINE off with the reason when no browser is logged in to a LINE Official Account', async () => {
    const { el } = await open([FB_CONNECTED]);
    expect(radios(el)[1].disabled).toBe(true);
    expect(el.querySelector('app-modal .channel .su-field-help')?.textContent).toBe(
      t().api.line.chatChannelLineNoAccount,
    );
  });

  it('creates a Facebook set by default, telling the API its channel', async () => {
    const { fixture, el } = await open([FB_CONNECTED, LINE_CONNECTED]);
    type(el, 'ร้าน');
    fixture.detectChanges();
    create(el).click();
    await settle();
    const req = http.expectOne('/api/workspaces/ws-1/link-sets');
    expect(req.request.body).toMatchObject({ name: 'ร้าน', channel: 'fb' });
    req.flush(apiLinkSet({ id: 'new', name: 'ร้าน' }));
    await settle();
  });

  it('creates a set of chats when LINE is chosen', async () => {
    const { fixture, el } = await open([FB_CONNECTED, LINE_CONNECTED]);
    radios(el)[1].click();
    fixture.detectChanges();
    expect(radios(el)[1].getAttribute('aria-checked')).toBe('true');
    type(el, 'ลูกค้าประจำ');
    fixture.detectChanges();
    create(el).click();
    await settle();
    const req = http.expectOne('/api/workspaces/ws-1/link-sets');
    expect(req.request.body).toMatchObject({ name: 'ลูกค้าประจำ', channel: 'line' });
    req.flush(apiLineSet({ id: 'new', name: 'ลูกค้าประจำ' }));
    await settle();
  });

  it('lists the LINE accounts, not the Facebook ones, for a chat set when two are connected', async () => {
    const laptop: ApiAccount = { ...FB_CONNECTED, id: 'acc-fb2', name: 'Facebook · Laptop' };
    const { fixture, el } = await open([FB_CONNECTED, laptop, LINE_CONNECTED, BRANCH_LINE]);
    // Two Facebook extensions: the select asks which one.
    let select = el.querySelector<HTMLSelectElement>('app-modal select')!;
    expect([...select.options].map((o) => o.textContent?.trim())).toEqual([
      t().api.flow.postAsPick,
      'Shop PC',
      'Laptop',
    ]);
    // Two LINE accounts: it asks again, with the LINE ones (by the name of their browsers).
    radios(el)[1].click();
    fixture.detectChanges();
    select = el.querySelector<HTMLSelectElement>('app-modal select')!;
    expect([...select.options].map((o) => o.textContent?.trim())).toEqual([
      t().api.flow.postAsPick,
      'Shop PC',
      'Branch OA',
    ]);
    expect(
      el.querySelector('app-modal select')!.closest('app-select-field')?.textContent,
    ).toContain(t().api.line.chatNewSetExt);
    type(el, 'ลูกค้า');
    fixture.detectChanges();
    create(el).click();
    fixture.detectChanges();
    await settle();
    // Nothing is sent without the extension.
    expect(el.textContent).toContain(t().api.flow.newSetExtErr);
    http.expectNone('/api/workspaces/ws-1/link-sets');
    select.value = 'acc-line2';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    create(el).click();
    await settle();
    const req = http.expectOne('/api/workspaces/ws-1/link-sets');
    expect(req.request.body).toMatchObject({ channel: 'line', postAsAccountId: 'acc-line2' });
    req.flush(apiLineSet({ id: 'new', name: 'ลูกค้า', postAsAccountId: 'acc-line2' }));
    await settle();
  });

  it('forgets an extension picked for Facebook when the person switches to LINE', async () => {
    const laptop: ApiAccount = { ...FB_CONNECTED, id: 'acc-fb2', name: 'Facebook · Laptop' };
    const { fixture, el } = await open([FB_CONNECTED, laptop, LINE_CONNECTED, BRANCH_LINE]);
    let select = el.querySelector<HTMLSelectElement>('app-modal select')!;
    select.value = 'acc-fb2';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    radios(el)[1].click();
    fixture.detectChanges();
    select = el.querySelector<HTMLSelectElement>('app-modal select')!;
    expect(select.value).toBe('');
  });

  it('starts from Facebook again each time it opens', async () => {
    const { fixture, el } = await open([FB_CONNECTED, LINE_CONNECTED]);
    radios(el)[1].click();
    fixture.detectChanges();
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await settle();
    expect(radios(el)[0].getAttribute('aria-checked')).toBe('true');
  });
});
