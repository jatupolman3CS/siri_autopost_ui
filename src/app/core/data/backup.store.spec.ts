import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { WS, provideApiTesting, settle, signIn } from '../../testing/api-testing';
import { apiLinkSet } from '../../testing/link-sets.fixtures';
import { BACKUP, BACKUP_URL, RESTORE_URL, antiBan } from '../../testing/test-post.fixtures';
import { I18nService } from '../i18n/i18n.service';
import '../i18n/i18n.engine';
import { NotificationService } from '../services/notification.service';
import { BackupStore } from './backup.store';
import { CollectionsStore } from './collections.store';
import { LinkSetsStore } from './link-sets.store';
import { SettingsStore } from './settings.store';

describe('BackupStore', () => {
  let http: HttpTestingController;
  let store: BackupStore;
  let created: Blob[];
  let clicks: string[];
  const t = () => TestBed.inject(I18nService).t();
  const toasts = () => TestBed.inject(NotificationService).toasts();

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
    http = provideApiTesting();
    store = TestBed.inject(BackupStore);
    await signIn(http, { collections: [], linkSets: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    http.verify();
  });

  describe('download', () => {
    it('reads the backup and saves it as autopost-backup.json, then says so', async () => {
      const saving = store.download();
      expect(store.busy()).toBe(true);
      http.expectOne(BACKUP_URL).flush(BACKUP);
      expect(await saving).toBe(true);
      expect(clicks).toEqual(['autopost-backup.json']);
      expect(JSON.parse(await created[0].text())).toEqual(BACKUP);
      expect(created[0].type).toBe('application/json');
      expect(toasts().map((x) => x.message)).toEqual([t().ab.backedUp]);
      expect(store.busy()).toBe(false);
    });

    it('saves nothing and says nothing when the API refuses (the interceptor has said why)', async () => {
      const saving = store.download();
      http
        .expectOne(BACKUP_URL)
        .flush({ title: 'ต้องใช้แผน Pro' }, { status: 403, statusText: 'Forbidden' });
      expect(await saving).toBe(false);
      expect(clicks).toEqual([]);
      expect(toasts().some((x) => x.message === t().ab.backedUp)).toBe(false);
      expect(store.busy()).toBe(false);
    });

    it('says so when the browser will not download', async () => {
      (URL.createObjectURL as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('no');
      });
      const saving = store.download();
      http.expectOne(BACKUP_URL).flush(BACKUP);
      expect(await saving).toBe(false);
      expect(toasts().map((x) => x.message)).toEqual([t().api.engine.backupFailed]);
    });

    it('does not start a second backup while one is on its way', async () => {
      const first = store.download();
      expect(await store.download()).toBe(false);
      http.expectOne(BACKUP_URL).flush(BACKUP);
      await first;
    });
  });

  describe('restore', () => {
    it('sends the file, toasts the counts and reads again what it replaced', async () => {
      const restoring = store.restore(BACKUP);
      const req = http.expectOne(RESTORE_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(BACKUP);
      req.flush({ collections: 2, linkSets: 1, schedules: 3 });
      // The answer does not wait for the lists.
      const result = await restoring;
      await settle();
      // Collections and link sets, the queued posts of the re-made schedules, and the advanced rules.
      http.expectOne(`/api/workspaces/${WS}/collections`).flush([]);
      http.expectOne(`/api/workspaces/${WS}/link-sets`).flush([apiLinkSet({ id: 'restored' })]);
      for (const r of http.match((x) => x.url === `/api/workspaces/${WS}/posts`)) r.flush([]);
      http.expectOne(`/api/workspaces/${WS}/errors`).flush([]);
      http.expectOne(`/api/workspaces/${WS}/engine`).flush({
        antiBan: antiBan({ advanced: { ...antiBan().advanced, minGap: 9 } }),
        offline: { policy: 'queue', window: '2h', line: true, email: true, push: false },
        extensionOnline: true,
        simulatedOffline: false,
        devices: 0,
        devicesOnline: 0,
      });
      await settle();
      expect(result).toEqual({ collections: 2, linkSets: 1, schedules: 3 });
      expect(toasts().map((x) => x.message)).toContain(
        t().ab.restored.replace('{c}', '2').replace('{s}', '1').replace('{h}', '3'),
      );
      expect(
        TestBed.inject(LinkSetsStore)
          .sets()
          .map((s) => s.id),
      ).toEqual(['restored']);
      expect(TestBed.inject(CollectionsStore).collections()).toEqual([]);
      expect(TestBed.inject(SettingsStore).ab().advanced.minGap).toBe(9);
    });

    it('rejects with the API refusal and changes nothing', async () => {
      const restoring = store.restore(BACKUP);
      const assertion = expect(restoring).rejects.toMatchObject({ status: 400 });
      http
        .expectOne(RESTORE_URL)
        .flush({ title: 'ไฟล์สำรองไม่สมบูรณ์' }, { status: 400, statusText: 'Bad Request' });
      await assertion;
      await settle();
      // No re-read, no toast: nothing changed.
      http.expectNone(`/api/workspaces/${WS}/collections`);
      expect(toasts()).toEqual([]);
      expect(store.busy()).toBe(false);
    });
  });
});
