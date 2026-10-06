import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AccountsStore } from '../../core/data/accounts.store';
import { DeviceEventsService } from '../../core/data/device-events.service';
import { PostsStore } from '../../core/data/posts.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { ApiPost, ApiRole } from '../../core/http/api.service';
import { I18nService } from '../../core/i18n/i18n.service';
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
