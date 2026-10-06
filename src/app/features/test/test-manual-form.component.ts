import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { LibraryStore } from '../../core/data/library.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { TEST_MAX_MEDIA, TestPostStore } from '../../core/data/test-post.store';
import { INPUT_LIMITS } from '../../core/http/input-limits';
import '../../core/i18n/i18n.engine';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';
import { Pager } from '../../shared/components/pager/pager';
import { PagerComponent } from '../../shared/components/pager/pager.component';

// The "test by hand" panel: a group or page link, a text and library images typed and picked in, sent through the
// chosen extension at once to see that the jobs really work (no collection, link set or schedule involved).
// Images come from the media library; "upload from my computer" puts files into it first (so they count toward the
// plan's image limit, and the server's refusal is shown). The store sends the test and follows it like the other panel.

/** SetLink.MaxUrlLength: the longest address the API takes. */
const MAX_URL = 300;

@Component({
  selector: 'app-test-manual-form',
  imports: [InputFieldComponent, PagerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './test-manual-form.component.html',
  styleUrls: ['./test-form.scss', './test-manual-form.component.scss'],
})
export class TestManualFormComponent {
  private readonly i18n = inject(I18nService);
  private readonly library = inject(LibraryStore);
  protected readonly perm = inject(PermissionsService);
  protected readonly store = inject(TestPostStore);
  protected readonly t = this.i18n.t;
  protected readonly maxText = INPUT_LIMITS.postText;
  protected readonly maxMedia = TEST_MAX_MEDIA;
  protected readonly maxUrl = MAX_URL;

  /** The picker of library images is open. */
  protected readonly pickerOpen = signal(false);
  /** Files are being uploaded. */
  protected readonly uploading = signal(false);
  /** Why an upload did not go through (the server's reason, e.g. the plan's image limit). */
  protected readonly uploadError = signal('');

  protected readonly canPick = computed(() => this.perm.canEdit() && !this.store.running());
  protected readonly urlHint = computed(() => this.t().api.engine.testManualUrlHint);
  protected readonly textHint = computed(() =>
    fmt(this.t().api.engine.testManualTextHint, { n: INPUT_LIMITS.postText }),
  );
  protected readonly imagesHint = computed(() =>
    fmt(this.t().api.engine.testManualImagesHint, { n: TEST_MAX_MEDIA }),
  );

  /** The typed address as the server will read it: a group or a page, and its standard address. */
  protected readonly target = computed(() => {
    const target = this.store.manualTarget();
    if (!target) return null;
    const a = this.t().api.engine;
    return { url: target.url, kind: target.kind === 'page' ? a.testKindPage : a.testKindGroup };
  });
  /** Only a link that was typed and is wrong is an error (an empty box just waits). */
  protected readonly urlError = computed(() =>
    this.store.manualUrl().trim() !== '' && !this.store.manualTarget()
      ? this.t().api.engine.testManualBadUrl
      : '',
  );

  /** The images of the library a test can carry (not videos, not files switched off). */
  private readonly images = computed(() =>
    this.library.media().filter((m) => m.kind === 'image' && m.active !== false),
  );
  protected readonly mediaPager = new Pager(12);
  private readonly pickPage = computed(() => this.mediaPager.slice(this.images()));

  /** The images picked for the test, as the library knows them (a file deleted meanwhile says so). */
  protected readonly attached = computed(() => {
    const files = this.library.media();
    const urls = this.library.thumbs();
    return this.store.manualMedia().map((id) => {
      const m = files.find((f) => f.id === id);
      return { id, label: m?.name ?? this.t().api.engine.testManualGone, src: urls[id] ?? null };
    });
  });
  protected readonly picks = computed(() => {
    const on = this.store.manualMedia();
    const urls = this.library.thumbs();
    return this.pickPage().map((m) => ({
      id: m.id,
      label: m.name,
      src: urls[m.id] ?? null,
      selected: on.includes(m.id),
    }));
  });
  protected readonly pickedLabel = computed(() =>
    fmt(this.t().api.engine.testManualPicked, {
      n: this.store.manualMedia().length,
      m: TEST_MAX_MEDIA,
    }),
  );
  /** Every slot is taken: the others cannot be added until one is taken out. */
  protected readonly full = computed(() => this.store.manualMedia().length >= TEST_MAX_MEDIA);

  /** Beside the run button: what the API refused, or why it is off, else the "real post" note. */
  protected readonly error = computed(() =>
    this.store.running() ? '' : this.store.runError() || this.urlError(),
  );
  protected readonly note = computed(() => {
    const block = this.store.blockManual();
    const a = this.t().api.engine;
    return block === 'needUrl'
      ? a.testManualNeedUrl
      : block === 'needText'
        ? a.testManualNeedText
        : this.t().test.confirmBody;
  });
  protected readonly canRun = computed(
    () =>
      this.perm.canEdit() &&
      !this.store.running() &&
      !this.uploading() &&
      this.store.blockManual() === '',
  );
  protected readonly runLabel = computed(() => {
    const t = this.t().test;
    return this.store.running()
      ? t.running
      : this.store.log().length
        ? t.again
        : this.t().api.engine.testManualSend;
  });
  protected readonly uploadLabel = computed(() =>
    this.uploading() ? fmt(this.t().api.uploading, { n: 1 }) : this.t().api.engine.testManualUpload,
  );
  protected readonly pickLabel = computed(() =>
    this.pickerOpen()
      ? this.t().api.engine.testManualPickClose
      : this.t().api.engine.testManualPickOpen,
  );
  protected readonly preview = computed(() => this.store.manualComposed() || '—');

  constructor() {
    // Thumbnails of the picked images and of the picker's page only.
    effect(() => {
      this.library.ensureThumbs([
        ...this.store.manualMedia(),
        ...(this.pickerOpen() ? this.pickPage().map((m) => m.id) : []),
      ]);
    });
  }

  protected onText(e: Event): void {
    this.store.manualText.set((e.target as HTMLTextAreaElement).value);
  }

  /** Uploads the chosen files into the library (the server may refuse: the image limit) and picks the new ones. */
  protected async upload(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = '';
    if (!files.length || this.uploading()) return;
    this.uploading.set(true);
    this.uploadError.set('');
    const refusals: string[] = [];
    try {
      const ids = await this.library.upload(files, null, refusals);
      this.store.addManualMedia(ids);
      if (ids.length < files.length)
        this.uploadError.set(
          refusals.length
            ? fmt(this.t().api.engine.testManualUploadRefused, { r: refusals[0] })
            : this.t().api.uploadFailed,
        );
    } finally {
      this.uploading.set(false);
    }
  }
}
