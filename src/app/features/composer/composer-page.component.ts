import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CollectionsStore } from '../../core/data/collections.store';
import { ComposerPreviewService } from '../../core/data/composer-preview.service';
import { SchedulesStore } from '../../core/data/schedules.store';
import { DraftStore } from '../../core/data/draft.store';
import { LibraryStore } from '../../core/data/library.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { INPUT_LIMITS } from '../../core/http/input-limits';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { UiPrefsService } from '../../core/services/ui-prefs.service';
import { FlowStepsComponent } from '../../shared/components/flow-steps/flow-steps.component';
import { PagerComponent } from '../../shared/components/pager/pager.component';
import { Pager } from '../../shared/components/pager/pager';
import { PermNoteComponent } from '../../shared/components/perm-note/perm-note.component';
import { SelectFieldComponent } from '../../shared/components/select-field/select-field.component';
import { NewCollectionModalComponent } from '../collections/new-collection-modal.component';
import { AiWriterModalComponent } from './ai-writer-modal.component';
import { COMPOSER_PATH } from './composer-link';
import { ComposerPreviewComponent } from './composer-preview.component';
import '../../core/i18n/i18n.flow';

// Writes or edits ONE post of a collection (what to post, not when or where: that is the schedules page). The
// text with its tools (saved text, {{code}}, spintax, the AI writer), media from the library, the collection
// it is saved to and a preview of how the engine will compose it. The draft lives in DraftStore, so it
// survives a trip to the library; `?collection=` and `?post=` (route inputs) say which post it is.
@Component({
  selector: 'app-composer-page',
  imports: [
    AiWriterModalComponent,
    ComposerPreviewComponent,
    FlowStepsComponent,
    NewCollectionModalComponent,
    PagerComponent,
    PermNoteComponent,
    RouterLink,
    SelectFieldComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './composer-page.component.html',
  styleUrl: './composer-page.component.scss',
})
export class ComposerPageComponent {
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  private readonly library = inject(LibraryStore);
  private readonly previewSets = inject(ComposerPreviewService);
  private readonly schedules = inject(SchedulesStore);
  private readonly prefs = inject(UiPrefsService);
  protected readonly collections = inject(CollectionsStore);
  protected readonly store = inject(DraftStore);
  protected readonly perm = inject(PermissionsService);
  protected readonly limits = INPUT_LIMITS;
  protected readonly t = inject(I18nService).t;

  /** `?collection=`: the collection a new post goes to. */
  readonly collection = input<string | undefined>(undefined);
  /** `?post=`: the post being edited. */
  readonly post = input<string | undefined>(undefined);

  protected readonly d = this.store.draft;
  protected readonly busy = signal(false);
  protected readonly uploading = signal(false);
  protected readonly colModal = signal(false);
  protected readonly aiModal = signal(false);

  protected readonly showTools = computed(() => this.store.toolsOverride() ?? !this.prefs.simple());

  protected readonly snippetOptions = computed(() =>
    this.library.snippets().map((s) => ({ value: s.id, label: s.title })),
  );
  protected readonly collectionOptions = computed(() =>
    this.collections.collections().map((c) => ({ value: c.id, label: c.name })),
  );
  /** The collection the draft is saved to, when it exists. */
  protected readonly target = computed(() => this.collections.byId(this.d().collectionId));

  protected readonly mediaPager = new Pager(20);
  /** The library files on the page of the picker (the library can hold thousands). */
  private readonly mediaPage = computed(() => this.mediaPager.slice(this.library.media()));

  protected readonly mediaPick = computed(() => {
    const picked = this.d().media;
    const thumbs = this.library.thumbs();
    return this.mediaPage().map((m) => ({
      id: m.id,
      label: m.name,
      src: thumbs[m.id] ?? null,
      icon: m.kind === 'video' ? 'ph-video' : 'ph-image',
      selected: picked.includes(m.id),
    }));
  });
  protected readonly mediaSelLabel = computed(() =>
    fmt(this.t().cmp.mediaSel, { n: this.d().media.length }),
  );

  /** Which schedules use the collection (named once the schedules have arrived, else their number). */
  protected readonly collectionHint = computed(() => {
    const c = this.target();
    if (!c) return this.collections.collections().length ? '' : this.t().api.flow.cmpNoCollections;
    if (!c.scheduleCount) return this.t().cmp.colHintNone;
    const used = this.schedules.loaded() ? this.schedules.usingCollection(c.id) : [];
    return used.length
      ? fmt(this.t().cmp.colHint, {
          s: used.map((x) => `${x.name} (${x.slots.join(', ')})`).join(' · '),
        })
      : fmt(this.t().api.flow.cmpColHint, { n: c.scheduleCount });
  });
  /** An approved post of a collection that needs approval goes back to draft when it is edited. */
  protected readonly editResets = computed(() => {
    const id = this.d().postId;
    const found = id ? this.collections.postById(id) : undefined;
    return (
      !!found &&
      this.target()?.settings.requireApproval === true &&
      found.post.approval === 'approved'
    );
  });

  constructor() {
    // Thumbnails are fetched for the picker's page and the files attached to the draft only.
    effect(() =>
      this.library.ensureThumbs([...this.mediaPage().map((m) => m.id), ...this.d().media]),
    );
    // What the collections and link sets show here changes on other pages: read them again on arrival.
    void this.collections.refresh();
    void this.previewSets.refresh();
    // The address says which post this is (a link, a reload, the library's "back to the post"): once the
    // collections are in, set the draft up for it unless it already is that post.
    effect(() => {
      if (!this.collections.loaded()) return;
      const collection = this.collection();
      const post = this.post();
      untracked(() => {
        if (this.store.open(collection, post) === 'missing')
          this.notify.info(this.t().api.flow.cmpPostGone);
      });
    });
  }

  protected setText(value: string): void {
    this.store.patch({ text: value, errText: '' });
  }

  protected setCollection(id: string): void {
    this.store.patch({ collectionId: id, errCol: '' });
  }

  protected insertSnippet(id: string): void {
    const s = this.library.snippets().find((x) => x.id === id);
    if (s) this.store.appendText(s.text);
  }

  protected insertCode(): void {
    if (!this.store.insertCode()) this.notify.info(this.t().cmp.codeAlready);
  }

  protected insertSpin(): void {
    this.store.insertSpin(this.t().api.flow.spinSample);
  }

  protected toggleMedia(id: string): void {
    if (!this.store.toggleMedia(id)) this.mediaFull();
  }

  private mediaFull(): void {
    this.notify.error(fmt(this.t().api.mediaMax, { n: INPUT_LIMITS.postMedia }));
  }

  /** Uploads to the library and attaches what the server took. */
  protected async upload(input: HTMLInputElement): Promise<void> {
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!files.length || !this.perm.canEdit()) return;
    const a = this.t().api;
    this.uploading.set(true);
    if (files.length > 1) this.notify.info(fmt(a.uploading, { n: files.length }));
    try {
      const ids = await this.library.upload(files);
      if (ids.length) this.notify.success(fmt(a.uploaded, { n: ids.length }));
      if (ids.length < files.length) this.notify.error(a.uploadFailed);
      if (ids.map((id) => this.store.addMedia(id)).includes(false)) this.mediaFull();
    } finally {
      this.uploading.set(false);
    }
  }

  protected toggleTools(): void {
    this.store.toolsOverride.set(!this.showTools());
  }

  /** The new collection is where the post goes now. */
  protected collectionCreated(id: string): void {
    this.store.patch({ collectionId: id, errCol: '' });
  }

  /** The AI writer filled a collection: show it on the collections page, open. */
  protected generated(collectionId: string): void {
    this.collections.openId.set(collectionId);
    void this.router.navigateByUrl('/app/collections');
  }

  protected cancel(): void {
    this.store.reset();
    void this.router.navigateByUrl('/app/collections');
  }

  protected back(): void {
    void this.router.navigateByUrl('/app/collections');
  }

  /** Validates, then saves the post to its collection (a new post, or the one being edited). */
  protected async save(andNew: boolean): Promise<void> {
    if (this.busy() || !this.perm.canEdit()) return;
    const t = this.t();
    const d = this.d();
    const text = d.text.trim();
    const collection = this.collections.byId(d.collectionId);
    const errs = {
      errText: text ? '' : t.cmp.errText,
      errCol: collection ? '' : t.cmp.errCol,
    };
    if (errs.errText || errs.errCol || !collection) {
      this.store.patch(errs);
      return;
    }
    const existing = d.postId ? this.collections.postById(d.postId) : undefined;
    if (d.postId && !existing) {
      // Deleted elsewhere meanwhile: what is written stays as a new post.
      this.notify.info(t.api.flow.cmpPostGone);
      this.store.patch({ postId: null });
      return;
    }
    this.busy.set(true);
    try {
      if (existing)
        await this.collections.updatePost(existing.post, {
          text,
          mediaIds: d.media,
          toCollectionId: collection.id,
        });
      else await this.collections.addPost(collection.id, text, d.media);
      this.notify.success(existing ? t.cmp.updated : fmt(t.cmp.saved, { c: collection.name }));
      this.collections.lastId.set(collection.id);
      this.collections.openId.set(collection.id);
      if (andNew) {
        this.store.startNew(collection.id);
        void this.router.navigate([COMPOSER_PATH], {
          queryParams: { collection: collection.id, post: null },
        });
      } else {
        this.store.reset();
        void this.router.navigateByUrl('/app/collections');
      }
    } catch {
      // The API's reason was toasted by the error interceptor; the draft stays as it is.
    } finally {
      this.busy.set(false);
    }
  }
}
