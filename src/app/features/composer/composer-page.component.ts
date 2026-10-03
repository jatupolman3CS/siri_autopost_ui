import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Draft, DraftStore } from '../../core/data/draft.store';
import { LibraryStore } from '../../core/data/library.store';
import { PlatformKey, PostItem } from '../../core/data/models';
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
  t: readonly [string, string];
}

/** One task per selected account; accounts that post to groups get one per selected group. */
function taskList(d: Draft): Task[] {
  const out: Task[] = [];
  for (const a of SEED.accounts) {
    if (!d.targets[a.id]) continue;
    if (a.hasGroups) d.groups.forEach((g) => out.push({ a: a.id, p: a.platform, t: [g, g] }));
    else {
      const tg = SEED.targets.find((x) => x.a === a.id);
      out.push({ a: a.id, p: a.platform, t: tg ? tg.t : ['', ''] });
    }
  }
  return out;
}

@Component({
  selector: 'app-composer-page',
  imports: [CheckboxComponent, InputFieldComponent, SelectFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './composer-page.component.html',
  styleUrl: './composer-page.component.scss',
})
export class ComposerPageComponent {
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  private readonly posts = inject(PostsStore);
  private readonly library = inject(LibraryStore);
  private readonly settings = inject(SettingsStore);
  private readonly i18n = inject(I18nService);
  protected readonly store = inject(DraftStore);
  protected readonly t = this.i18n.t;
  protected readonly d = this.store.draft;
  protected readonly groups = SEED.groups;

  protected readonly snippetOptions = computed(() =>
    this.library.snippets().map((s) => ({ value: s.id, label: s.title[this.i18n.li()] })),
  );

  protected readonly mediaPick = computed(() =>
    this.library.media().map((m) => ({
      id: m.id,
      label: m.label[this.i18n.li()],
      icon: m.kind === 'video' ? 'ph-video' : 'ph-image',
      selected: this.d().media.includes(m.id),
    })),
  );

  protected readonly targetRows = computed(() => {
    const li = this.i18n.li();
    const d = this.d();
    return SEED.accounts.map((a) => {
      const checked = !!d.targets[a.id];
      const disabled = this.posts.health(a.id) === 'relogin';
      return {
        id: a.id,
        icon: SEED.platforms[a.platform].icon,
        label: `${a.name} · ${a.handle[li]}`,
        checked,
        disabled,
        showGroups: !!a.hasGroups && checked,
        needsLogin: disabled,
      };
    });
  });
  protected readonly groupsSel = computed(() =>
    fmt(this.t().cmp.groupsSel, { n: this.d().groups.length, m: SEED.groups.length }),
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
    const tasks = taskList(d);
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
    if (s) this.store.appendText(s.text[this.i18n.li()]);
  }

  protected toggleMedia(id: string): void {
    const media = this.d().media;
    this.store.patch({
      media: media.includes(id) ? media.filter((x) => x !== id) : [...media, id],
    });
  }

  protected setTarget(id: string, on: boolean): void {
    this.store.patch({ targets: { ...this.d().targets, [id]: on }, errTargets: '' });
  }

  protected toggleGroup(g: string): void {
    const groups = this.d().groups;
    this.store.patch({
      groups: groups.includes(g) ? groups.filter((x) => x !== g) : [...groups, g],
    });
  }

  protected selectAllGroups(): void {
    this.store.patch({ groups: [...SEED.groups] });
  }

  protected clearGroups(): void {
    this.store.patch({ groups: [] });
  }

  protected setRepeat(v: string): void {
    this.store.patch({ repeat: v as Draft['repeat'] });
  }

  protected saveDraft(): void {
    this.notify.info(this.t().cmp.toastDraft);
  }

  /** Validates, then queues one task per target, spaced by the workspace smart delay. */
  protected submit(): void {
    const t = this.t().cmp;
    const d = this.d();
    const [y, mo, da] = d.date.split('-').map(Number);
    const [hh, mm] = (d.time || '00:00').split(':').map(Number);
    const start = new Date(y, mo - 1, da, hh, mm);
    const tasks = taskList(d);
    const errs = {
      errText: d.text.trim() ? '' : t.errText,
      errTargets: tasks.length ? '' : t.errTargets,
      errTime: isNaN(start.getTime()) || start <= this.posts.now ? t.errTime : '',
    };
    if (errs.errText || errs.errTargets || errs.errTime) {
      this.store.patch(errs);
      return;
    }
    const ab = this.settings.ab();
    let cur = start.getTime();
    const add: PostItem[] = tasks.map((tk, i) => {
      if (i > 0 && d.useDelay) cur += (ab.min + Math.random() * (ab.max - ab.min)) * 60000;
      return {
        id: `n${Date.now()}-${i}`,
        dt: new Date(cur),
        accountId: tk.a,
        platform: tk.p,
        target: tk.t,
        text: d.text.trim(),
        status: 'queued',
      };
    });
    this.posts.add(add);
    this.store.reset();
    this.notify.success(fmt(t.toastDone, { n: add.length }));
    void this.router.navigate(['/app/calendar'], { queryParams: { day: d.date } });
  }
}
