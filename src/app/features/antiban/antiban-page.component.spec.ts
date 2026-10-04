import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { assistStorage } from '../../core/auth/token';
import { SettingsStore, defaultAdvanced } from '../../core/data/settings.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { ApiRole } from '../../core/http/api.service';
import '../../core/i18n/i18n.engine';
import { I18nService } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { answerWorkspaceLoads, provideApiTesting, settle, signIn } from '../../testing/api-testing';
import {
  ANTI_BAN_URL,
  BACKUP,
  BACKUP_URL,
  POSTS_URL,
  RESTORE_URL,
  antiBan,
  flushBackground,
} from '../../testing/test-post.fixtures';
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
  const enter = async (input: HTMLInputElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('change'));
    await rerender();
  };
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

    it('turns the focus window off and says it is only saved', async () => {
      adv().querySelector<HTMLInputElement>('app-checkbox input')!.click();
      await rerender();
      expect(settings().ab().advanced.focus).toBe(false);
      expect([...adv().querySelectorAll('.stored')].map((p) => p.textContent)).toContain(
        t().api.engine.storedOnly,
      );
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
    it('lets an admin change all five; only the shuffle says it is saved without effect', async () => {
      await open({ role: 'admin' });
      const boxes = [...el.querySelectorAll<HTMLInputElement>('.human input[type=checkbox]')];
      expect(boxes).toHaveLength(5);
      expect(boxes.map((b) => b.disabled)).toEqual([false, false, false, false, false]);
      const notes = [...el.querySelectorAll('.human .not-yet')].map((n) => n.textContent);
      expect(notes).toEqual([t().api.engine.storedOnly]);
      // The note sits under the shuffle (third) row.
      expect(el.querySelectorAll('.human > div')[2].querySelector('.not-yet')).not.toBeNull();
      expect(el.textContent).not.toContain(t().api.notYet);
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

    it('opens a dialog with the hint, a box for the file and the two buttons', async () => {
      expect(modalBody()).toBeNull();
      await openModal();
      expect(document.querySelector('.su-modal-title')!.textContent).toBe(t().ab.restoreTitle);
      expect(modalBody()!.textContent).toContain(t().ab.restoreHint);
      expect(modalBody()!.querySelector('textarea')!.value).toBe('');
      expect(modalButton(t().common.cancel)).toBeTruthy();
      expect(modalButton(t().ab.restore)).toBeTruthy();
    });

    it('refuses a text that is not a JSON object without asking the API', async () => {
      await openModal();
      for (const text of ['', 'not json', '[1, 2]', '42', 'null']) {
        await typeRestore(text);
        modalButton(t().ab.restore).click();
        await rerender();
        expect(modalBody()!.querySelector('.su-field-err')!.textContent).toBe(t().ab.restoreErr);
      }
      http.expectNone(RESTORE_URL);
    });

    it('sends the file, closes, says what was restored and reads the replaced data again', async () => {
      await openModal();
      await typeRestore(JSON.stringify(BACKUP));
      modalButton(t().ab.restore).click();
      await settle();
      const req = http.expectOne(RESTORE_URL);
      expect(req.request.body).toEqual(BACKUP);
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

    it('keeps the dialog and the text open with the API reason when the file is refused', async () => {
      await openModal();
      const text = JSON.stringify({ collections: [] });
      await typeRestore(text);
      modalButton(t().ab.restore).click();
      await settle();
      http
        .expectOne(RESTORE_URL)
        .flush(
          { title: 'ไฟล์สำรองไม่สมบูรณ์ ต้องมีชุดโพสต์ ชุดลิงก์ และตารางโพสต์' },
          { status: 400, statusText: 'Bad Request' },
        );
      await rerender();
      expect(modalBody()!.querySelector('.su-field-err')!.textContent).toContain(
        'ไฟล์สำรองไม่สมบูรณ์',
      );
      expect(modalBody()!.querySelector('textarea')!.value).toBe(text);
      expect(toasts()).toEqual([]);
      expect(modalButton(t().ab.restore).disabled).toBe(false);
    });

    it('closes on cancel and starts empty the next time', async () => {
      await openModal();
      await typeRestore('{"collections": []}');
      modalButton(t().common.cancel).click();
      await rerender();
      expect(modalBody()).toBeNull();
      await openModal();
      expect(modalBody()!.querySelector('textarea')!.value).toBe('');
    });
  });
});
