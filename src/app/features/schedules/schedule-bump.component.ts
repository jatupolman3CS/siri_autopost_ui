import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { LibraryStore } from '../../core/data/library.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { INPUT_LIMITS } from '../../core/http/input-limits';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';
import { CheckboxComponent } from '../../shared/components/checkbox/checkbox.component';
import { FeatureLockComponent } from '../../shared/components/feature-lock/feature-lock.component';
import { Pager } from '../../shared/components/pager/pager';
import { PagerComponent } from '../../shared/components/pager/pager.component';
import {
  SelectFieldComponent,
  SelectOption,
} from '../../shared/components/select-field/select-field.component';
import { BUMP_HOURS, ScheduleFormService } from './schedule-form.service';

let nextId = 0;

// The "bump posts" section of the schedule builder (a Premium function): after each post goes out, the
// extension opens its link and comments on it again so it comes back to the top. The person chooses how long
// after the post (and between bumps), how many bumps, the comment (spintax) and the library images the bumps
// draw from. A workspace whose owner is not on a plan with bumping sees the section locked
// (`app-feature-lock`, with the upgrade link for the owner) and the controls off: the form never asks for it.
@Component({
  selector: 'app-schedule-bump',
  imports: [
    RouterLink,
    CheckboxComponent,
    FeatureLockComponent,
    PagerComponent,
    SelectFieldComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './schedule-bump.component.html',
  styleUrl: './schedule-bump.component.scss',
})
export class ScheduleBumpComponent {
  protected readonly form = inject(ScheduleFormService);
  protected readonly perm = inject(PermissionsService);
  private readonly library = inject(LibraryStore);
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;
  protected readonly limits = INPUT_LIMITS;
  protected readonly textId = `bump-text-${nextId++}`;

  protected readonly pickerOpen = signal(false);
  protected readonly pager = new Pager(12);

  /** The controls are off for a viewer, and while the plan lacks bumping. */
  protected readonly off = computed(() => this.perm.readOnly() || this.form.bumpLocked());
  /** The details follow the switch; a locked section shows them (off) so the person sees what Premium adds. */
  protected readonly showDetails = computed(() => this.form.bumpOn() || this.form.bumpLocked());

  protected readonly title = computed(() =>
    fmt(this.t().api.flow.schBumpTitle, { plan: this.t().plans.agency.name }),
  );
  protected readonly lockTitle = computed(() =>
    fmt(this.t().api.flow.schBumpLockedTitle, { plan: this.t().plans.agency.name }),
  );
  protected readonly lockBody = computed(() =>
    fmt(this.t().api.flow.schBumpLockedBody, { plan: this.t().plans.agency.name }),
  );

  protected readonly hourOptions = computed<SelectOption[]>(() =>
    BUMP_HOURS.map((h) => ({
      value: String(h),
      label: fmt(this.t().api.flow.schBumpAfterOpt, { h }),
    })),
  );
  protected readonly roundOptions = computed<SelectOption[]>(() =>
    Array.from({ length: INPUT_LIMITS.bumpRounds }, (_, i) => ({
      value: String(i + 1),
      label: fmt(this.t().api.flow.schBumpRoundsOpt, { n: i + 1 }),
    })),
  );
  /** 0 up to how many images are chosen (at most 5). */
  protected readonly eachOptions = computed<SelectOption[]>(() => {
    const max = Math.min(INPUT_LIMITS.bumpImages, this.form.bumpMedia().length);
    return Array.from({ length: max + 1 }, (_, n) => ({
      value: String(n),
      label: fmt(this.t().api.flow.schBumpEachOpt, { n }),
    }));
  });
  protected readonly selLabel = computed(() =>
    fmt(this.t().api.flow.schBumpImagesSel, {
      n: this.form.bumpMedia().length,
      max: INPUT_LIMITS.bumpPool,
    }),
  );

  /** Only images the library offers (a switched-off file is kept in the library but not offered). */
  private readonly images = computed(() =>
    this.library.media().filter((m) => m.kind === 'image' && m.active !== false),
  );
  private readonly page = computed(() => this.pager.slice(this.images()));
  protected readonly noLibrary = computed(() => this.library.loaded() && !this.images().length);

  /** The images already chosen, with their thumbnails (a file that left the library says so). */
  protected readonly chosen = computed(() => {
    const files = this.library.media();
    const urls = this.library.thumbs();
    return this.form.bumpMedia().map((id) => {
      const m = files.find((f) => f.id === id);
      return {
        id,
        label: m?.name ?? this.t().api.flow.plMediaGone,
        src: urls[id] ?? null,
      };
    });
  });
  protected readonly picks = computed(() => {
    const on = this.form.bumpMedia();
    const urls = this.library.thumbs();
    return this.page().map((m) => ({
      id: m.id,
      label: m.name,
      src: urls[m.id] ?? null,
      selected: on.includes(m.id),
    }));
  });

  constructor() {
    // Thumbnails of the chosen images and of the picker's page only (the library can hold thousands).
    effect(() => {
      this.library.ensureThumbs([
        ...this.form.bumpMedia(),
        ...(this.pickerOpen() ? this.page().map((m) => m.id) : []),
      ]);
    });
  }
}
