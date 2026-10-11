import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AccountsStore } from '../../core/data/accounts.store';
import { DeviceEventsService } from '../../core/data/device-events.service';
import { DevicesStore } from '../../core/data/devices.store';
import { LinkSetsStore } from '../../core/data/link-sets.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { ApiAccount, ApiLinkSet } from '../../core/http/api.service';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';
import { provideApiTesting, settle, signIn } from '../../testing/api-testing';
import { FakeDeviceEvents } from '../../testing/fake-events';
import {
  FB_CONNECTED,
  SET_URL,
  apiDevice,
  apiLink,
  apiLinkSet,
} from '../../testing/link-sets.fixtures';
import { SetOwnerComponent } from './set-owner.component';

// One link set, one extension; one group, one extension: the owner line at the top of a set's card and the groups that
// also sit in another extension's set.

const SHOP: ApiAccount = FB_CONNECTED; // acc-fb "Shop PC", the first in the list
const LAPTOP: ApiAccount = { ...FB_CONNECTED, id: 'acc-fb2', name: 'Facebook · Laptop' };
const LAPTOP_DEVICE = apiDevice({
  id: 'dev-2',
  name: 'Laptop',
  accountId: 'acc-fb2',
  online: false,
});
const PLANTS = 'https://www.facebook.com/groups/plants';

describe('SetOwnerComponent', () => {
  let http: HttpTestingController;

  async function open(sets: ApiLinkSet[], shown: string, accounts: ApiAccount[] = [SHOP, LAPTOP]) {
    http = provideApiTesting({
      imports: [SetOwnerComponent],
      providers: [{ provide: DeviceEventsService, useClass: FakeDeviceEvents }],
    });
    TestBed.inject(WorkspaceStore);
    TestBed.inject(AccountsStore);
    TestBed.inject(DevicesStore);
    TestBed.inject(LinkSetsStore);
    await signIn(http, { linkSets: sets, devices: [apiDevice(), LAPTOP_DEVICE] });
    TestBed.inject(AccountsStore).list.set(accounts);
    const fixture = TestBed.createComponent(SetOwnerComponent);
    fixture.componentRef.setInput(
      'set',
      sets.find((s) => s.id === shown),
    );
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const t = () => TestBed.inject(I18nService).t();
  const text = (node: Element | null) => node?.textContent?.replace(/\s+/g, ' ').trim();

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

  it('names the extension that posts the set and whether it is online', async () => {
    const mine = apiLinkSet({
      id: 's1',
      postAsAccountId: 'acc-fb2',
      links: [apiLink({ id: 'a' })],
    });
    const { el } = await open([mine], 's1');
    expect(text(el.querySelector('.owner'))).toContain(
      fmt(t().api.flow.ownerLine, { name: 'Laptop' }),
    );
    expect(text(el.querySelector('.owner'))).toContain(t().api.flow.ovExtOffline);
    expect(el.querySelector('.owner.none')).toBeNull();
    expect(el.querySelector('.overlaps')).toBeNull();
  });

  it('warns that nothing is posted while several extensions are connected and the set names none', async () => {
    const orphan = apiLinkSet({ id: 's1', postAsAccountId: null });
    const { el } = await open([orphan], 's1');
    const owner = el.querySelector('.owner.none')!;
    expect(owner.textContent).toContain(t().api.flow.ownerNone);
    expect(owner.textContent).toContain(t().api.flow.postAsNone);
  });

  it('names the only connected extension for a set that names none', async () => {
    const { el } = await open([apiLinkSet({ id: 's1', postAsAccountId: null })], 's1', [SHOP]);
    expect(text(el.querySelector('.owner'))).toContain(
      fmt(t().api.flow.ownerLine, { name: 'Shop PC' }),
    );
  });

  it('lists a group the extension listed first keeps, without a button, in the set of the extension that skips it', async () => {
    const shop = apiLinkSet({
      id: 'shop',
      name: 'ร้าน',
      postAsAccountId: 'acc-fb',
      links: [apiLink({ id: 'l1', url: PLANTS })],
    });
    const laptop = apiLinkSet({
      id: 'laptop',
      name: 'แล็ปท็อป',
      postAsAccountId: 'acc-fb2',
      links: [apiLink({ id: 'l2', url: PLANTS })],
    });

    // The set that keeps the group: an information row, nothing to remove.
    const keeper = await open([shop, laptop], 'shop');
    expect(keeper.el.querySelectorAll('.overlaps li')).toHaveLength(1);
    expect(text(keeper.el.querySelector('.overlaps li'))).toContain(t().api.flow.overlapKeeps);
    expect(keeper.el.querySelector('.overlaps button')).toBeNull();
    http.verify();
    TestBed.resetTestingModule();

    // The set that skips it: the sentence names the set and the extension that keep it, and the row can be removed.
    const { el } = await open([shop, laptop], 'laptop');
    const row = el.querySelector('.overlaps li')!;
    expect(text(row)).toContain(fmt(t().api.flow.overlapSkipped, { set: 'ร้าน', ext: 'Shop PC' }));
    (row.querySelector('button') as HTMLButtonElement).click();
    const del = http.expectOne(
      (r) => r.method === 'DELETE' && r.url === `${SET_URL('laptop')}/links/l2`,
    );
    del.flush(null, { status: 204, statusText: 'No Content' });
    await settle();
  });

  it('shows nothing about overlaps while every group has one extension', async () => {
    const shop = apiLinkSet({
      id: 'shop',
      postAsAccountId: 'acc-fb',
      links: [apiLink({ id: 'l1', url: PLANTS })],
    });
    const shop2 = apiLinkSet({
      id: 'shop2',
      postAsAccountId: 'acc-fb',
      links: [apiLink({ id: 'l2', url: PLANTS })],
    });
    const { el } = await open([shop, shop2], 'shop2');
    expect(el.querySelector('.overlaps')).toBeNull();
  });
});
