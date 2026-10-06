import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountsStore } from '../../core/data/accounts.store';
import {
  AntiBanSettings,
  SettingsStore,
  TYPING_SPEEDS,
  TypingSpeed,
} from '../../core/data/settings.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { PostsStore } from '../../core/data/posts.store';
import { PLATFORMS } from '../../core/data/platforms';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { INPUT_LIMITS } from '../../core/http/input-limits';
import { hm } from '../../core/i18n/format';
import { I18nService } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { CheckboxComponent } from '../../shared/components/checkbox/checkbox.component';
import { PermNoteComponent } from '../../shared/components/perm-note/perm-note.component';
import { SelectFieldComponent } from '../../shared/components/select-field/select-field.component';
import { AntibanAdvancedComponent } from './antiban-advanced.component';
import { AntibanLockComponent } from './antiban-lock.component';
import '../../core/i18n/i18n.engine';

type HumanKey = 'typing' | 'scroll' | 'shuffle' | 'autopause' | 'warmup';

/** The API's range for the Facebook daily limit (AntiBanSettings.MaxDailyLimit). */
const MAX_LIMIT = INPUT_LIMITS.platformDailyLimit;

@Component({
  selector: 'app-antiban-page',
  imports: [
    CheckboxComponent,
    PermNoteComponent,
    RouterLink,
    SelectFieldComponent,
    AntibanAdvancedComponent,
    AntibanLockComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './antiban-page.component.html',
  styleUrl: './antiban-page.component.scss',
})
export class AntibanPageComponent {
  private readonly notify = inject(NotificationService);
  private readonly posts = inject(PostsStore);
  private readonly workspaces = inject(WorkspaceStore);
  private readonly accounts = inject(AccountsStore);
  protected readonly perm = inject(PermissionsService);
  private readonly i18n = inject(I18nService);
  protected readonly settings = inject(SettingsStore);
  protected readonly t = this.i18n.t;
  protected readonly ab = this.settings.ab;
  protected readonly maxLimit = MAX_LIMIT;

  /** Advanced anti-ban needs the owner's plan to be Pro or above (the API says so on the workspace). */
  protected readonly locked = computed(
    () => this.workspaces.loaded() && !this.workspaces.current()?.advancedAntiBan,
  );
  /** Admins change the settings, once they have loaded. */
  protected readonly editable = computed(() => this.perm.canAdmin() && this.settings.loaded());

  protected readonly risk = computed(() => {
    const ab = this.ab();
    const t = this.t().ab;
    // What is really applied counts: the delay, the Facebook limit, typing, scrolling, the automatic pause, and
    // (as in the design) whether the plan has the advanced rules at all. Shuffle and warm-up are not in it.
    const score =
      (ab.min < 2 ? 2 : ab.min < 3 ? 1 : 0) +
      (ab.limits.fb > 40 ? 1 : 0) +
      (ab.typing ? 0 : 1) +
      (ab.scroll ? 0 : 1) +
      (ab.autopause ? 0 : 1) +
      (this.locked() ? 1 : 0);
    return score <= 1
      ? { label: t.riskLow, color: 'var(--color-success)' }
      : score <= 3
        ? { label: t.riskMed, color: 'var(--color-warning)' }
        : { label: t.riskHigh, color: 'var(--color-danger)' };
  });

  /**
   * When the next 5 queued posts of the accounts a browser posts for go out: at their time, or later when the
   * account's last post is closer than the minimum delay (the API holds it back). Sample accounts never post.
   */
  protected readonly dispatch = computed(() => {
    const ab = this.ab();
    const now = this.posts.now();
    const connected = new Set(
      this.accounts
        .list()
        .filter((a) => a.connected)
        .map((a) => a.id),
    );
    const last = new Map<string, number>();
    for (const p of this.posts.posts())
      if (p.publishedAt && connected.has(p.accountId))
        last.set(p.accountId, Math.max(last.get(p.accountId) ?? 0, p.publishedAt.getTime()));
    return this.posts
      .items()
      .filter((p) => p.status === 'queued' && p.dt > now && connected.has(p.accountId))
      .sort((a, b) => a.dt.getTime() - b.dt.getTime())
      .slice(0, 5)
      .map((p) => {
        const earliest = (last.get(p.accountId) ?? 0) + ab.min * 60000;
        const at = Math.max(p.dt.getTime(), earliest);
        last.set(p.accountId, at);
        const late = Math.round((at - p.dt.getTime()) / 60000);
        return {
          time: hm(new Date(at)),
          icon: PLATFORMS.fb.icon,
          target: `${PLATFORMS.fb.name} · ${p.target}`,
          wait: late > 0 ? `+${late} ${this.t().common.min}` : '',
        };
      });
  });

  /** The one daily limit: Facebook posts in the last 24 hours against what the workspace allows. */
  protected readonly limit = computed(() => {
    const limit = this.ab().limits.fb;
    const used = this.settings.used24h();
    const ready = this.posts.loaded() && this.accounts.loaded();
    const r = used / limit;
    return {
      icon: PLATFORMS.fb.icon,
      name: PLATFORMS.fb.name,
      limit,
      usedLabel: `${this.t().ab.usedToday} ${ready ? used : '—'}/${limit}`,
      pct: ready ? Math.min(100, Math.round(r * 100)) : 0,
      color: r >= 0.8 ? 'var(--color-warning)' : 'var(--color-primary)',
    };
  });

  protected readonly humanRows = computed(() => {
    const t = this.t().ab;
    const ab = this.ab();
    const rows: [HumanKey, string][] = [
      ['typing', t.hTyping],
      ['scroll', t.hScroll],
      ['shuffle', t.hShuffle],
      ['autopause', t.hPause],
      ['warmup', t.hWarm],
    ];
    return rows.map(([k, label]) => ({ k, label, on: ab[k] }));
  });

  protected readonly speedOptions = computed(() => {
    const a = this.t().api.engine;
    const labels: Record<TypingSpeed, string> = {
      slow: a.abSpeedSlow,
      normal: a.abSpeedNormal,
      fast: a.abSpeedFast,
    };
    return TYPING_SPEEDS.map((value) => ({ value, label: labels[value] }));
  });

  protected setMin(v: string): void {
    const min = parseInt(v, 10);
    this.settings.patchAb({ min, max: Math.max(min + 1, this.ab().max) });
  }

  protected setMax(v: string): void {
    const max = parseInt(v, 10);
    this.settings.patchAb({ max, min: Math.min(max - 1, this.ab().min) });
  }

  /** Keeps the number the API accepts and shows it (also when the typed one was out of range). */
  protected setLimit(input: HTMLInputElement): void {
    const fb = Math.min(MAX_LIMIT, Math.max(1, parseInt(input.value, 10) || 1));
    input.value = String(fb);
    this.settings.patchAb({ limits: { fb } });
  }

  protected setSpeed(v: string): void {
    const speed = TYPING_SPEEDS.find((s) => s === v);
    if (speed) this.settings.patchAb({ typingSpeed: speed });
  }

  protected setHuman(k: HumanKey, on: boolean): void {
    this.settings.patchAb({ [k]: on } as Partial<AntiBanSettings>);
  }

  protected readonly saving = signal(false);

  protected async save(): Promise<void> {
    if (!this.editable()) return;
    this.saving.set(true);
    try {
      await this.settings.saveAb();
      this.notify.success(this.t().ab.saved);
    } finally {
      this.saving.set(false);
    }
  }
}
