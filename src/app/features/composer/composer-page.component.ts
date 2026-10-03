import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AccountsStore } from '../../core/data/accounts.store';
import { Draft, DraftStore, canTarget } from '../../core/data/draft.store';
import { INPUT_LIMITS } from '../../core/http/input-limits';
import { PermissionsService } from '../../core/data/permissions.service';
import { LibraryStore } from '../../core/data/library.store';
import { PlatformKey, SocialAccount, accountKind } from '../../core/data/models';
import { PostsStore } from '../../core/data/posts.store';
import { PLATFORMS } from '../../core/data/platforms';
import { SettingsStore } from '../../core/data/settings.store';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { CheckboxComponent } from '../../shared/components/checkbox/checkbox.component';
import { PermNoteComponent } from '../../shared/components/perm-note/perm-note.component';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';
import { SelectFieldComponent } from '../../shared/components/select-field/select-field.component';

interface Task {
  a: string;
  p: PlatformKey;
  t: string;
}

/** One task per selected account; accounts that post to groups get one per selected group. */
export function taskList(d: Draft, accounts: SocialAccount[]): Task[] {
  const out: Task[] = [];
  for (const a of accounts) {
    if (!d.targets[a.id] || !canTarget(a)) continue;
    if (a.groups.length)
      d.groups
        .filter((g) => a.groups.includes(g))
        .forEach((g) => out.push({ a: a.id, p: a.platform, t: g }));
    else out.push({ a: a.id, p: a.platform, t: a.defaultTarget });
  }
  return out;
}

/** The server queues repeats this many days ahead (Repeat.HorizonDays); nothing repeats beyond that. */
export const REPEAT_HORIZON_DAYS = 14;

/** How many days of the next REPEAT_HORIZON_DAYS the API schedules for a repeat (Occurrences in Posts.cs). */
export function occurrences(start: Date, repeat: Draft['repeat']): number {
  if (repeat === 'none') return 1;
  if (repeat === 'weekly') return REPEAT_HORIZON_DAYS / 7;
  let n = 0;
  for (let i = 0; i < REPEAT_HORIZON_DAYS; i++) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i).getDay();
    if (repeat === 'daily' || (day !== 0 && day !== 6)) n++;
  }
  return n;
}

/** Local wall-clock time with its UTC offset, so the server repeats on the user's weekdays. */
export function localIso(d: Date): string {
  const pad = (n: number) => String(Math.abs(n)).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:00` +
    `${sign}${pad(Math.trunc(off / 60))}:${pad(off % 60)}`
  );
}

@Component({
  selector: 'app-composer-page',
  imports: [
    RouterLink,
    CheckboxComponent,
    InputFieldComponent,
    PermNoteComponent,
    SelectFieldComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './composer-page.component.html',
  styleUrl: './composer-page.component.scss',
})
export class ComposerPageComponent {
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  private readonly posts = inject(PostsStore);
  private readonly accounts = inject(AccountsStore);
  private readonly library = inject(LibraryStore);
  private readonly settings = inject(SettingsStore);
  private readonly i18n = inject(I18nService);
  protected readonly store = inject(DraftStore);
  protected readonly perm = inject(PermissionsService);
  protected readonly limits = INPUT_LIMITS;
  protected readonly t = this.i18n.t;
  protected readonly d = this.store.draft;
  protected readonly groups = this.accounts.allGroups;
  protected readonly busy = signal(false);

  protected readonly snippetOptions = computed(() =>
    this.library.snippets().map((s) => ({ value: s.id, label: s.title })),
  );

  protected readonly mediaPick = computed(() =>
    this.library.media().map((m) => ({
      id: m.id,
      label: m.name,
      src: this.library.thumbs()[m.id] ?? null,
      icon: m.kind === 'video' ? 'ph-video' : 'ph-image',
      selected: this.d().media.includes(m.id),
    })),
  );

  protected readonly targetRows = computed(() => {
    const d = this.d();
    return this.accounts.list().map((a) => {
      const disabled = !canTarget(a);
      const checked = !!d.targets[a.id] && !disabled;
      return {
        id: a.id,
        icon: PLATFORMS[a.platform].icon,
        label: `${a.name} · ${a.handle}`,
        checked,
        disabled,
        groups: a.groups,
        demo: accountKind(a) === 'sample',
        unbound: accountKind(a) === 'unbound',
        showGroups: a.groups.length > 0 && checked,
        needsLogin: a.health === 'relogin' && accountKind(a) !== 'unbound',
        // A device's Facebook account posts to groups it has synced; with none there is nowhere to send.
        needsGroups: a.connected && a.health !== 'relogin' && !a.groups.length,
      };
    });
  });
  protected readonly groupsSel = computed(() =>
    fmt(this.t().cmp.groupsSel, { n: this.d().groups.length, m: this.groups().length }),
  );

  protected readonly repeatOptions = computed(() => {
    const c = this.t().cmp;
    return [
      { value: 'none', label: c.rNone },
      { value: 'daily', label: c.rDaily },
      { value: 'weekdays', label: c.rWeekdays },
      { value: 'weekly', label: c.rWeekly },
    ];
  });
  protected readonly useDelayLabel = computed(() => {
    const ab = this.settings.ab();
    return fmt(this.t().cmp.useDelay, { a: ab.min, b: ab.max });
  });

  /** The date and time picked, as a Date (NaN when incomplete). */
  private readonly start = computed(() => {
    const d = this.d();
    const [y, mo, da] = d.date.split('-').map(Number);
    const [hh, mm] = (d.time || '00:00').split(':').map(Number);
    return new Date(y, mo - 1, da, hh, mm);
  });

  /**
   * What scheduling will create: tasks per day, the span the smart delay spreads them over (or "all at the
   * start time" when it is off), and for a repeat the total over the days the API queues ahead.
   */
  protected readonly summary = computed(() => {
    const d = this.d();
    const t = this.t();
    const tasks = taskList(d, this.accounts.list());
    if (!tasks.length) return t.cmp.summaryEmpty;
    const ab = this.settings.ab();
    const [h, m] = (d.time || '00:00').split(':').map(Number);
    const spread = d.useDelay ? (Math.max(0, tasks.length - 1) * (ab.min + ab.max)) / 2 : 0;
    const endMin = h * 60 + m + spread;
    const t2 = `${String(Math.floor(endMin / 60) % 24).padStart(2, '0')}:${String(Math.round(endMin % 60)).padStart(2, '0')}`;
    const platforms = new Set(tasks.map((x) => x.p)).size;
    const delay = d.useDelay ? t.api.sumRandom : t.api.sumSame;
    const days = occurrences(this.start(), d.repeat);
    if (days <= 1 && d.repeat === 'none')
      return fmt(t.cmp.summary, { n: tasks.length, p: platforms, t1: d.time, t2 }) + delay;
    return (
      fmt(t.api.sumRepeat, {
        total: tasks.length * days,
        n: tasks.length,
        days,
        p: platforms,
        t1: d.time,
        t2,
      }) + delay
    );
  });

  /** Repeats are queued REPEAT_HORIZON_DAYS ahead, not forever: said under the repeat choice. */
  protected readonly repeatNote = computed(() =>
    this.d().repeat === 'none' ? '' : fmt(this.t().api.repeatNote, { n: REPEAT_HORIZON_DAYS }),
  );

  protected setText(v: string): void {
    this.store.patch({ text: v, errText: '' });
  }

  protected insertSnippet(id: string): void {
    const s = this.library.snippets().find((x) => x.id === id);
    if (s) this.store.appendText(s.text);
  }

  protected toggleMedia(id: string): void {
    const media = this.d().media;
    if (!media.includes(id) && media.length >= INPUT_LIMITS.postMedia) {
      this.notify.error(fmt(this.t().api.mediaMax, { n: INPUT_LIMITS.postMedia }));
      return;
    }
    this.store.patch({
      media: media.includes(id) ? media.filter((x) => x !== id) : [...media, id],
    });
  }

  protected setTarget(id: string, on: boolean): void {
    this.store.patch({
      targets: { ...this.d().targets, [id]: on },
      autoTargets: false,
      errTargets: '',
    });
  }

  protected toggleGroup(g: string): void {
    const groups = this.d().groups;
    this.store.patch({
      groups: groups.includes(g) ? groups.filter((x) => x !== g) : [...groups, g],
      autoTargets: false,
    });
  }

  protected selectAllGroups(): void {
    this.store.patch({ groups: [...this.groups()], autoTargets: false });
  }

  protected clearGroups(): void {
    this.store.patch({ groups: [], autoTargets: false });
  }

  protected setRepeat(v: string): void {
    this.store.patch({ repeat: v as Draft['repeat'] });
  }

  protected saveDraft(): void {
    this.notify.info(this.t().cmp.toastDraft);
  }

  /** Validates, then asks the server to queue one task per target, spaced by the smart delay. */
  protected async submit(): Promise<void> {
    if (this.busy() || !this.perm.canEdit()) return;
    const t = this.t().cmp;
    const d = this.d();
    const start = this.start();
    const tasks = taskList(d, this.accounts.list());
    const errs = {
      errText: d.text.trim() ? '' : t.errText,
      errTargets: tasks.length ? '' : t.errTargets,
      errTime: isNaN(start.getTime()) || start <= new Date() ? t.errTime : '',
    };
    if (errs.errText || errs.errTargets || errs.errTime) {
      this.store.patch(errs);
      return;
    }
    const byAccount = new Map<string, string[]>();
    for (const tk of tasks) byAccount.set(tk.a, [...(byAccount.get(tk.a) ?? []), tk.t]);
    this.busy.set(true);
    try {
      const created = await this.posts.schedule({
        content: d.text.trim(),
        mediaIds: d.media,
        startAt: localIso(start),
        useDelay: d.useDelay,
        repeat: d.repeat,
        targets: [...byAccount.keys()].map((accountId) => {
          const a = this.accounts.byId(accountId);
          return { accountId, groups: a?.groups.length ? byAccount.get(accountId)! : null };
        }),
      });
      if (d.replaces) await this.posts.remove(d.replaces).catch(() => undefined);
      this.store.reset();
      this.notify.success(fmt(t.toastDone, { n: created }));
      void this.router.navigate(['/app/calendar'], { queryParams: { day: d.date } });
    } finally {
      this.busy.set(false);
    }
  }
}
