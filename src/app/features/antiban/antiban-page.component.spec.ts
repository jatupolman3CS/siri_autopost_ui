import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { assistStorage } from '../../core/auth/token';
import { PLATFORMS } from '../../core/data/platforms';
import { SettingsStore, defaultAdvanced } from '../../core/data/settings.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { ApiRole } from '../../core/http/api.service';
import '../../core/i18n/i18n.engine';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import {
  answerWorkspaceLoads,
  provideApiTesting,
  settle,
  signIn,
  signInHoldingWorkspaces,
} from '../../testing/api-testing';
import {
  ANTI_BAN_URL,
  BACKUP,
  BACKUP_URL,
  POSTS_URL,
  RESTORE_URL,
  antiBan,
  flushBackground,
} from '../../testing/test-post.fixtures';
import { AntibanAdvancedComponent } from './antiban-advanced.component';
import { AntibanPageComponent } from './antiban-page.component';

describe('AntibanPageComponent', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<AntibanPageComponent>;
  let el: HTMLElement;
  const t = () => TestBed.inject(I18nService).t();
  const toasts = () => TestBed.inject(NotificationService).toasts();
  const settings = () => TestBed.inject(SettingsStore);

  async function open(
    opts: { role?: ApiRole; advanced?: boolean; assist?: boolean } = {},
  ): Promise<void> {
    http = provideApiTesting({
      imports: [AntibanPageComponent],
      providers: [provideRouter([{ path: '**', children: [] }])],
    });
    if (opts.assist)
      assistStorage.set({
        adminToken: 'a',
        customerId: 'u-1',
        email: 'owner@shop.co',
        expiresAt: '2099-01-01T00:00:00Z',
      });
    TestBed.inject(WorkspaceStore);
    await signIn(http, {
      workspace: { role: opts.role ?? 'owner', advancedAntiBan: opts.advanced ?? true },
    });
    fixture = TestBed.createComponent(AntibanPageComponent);
    fixture.detectChanges();
    await settle();
    // The stores the page reads start loading when it is created.
    answerWorkspaceLoads(http);
    await settle();
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  }

  const rerender = async () => {
    await settle();
    fixture.detectChanges();
  };
  const adv = () => el.querySelector<HTMLElement>('section.adv')!;
  /** The numeric inputs of the advanced section: the seven rules, then the block pause min and max. */
  const nums = () => [...adv().querySelectorAll<HTMLInputElement>('input[type=number]')];
  const values = () => nums().map((i) => i.value);
  const enter = async (input: HTMLInputElement | HTMLSelectElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('change'));
    await rerender();
  };
  const enterSelect = enter;
  const button = (root: ParentNode, text: string) =>
    [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent!.includes(text),
    )!;
  const saveBtn = () => el.querySelector<HTMLButtonElement>('.page-head button')!;
  const modalBody = () => document.querySelector<HTMLElement>('.su-modal-body');
  const modalButton = (text: string) =>
    [...document.querySelectorAll<HTMLButtonElement>('.su-modal-foot button')].find((b) =>
      b.textContent!.includes(text),
    )!;
  const typeRestore = async (text: string) => {
    const ta = modalBody()!.querySelector('textarea')!;
    ta.value = text;
    ta.dispatchEvent(new Event('input'));
    await rerender();
  };

  afterEach(() => {
    vi.restoreAllMocks();
    try {
      http.verify();
    } finally {
      TestBed.resetTestingModule();
      localStorage.clear();
    }
  });

  describe('the advanced section', () => {
    beforeEach(() => open());

    it('has the design title, badge, the seven rules, the block pause, the focus window, warm-up and backup', () => {
      expect(adv().querySelector('h2')!.textContent).toBe(t().ab.advTitle);
      expect(adv().querySelector('.crown')!.textContent).toContain(t().ab.advBadge);
      expect(adv().querySelector('.sub')!.textContent).toBe(t().ab.advBody);
      const a = t().ab;
      expect(
        [...adv().querySelectorAll('.num > span:first-child')].map((s) => s.textContent),
      ).toEqual([
        a.minGap,
        a.dailyAll,
        a.failStreak,
        a.recentAvoid,
        a.cooldown,
        a.autoOff,
        a.stopFail,
        a.blockPause,
      ]);
      // The server's defaults.
      expect(values()).toEqual(['2', '0', '4', '10', '0', '3', '30', '24', '48']);
      expect(adv().querySelector('.pair span')!.textContent).toBe(a.blockTo);
      expect(adv().querySelector('app-checkbox label')!.textContent).toBe(a.focusWindow);
      expect(adv().querySelector<HTMLInputElement>('app-checkbox input')!.checked).toBe(true);
      expect([...adv().querySelectorAll('li')].map((l) => l.textContent)).toEqual([
        a.w1,
        a.w2,
        a.w3,
        a.w4,
      ]);
      expect(adv().textContent).toContain(a.warmTitle);
      expect(adv().textContent).toContain(a.backupTitle);
      expect(button(adv(), a.backup)).toBeTruthy();
      expect(button(adv(), a.restore)).toBeTruthy();
    });

    it('limits every rule to the range the API accepts and shows the limited number', async () => {
      const [minGap, dailyAll, failStreak, recentAvoid, cooldown, autoOff, stopFail] = nums();
      await enter(minGap, '99');
      expect(minGap.value).toBe('60');
      await enter(dailyAll, '9999');
      expect(dailyAll.value).toBe('500');
      await enter(failStreak, '-3');
      expect(failStreak.value).toBe('0');
      await enter(recentAvoid, '51');
      expect(recentAvoid.value).toBe('50');
      await enter(cooldown, '200');
      expect(cooldown.value).toBe('168');
      await enter(autoOff, '21');
      expect(autoOff.value).toBe('20');
      await enter(stopFail, 'abc');
      expect(stopFail.value).toBe('0');
      expect(settings().ab().advanced).toEqual({
        ...defaultAdvanced(),
        minGap: 60,
        dailyAll: 500,
        failStreak: 0,
        recentAvoid: 50,
        cooldown: 168,
        autoOffFails: 20,
        stopFailPct: 0,
      });
    });

    it('lets a platform take up to 500 posts a day (72 groups three times a day is 216)', async () => {
      const fb = el.querySelector<HTMLInputElement>(`input[aria-label="${PLATFORMS.fb.name}"]`)!;
      expect(fb.max).toBe('500');
      await enter(fb, '216');
      expect(settings().ab().limits.fb).toBe(216);
      expect(fb.value).toBe('216');
      await enter(fb, '9999');
      expect(settings().ab().limits.fb).toBe(500);
      expect(fb.value).toBe('500');
    });

    it('keeps the shortest block pause at or below the longest', async () => {
      const [, , , , , , , min, max] = nums();
      await enter(min, '60');
      expect(settings().ab().advanced).toMatchObject({ blockMin: 60, blockMax: 60 });
      expect(max.value).toBe('60');
      await enter(max, '10');
      expect(settings().ab().advanced).toMatchObject({ blockMin: 10, blockMax: 10 });
      expect(min.value).toBe('10');
      await enter(max, '500');
      expect(settings().ab().advanced.blockMax).toBe(168);
      await enter(min, '0');
      expect(settings().ab().advanced.blockMin).toBe(1);
    });

    it('turns the focus window off, and says the browser applies it (it is not "saved only" any more)', async () => {
      adv().querySelector<HTMLInputElement>('app-checkbox input')!.click();
      await rerender();
      expect(settings().ab().advanced.focus).toBe(false);
      expect([...adv().querySelectorAll('.stored')].map((p) => p.textContent)).toContain(
        t().api.engine.abFocusApplied,
      );
      expect(adv().textContent).not.toContain(t().api.engine.storedOnly);
    });

    it('says the extension in the browser takes the rest after a Facebook block', () => {
      expect(adv().textContent).toContain(t().api.engine.abBlockApplied);
      expect(adv().textContent).not.toContain(t().api.engine.storedOnly);
    });

    it('says the block pause needs the automatic pause', async () => {
      expect(adv().textContent).not.toContain(t().api.engine.blockNeedsAuto);
      settings().patchAb({ autopause: false });
      await rerender();
      expect(adv().textContent).toContain(t().api.engine.blockNeedsAuto);
    });

    it('goes out with Save together with the other settings', async () => {
      await enter(nums()[1], '80');
      await enter(nums()[7], '12');
      saveBtn().click();
      await settle();
      const req = http.expectOne((r) => r.method === 'PUT' && r.url === ANTI_BAN_URL);
      expect(req.request.body.advanced).toEqual({
        ...defaultAdvanced(),
        dailyAll: 80,
        blockMin: 12,
        blockMax: 48,
      });
      expect(req.request.body.min).toBe(3);
      req.flush({
        antiBan: antiBan({ advanced: { ...defaultAdvanced(), dailyAll: 80, blockMin: 12 } }),
        offline: { policy: 'queue', window: '2h', line: true, email: true, push: false },
        extensionOnline: true,
        simulatedOffline: false,
        devices: 0,
        devicesOnline: 0,
      });
      await rerender();
      expect(toasts().map((x) => x.message)).toContain(t().ab.saved);
      expect(values()[1]).toBe('80');
    });
  });

  describe('the human-like behaviour switches', () => {
    it('lets an admin change all five, and none of them says it is saved without effect', async () => {
      await open({ role: 'admin' });
      const boxes = [...el.querySelectorAll<HTMLInputElement>('.human input[type=checkbox]')];
      expect(boxes).toHaveLength(5);
      expect(boxes.map((b) => b.disabled)).toEqual([false, false, false, false, false]);
      // The server applies the shuffle now, the browser the rest of what it can: nothing is "saved only".
      expect(el.textContent).not.toContain(t().api.engine.storedOnly);
      expect(el.textContent).not.toContain(t().api.notYet);
      expect(el.querySelector('.human .not-yet')).toBeNull();
    });

    it('saves the automatic pause and the warm-up like the others', async () => {
      await open({ role: 'admin' });
      const boxes = [...el.querySelectorAll<HTMLInputElement>('.human input[type=checkbox]')];
      boxes[3].click();
      boxes[4].click();
      await rerender();
      expect(settings().ab()).toMatchObject({ autopause: false, warmup: true });
      saveBtn().click();
      await settle();
      const req = http.expectOne((r) => r.method === 'PUT' && r.url === ANTI_BAN_URL);
      expect(req.request.body).toMatchObject({ autoPause: false, warmup: true });
      req.flush({
        antiBan: antiBan({ autoPause: false, warmup: true }),
        offline: { policy: 'queue', window: '2h', line: true, email: true, push: false },
        extensionOnline: true,
        simulatedOffline: false,
        devices: 0,
        devicesOnline: 0,
      });
      await settle();
    });
  });

  describe('typing speed', () => {
    const speed = () => el.querySelector<HTMLSelectElement>('.human app-select-field select')!;
    const speedBox = () => el.querySelector<HTMLElement>('.human .speed')!;
    const typingBox = () => el.querySelector<HTMLInputElement>('.human input[type=checkbox]')!;

    it('is a three-way choice beside the typing switch, on normal by default', async () => {
      await open({ role: 'admin' });
      // Sits in the first row, the one of the typing switch.
      expect(el.querySelectorAll('.human > div')[0].contains(speedBox())).toBe(true);
      expect(speedBox().querySelector('label')!.textContent!.trim()).toBe(
        t().api.engine.abTypingSpeed,
      );
      expect([...speed().options].map((o) => [o.value, o.textContent!.trim()])).toEqual([
        ['slow', t().api.engine.abSpeedSlow],
        ['normal', t().api.engine.abSpeedNormal],
        ['fast', t().api.engine.abSpeedFast],
      ]);
      expect(speed().value).toBe('normal');
      expect(speed().disabled).toBe(false);
      expect(speedBox().textContent).toContain(t().api.engine.abSpeedHint);
    });

    it('saves the speed with the other settings and shows what the server stored', async () => {
      await open({ role: 'admin' });
      await enterSelect(speed(), 'fast');
      expect(settings().ab().typingSpeed).toBe('fast');
      saveBtn().click();
      await settle();
      const req = http.expectOne((r) => r.method === 'PUT' && r.url === ANTI_BAN_URL);
      expect(req.request.body.typingSpeed).toBe('fast');
      req.flush({
        antiBan: antiBan({ typingSpeed: 'fast' }),
        offline: { policy: 'queue', window: '2h', line: true, email: true, push: false },
        extensionOnline: true,
        simulatedOffline: false,
        devices: 0,
        devicesOnline: 0,
      });
      await rerender();
      expect(speed().value).toBe('fast');
    });

    it('shows the speed the workspace has', async () => {
      await open({ role: 'admin' });
      settings().patchAb({ typingSpeed: 'slow' });
      await rerender();
      expect(speed().value).toBe('slow');
    });

    it('is off while typing is off, like the choice it belongs to', async () => {
      await open({ role: 'admin' });
      typingBox().click();
      await rerender();
      expect(settings().ab().typing).toBe(false);
      expect(speed().disabled).toBe(true);
      typingBox().click();
      await rerender();
      expect(speed().disabled).toBe(false);
    });

    it('is locked below Pro like the other behaviour switches, and for a viewer', async () => {
      await open({ role: 'owner', advanced: false });
      expect(speed().disabled).toBe(true);
      TestBed.resetTestingModule();
      await open({ role: 'viewer' });
      expect(speed().disabled).toBe(true);
    });
  });

  describe('the daily limit', () => {
    const rows = () => el.querySelectorAll('.limits .row');
    const input = () => el.querySelector<HTMLInputElement>('.limits input[type=number]')!;

    it('is one Facebook limit, with no row for another platform and no "Facebook only" note', async () => {
      await open({ role: 'admin' });
      expect(rows()).toHaveLength(1);
      expect(rows()[0].textContent).toContain(PLATFORMS.fb.name);
      expect(input().value).toBe('40');
      expect(input().getAttribute('aria-label')).toBe(PLATFORMS.fb.name);
      expect(el.querySelector('.limits')!.textContent).not.toMatch(/Instagram|TikTok|LINE|Threads/);
      expect(t().api).not.toHaveProperty('limitsFbOnly');
    });

    it('counts the Facebook posts of the last 24 hours against it', async () => {
      await open({ role: 'admin' });
      await rerender();
      expect(rows()[0].textContent).toContain(`${t().ab.usedToday} 0/40`);
    });
  });

  describe('what the extension uses', () => {
    const card = () => el.querySelector<HTMLElement>('section.uses')!;

    it('is a card at the top that lists what the browser applies when it posts', async () => {
      await open({ role: 'admin' });
      const a = t().api.engine;
      expect(card().querySelector('h2')!.textContent).toBe(a.abExtTitle);
      expect([...card().querySelectorAll('li')].map((l) => l.textContent)).toEqual([
        a.abExtTyping,
        a.abExtScroll,
        a.abExtFocus,
        a.abExtBlock,
        a.abExtPause,
      ]);
      // First thing under the page title, before the risk meter.
      const order = [...el.querySelectorAll('.page > *')];
      expect(order.indexOf(card())).toBeLessThan(order.indexOf(el.querySelector('.risk')!));
    });

    it('says what it posts and where comes from the schedule, with links to the pages that hold it', async () => {
      await open({ role: 'admin' });
      const a = t().api.engine;
      expect(card().textContent).toContain(a.abExtWhatTitle);
      expect(card().textContent).toContain(a.abExtWhat);
      expect(
        [...card().querySelectorAll('a')].map((l) => [
          l.getAttribute('href'),
          l.textContent!.trim(),
        ]),
      ).toEqual([
        ['/app/schedules', t().nav.schedules],
        ['/app/posts', t().api.postsNav],
        ['/app/targets', t().nav.targets],
        ['/app/team', a.abExtLinkTeam],
      ]);
    });

    it('is plain information, so it is there for a viewer as well', async () => {
      await open({ role: 'viewer' });
      expect(card()).not.toBeNull();
    });
  });

  describe('the risk meter', () => {
    const label = () => el.querySelector('.risk-label')!.textContent;

    it('is low with the defaults and counts the automatic pause and the plan like the design', async () => {
      await open({ role: 'admin' });
      expect(label()).toBe(t().ab.riskLow);
      settings().patchAb({ autopause: false });
      await rerender();
      expect(label()).toBe(t().ab.riskLow);
      settings().patchAb({ typing: false });
      await rerender();
      expect(label()).toBe(t().ab.riskMed);
      settings().patchAb({ scroll: false, min: 1 });
      await rerender();
      expect(label()).toBe(t().ab.riskHigh);
    });

    it('adds a point when the owner plan has no advanced rules', async () => {
      await open({ role: 'admin', advanced: false });
      settings().patchAb({ autopause: false });
      await rerender();
      // autopause off (1) + no advanced rules (1)
      expect(label()).toBe(t().ab.riskMed);
    });
  });

  describe('plan lock', () => {
    it('shows the lock banner twice, switches every advanced control off and dims the section', async () => {
      await open({ role: 'owner', advanced: false });
      expect(el.querySelectorAll('.lock')).toHaveLength(2);
      expect(adv().querySelector('.lock')!.textContent).toContain(t().ab.locked);
      expect(nums().every((i) => i.disabled)).toBe(true);
      expect(adv().querySelector<HTMLInputElement>('app-checkbox input')!.disabled).toBe(true);
      expect(button(adv(), t().ab.backup).disabled).toBe(true);
      expect(button(adv(), t().ab.restore).disabled).toBe(true);
      expect(button(adv(), t().ab.backup).title).toBe(t().ab.locked);
      expect(adv().querySelectorAll('.dim').length).toBeGreaterThan(0);
      // The owner can upgrade.
      const upgrade = [...el.querySelectorAll<HTMLAnchorElement>('.lock a')];
      expect(upgrade.map((a) => a.getAttribute('href'))).toEqual(['/app/billing', '/app/billing']);
      expect(upgrade[0].textContent).toContain(t().common.upgrade);
    });

    it('shows no lock and dims nothing before the workspaces have arrived, then locks', async () => {
      http = provideApiTesting({
        imports: [AntibanPageComponent],
        providers: [provideRouter([{ path: '**', children: [] }])],
      });
      const ws = TestBed.inject(WorkspaceStore);
      const held = await signInHoldingWorkspaces(http);
      fixture = TestBed.createComponent(AntibanPageComponent);
      fixture.detectChanges();
      await settle();
      fixture.detectChanges();
      el = fixture.nativeElement as HTMLElement;
      expect(ws.loaded()).toBe(false);
      expect(el.querySelector('.lock')).toBeNull();
      expect(adv().querySelector('.dim')).toBeNull();
      await held.answer({ advancedAntiBan: false });
      await rerender();
      expect(el.querySelectorAll('.lock')).toHaveLength(2);
      expect(adv().querySelectorAll('.dim').length).toBeGreaterThan(0);
    });

    it('does not offer an upgrade to a member who is not the owner', async () => {
      await open({ role: 'admin', advanced: false });
      expect(el.querySelectorAll('.lock')).toHaveLength(2);
      expect(el.querySelector('.lock a')).toBeNull();
    });

    it('is not locked when the owner plan has the advanced rules, whoever is signed in', async () => {
      await open({ role: 'admin', advanced: true });
      expect(el.querySelector('.lock')).toBeNull();
      expect(adv().querySelector('.dim')).toBeNull();
    });
  });

  describe('permissions', () => {
    it.each([
      ['viewer', true],
      ['editor', true],
      ['admin', false],
      ['owner', false],
    ] as const)('%s: advanced rules, backup and restore off = %s', async (role, off) => {
      await open({ role });
      expect(nums().every((i) => i.disabled)).toBe(off);
      expect(adv().querySelector<HTMLInputElement>('app-checkbox input')!.disabled).toBe(off);
      expect(button(adv(), t().ab.backup).disabled).toBe(off);
      expect(button(adv(), t().ab.restore).disabled).toBe(off);
      expect(saveBtn().disabled).toBe(off);
      expect(el.querySelector('.perm-note') !== null).toBe(off);
    });

    it('is read-only in assist mode', async () => {
      await open({ role: 'owner', assist: true });
      expect(nums().every((i) => i.disabled)).toBe(true);
      expect(button(adv(), t().ab.backup).disabled).toBe(true);
      expect(button(adv(), t().ab.restore).disabled).toBe(true);
    });
  });

  describe('backup', () => {
    let created: Blob[];
    let clicks: string[];

    beforeEach(async () => {
      created = [];
      clicks = [];
      URL.createObjectURL = vi.fn((b: Blob | MediaSource) => {
        created.push(b as Blob);
        return 'blob:backup';
      });
      URL.revokeObjectURL = vi.fn();
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement,
      ) {
        clicks.push(this.download);
      });
      await open({ role: 'admin' });
    });

    it('downloads the backup file and says so; the card says it holds no tokens', async () => {
      expect(adv().textContent).toContain(t().api.engine.backupNoSecrets);
      button(adv(), t().ab.backup).click();
      await settle();
      http.expectOne(BACKUP_URL).flush(BACKUP);
      await rerender();
      expect(clicks).toEqual(['autopost-backup.json']);
      expect(JSON.parse(await created[0].text())).toEqual(BACKUP);
      expect(toasts().map((x) => x.message)).toContain(t().ab.backedUp);
    });
  });

  describe('restore', () => {
    beforeEach(() => open({ role: 'admin' }));

    const openModal = async () => {
      button(adv(), t().ab.restore).click();
      await rerender();
    };
    const check = () => modalButton(t().api.engine.restoreCheck);
    const confirm = () => modalButton(t().api.engine.restoreConfirm);
    const review = () => modalBody()!.querySelector<HTMLElement>('[data-testid=restore-review]');
    /** A backup with something in every list, so the summary has numbers to show. */
    const FILE = {
      ...BACKUP,
      collections: [
        { name: 'A', description: '', icon: '', posts: [{}, {}, {}] },
        { name: 'B', description: '', icon: '', posts: [{}] },
      ],
      linkSets: [{ name: 'S', postAsAccountId: null, accountIds: [], links: [{}, {}, {}, {}, {}] }],
      schedules: [{ name: 'Morning' }, { name: 'Evening' }, { name: 'Weekend' }],
      notificationRules: { channel: 'tg', events: {}, sets: [{ linkSet: 'S' }] },
      autoReply: { on: true, rules: [{}, {}] },
    };
    const li = () => [...review()!.querySelectorAll('li')].map((l) => l.textContent!.trim());

    it('opens a dialog with the hint, a box for the file and the two buttons', async () => {
      expect(modalBody()).toBeNull();
      await openModal();
      expect(document.querySelector('.su-modal-title')!.textContent).toBe(t().ab.restoreTitle);
      expect(modalBody()!.textContent).toContain(t().ab.restoreHint);
      expect(modalBody()!.querySelector('textarea')!.value).toBe('');
      expect(modalButton(t().common.cancel)).toBeTruthy();
      expect(check()).toBeTruthy();
      // Nothing can be restored from this step: there is no restore button yet.
      expect(modalButton(t().api.engine.restoreConfirm)).toBeUndefined();
    });

    it('refuses a text that is not a JSON object without asking the API', async () => {
      await openModal();
      for (const text of ['', 'not json', '[1, 2]', '42', 'null']) {
        await typeRestore(text);
        check().click();
        await rerender();
        expect(modalBody()!.querySelector('.su-field-err')!.textContent).toBe(t().ab.restoreErr);
        expect(review()).toBeNull();
      }
      http.expectNone(RESTORE_URL);
    });

    it('refuses a file without collections, link sets and schedules before showing anything', async () => {
      await openModal();
      for (const text of ['{}', '{"collections": []}', '{"collections":[],"linkSets":[]}']) {
        await typeRestore(text);
        check().click();
        await rerender();
        expect(modalBody()!.querySelector('.su-field-err')!.textContent).toBe(
          t().api.engine.restoreIncomplete,
        );
        expect(review()).toBeNull();
      }
      http.expectNone(RESTORE_URL);
    });

    it('fills the box from a chosen file, which is then checked like pasted text', async () => {
      await openModal();
      const input = modalBody()!.querySelector<HTMLInputElement>('[data-testid=restore-file]')!;
      expect(input.accept).toContain('.json');
      expect(button(modalBody()!, t().api.engine.restorePick)).toBeTruthy();
      const file = new File([JSON.stringify(FILE)], 'backup.json', { type: 'application/json' });
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      input.dispatchEvent(new Event('change'));
      await rerender();
      await rerender();
      expect(modalBody()!.querySelector('textarea')!.value).toBe(JSON.stringify(FILE));
      check().click();
      await rerender();
      expect(review()).not.toBeNull();
      http.expectNone(RESTORE_URL);
    });

    describe('the confirmation step', () => {
      beforeEach(async () => {
        await openModal();
        await typeRestore(JSON.stringify(FILE));
        check().click();
        await rerender();
      });

      it('lists what the file contains, without sending anything yet', () => {
        expect(review()).not.toBeNull();
        expect(modalBody()!.querySelector('textarea')).toBeNull();
        expect(li()).toEqual([
          fmt(t().api.engine.restoreSumCollections, { n: 2, p: 4 }),
          fmt(t().api.engine.restoreSumLinkSets, { n: 1, l: 5 }),
          fmt(t().api.engine.restoreSumSchedules, { n: 3 }),
          t().api.engine.restoreSumAdvanced,
          fmt(t().api.engine.restoreSumNotify, { n: 1 }),
          fmt(t().api.engine.restoreSumReply, { n: 2 }),
        ]);
        expect(li()[0]).toBe('2 ชุดโพสต์ (รวม 4 โพสต์)');
        expect(review()!.textContent).toContain(t().api.engine.restoreSumPlan);
        http.expectNone(RESTORE_URL);
      });

      it('counts a post that sits in several collections once, and lists the posts that are in none', async () => {
        button(modalBody()!.closest('.su-modal-panel')!, t().api.engine.restoreBack).click();
        await rerender();
        const shared = (key: string) => ({ text: 'x', mediaIds: [], approval: 'approved', key });
        await typeRestore(
          JSON.stringify({
            ...FILE,
            collections: [
              { name: 'A', description: '', icon: '', posts: [shared('k1'), shared('k2')] },
              { name: 'B', description: '', icon: '', posts: [shared('k1')] },
            ],
            posts: [shared('k3'), shared('k4')],
          }),
        );
        check().click();
        await rerender();
        expect(li()[0]).toBe(fmt(t().api.engine.restoreSumCollections, { n: 2, p: 2 }));
        expect(li()[1]).toBe(fmt(t().api.engine.restoreSumLibrary, { n: 2 }));
      });

      it('says what is replaced: everything of those kinds, queued posts are deleted, history stays', () => {
        const text = review()!.textContent!;
        expect(text).toContain(t().api.engine.restoreReplaces);
        expect(text).toContain(t().api.engine.restoreQueued);
        expect(text).toContain(t().api.engine.restoreHistory);
        expect(review()!.querySelector('.callout.warn')!.getAttribute('role')).toBe('alert');
        // What is there now (the page's lists have arrived, and are empty here).
        expect(text).toContain(fmt(t().api.engine.restoreNow, { c: 0, s: 0, h: 0 }));
      });

      it('names only the optional parts the file has', async () => {
        button(modalBody()!.closest('.su-modal-panel')!, t().api.engine.restoreBack).click();
        await rerender();
        await typeRestore(JSON.stringify({ ...BACKUP, antiBanAdvanced: null }));
        check().click();
        await rerender();
        expect(li()).toHaveLength(3);
        expect(review()!.textContent).not.toContain(t().api.engine.restoreSumPlan);
      });

      it('sends the file only on the second click, and closes with the counts', async () => {
        confirm().click();
        await settle();
        const req = http.expectOne(RESTORE_URL);
        expect(req.request.body).toEqual(FILE);
        req.flush({ collections: 2, linkSets: 1, schedules: 3 });
        await settle();
        flushBackground(http);
        for (const r of http.match((x) => x.url === POSTS_URL)) r.flush([]);
        await rerender();
        expect(modalBody()).toBeNull();
        expect(toasts().map((x) => x.message)).toContain(
          t().ab.restored.replace('{c}', '2').replace('{s}', '1').replace('{h}', '3'),
        );
      });

      it('goes back to the box with the text, and asks for the second click again', async () => {
        button(modalBody()!.closest('.su-modal-panel')!, t().api.engine.restoreBack).click();
        await rerender();
        expect(review()).toBeNull();
        expect(modalBody()!.querySelector('textarea')!.value).toBe(JSON.stringify(FILE));
        expect(confirm()).toBeUndefined();
        check().click();
        await rerender();
        expect(review()).not.toBeNull();
        http.expectNone(RESTORE_URL);
      });

      it('cannot be dismissed while the restore is on its way', async () => {
        confirm().click();
        await settle();
        fixture.detectChanges();
        expect(document.querySelector('.su-modal-panel .su-x')).toBeNull();
        expect(confirm().disabled).toBe(true);
        confirm().click();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        await rerender();
        expect(modalBody()).not.toBeNull();
        expect(http.match(RESTORE_URL)).toHaveLength(1);
      });

      it('keeps the box and the text open with the API reason when the file is refused', async () => {
        confirm().click();
        await settle();
        http
          .expectOne(RESTORE_URL)
          .flush(
            { title: 'ไฟล์สำรองไม่สมบูรณ์ ชุดโพสต์ไม่ถูกต้อง' },
            { status: 400, statusText: 'Bad Request' },
          );
        await rerender();
        expect(modalBody()!.querySelector('.su-field-err')!.textContent).toContain(
          'ไฟล์สำรองไม่สมบูรณ์',
        );
        expect(review()).toBeNull();
        expect(modalBody()!.querySelector('textarea')!.value).toBe(JSON.stringify(FILE));
        expect(toasts()).toEqual([]);
        expect(check().disabled).toBe(false);
        // Nothing was replaced, so nothing was read again.
        http.expectNone(RESTORE_URL);
      });
    });

    it('closes on cancel and starts empty the next time', async () => {
      await openModal();
      await typeRestore('{"collections": []}');
      modalButton(t().common.cancel).click();
      await rerender();
      expect(modalBody()).toBeNull();
      await openModal();
      expect(modalBody()!.querySelector('textarea')!.value).toBe('');
      expect(review()).toBeNull();
    });

    it('starts at the first step again after closing from the confirmation', async () => {
      await openModal();
      await typeRestore(JSON.stringify(FILE));
      check().click();
      await rerender();
      expect(review()).not.toBeNull();
      document.querySelector<HTMLElement>('.su-modal-panel .su-x')!.click();
      await rerender();
      await openModal();
      expect(review()).toBeNull();
      expect(modalBody()!.querySelector('textarea')!.value).toBe('');
    });
  });

  describe('restore for someone who is not an admin', () => {
    it('keeps the button that opens the dialog off, and the dialog’s buttons too', async () => {
      await open({ role: 'editor' });
      expect(button(adv(), t().ab.restore).disabled).toBe(true);
      // Even if the dialog were opened some other way, nothing can be checked or sent.
      const advanced = fixture.debugElement.query(By.directive(AntibanAdvancedComponent));
      (advanced.componentInstance as { restoring: { set(v: boolean): void } }).restoring.set(true);
      await rerender();
      expect(modalButton(t().api.engine.restoreCheck).disabled).toBe(true);
      expect(modalButton(t().api.engine.restoreCheck).title).toBe(t().api.permAdmin);
      await typeRestore(JSON.stringify(BACKUP));
      modalButton(t().api.engine.restoreCheck).click();
      await rerender();
      expect(modalBody()!.querySelector('[data-testid=restore-review]')).toBeNull();
      http.expectNone(RESTORE_URL);
    });
  });
});
