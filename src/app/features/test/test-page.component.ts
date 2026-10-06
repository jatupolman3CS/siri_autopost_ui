import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PermissionsService } from '../../core/data/permissions.service';
import { STATUS_DOT } from '../../core/data/models';
import {
  DeviceState,
  TestLogEntry,
  TestLogKind,
  TestPanel,
  TestPostStore,
} from '../../core/data/test-post.store';
import { dkey, fmtDate, hm } from '../../core/i18n/format';
import '../../core/i18n/i18n.engine';
import { Dict, I18nService, fmt } from '../../core/i18n/i18n.service';
import { PermNoteComponent } from '../../shared/components/perm-note/perm-note.component';
import { SelectFieldComponent } from '../../shared/components/select-field/select-field.component';
import { Pager } from '../../shared/components/pager/pager';
import { PagerComponent } from '../../shared/components/pager/pager.component';
import { TestManualFormComponent } from './test-manual-form.component';
import { TestSetFormComponent } from './test-set-form.component';

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

/** The dot beside an extension: ready, taking no jobs, offline. */
const DEVICE_DOT: Record<DeviceState, string> = {
  online: 'var(--color-success)',
  paused: 'var(--color-warning)',
  offline: 'var(--color-danger)',
};

// One real post to a group or page, now, through the extension the person picks. Two ways to make it (a segmented
// choice): "from a collection" (the set / group / collection / post form) and "by hand" (a link, a text and library
// images typed in), which share the extension picker above them and the log and history beside them. The page only
// picks and shows: TestPostStore sends it and follows the post (events plus a 3 s poll), so the log is what the
// extension really reported, never a simulation.
@Component({
  selector: 'app-test-page',
  imports: [
    PagerComponent,
    PermNoteComponent,
    RouterLink,
    SelectFieldComponent,
    TestManualFormComponent,
    TestSetFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './test-page.component.html',
  styleUrl: './test-page.component.scss',
})
export class TestPageComponent {
  private readonly i18n = inject(I18nService);
  protected readonly perm = inject(PermissionsService);
  protected readonly store = inject(TestPostStore);
  protected readonly t = this.i18n.t;

  protected readonly panels = computed<{ key: TestPanel; label: string }[]>(() => {
    const a = this.t().api.engine;
    return [
      { key: 'set', label: a.testPanelSet },
      { key: 'manual', label: a.testPanelManual },
    ];
  });

  /** Pause the extension choice while the post is being sent. */
  protected readonly canPick = computed(() => this.perm.canEdit() && !this.store.running());

  private stateLabel(s: DeviceState): string {
    const a = this.t().api.engine;
    return s === 'online'
      ? a.testDeviceOnline
      : s === 'offline'
        ? a.testDeviceOffline
        : a.testDevicePaused;
  }

  /** Every extension as the picker lists it: its name and how it is doing (a <select> cannot show a coloured dot). */
  protected readonly deviceOptions = computed(() => {
    const states = this.store.deviceStates();
    return this.store.deviceList().map((d) => ({
      value: d.id,
      label: `${d.name} · ${this.stateLabel(states.get(d.id) ?? 'offline')}`,
    }));
  });
  /** The chosen extension, with the dot and state shown under the picker (or in place of it when there is one). */
  protected readonly chosen = computed(() => {
    const d = this.store.device();
    if (!d) return null;
    const state = this.store.deviceStates().get(d.id) ?? 'offline';
    return { name: d.name, dot: DEVICE_DOT[state], state: this.stateLabel(state) };
  });
  /** With one extension it is shown as plain text; with several, as a picker. */
  protected readonly several = computed(() => this.store.deviceList().length > 1);

  /** The card above the form: no extension at all, none online, or the chosen one is offline. */
  protected readonly banner = computed(() => {
    const block = this.store.block();
    const a = this.t().api.engine;
    return block === 'offline'
      ? this.t().test.needOnline
      : block === 'noDevice'
        ? a.testNoDevice
        : block === 'deviceDown'
          ? fmt(a.testDeviceDown, { d: this.store.device()?.name ?? '' })
          : '';
  });
  protected readonly noDevice = computed(() => this.store.block() === 'noDevice');

  /** One line of the log: when, an icon, what happened and (for a failure) what the extension reported. */
  protected readonly logRows = computed(() => {
    const t = this.t();
    return this.store.log().map((e) => this.logRow(e, t));
  });

  protected readonly logPager = new Pager(20);
  protected readonly logPage = computed(() => this.logPager.slice(this.logRows()));
  protected readonly historyPager = new Pager(20);
  protected readonly historyPage = computed(() => this.historyPager.slice(this.historyRows()));

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
