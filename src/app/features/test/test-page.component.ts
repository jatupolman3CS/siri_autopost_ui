import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CollectionsStore } from '../../core/data/collections.store';
import { LinkSetsStore } from '../../core/data/link-sets.store';
import { STATUS_DOT } from '../../core/data/models';
import { PermissionsService } from '../../core/data/permissions.service';
import { TestLogEntry, TestLogKind, TestPostStore } from '../../core/data/test-post.store';
import { INPUT_LIMITS } from '../../core/http/input-limits';
import { dkey, fmtDate, hm } from '../../core/i18n/format';
import '../../core/i18n/i18n.engine';
import { Dict, I18nService, fmt } from '../../core/i18n/i18n.service';
import { PermNoteComponent } from '../../shared/components/perm-note/perm-note.component';
import { SelectFieldComponent } from '../../shared/components/select-field/select-field.component';

/** Icon and colour of every state the log can show. */
const LOG_LOOK: Record<TestLogKind, { icon: string; color: string }> = {
  queued: { icon: 'ph-clock', color: 'var(--color-text-muted)' },
  waiting: { icon: 'ph-wifi-slash', color: 'var(--color-warning)' },
  posting: { icon: 'ph-paper-plane-right', color: 'var(--color-primary)' },
  success: { icon: 'ph-check-circle', color: 'var(--color-success)' },
  pending: { icon: 'ph-hourglass-medium', color: 'var(--color-warning)' },
  failed: { icon: 'ph-x-circle', color: 'var(--color-danger)' },
  skipped: { icon: 'ph-skip-forward', color: 'var(--color-text-muted)' },
  late: { icon: 'ph-hourglass', color: 'var(--color-text-muted)' },
};

// One real post to a chosen group, now. The page only picks and shows: TestPostStore sends it and follows the
// post (events plus a 3 s poll), so the log is what the extension really reported, never a simulation.
@Component({
  selector: 'app-test-page',
  imports: [PermNoteComponent, SelectFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './test-page.component.html',
  styleUrl: './test-page.component.scss',
})
export class TestPageComponent {
  private readonly i18n = inject(I18nService);
  private readonly linkSets = inject(LinkSetsStore);
  private readonly collections = inject(CollectionsStore);
  protected readonly perm = inject(PermissionsService);
  protected readonly store = inject(TestPostStore);
  protected readonly t = this.i18n.t;
  protected readonly maxText = INPUT_LIMITS.postText;

  /** The sets and collections have arrived (until then the preview says "—"). */
  protected readonly loaded = computed(() => this.linkSets.loaded() && this.collections.loaded());
  /** Pause the choices while the post is being sent. */
  protected readonly canPick = computed(() => this.perm.canEdit() && !this.store.running());

  protected readonly setOptions = computed(() =>
    this.linkSets.sets().map((s) => ({ value: s.id, label: s.name })),
  );
  protected readonly groupOptions = computed(() =>
    this.store.members().map((m) => ({ value: m.key, label: m.label })),
  );
  protected readonly colOptions = computed(() =>
    this.collections.collections().map((c) => ({ value: c.id, label: c.name })),
  );
  /** "Random from the collection (n posts)", then every post the test may use, numbered as in the design. */
  protected readonly postOptions = computed(() => {
    const posts = this.store.usablePosts();
    return [
      { value: '', label: fmt(this.t().test.random, { n: posts.length }) },
      ...posts.map((p, i) => ({ value: p.id, label: `${i + 1}. ${p.text.slice(0, 40)}` })),
    ];
  });

  protected readonly preview = computed(() =>
    !this.loaded() ? '—' : this.store.composed() || this.t().test.needPick,
  );
  protected readonly filesLabel = computed(() => {
    const t = this.t().test;
    const n = this.store.files();
    return n ? fmt(t.filesN, { n }) : t.noFiles;
  });

  /** The card above the form: no browser is online, or none has a Facebook account yet. */
  protected readonly banner = computed(() => {
    const block = this.store.block();
    return block === 'offline'
      ? this.t().test.needOnline
      : block === 'noAccount'
        ? this.t().api.engine.testNoAccount
        : '';
  });
  /** Under the form, beside the run button: why it is off, or what the API refused. */
  protected readonly error = computed(() => {
    if (this.store.running()) return '';
    if (this.store.runError()) return this.store.runError();
    if (!this.loaded()) return '';
    const block = this.store.block();
    return block === 'needPick'
      ? this.t().test.needPick
      : block === 'noPosts'
        ? this.t().test.noPosts
        : '';
  });
  protected readonly canRun = computed(
    () =>
      this.perm.canEdit() && this.loaded() && !this.store.running() && this.store.block() === '',
  );
  protected readonly runLabel = computed(() => {
    const t = this.t().test;
    return this.store.running() ? t.running : this.store.log().length ? t.again : t.run;
  });

  /** One line of the log: when, an icon, what happened and (for a failure) what the extension reported. */
  protected readonly logRows = computed(() => {
    const t = this.t();
    return this.store.log().map((e) => this.logRow(e, t));
  });

  protected readonly historyRows = computed(() => {
    const t = this.t();
    const li = this.i18n.li();
    const today = dkey(new Date());
    return this.store.history().map((p) => ({
      id: p.id,
      time: dkey(p.dt) === today ? hm(p.dt) : `${fmtDate(p.dt, li)} ${hm(p.dt)}`,
      text: `${p.target} · ${p.text}`,
      dot: STATUS_DOT[p.status],
      status: t.status[p.status],
    }));
  });

  protected onText(e: Event): void {
    this.store.text.set((e.target as HTMLTextAreaElement).value);
  }

  private logRow(e: TestLogEntry, t: Dict) {
    const a = t.api.engine;
    const look = LOG_LOOK[e.kind];
    const reason = e.code ? t.reasons[e.code] : null;
    const text = {
      queued: a.testQueued,
      waiting: a.testWaiting,
      posting: a.testPosting,
      success: a.testSuccess,
      pending: a.testPending,
      failed: a.testFailed,
      skipped: a.testSkipped,
      late: a.testStillWaiting,
    }[e.kind];
    return {
      key: `${e.kind}-${e.at.getTime()}`,
      icon: look.icon,
      color: look.color,
      time: hm(e.at),
      text: e.kind === 'failed' && reason ? `${text} · ${reason.title}` : text,
      // The extension's own words say more than the generic reason (the errors page does the same).
      detail:
        e.kind === 'failed' ? e.detail || reason?.body || '' : e.kind === 'skipped' ? e.detail : '',
    };
  }
}
