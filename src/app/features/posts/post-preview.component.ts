import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { PreviewSetsService } from '../../core/data/preview-sets.service';
import { LibraryStore } from '../../core/data/library.store';
import {
  MAX_COMPOSED_LENGTH,
  composeFull,
  composeSegments,
  groupSlug,
  hasSpin,
  postComposeSettings,
  seededRandom,
  spinVariants,
} from '../../core/flow';
import { ApiCollectionSettings, ApiPostSettings } from '../../core/http/api.service';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { SelectFieldComponent } from '../../shared/components/select-field/select-field.component';
import '../../core/i18n/i18n.flow';

/** A collection the post sits in, with what the preview needs of it (its footer and hashtags). */
export interface PreviewCollection {
  id: string;
  name: string;
  settings: Pick<ApiCollectionSettings, 'hashtags' | 'footer' | 'footerPos'> | null;
}

/** How many different results "show variants" writes. */
const VARIANTS = 3;

// "Preview as posted" beside the editor: the text written the way the engine writes it for one group of a link
// set (spintax picked, the group's code, the footer and hashtags of a collection the post sits in, laid under
// the post's own live settings), with the words spintax picked highlighted. The person chooses the link set and
// the group (whose code is shown), the collection to preview as (a post may sit in several), reshuffles the
// picks (a seeded random, so the preview stays still while typing), or shows 3 different variants at once. The
// composed length is counted against the 7,000 characters the server allows.
@Component({
  selector: 'app-post-preview',
  imports: [SelectFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './post-preview.component.html',
  styleUrl: './post-preview.component.scss',
})
export class PostPreviewComponent {
  private readonly preview = inject(PreviewSetsService);
  private readonly library = inject(LibraryStore);
  protected readonly t = inject(I18nService).t;

  /** The post's text as typed. */
  readonly text = input('');
  /** The library files attached to the post. */
  readonly media = input<readonly string[]>([]);
  /** Shows a remove button on each attached file; the editor takes the file off the post. */
  readonly removable = input(false);
  readonly removed = output<string>();
  /** The collections the post sits in (the preview takes its footer and hashtags from one of them). */
  readonly collections = input<readonly PreviewCollection[]>([]);
  /** The post's own footer, hashtags and footer position as they are in the form now (null follows the collection). */
  readonly postSettings = input<Pick<ApiPostSettings, 'hashtags' | 'footer' | 'footerPos'> | null>(
    null,
  );

  protected readonly seed = signal(1);
  protected readonly variants = signal(false);
  private readonly pickedCollection = signal('');
  private readonly pickedSet = signal('');
  /** The index of the chosen group among the usable links of the set (null = the default one). */
  private readonly pickedLink = signal<number | null>(null);

  constructor() {
    effect(() => this.library.ensureThumbs(this.media()));
  }

  // ----- the collection to preview as -----

  protected readonly collectionOptions = computed(() =>
    this.collections().map((c) => ({ value: c.id, label: c.name })),
  );
  /** The collection chosen, else the first one the post sits in. */
  protected readonly collectionId = computed(() => {
    const list = this.collections();
    return list.find((c) => c.id === this.pickedCollection())?.id ?? list[0]?.id ?? '';
  });
  private readonly collection = computed(
    () => this.collections().find((c) => c.id === this.collectionId()) ?? null,
  );
  protected readonly collectionLine = computed(() => {
    const c = this.collection();
    return c ? fmt(this.t().api.flow.edPvOneCol, { c: c.name }) : this.t().api.flow.edPvNoCol;
  });

  // ----- the link set and the group -----

  protected readonly setOptions = computed(() =>
    this.preview.sets().map((s) => ({ value: s.id, label: s.name })),
  );
  /** The set chosen, else the first one. */
  protected readonly setId = computed(() => {
    const sets = this.preview.sets();
    return sets.find((s) => s.id === this.pickedSet())?.id ?? sets[0]?.id ?? '';
  });
  private readonly set = computed(() => this.preview.sets().find((s) => s.id === this.setId()));
  /** The links the engine could post to: on and valid. */
  private readonly usable = computed(() =>
    (this.set()?.links ?? []).filter((l) => l.enabled && l.valid),
  );
  protected readonly linkOptions = computed(() =>
    this.usable().map((l, i) => ({
      value: String(i),
      label: (l.name.trim() || groupSlug(l.url)) + (l.code.trim() ? ` · ${l.code.trim()}` : ''),
    })),
  );
  private readonly linkIndex = computed(() => {
    const usable = this.usable();
    const picked = this.pickedLink();
    if (picked !== null && picked < usable.length) return picked;
    // By default the first group that has a code, else the first one.
    const withCode = usable.findIndex((l) => l.code.trim());
    return usable.length ? Math.max(0, withCode) : -1;
  });
  protected readonly linkValue = computed(() =>
    this.linkIndex() < 0 ? '' : String(this.linkIndex()),
  );
  private readonly link = computed(() => this.usable()[this.linkIndex()] ?? null);
  private readonly code = computed(() => this.link()?.code.trim() ?? '');

  protected readonly note = computed(() => {
    const c = this.t().cmp;
    if (!this.set()) return c.previewNoSet;
    const link = this.link();
    if (!link) return this.t().ts.empty;
    return fmt(c.previewFor, { g: link.name.trim() || groupSlug(link.url) });
  });
  /** The code of the group, or that it has none (only when there is a group to speak of). */
  protected readonly codeLine = computed(() => {
    if (!this.link()) return '';
    const a = this.t().api.flow;
    return this.code() ? fmt(a.edPvCode, { c: this.code() }) : a.edPvNoCode;
  });

  // ----- the composed text -----

  private readonly settings = computed(() =>
    postComposeSettings(this.collection()?.settings ?? null, this.postSettings()),
  );
  protected readonly filled = computed(() => !!this.text().trim());
  protected readonly canVary = computed(() => hasSpin(this.text()));
  /** The composed post in pieces, so what spintax picked can be highlighted. */
  protected readonly segments = computed(() =>
    this.filled()
      ? composeSegments(this.text(), this.code(), this.settings(), seededRandom(this.seed()))
      : [],
  );
  protected readonly anySpun = computed(() => this.segments().some((s) => s.spun));
  /** Up to three different results, each composed for the same group. */
  protected readonly variantTexts = computed(() => {
    if (!this.filled()) return [];
    const rnd = seededRandom(this.seed());
    return spinVariants(this.text(), VARIANTS, rnd).map((v) =>
      composeFull(v, this.code(), this.settings(), rnd),
    );
  });
  protected readonly showVariants = computed(() => this.variants() && this.canVary());
  protected readonly length = computed(() =>
    this.segments().reduce((n, s) => n + s.text.length, 0),
  );
  protected readonly tooLong = computed(() => this.length() > MAX_COMPOSED_LENGTH);
  protected readonly lengthLine = computed(() =>
    fmt(this.t().api.flow.edPvLen, { n: this.length(), max: MAX_COMPOSED_LENGTH }),
  );
  protected readonly tooLongLine = computed(() =>
    fmt(this.t().api.flow.edPvTooLong, { max: MAX_COMPOSED_LENGTH }),
  );

  protected readonly chips = computed(() => {
    const files = this.library.media();
    const urls = this.library.thumbs();
    return this.media().flatMap((id) => {
      const m = files.find((f) => f.id === id);
      return m
        ? [
            {
              id,
              label: m.name,
              src: urls[id] ?? null,
              icon: m.kind === 'video' ? 'ph-video' : 'ph-image',
            },
          ]
        : [];
    });
  });

  protected variantLabel(index: number): string {
    return fmt(this.t().api.flow.edPvVariantN, { n: index + 1 });
  }

  protected remove(id: string): void {
    this.removed.emit(id);
  }

  protected pickCollection(id: string): void {
    this.pickedCollection.set(id);
  }

  protected pickSet(id: string): void {
    this.pickedSet.set(id);
    this.pickedLink.set(null);
  }

  protected pickLink(index: string): void {
    this.pickedLink.set(index === '' ? null : Number(index));
  }

  protected respin(): void {
    this.seed.update((n) => n + 1);
  }

  protected toggleVariants(): void {
    this.variants.update((v) => !v);
  }
}
