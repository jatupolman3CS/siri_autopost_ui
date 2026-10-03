import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DraftStore } from '../../core/data/draft.store';
import { LibraryStore } from '../../core/data/library.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { dkey } from '../../core/i18n/format';
import { WS, provideApiTesting, signIn } from '../../testing/api-testing';
import { AccountsStore } from '../../core/data/accounts.store';
import { INPUT_LIMITS } from '../../core/http/input-limits';
import { I18nService } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { ACCOUNTS } from '../../testing/api-testing';
import {
  ComposerPageComponent,
  REPEAT_HORIZON_DAYS,
  localIso,
  occurrences,
} from './composer-page.component';

describe('ComposerPageComponent', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    http = provideApiTesting({
      imports: [ComposerPageComponent],
      providers: [provideRouter([{ path: '**', children: [] }])],
    });
    TestBed.inject(DraftStore);
    await signIn(http);
  });

  function submit() {
    const fixture = TestBed.createComponent(ComposerPageComponent);
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.bottom .su-btn-primary')!
      .click();
    fixture.detectChanges();
  }

  it('starts with the design defaults: three groups of the page, plus Instagram', () => {
    const d = TestBed.inject(DraftStore).draft();
    expect(d.targets).toEqual({ 'acc-page': true, 'acc-ig': true });
    expect(d.groups).toEqual(['G1', 'G2', 'G3']);
  });

  it('shows errors and sends nothing for an empty post in the past', () => {
    const draft = TestBed.inject(DraftStore);
    draft.patch({ targets: {}, date: '2020-01-01' });
    submit();
    expect(draft.draft().errText).not.toBe('');
    expect(draft.draft().errTargets).not.toBe('');
    expect(draft.draft().errTime).not.toBe('');
    http.expectNone(`/api/workspaces/${WS}/posts/schedule`);
  });

  it('sends the selected groups per account and skips accounts that need a new login', () => {
    const draft = TestBed.inject(DraftStore);
    const tomorrow = new Date(Date.now() + 864e5);
    draft.patch({
      text: 'โปรวันนี้',
      date: dkey(tomorrow),
      time: '14:00',
      targets: { 'acc-page': true, 'acc-ig': true, 'acc-tt': true },
      groups: ['G2', 'G4'],
    });
    submit();
    const req = http.expectOne(`/api/workspaces/${WS}/posts/schedule`);
    expect(req.request.body.content).toBe('โปรวันนี้');
    expect(req.request.body.startAt).toMatch(/T14:00:00[+-]\d{2}:\d{2}$/);
    expect(req.request.body.targets).toEqual([
      { accountId: 'acc-page', groups: ['G2', 'G4'] },
      { accountId: 'acc-ig', groups: null },
    ]);
  });

  it('writes local times with their UTC offset', () => {
    const d = new Date(2026, 9, 4, 9, 5);
    expect(localIso(d)).toMatch(/^2026-10-04T09:05:00[+-]\d{2}:\d{2}$/);
  });

  it('counts the days of a repeat the way the API queues them', () => {
    const monday = new Date(2026, 9, 5, 14);
    expect(occurrences(monday, 'none')).toBe(1);
    expect(occurrences(monday, 'daily')).toBe(REPEAT_HORIZON_DAYS);
    expect(occurrences(monday, 'weekly')).toBe(2);
    expect(occurrences(monday, 'weekdays')).toBe(10); // Mon-Fri twice
    expect(occurrences(new Date(2026, 9, 10, 14), 'weekdays')).toBe(10); // from a Saturday: 14 days still hold 10
  });

  describe('page', () => {
    const element = () => TestBed.createComponent(ComposerPageComponent);

    function open(fixtureReady = true) {
      const fixture = element();
      fixture.detectChanges();
      return { fixture, el: fixture.nativeElement as HTMLElement, ready: fixtureReady };
    }

    it('says what scheduling creates: the delay, and for a repeat the total and the 14-day horizon', () => {
      const draft = TestBed.inject(DraftStore);
      const { fixture, el } = open();
      const summary = () => el.querySelector('.sum span')!.textContent!;
      const api = TestBed.inject(I18nService).t().api;
      expect(summary()).toContain('4'); // three groups of the page, plus Instagram
      expect(summary()).toContain(api.sumRandom);

      draft.patch({ useDelay: false });
      fixture.detectChanges();
      expect(summary()).toContain(api.sumSame);
      expect(summary()).not.toContain(api.sumRandom);

      draft.patch({ repeat: 'daily', useDelay: true });
      fixture.detectChanges();
      expect(summary()).toContain(String(4 * REPEAT_HORIZON_DAYS));
      expect(el.textContent).toContain(String(REPEAT_HORIZON_DAYS));
    });

    it('stops the text at 5000 characters and the media at 20 files', () => {
      const { fixture, el } = open();
      expect(el.querySelector('textarea')!.getAttribute('maxlength')).toBe(
        String(INPUT_LIMITS.postText),
      );
      const draft = TestBed.inject(DraftStore);
      draft.patch({ media: Array.from({ length: INPUT_LIMITS.postMedia }, (_, i) => 'm' + i) });
      TestBed.inject(LibraryStore).media.set([
        { id: 'extra', name: 'x.png', meta: '', kind: 'image', used: 0 },
      ]);
      fixture.detectChanges();
      el.querySelector<HTMLButtonElement>('.media .m')!.click();
      expect(draft.draft().media.length).toBe(INPUT_LIMITS.postMedia);
      expect(TestBed.inject(NotificationService).toasts().length).toBe(1);
    });

    it('does not offer a connected account that has no groups yet, and says why', () => {
      TestBed.inject(AccountsStore).list.set([
        { ...ACCOUNTS[0], id: 'acc-new', name: 'Facebook · New PC', connected: true, groups: [] },
        ...ACCOUNTS,
      ]);
      const { fixture, el } = open();
      TestBed.inject(DraftStore).patch({ targets: { 'acc-new': true }, autoTargets: false });
      fixture.detectChanges();
      const row = el.querySelector('.tgt')!;
      expect(row.querySelector<HTMLInputElement>('input[type=checkbox]')!.disabled).toBe(true);
      expect(row.textContent).toMatch(/no groups yet|ยังไม่มีกลุ่ม/);
      // Even if it was selected before, no task is made for it.
      expect(el.querySelector('.sum span')!.textContent).toMatch(
        /Select at least one|เลือกบัญชีปลายทาง/,
      );
    });

    it('is off for a viewer', () => {
      TestBed.inject(WorkspaceStore).list.update((l) => l.map((w) => ({ ...w, role: 'viewer' })));
      const { el } = open();
      expect(el.querySelector<HTMLButtonElement>('.bottom .su-btn-primary')!.disabled).toBe(true);
    });
  });
});
