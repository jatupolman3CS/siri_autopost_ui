import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AiStore } from '../../core/data/ai.store';
import { CollectionsStore } from '../../core/data/collections.store';
import { PreviewSetsService } from '../../core/data/preview-sets.service';
import { DraftStore } from '../../core/data/draft.store';
import { LibraryStore } from '../../core/data/library.store';
import { MasterPostsStore } from '../../core/data/master-posts.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { TextEdit, insertAt, insertCodeTag, wrapSpin } from '../../core/flow';
import { ApiCollectionPost, ApiPostSettings } from '../../core/http/api.service';
import { INPUT_LIMITS } from '../../core/http/input-limits';
import { problemMessage } from '../../core/http/problem-details';
import { dayNames } from '../../core/i18n/format';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { UiPrefsService } from '../../core/services/ui-prefs.service';
import { CheckboxComponent } from '../../shared/components/checkbox/checkbox.component';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';
import { PagerComponent } from '../../shared/components/pager/pager.component';
import { Pager } from '../../shared/components/pager/pager';
import { NewCollectionModalComponent } from '../collections/new-collection-modal.component';
import { AiPanelComponent } from './ai-panel.component';
import { PostPreviewComponent, PreviewCollection } from './post-preview.component';
import { PostStatusComponent } from './post-status.component';
import { PostToolbarComponent } from './post-toolbar.component';
import '../../core/i18n/i18n.flow';

type Position = 'follow' | 'end' | 'top';

/** "HH:mm" as the API wants it (the browser's time input already gives that, or ''). */
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** A post that follows its collection in everything and has no limits of its own. */
const BLANK_SETTINGS: ApiPostSettings = {
  hashtags: null,
  footer: null,
  footerPos: null,
  validFrom: null,
  validUntil: null,
  weekdays: [],
  timeFrom: null,
  timeTo: null,
  maxPerDay: 0,
};

const hasOwnSettings = (s: ApiPostSettings | undefined): boolean =>
  !!s &&
  (s.hashtags != null ||
    s.footer != null ||
    s.footerPos != null ||
    !!s.validFrom ||
    !!s.validUntil ||
    (s.weekdays?.length ?? 0) > 0 ||
    !!s.timeFrom ||
    !!s.timeTo ||
    s.maxPerDay > 0);

// THE editor of a library post: a new one and an existing one are the same screen. The text with the insert
// toolbar right above it ({{code}}, Spintax, saved snippets, AI) writes at the caret; under it a status line
// says what the text will do (group code, how much Spintax, braces that look wrong); the AI panel opens in
// place; media come from the library (or are uploaded into it); the post sits in up to 50 collections (and a
// new one can be made here); its own footer, hashtags and timing are in "more options"; and the live preview
// sits beside it (below on a phone). A NEW post is bound to `DraftStore` (so it survives a trip to the media
// library); an existing one keeps local state, set up again only for another post, so a quiet refresh of the
// list never throws typing away. A refusal by the API is shown inside the form and the form stays open.
@Component({
  selector: 'app-post-editor',
  imports: [
    AiPanelComponent,
    CheckboxComponent,
    InputFieldComponent,
    NewCollectionModalComponent,
    PagerComponent,
    PostPreviewComponent,
    PostStatusComponent,
    PostToolbarComponent,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './post-editor.component.html',
  styleUrl: './post-editor.component.scss',
})
export class PostEditorComponent {
  private readonly store = inject(MasterPostsStore);
  private readonly collections = inject(CollectionsStore);
  private readonly library = inject(LibraryStore);
  private readonly draft = inject(DraftStore);
  private readonly previewSets = inject(PreviewSetsService);
  private readonly notify = inject(NotificationService);
  private readonly prefs = inject(UiPrefsService);
  private readonly injector = inject(Injector);
  protected readonly perm = inject(PermissionsService);
  protected readonly ai = inject(AiStore);
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;
  protected readonly limits = INPUT_LIMITS;

  /** The post being edited; null starts a new one (its text, media and collections live in the draft). */
  readonly post = input<ApiCollectionPost | null>(null);
  /** The post was saved: the panel closes. */
  readonly saved = output<ApiCollectionPost>();
  /** "Save and add another" saved the post: the panel stays, with a blank new post. */
  readonly savedAnother = output<ApiCollectionPost>();
  /** Cancel: the panel closes (the draft of a new post is thrown away). */
  readonly cancelled = output<void>();

  private readonly textarea = viewChild<ElementRef<HTMLTextAreaElement>>('ta');

  // The text, media and collections of an existing post. A NEW post reads and writes the draft instead.
  private readonly localText = signal('');
  private readonly localMedia = signal<string[]>([]);
  private readonly localCollections = signal<string[]>([]);
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
  protected readonly uploading = signal(false);
  /** Messages by field, then `form` for what the API said. */
  protected readonly errText = signal('');
  protected readonly errDates = signal('');
  protected readonly errTime = signal('');
  protected readonly errMax = signal('');
  protected readonly errForm = signal('');
  protected readonly pickerOpen = signal(false);
  protected readonly moreOpen = signal(false);
  protected readonly colModal = signal(false);
  protected readonly aiOpen = signal(false);
  /** Whether the AI panel has been opened once (it then stays, hidden when closed, so its drafts are kept). */
  protected readonly aiEver = signal(false);
  /** AI drafts being saved as separate posts. */
  protected readonly aiSaving = signal<string[]>([]);
  /** Where the caret and the selection are in the text area (the toolbar writes there). */
  private readonly caret = signal({ start: 0, end: 0 });

  protected readonly mediaPager = new Pager(12);
  private readonly mediaPage = computed(() => this.mediaPager.slice(this.library.media()));

  private readonly postId = computed(() => this.post()?.id ?? null);
  protected readonly isNew = computed(() => this.postId() === null);

  protected readonly text = computed(() =>
    this.isNew() ? this.draft.draft().text : this.localText(),
  );
  protected readonly mediaIds = computed(() =>
    this.isNew() ? this.draft.draft().media : this.localMedia(),
  );
  protected readonly collectionIds = computed(() =>
    this.isNew() ? this.draft.draft().collectionIds : this.localCollections(),
  );
  /** The words selected in the text (what a Spintax wrap would use). */
  protected readonly selectedText = computed(() => {
    const { start, end } = this.caret();
    return this.text().slice(start, end);
  });

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
      // A file switched off in the library cannot be added (one already attached can still be taken off).
      off: m.active === false && !on.includes(m.id),
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

  // What the preview needs: the collections the post sits in, and the post's own settings as they are typed.
  protected readonly previewCollections = computed<PreviewCollection[]>(() =>
    this.collectionIds().flatMap((id) => {
      const c = this.collections.byId(id);
      return c ? [{ id, name: c.name, settings: c.settings }] : [];
    }),
  );
  protected readonly ownMessage = computed(() => ({
    hashtags: this.tagsOwn() ? this.tags().trim() : null,
    footer: this.footerOwn() ? this.footer().trim() : null,
    footerPos: this.footerPos() === 'follow' ? null : (this.footerPos() as 'end' | 'top'),
  }));

  constructor() {
    // The link sets change on another page: the preview reads them again when the editor opens.
    void this.previewSets.refresh();
    // Set the form up for the post, once per post: a quiet refresh of the list must not throw typing away.
    effect(() => {
      const id = this.postId();
      untracked(() => this.load(id === null ? null : this.post()));
    });
    // Thumbnails of the attached files and of the picker's page only.
    effect(() => {
      this.library.ensureThumbs([...this.mediaIds(), ...this.mediaPage().map((m) => m.id)]);
    });
    // The text is ready to type in.
    afterNextRender(() => {
      if (this.perm.canEdit()) this.textarea()?.nativeElement.focus({ preventScroll: true });
    });
  }

  private load(p: ApiCollectionPost | null): void {
    const s = p?.settings;
    this.localText.set(p?.text ?? '');
    this.localMedia.set([...(p?.mediaIds ?? [])]);
    this.localCollections.set([...(p?.collectionIds ?? [])]);
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
    // The own settings are tucked away unless the post has some (or the person turned simple mode off).
    this.moreOpen.set(hasOwnSettings(s) || !this.prefs.simple());
    const end = this.isNew() ? this.draft.draft().text.length : (p?.text.length ?? 0);
    this.caret.set({ start: end, end });
  }

  // ----- the text, the media and the collections (the draft for a new post, local state for an old one) -----

  private writeText(value: string): void {
    if (this.isNew()) this.draft.patch({ text: value });
    else this.localText.set(value);
  }

  private writeMedia(ids: string[]): void {
    if (this.isNew()) this.draft.patch({ media: ids });
    else this.localMedia.set(ids);
  }

  private writeCollections(ids: string[]): void {
    if (this.isNew()) this.draft.patch({ collectionIds: ids });
    else this.localCollections.set(ids);
  }

  protected setText(value: string): void {
    this.writeText(value);
    this.errText.set('');
  }

  /** Remembers where the caret and the selection are (the toolbar writes there, the popover offers to wrap). */
  protected track(el: HTMLTextAreaElement): void {
    this.caret.set({ start: el.selectionStart, end: el.selectionEnd });
  }

  // ----- the insert toolbar: everything is written at the caret, or in place of the selection -----

  /** Where to write now: the text area's selection, or the end of the text before it was ever used. */
  private position(): { start: number; end: number } {
    const el = this.textarea()?.nativeElement;
    return el ? { start: el.selectionStart, end: el.selectionEnd } : this.caret();
  }

  /** Puts the edited text in and the caret where the edit says; null means it would not fit. */
  private apply(edit: TextEdit | null): void {
    if (!edit) {
      this.notify.error(fmt(this.t().api.flow.edTooLongInsert, { n: INPUT_LIMITS.postText }));
      return;
    }
    const el = this.textarea()?.nativeElement;
    if (el) {
      // The area first (so the caret does not jump to the end when the bound value changes), then the state.
      el.value = edit.text;
      el.focus({ preventScroll: true });
      el.setSelectionRange(edit.caret, edit.caret);
    }
    this.caret.set({ start: edit.caret, end: edit.caret });
    this.setText(edit.text);
  }

  protected insertCode(): void {
    const { start, end } = this.position();
    this.apply(insertCodeTag(this.text(), start, end, INPUT_LIMITS.postText));
  }

  /** A snippet, a spintax group or an example, at the caret. */
  protected insertText(value: string): void {
    const { start, end } = this.position();
    this.apply(insertAt(this.text(), value, start, end, INPUT_LIMITS.postText));
  }

  protected wrapSelection(): void {
    const { start, end } = this.position();
    this.apply(wrapSpin(this.text(), start, end, INPUT_LIMITS.postText));
  }

  // ----- the AI panel -----

  protected toggleAi(): void {
    if (!this.ai.canOpen()) return;
    this.aiOpen.set(!this.aiOpen());
    if (this.aiOpen()) this.aiEver.set(true);
  }

  /** The draft replaces the text. */
  protected aiUse(draft: string): void {
    const text = draft.slice(0, INPUT_LIMITS.postText);
    this.apply({ text, caret: text.length });
    this.notify.info(this.t().api.flow.edAiUsed);
  }

  /** The draft goes after the text, with a blank line between. */
  protected aiAppend(draft: string): void {
    const current = this.text();
    const joined = (current.trim() ? current.replace(/\s+$/, '') + '\n\n' : '') + draft;
    if (joined.length > INPUT_LIMITS.postText) {
      this.notify.error(fmt(this.t().api.flow.edTooLongInsert, { n: INPUT_LIMITS.postText }));
      return;
    }
    this.apply({ text: joined, caret: joined.length });
    this.notify.info(this.t().api.flow.edAiAppended);
  }

  /**
   * The draft becomes a post of its own, in the same collections but SWITCHED OFF, so the person reads it (it
   * is AI text) and switches it on. The panel only asks; this saves, and the post being edited is not touched.
   */
  protected async aiSeparate(draft: string): Promise<void> {
    if (!this.perm.canEdit() || this.aiSaving().includes(draft)) return;
    this.aiSaving.update((l) => [...l, draft]);
    try {
      await this.store.create({
        text: draft.slice(0, INPUT_LIMITS.postText),
        mediaIds: [],
        collectionIds: this.knownCollections(),
        settings: BLANK_SETTINGS,
        active: false,
      });
      this.notify.success(this.t().api.flow.edAiAdded);
    } catch (e) {
      this.notify.error(problemMessage(e) ?? this.t().api.flow.plSaveFailed);
    } finally {
      this.aiSaving.update((l) => l.filter((x) => x !== draft));
    }
  }

  // ----- collections, days, media -----

  protected toggleCollection(id: string): void {
    const on = this.collectionIds();
    if (on.includes(id)) {
      this.writeCollections(on.filter((x) => x !== id));
    } else if (on.length >= INPUT_LIMITS.postCollections) {
      this.errForm.set(fmt(this.t().api.flow.plColMax, { n: INPUT_LIMITS.postCollections }));
    } else {
      this.writeCollections([...on, id]);
      this.errForm.set('');
    }
  }

  /** A collection made from the editor is where the post goes too. */
  protected collectionCreated(id: string): void {
    if (!this.collectionIds().includes(id)) this.toggleCollection(id);
  }

  protected toggleDay(day: number): void {
    const on = this.weekdays();
    this.weekdays.set(
      on.includes(day) ? on.filter((d) => d !== day) : [...on, day].sort((a, b) => a - b),
    );
  }

  /** Attaches the file or takes it off; false (with the message shown) when the post has the most it may. */
  protected toggleMedia(id: string): boolean {
    const on = this.mediaIds();
    if (on.includes(id)) {
      this.writeMedia(on.filter((m) => m !== id));
      return true;
    }
    if (on.length >= INPUT_LIMITS.postMedia) {
      this.errForm.set(fmt(this.t().api.mediaMax, { n: INPUT_LIMITS.postMedia }));
      return false;
    }
    this.writeMedia([...on, id]);
    this.errForm.set('');
    return true;
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
      for (const id of ids) if (!this.attach(id)) break;
    } finally {
      this.uploading.set(false);
    }
  }

  /** Attaches a file that is not attached yet. */
  private attach(id: string): boolean {
    return this.mediaIds().includes(id) || this.toggleMedia(id);
  }

  // ----- saving -----

  /** The post's own settings as the API wants them: null follows the collection, '' means none for this post. */
  private settings(): ApiPostSettings {
    const time = !!this.timeFrom() && !!this.timeTo();
    return {
      ...this.ownMessage(),
      validFrom: this.validFrom() || null,
      validUntil: this.validUntil() || null,
      weekdays: [...this.weekdays()],
      timeFrom: time ? this.timeFrom() : null,
      timeTo: time ? this.timeTo() : null,
      maxPerDay: Number(this.maxPerDay()) || 0,
    };
  }

  /** The chosen collections that still exist (one deleted since the draft was started is left out). */
  private knownCollections(): string[] {
    const ids = this.collectionIds();
    return this.collections.loaded() ? ids.filter((id) => !!this.collections.byId(id)) : [...ids];
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
    const ok = !(this.errText() || this.errDates() || this.errTime() || this.errMax());
    // A problem inside the folded "more options" must be seen: open them.
    if (this.errDates() || this.errTime() || this.errMax()) this.moreOpen.set(true);
    return ok;
  }

  /** Saves the post; `another` then starts the next new post (keeping its collections) instead of closing. */
  protected async save(another = false): Promise<void> {
    if (this.busy() || !this.perm.canEdit() || !this.valid()) return;
    const a = this.t().api.flow;
    const collectionIds = this.knownCollections();
    const body = {
      text: this.text().trim(),
      mediaIds: [...this.mediaIds()],
      collectionIds,
      settings: this.settings(),
    };
    this.busy.set(true);
    this.errForm.set('');
    try {
      const existing = this.post();
      const saved = existing
        ? await this.store.update(existing.id, body)
        : await this.store.create({ ...body, active: this.activeNew() });
      if (another) {
        this.draft.startNew(collectionIds);
        this.notify.success(a.edSavedAnother);
        this.savedAnother.emit(saved);
      } else {
        if (!existing) this.draft.reset();
        this.notify.success(existing ? a.plSaved : a.plCreated);
        this.saved.emit(saved);
      }
    } catch (e) {
      this.errForm.set(problemMessage(e) ?? a.plSaveFailed);
    } finally {
      this.busy.set(false);
    }
  }

  /** Cancel: what was written is thrown away (a new post's draft too) and the panel closes. */
  protected cancel(): void {
    if (this.isNew()) this.draft.reset();
    this.cancelled.emit();
  }
}
