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
import { FB_CONNECTED, apiDevice, apiLink, apiLinkSet } from '../../testing/link-sets.fixtures';
import { OwnershipOverviewComponent } from './ownership-overview.component';

// "Link groups ↔ extensions": every extension with its sets and groups, the sets nobody posts, and the note about a
// group that sits in the sets of two extensions.

const SHOP: ApiAccount = FB_CONNECTED;
const LAPTOP: ApiAccount = { ...FB_CONNECTED, id: 'acc-fb2', name: 'Facebook · Laptop' };
const PLANTS = 'https://www.facebook.com/groups/plants';

describe('OwnershipOverviewComponent', () => {
  let http: HttpTestingController;

  async function open(sets: ApiLinkSet[], accounts: ApiAccount[] = [SHOP, LAPTOP]) {
    http = provideApiTesting({
      imports: [OwnershipOverviewComponent],
      providers: [{ provide: DeviceEventsService, useClass: FakeDeviceEvents }],
    });
    TestBed.inject(WorkspaceStore);
    TestBed.inject(AccountsStore);
    TestBed.inject(DevicesStore);
    TestBed.inject(LinkSetsStore);
    await signIn(http, {
      linkSets: sets,
      devices: [
        apiDevice(),
        apiDevice({ id: 'dev-2', name: 'Laptop', accountId: 'acc-fb2', online: false }),
      ],
    });
    TestBed.inject(AccountsStore).list.set(accounts);
    TestBed.inject(AccountsStore).loaded.set(true);
    const fixture = TestBed.createComponent(OwnershipOverviewComponent);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const t = () => TestBed.inject(I18nService).t();
  const text = (node: Element | null) => node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const items = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('li')];

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

  it('lists every connected extension with its sets and groups, then the sets nobody posts', async () => {
    const sets = [
      apiLinkSet({
        id: 'a',
        name: 'ร้าน',
        postAsAccountId: 'acc-fb',
        links: [apiLink({ id: 'l1' }), apiLink({ id: 'l2' })],
      }),
      apiLinkSet({
        id: 'b',
        name: 'ไม่มีเครื่อง',
        postAsAccountId: null,
        links: [apiLink({ id: 'l3' })],
      }),
    ];
    const { el } = await open(sets);
    const rows = items(el);
    expect(rows).toHaveLength(3);
    expect(text(rows[0])).toContain('Shop PC');
    expect(text(rows[0])).toContain(fmt(t().api.flow.ownSetsGroups, { s: 1, g: 2 }));
    expect(text(rows[0])).toContain('ร้าน');
    // An extension with no set says so instead of looking broken.
    expect(text(rows[1])).toContain('Laptop');
    expect(text(rows[1])).toContain(t().api.flow.ownNoSets);
    // The sets nobody posts come last, with what to do.
    expect(rows[2].classList.contains('none')).toBe(true);
    expect(text(rows[2])).toContain(t().api.flow.ownUnassigned);
    expect(text(rows[2])).toContain(t().api.flow.ownUnassignedHint);
    expect(el.querySelector('.callout')).toBeNull();
  });

  it('says how many groups sit in the sets of more than one extension', async () => {
    const sets = [
      apiLinkSet({
        id: 'a',
        postAsAccountId: 'acc-fb',
        links: [apiLink({ id: 'l1', url: PLANTS })],
      }),
      apiLinkSet({
        id: 'b',
        postAsAccountId: 'acc-fb2',
        links: [apiLink({ id: 'l2', url: PLANTS })],
      }),
    ];
    const { el } = await open(sets);
    expect(text(el.querySelector('.callout'))).toContain(fmt(t().api.flow.overlapTitle, { n: 1 }));
  });

  it('shows nothing before there is anything to show', async () => {
    const { el } = await open([], []);
    expect(el.querySelector('section')).toBeNull();
  });
});
