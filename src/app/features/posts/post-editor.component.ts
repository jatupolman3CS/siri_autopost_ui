import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CollectionsStore } from '../../core/data/collections.store';
import { LibraryStore } from '../../core/data/library.store';
import { MasterPostsStore } from '../../core/data/master-posts.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { ApiCollectionPost, ApiPostSettings } from '../../core/http/api.service';
import { INPUT_LIMITS } from '../../core/http/input-limits';
import { problemMessage } from '../../core/http/problem-details';
import { dayNames } from '../../core/i18n/format';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { CheckboxComponent } from '../../shared/components/checkbox/checkbox.component';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';
import { PagerComponent } from '../../shared/components/pager/pager.component';
import { Pager } from '../../shared/components/pager/pager';
import '../../core/i18n/i18n.flow';

type Position = 'follow' | 'end' | 'top';

/** "HH:mm" as the API wants it (the browser's time input already gives that, or ''). */
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// The editor of ONE library post, inline on its card or in the "new post" dialog: the text, the media, the
// collections it sits in, its own message settings (hashtags, footer and its position, each either following
// the collection or its own) and its own schedule limits (dates, weekdays, time window, a daily cap). The
// form keeps what is typed while the list refreshes underneath (it is set up again only for another post).
// A refusal by the API is shown inside the form and the form stays open.
@Component({
  selector: 'app-post-editor',
  imports: [CheckboxComponent, InputFieldComponent, PagerComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './post-editor.component.html',
  styleUrl: './post-editor.component.scss',
})
export class PostEditorComponent {
  private readonly store = inject(MasterPostsStore);
  private readonly collections = inject(CollectionsStore);
  private readonly library = inject(LibraryStore);
  private readonly notify = inject(NotificationService);
  protected readonly perm = inject(PermissionsService);
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;
  protected readonly limits = INPUT_LIMITS;

  /** The post being edited; null starts a new one. */
  readonly post = input<ApiCollectionPost | null>(null);
  /** Collections a new post starts in (the collection filter of the page, for example). */
  readonly startIn = input<readonly string[]>([]);
  readonly saved = output<ApiCollectionPost>();
  readonly cancelled = output<void>();

  protected readonly text = signal('');
  protected readonly mediaIds = signal<string[]>([]);
  protected readonly collectionIds = signal<string[]>([]);
  protected readonly tagsOwn = signal(false);
  protected readonly tags = signal('');
  protected readonly footerOwn = signal(false);
  protected readonly footer = signal('');
  protected readonly footerPos = signal<Position>('follow');
  protected readonly validFrom = signal('');
  protected readonly validUntil = signal('');
  protected readonly weekdays = signal<number[]>([]);
  protected readonly timeFrom = signal('');
  protected readonly timeTo = signal('');
  protected readonly maxPerDay = signal('0');
  protected readonly activeNew = signal(true);

  protected readonly busy = signal(false);
  /** Messages by field, then `form` for what the API said. */
  protected readonly errText = signal('');
  protected readonly errDates = signal('');
  protected readonly errTime = signal('');
  protected readonly errMax = signal('');
  protected readonly errForm = signal('');
  protected readonly pickerOpen = signal(false);

  protected readonly mediaPager = new Pager(12);
  private readonly mediaPage = computed(() => this.mediaPager.slice(this.library.media()));

  private readonly postId = computed(() => this.post()?.id ?? null);
  protected readonly isNew = computed(() => this.postId() === null);

  protected readonly collectionOptions = computed(() =>
    this.collections.collections().map((c) => ({
      id: c.id,
      name: c.name,
      on: this.collectionIds().includes(c.id),
    })),
  );
  protected readonly days = computed(() =>
    dayNames(this.i18n.li()).map((label, value) => ({
      value,
      label,
      on: this.weekdays().includes(value),
    })),
  );
  protected readonly colHint = computed(() =>
    fmt(this.t().api.flow.plColHint, { n: INPUT_LIMITS.postCollections }),
  );
  protected readonly mediaSelLabel = computed(() =>
    fmt(this.t().cmp.mediaSel, { n: this.mediaIds().length }),
  );
  protected readonly maxHint = computed(() =>
    fmt(this.t().api.flow.plMaxPerDayHint, { n: INPUT_LIMITS.postMaxPerDay }),
  );
  /** Files attached to the post, with what the library knows about them. */
  protected readonly attached = computed(() => {
    const files = this.library.media();
    const urls = this.library.thumbs();
    return this.mediaIds().map((id) => {
      const m = files.find((f) => f.id === id);
      return {
        id,
        label: m?.name ?? this.t().api.flow.plMediaGone,
        src: urls[id] ?? null,
        icon: m?.kind === 'video' ? 'ph-video' : 'ph-image',
      };
    });
  });
  protected readonly picks = computed(() => {
    const on = this.mediaIds();
    const urls = this.library.thumbs();
    return this.mediaPage().map((m) => ({
      id: m.id,
      label: m.name,
      src: urls[m.id] ?? null,
      icon: m.kind === 'video' ? 'ph-video' : 'ph-image',
      selected: on.includes(m.id),
    }));
  });
  /** Whether saving may send an approved post back to draft (it sits in a collection that needs approval). */
  protected readonly editResets = computed(() => {
    const p = this.post();
    if (!p || p.approval !== 'approved') return false;
    const ids = this.collectionIds();
    return this.collections
      .collections()
      .some(
        (c) => c.settings.requireApproval && (ids.includes(c.id) || p.collectionIds.includes(c.id)),
      );
  });

  constructor() {
    // Set the form up for the post, once per post: a quiet refresh of the list must not throw typing away.
    effect(() => {
      const id = this.postId();
      untracked(() => this.load(id === null ? null : this.post()));
    });
    // Thumbnails of the attached files and of the picker's page only.
    effect(() => {
      this.library.ensureThumbs([...this.mediaIds(), ...this.mediaPage().map((m) => m.id)]);
    });
  }

  private load(p: ApiCollectionPost | null): void {
    const s = p?.settings;
    this.text.set(p?.text ?? '');
    this.mediaIds.set([...(p?.mediaIds ?? [])]);
    this.collectionIds.set([...(p ? p.collectionIds : this.startIn())]);
    this.tagsOwn.set(s?.hashtags != null);
    this.tags.set(s?.hashtags ?? '');
    this.footerOwn.set(s?.footer != null);
    this.footer.set(s?.footer ?? '');
    this.footerPos.set(s?.footerPos ?? 'follow');
    this.validFrom.set(s?.validFrom ?? '');
    this.validUntil.set(s?.validUntil ?? '');
    this.weekdays.set([...(s?.weekdays ?? [])].sort((a, b) => a - b));
    this.timeFrom.set(s?.timeFrom ?? '');
    this.timeTo.set(s?.timeTo ?? '');
    this.maxPerDay.set(String(s?.maxPerDay ?? 0));
    this.activeNew.set(true);
    this.errText.set('');
    this.errDates.set('');
    this.errTime.set('');
    this.errMax.set('');
    this.errForm.set('');
    this.pickerOpen.set(false);
  }

  protected setText(value: string): void {
    this.text.set(value);
    this.errText.set('');
  }

  protected toggleCollection(id: string): void {
    const on = this.collectionIds();
    if (on.includes(id)) {
      this.collectionIds.set(on.filter((x) => x !== id));
    } else if (on.length >= INPUT_LIMITS.postCollections) {
      this.errForm.set(fmt(this.t().api.flow.plColMax, { n: INPUT_LIMITS.postCollections }));
    } else {
      this.collectionIds.set([...on, id]);
      this.errForm.set('');
    }
  }

  protected toggleDay(day: number): void {
    const on = this.weekdays();
    this.weekdays.set(
      on.includes(day) ? on.filter((d) => d !== day) : [...on, day].sort((a, b) => a - b),
    );
  }

  protected toggleMedia(id: string): void {
    const on = this.mediaIds();
    if (on.includes(id)) {
      this.mediaIds.set(on.filter((m) => m !== id));
    } else if (on.length >= INPUT_LIMITS.postMedia) {
      this.errForm.set(fmt(this.t().api.mediaMax, { n: INPUT_LIMITS.postMedia }));
    } else {
      this.mediaIds.set([...on, id]);
      this.errForm.set('');
    }
  }

  /** The post's own settings as the API wants them: null follows the collection, '' means none for this post. */
  private settings(): ApiPostSettings {
    const time = !!this.timeFrom() && !!this.timeTo();
    return {
      hashtags: this.tagsOwn() ? this.tags().trim() : null,
      footer: this.footerOwn() ? this.footer().trim() : null,
      footerPos: this.footerPos() === 'follow' ? null : (this.footerPos() as 'end' | 'top'),
      validFrom: this.validFrom() || null,
      validUntil: this.validUntil() || null,
      weekdays: [...this.weekdays()],
      timeFrom: time ? this.timeFrom() : null,
      timeTo: time ? this.timeTo() : null,
      maxPerDay: Number(this.maxPerDay()) || 0,
    };
  }

  /** Checks the form like the server will; false (with the messages set) when something is wrong. */
  private valid(): boolean {
    const a = this.t().api.flow;
    this.errText.set(this.text().trim() ? '' : this.t().cmp.errText);
    const from = this.validFrom();
    const until = this.validUntil();
    this.errDates.set(from && until && from > until ? a.plErrDates : '');
    const tf = this.timeFrom();
    const tt = this.timeTo();
    const both = !!tf && !!tt;
    const badTime = !!tf !== !!tt || (both && !(TIME.test(tf) && TIME.test(tt)));
    this.errTime.set(badTime ? a.plErrTime : '');
    const max = this.maxPerDay().trim();
    const n = Number(max);
    const badMax = max === '' || !Number.isInteger(n) || n < 0 || n > INPUT_LIMITS.postMaxPerDay;
    this.errMax.set(badMax ? fmt(a.plErrMax, { n: INPUT_LIMITS.postMaxPerDay }) : '');
    return !(this.errText() || this.errDates() || this.errTime() || this.errMax());
  }

  protected async save(): Promise<void> {
    if (this.busy() || !this.perm.canEdit() || !this.valid()) return;
    const a = this.t().api.flow;
    const body = {
      text: this.text().trim(),
      mediaIds: this.mediaIds(),
      collectionIds: this.collectionIds(),
      settings: this.settings(),
    };
    this.busy.set(true);
    this.errForm.set('');
    try {
      const existing = this.post();
      const saved = existing
        ? await this.store.update(existing.id, body)
        : await this.store.create({ ...body, active: this.activeNew() });
      this.notify.success(existing ? a.plSaved : a.plCreated);
      this.saved.emit(saved);
    } catch (e) {
      this.errForm.set(problemMessage(e) ?? a.plSaveFailed);
    } finally {
      this.busy.set(false);
    }
  }
}
