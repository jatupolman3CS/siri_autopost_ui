import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AccountsStore } from '../../core/data/accounts.store';
import { DeviceEventsService } from '../../core/data/device-events.service';
import { PostsStore } from '../../core/data/posts.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { ApiPost, ApiRole } from '../../core/http/api.service';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import {
  ACCOUNTS,
  WS,
  apiPost,
  provideApiTesting,
  settle,
  signIn,
} from '../../testing/api-testing';
import { FakeDeviceEvents } from '../../testing/fake-events';
import { ErrorsPageComponent } from './errors-page.component';

const failed = (over: Partial<ApiPost> & { id: string }): ApiPost =>
  apiPost({
    scheduledAt: '2026-10-05T09:00:00Z',
    status: 'failed',
    failureCode: 'rate_limit',
    target: 'ขายของบ้านและสวน',
    content: 'โพสต์ขายโซฟา',
    ...over,
  });

describe('ErrorsPageComponent', () => {
  let http: HttpTestingController;

  async function open(errors: ApiPost[], role: ApiRole = 'owner') {
    http = provideApiTesting({
      imports: [ErrorsPageComponent],
      providers: [{ provide: DeviceEventsService, useClass: FakeDeviceEvents }],
    });
    TestBed.inject(WorkspaceStore);
    TestBed.inject(PostsStore);
    TestBed.inject(AccountsStore);
    await signIn(http, { errors, workspace: { role } });
    const fixture = TestBed.createComponent(ErrorsPageComponent);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const t = () => TestBed.inject(I18nService).t();
  const cards = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('section.err')];
  const button = (root: ParentNode, text: string) =>
    [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
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

  it('lists each failed post with the Facebook mark, the group it was for and the reason', async () => {
    const { el } = await open([failed({ id: 'e1' })]);
    const [card] = cards(el);
    expect(cards(el)).toHaveLength(1);
    expect(card.querySelector('.ph-facebook-logo')).not.toBeNull();
    expect(card.querySelector('h2')?.textContent).toBe(t().reasons.rate_limit.title);
    expect(card.querySelector('.small.muted')?.textContent).toContain(
      'Facebook · ขายของบ้านและสวน',
    );
    expect(card.textContent).toContain(t().reasons.rate_limit.fix);
    expect(card.textContent).toContain('โพสต์ขายโซฟา');
  });

  it('speaks about Facebook only: no other platform in any reason, in either language', async () => {
    const codes = ['rate_limit', 'session', 'network', 'media_too_large', 'quota'] as const;
    const { fixture, el } = await open(codes.map((c) => failed({ id: c, failureCode: c })));
    expect(cards(el)).toHaveLength(5);
    for (const lang of ['th', 'en'] as const) {
      TestBed.inject(I18nService).setLang(lang);
      fixture.detectChanges();
      expect(el.textContent, lang).not.toMatch(/TikTok|Instagram|Threads|LINE OA|\bX\b/);
    }
    TestBed.inject(I18nService).setLang('th');
  });

  it("says the extension's own words when it reported a reason", async () => {
    const { el } = await open([failed({ id: 'e1', failureDetail: 'กลุ่มนี้ปิดการโพสต์' })]);
    expect(cards(el)[0].textContent).toContain('กลุ่มนี้ปิดการโพสต์');
  });

  it('asks to sign in again for a session error, and marks the account signed in again', async () => {
    const { fixture, el } = await open([
      failed({ id: 'e1', failureCode: 'session', accountId: ACCOUNTS[0].id }),
      failed({ id: 'e2', failureCode: 'quota' }),
    ]);
    // Only the session error has the button; the other one is about the limit.
    expect(cards(el).map((c) => !!button(c, t().err.signin))).toEqual([true, false]);
    button(cards(el)[0], t().err.signin)!.click();
    http
      .expectOne({
        method: 'POST',
        url: `/api/workspaces/${WS}/accounts/${ACCOUNTS[0].id}/reconnect`,
      })
      .flush({ ...ACCOUNTS[0], health: 'ok' });
    await settle();
    fixture.detectChanges();
    expect(
      TestBed.inject(NotificationService)
        .toasts()
        .some((x) => x.message === t().err.signedIn),
    ).toBe(true);
    expect(TestBed.inject(AccountsStore).health(ACCOUNTS[0].id)).toBe('ok');
  });

  it('retries a failed post and skips one, as an editor', async () => {
    const { fixture, el } = await open([failed({ id: 'e1' })]);
    button(cards(el)[0], t().common.retryNow)!.click();
    http
      .expectOne({ method: 'POST', url: `/api/workspaces/${WS}/posts/e1/retry` })
      .flush(failed({ id: 'e1' }));
    await settle();
    // The page reads the posts and the errors again after a change.
    for (const r of http.match(
      (x) => x.url.includes(`/api/workspaces/${WS}/posts`) && x.method === 'GET',
    ))
      r.flush([]);
    for (const r of http.match(`/api/workspaces/${WS}/errors`)) r.flush([]);
    await settle();
    fixture.detectChanges();
    expect(cards(el)).toHaveLength(0);
    expect(
      TestBed.inject(NotificationService)
        .toasts()
        .some((x) => x.message === t().err.retried),
    ).toBe(true);
  });

  describe('retrying many failed posts at once', () => {
    const RETRY_URL = `/api/workspaces/${WS}/posts/retry`;
    const LIVE = 'acc-live';
    const accountsOf = () => TestBed.inject(AccountsStore);
    /** The default account of the fixtures was unbound; `acc-live` is a browser that posts. */
    const pairBrowser = (fixture: { detectChanges(): void }) => {
      accountsOf().list.set([
        ACCOUNTS[0],
        { ...ACCOUNTS[0], id: LIVE, name: 'Facebook · Office PC', connected: true },
      ]);
      fixture.detectChanges();
    };
    const checkboxes = (root: ParentNode) => [
      ...root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    ];
    const bar = (el: HTMLElement) => el.querySelector<HTMLElement>('section.bulk');
    const answerReloads = async (errors: ApiPost[] = []) => {
      await settle();
      for (const r of http.match(
        (x) => x.url.includes(`/api/workspaces/${WS}/posts`) && x.method === 'GET',
      ))
        r.flush([]);
      for (const r of http.match(`/api/workspaces/${WS}/errors`)) r.flush(errors);
      await settle();
    };
    const live = (n: number, over: Partial<ApiPost> = {}) =>
      Array.from({ length: n }, (_, i) =>
        failed({
          id: `f${i}`,
          accountId: LIVE,
          scheduledAt: new Date(Date.UTC(2026, 9, 5, 9, 0) - i * 60000).toISOString(),
          ...over,
        }),
      );

    it('picks the posts of a page and sends them in one request', async () => {
      const { fixture, el } = await open(live(3));
      pairBrowser(fixture);
      expect(bar(el)).toBeNull();

      // "Select this page" is the first box; each card has its own.
      checkboxes(el)[0].click();
      fixture.detectChanges();
      expect(checkboxes(el).every((c) => c.checked)).toBe(true);
      expect(bar(el)?.textContent).toContain(fmt(t().api.errBulkSelected, { n: 3 }));
      // Everything shown is selected already: no "select all" to offer.
      expect(bar(el)?.querySelector('[data-testid="bulk-select-all"]')).toBeNull();

      checkboxes(el)[2].click(); // takes one post out again
      fixture.detectChanges();
      const retry = bar(el)!.querySelector<HTMLButtonElement>('[data-testid="bulk-retry"]')!;
      expect(retry.textContent).toContain(fmt(t().api.errBulkRetry, { n: 2 }));
      retry.click();
      fixture.detectChanges();
      expect(retry.disabled).toBe(true); // busy until the API answers

      const req = http.expectOne({ method: 'POST', url: RETRY_URL });
      expect((req.request.body as { postIds: string[] }).postIds).toEqual(['f0', 'f2']);
      req.flush({ retried: 2, unbound: 0, notFailed: 0 });
      await answerReloads();
      fixture.detectChanges();

      const toasts = TestBed.inject(NotificationService).toasts();
      expect(toasts.some((x) => x.message === fmt(t().api.errBulkDone, { n: 2 }))).toBe(true);
      // The selection is dropped with the posts.
      expect(bar(el)).toBeNull();
    });

    it('selects every failed post on every page and sends them in rounds of 500', async () => {
      const { fixture, el } = await open(live(1100));
      pairBrowser(fixture);
      expect(cards(el)).toHaveLength(20);
      expect(el.querySelector('section.row-tools')?.textContent).toContain(
        fmt(t().api.errReadyLine, { n: 1100 }),
      );

      checkboxes(el)[0].click();
      fixture.detectChanges();
      expect(bar(el)?.textContent).toContain(fmt(t().api.errBulkSelected, { n: 20 }));
      button(bar(el)!, fmt(t().api.errSelectAll, { n: 1100 }))!.click();
      fixture.detectChanges();
      expect(bar(el)?.textContent).toContain(fmt(t().api.errBulkSelected, { n: 1100 }));
      expect(bar(el)?.querySelector('[data-testid="bulk-select-all"]')).toBeNull();

      bar(el)!.querySelector<HTMLButtonElement>('[data-testid="bulk-retry"]')!.click();
      for (const size of [500, 500, 100]) {
        await settle();
        const req = http.expectOne({ method: 'POST', url: RETRY_URL });
        expect((req.request.body as { postIds: string[] }).postIds).toHaveLength(size);
        req.flush({ retried: size, unbound: 0, notFailed: 0 });
      }
      await answerReloads();
      fixture.detectChanges();
      expect(
        TestBed.inject(NotificationService)
          .toasts()
          .some((x) => x.message === fmt(t().api.errBulkDone, { n: 1100 })),
      ).toBe(true);
      expect(cards(el)).toHaveLength(0);
    });

    it('does not offer posts of an unbound browser, and says what the API left alone', async () => {
      const { fixture, el } = await open([
        ...live(2),
        failed({ id: 'old1', accountId: ACCOUNTS[0].id }),
        failed({ id: 'old2', accountId: ACCOUNTS[0].id }),
        failed({ id: 'wait', accountId: LIVE, failureCode: 'pending_approval', status: 'pending' }),
      ]);
      pairBrowser(fixture);
      // Four failed ones and one waiting for approval: only the two of the live browser can be picked.
      expect(cards(el)).toHaveLength(5);
      const pickable = cards(el).filter((c) => c.querySelector('input[type="checkbox"]'));
      expect(pickable).toHaveLength(2);
      expect(el.querySelector('section.row-tools')?.textContent).toContain(
        fmt(t().api.errReadyLine, { n: 2 }),
      );
      expect(el.querySelector('section.row-tools')?.textContent).toContain(
        fmt(t().api.errUnboundLine, { n: 2 }),
      );

      // The single retry button is still there for every failed post.
      expect(cards(el).filter((c) => !!button(c, t().common.retryNow))).toHaveLength(4);

      checkboxes(el)[1].click(); // the first card's own box
      fixture.detectChanges();
      expect(bar(el)?.textContent).toContain(fmt(t().api.errBulkSelected, { n: 1 }));
      bar(el)!.querySelector<HTMLButtonElement>('[data-testid="bulk-retry"]')!.click();
      http
        .expectOne({ method: 'POST', url: RETRY_URL })
        .flush({ retried: 1, unbound: 1, notFailed: 1 });
      await answerReloads();
      const messages = TestBed.inject(NotificationService)
        .toasts()
        .map((x) => x.message);
      expect(messages).toContain(fmt(t().api.errBulkDone, { n: 1 }));
      expect(messages).toContain(fmt(t().api.errBulkUnbound, { n: 1 }));
      expect(messages).toContain(fmt(t().api.errBulkGone, { n: 1 }));
    });

    it('keeps the selection when a round fails, so one more press carries on', async () => {
      const { fixture, el } = await open(live(2));
      pairBrowser(fixture);
      checkboxes(el)[0].click();
      fixture.detectChanges();
      bar(el)!.querySelector<HTMLButtonElement>('[data-testid="bulk-retry"]')!.click();
      http
        .expectOne({ method: 'POST', url: RETRY_URL })
        .flush({ title: 'down' }, { status: 500, statusText: 'Server Error' });
      await answerReloads(live(2));
      fixture.detectChanges();
      expect(bar(el)?.textContent).toContain(fmt(t().api.errBulkSelected, { n: 2 }));
      expect(
        bar(el)!.querySelector<HTMLButtonElement>('[data-testid="bulk-retry"]')!.disabled,
      ).toBe(false);
    });

    it('starts again from nothing when the list is filtered', async () => {
      const { fixture, el } = await open(live(2));
      pairBrowser(fixture);
      checkboxes(el)[0].click();
      fixture.detectChanges();
      expect(bar(el)).not.toBeNull();
      button(el, t().err.filterToday)!.click();
      fixture.detectChanges();
      expect(bar(el)).toBeNull();
    });

    it('keeps every selection control off for a viewer', async () => {
      const { fixture, el } = await open(live(2), 'viewer');
      pairBrowser(fixture);
      expect(checkboxes(el)).toHaveLength(3);
      expect(checkboxes(el).every((c) => c.disabled)).toBe(true);
    });
  });

  it('keeps every button off for a viewer, with the reason', async () => {
    const { el } = await open([failed({ id: 'e1', failureCode: 'session' })], 'viewer');
    for (const b of cards(el)[0].querySelectorAll<HTMLButtonElement>('button')) {
      expect(b.disabled, b.textContent ?? '').toBe(true);
      expect(b.getAttribute('title')).toBeTruthy();
    }
  });

  it('says there is nothing to fix when no post failed', async () => {
    const { el } = await open([]);
    expect(cards(el)).toHaveLength(0);
    expect(el.querySelector('app-empty-state')?.textContent).toContain(t().err.empty);
  });
});
