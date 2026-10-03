import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AccountsStore } from '../../core/data/accounts.store';
import { Draft, DraftStore } from '../../core/data/draft.store';
import { LibraryStore } from '../../core/data/library.store';
import { PlatformKey, SocialAccount } from '../../core/data/models';
import { PostsStore } from '../../core/data/posts.store';
import { SEED } from '../../core/data/seed.data';
import { SettingsStore } from '../../core/data/settings.store';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { CheckboxComponent } from '../../shared/components/checkbox/checkbox.component';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';
import { SelectFieldComponent } from '../../shared/components/select-field/select-field.component';

interface Task {
  a: string;
  p: PlatformKey;
  t: string;
}

/** One task per selected account; accounts that post to groups get one per selected group. */
function taskList(d: Draft, accounts: SocialAccount[]): Task[] {
  const out: Task[] = [];
  for (const a of accounts) {
    if (!d.targets[a.id] || a.health === 'relogin') continue;
    if (a.groups.length)
      d.groups
        .filter((g) => a.groups.includes(g))
        .forEach((g) => out.push({ a: a.id, p: a.platform, t: g }));
    else out.push({ a: a.id, p: a.platform, t: a.defaultTarget });
  }
  return out;
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
  imports: [RouterLink, CheckboxComponent, InputFieldComponent, SelectFieldComponent],
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
      const disabled = a.health === 'relogin';
      const checked = !!d.targets[a.id] && !disabled;
      return {
        id: a.id,
        icon: SEED.platforms[a.platform].icon,
        label: `${a.name} · ${a.handle}`,
        checked,
        disabled,
        groups: a.groups,
        demo: !a.connected,
        showGroups: a.groups.length > 0 && checked,
        needsLogin: disabled,
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

  /** "Creates N tasks across P platforms between HH:MM–HH:MM". */
  protected readonly summary = computed(() => {
    const d = this.d();
    const tasks = taskList(d, this.accounts.list());
    if (!tasks.length) return this.t().cmp.summaryEmpty;
    const ab = this.settings.ab();
    const [h, m] = (d.time || '00:00').split(':').map(Number);
    const endMin = h * 60 + m + (Math.max(0, tasks.length - 1) * (ab.min + ab.max)) / 2;
    const t2 = `${String(Math.floor(endMin / 60) % 24).padStart(2, '0')}:${String(Math.round(endMin % 60)).padStart(2, '0')}`;
    return fmt(this.t().cmp.summary, {
      n: tasks.length,
      p: new Set(tasks.map((x) => x.p)).size,
      t1: d.time,
      t2,
    });
  });

  protected setText(v: string): void {
    this.store.patch({ text: v, errText: '' });
  }

  protected insertSnippet(id: string): void {
    const s = this.library.snippets().find((x) => x.id === id);
    if (s) this.store.appendText(s.text);
  }

  protected toggleMedia(id: string): void {
    const media = this.d().media;
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
    if (this.busy()) return;
    const t = this.t().cmp;
    const d = this.d();
    const [y, mo, da] = d.date.split('-').map(Number);
    const [hh, mm] = (d.time || '00:00').split(':').map(Number);
    const start = new Date(y, mo - 1, da, hh, mm);
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
