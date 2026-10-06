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
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Params, Router } from '@angular/router';
import { CollectionsStore } from '../../core/data/collections.store';
import { DraftStore } from '../../core/data/draft.store';
import { MasterPostsStore } from '../../core/data/master-posts.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { ApiBulkPostAction, ApiCollectionPost } from '../../core/http/api.service';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { CheckboxComponent } from '../../shared/components/checkbox/checkbox.component';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal/confirm-modal.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { FlowStepsComponent } from '../../shared/components/flow-steps/flow-steps.component';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';
import { NextStepComponent } from '../../shared/components/next-step/next-step.component';
import { PagerComponent } from '../../shared/components/pager/pager.component';
import { Pager } from '../../shared/components/pager/pager';
import { PermNoteComponent } from '../../shared/components/perm-note/perm-note.component';
import { SelectFieldComponent } from '../../shared/components/select-field/select-field.component';
import { MasterPostCardComponent } from './master-post-card.component';
import { PostEditorComponent } from './post-editor.component';
import { POSTS_PATH, editPostParams, newPostParams } from './posts-link';
import '../../core/i18n/i18n.flow';

export type PostFilter = 'all' | 'on' | 'off' | 'pending' | 'loose';

/** Does the post pass the state filter? */
export function matchesFilter(p: ApiCollectionPost, filter: PostFilter): boolean {
  switch (filter) {
    case 'on':
      return p.active;
    case 'off':
      return !p.active;
    case 'pending':
      return p.approval === 'pending';
    case 'loose':
      return p.collectionIds.length === 0;
    default:
      return true;
  }
}

/** The editor panel at the top of the page: a new post, or one of the library (`key` makes a fresh editor). */
type Panel = { kind: 'new'; key: number } | { kind: 'edit'; post: ApiCollectionPost; key: number };

// Step 1 of the flow: the post library. Every post of the workspace, each managing itself (on/off, own message
// and timing, results, approval), found by search, state and collection and shown a page at a time; a bulk bar
// acts on the selected posts. A post is only later put into collections, and may sit in several. Writing a post
// is here too: ONE editor panel above the list serves "new post" and "edit" (`?new=1&collection=<id>` and
// `?post=<id>`, which is also what the links of the other pages and the old composer address lead to).
@Component({
  selector: 'app-posts-page',
  imports: [
    CheckboxComponent,
    ConfirmModalComponent,
    EmptyStateComponent,
    FlowStepsComponent,
    InputFieldComponent,
    MasterPostCardComponent,
    NextStepComponent,
    PagerComponent,
    PermNoteComponent,
    PostEditorComponent,
    SelectFieldComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './posts-page.component.html',
  styleUrl: './posts-page.component.scss',
})
export class PostsPageComponent {
  protected readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  private readonly injector = inject(Injector);
  protected readonly store = inject(MasterPostsStore);
  protected readonly collections = inject(CollectionsStore);
  protected readonly draft = inject(DraftStore);
  protected readonly perm = inject(PermissionsService);
  protected readonly t = inject(I18nService).t;

  /** `?new=1`: the editor opens on a new post (the draft in progress, or a blank one). */
  readonly openNew = input<string | undefined>(undefined, { alias: 'new' });
  /** `?collection=`: the collection a new post starts in. */
  readonly collection = input<string | undefined>(undefined);
  /** `?post=`: the post to edit. */
  readonly post = input<string | undefined>(undefined);

  protected readonly search = signal('');
  protected readonly filter = signal<PostFilter>('all');
  /** The collection the list is narrowed to ('' = every post). */
  protected readonly collectionFilter = signal('');
  protected readonly pager = new Pager(20);

  protected readonly selection = signal<ReadonlySet<string>>(new Set());
  /** The collection the bulk bar adds to or takes out of. */
  protected readonly bulkCollection = signal('');
  protected readonly bulkBusy = signal(false);

  protected readonly panel = signal<Panel | null>(null);
  private panelKey = 0;
  private readonly panelEl = viewChild<ElementRef<HTMLElement>>('panelEl');
  protected readonly deleting = signal<ApiCollectionPost | null>(null);
  protected readonly bulkDeleteOpen = signal(false);

  constructor() {
    // Counts and times move when schedules run: read both lists again when the page opens.
    void this.store.refresh();
    void this.collections.refresh();
    // The address says what the editor shows (a link, a reload, the back button): `?post=` opens that post once
    // the posts have arrived, `?new=1` a new one, and nothing closes it.
    effect(() => {
      const post = this.post();
      const isNew = this.openNew();
      const collection = this.collection();
      // Only a post to edit waits for the library (reading it only then keeps the effect off its changes otherwise).
      const loaded = post ? this.store.loaded() : true;
      untracked(() => {
        if (post) {
          if (!loaded) return;
          const found = this.store.byId(post);
          if (found) this.showEdit(found);
          else {
            this.notify.info(this.t().api.flow.edPostGone);
            this.panel.set(null);
            this.go({ post: null });
          }
        } else if (isNew !== undefined) {
          this.draft.open(collection);
          this.showNew();
        } else this.panel.set(null);
      });
    });
    // A panel that opens is brought into view (the list below may be long).
    effect(() => {
      if (!this.panel()) return;
      afterNextRender(
        () =>
          this.panelEl()?.nativeElement.scrollIntoView?.({ behavior: 'smooth', block: 'start' }),
        { injector: this.injector },
      );
    });
  }

  protected readonly panelTitle = computed(() =>
    this.panel()?.kind === 'edit' ? this.t().api.flow.plEditTitle : this.t().api.flow.plNewTitle,
  );
  /** The post being edited, as the library holds it now (the copy it was opened with if it is gone meanwhile). */
  protected readonly editPost = computed(() => {
    const p = this.panel();
    return p?.kind === 'edit' ? (this.store.byId(p.post.id) ?? p.post) : null;
  });
  protected readonly editingId = computed(() => {
    const p = this.panel();
    return p?.kind === 'edit' ? p.post.id : null;
  });
  /** The post in progress, for the bar that leads back to it while the panel is closed. */
  protected readonly draftLine = computed(() => {
    const d = this.draft.draft();
    return fmt(this.t().lib.draftBar, { n: d.media.length, c: d.text.length });
  });

  private showNew(): void {
    if (this.panel()?.kind !== 'new') this.panel.set({ kind: 'new', key: ++this.panelKey });
  }

  private showEdit(post: ApiCollectionPost): void {
    if (this.editingId() !== post.id) this.panel.set({ kind: 'edit', post, key: ++this.panelKey });
  }

  /** Writes the editor's state into the address (what the panel shows can be bookmarked and reloaded). */
  private go(params: Params): void {
    void this.router.navigate([POSTS_PATH], { queryParams: params, queryParamsHandling: 'merge' });
  }

  /** "New post": the draft in progress continues, in the collection the list is narrowed to if there is one. */
  protected startNew(): void {
    if (!this.perm.canEdit()) return;
    const c = this.collectionFilter() || null;
    this.draft.open(c);
    this.showNew();
    this.go({ ...newPostParams(c), collection: c, post: null });
  }

  /** The bar's "back to the post": the draft as it is. */
  protected continueDraft(): void {
    this.showNew();
    this.go({ ...newPostParams(null), collection: null, post: null });
  }

  protected edit(post: ApiCollectionPost): void {
    if (!this.perm.canEdit()) return;
    this.showEdit(post);
    this.go({ ...editPostParams(post.id), new: null, collection: null });
  }

  /** Closes the panel; the draft of a new post stays (the bar above the list leads back to it). */
  protected closePanel(): void {
    this.panel.set(null);
    this.go({ new: null, collection: null, post: null });
  }

  /** "Save and add another": the post is saved, and the panel starts the next blank one. */
  protected nextPost(): void {
    this.panel.set({ kind: 'new', key: ++this.panelKey });
    this.go({ ...newPostParams(null), collection: null, post: null });
  }

  protected readonly filters = computed(() => {
    const a = this.t().api.flow;
    const c = this.store.counts();
    return [
      { key: 'all' as const, label: a.plFAll, n: c.all },
      { key: 'on' as const, label: a.plFOn, n: c.on },
      { key: 'off' as const, label: a.plFOff, n: c.off },
      { key: 'pending' as const, label: a.plFPending, n: c.pending },
      { key: 'loose' as const, label: a.plFLoose, n: c.loose },
    ];
  });
  protected readonly collectionOptions = computed(() => [
    { value: '', label: this.t().api.flow.plAnyCollection },
    ...this.collections.collections().map((c) => ({ value: c.id, label: c.name })),
  ]);
  protected readonly bulkOptions = computed(() =>
    this.collections.collections().map((c) => ({ value: c.id, label: c.name })),
  );

  /** The posts that pass the search, the state and the collection (oldest first, as the API lists them). */
  protected readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const state = this.filter();
    const col = this.collectionFilter();
    return this.store
      .posts()
      .filter(
        (p) =>
          matchesFilter(p, state) &&
          (!col || p.collectionIds.includes(col)) &&
          (!q || p.text.toLowerCase().includes(q)),
      );
  });
  protected readonly page = computed(() => this.pager.slice(this.filtered()));
  protected readonly shownLine = computed(() =>
    fmt(this.t().api.flow.plShownN, { n: this.filtered().length }),
  );

  /** The selected posts that still exist (a deleted post drops out of the selection by itself). */
  protected readonly selectedIds = computed(() => {
    const on = this.selection();
    return this.store
      .posts()
      .filter((p) => on.has(p.id))
      .map((p) => p.id);
  });
  protected readonly selectedLine = computed(() =>
    fmt(this.t().api.flow.plBulkSelected, { n: this.selectedIds().length }),
  );
  protected readonly pageSelected = computed(() => {
    const ids = this.page().map((p) => p.id);
    const on = this.selection();
    return ids.length > 0 && ids.every((id) => on.has(id));
  });
  protected readonly bulkDeleteBody = computed(() =>
    fmt(this.t().api.flow.plBulkDeleteBody, { n: this.selectedIds().length }),
  );

  protected isSelected(id: string): boolean {
    return this.selection().has(id);
  }

  protected select(id: string, on: boolean): void {
    this.selection.update((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  /** Selects every post of the page, or clears them when they all are selected already. */
  protected selectPage(on: boolean): void {
    this.selection.update((s) => {
      const next = new Set(s);
      for (const p of this.page()) {
        if (on) next.add(p.id);
        else next.delete(p.id);
      }
      return next;
    });
  }

  protected clearSelection(): void {
    this.selection.set(new Set());
  }

  protected setFilter(filter: PostFilter): void {
    this.filter.set(filter);
    this.pager.go(1);
  }

  protected setSearch(text: string): void {
    this.search.set(text);
    this.pager.go(1);
  }

  protected setCollectionFilter(id: string): void {
    this.collectionFilter.set(id);
    this.pager.go(1);
  }

  /** Runs a bulk action on the selected posts and says how many it changed. */
  protected async bulk(action: ApiBulkPostAction, collectionId?: string): Promise<void> {
    const ids = this.selectedIds();
    if (!ids.length || this.bulkBusy() || !this.perm.canEdit()) return;
    this.bulkBusy.set(true);
    try {
      const n = await this.store.bulk(ids, action, collectionId);
      this.notify.success(fmt(this.t().api.flow.plBulkDone, { n }));
      if (action === 'delete') this.clearSelection();
    } catch {
      // The interceptor tells the user why.
    } finally {
      this.bulkBusy.set(false);
    }
  }

  protected readonly deleteOne = async (): Promise<void> => {
    const post = this.deleting();
    if (!post) return;
    if (!(await this.store.remove(post.id))) throw new Error('delete refused');
    this.notify.success(this.t().api.flow.plDeleted);
  };

  protected readonly deleteSelected = async (): Promise<void> => {
    const ids = this.selectedIds();
    const n = await this.store.bulk(ids, 'delete');
    this.clearSelection();
    this.notify.success(fmt(this.t().api.flow.plBulkDone, { n }));
  };
}
