import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CollectionsStore } from '../../core/data/collections.store';
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
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { NextStepComponent } from '../../shared/components/next-step/next-step.component';
import { PagerComponent } from '../../shared/components/pager/pager.component';
import { Pager } from '../../shared/components/pager/pager';
import { PermNoteComponent } from '../../shared/components/perm-note/perm-note.component';
import { SelectFieldComponent } from '../../shared/components/select-field/select-field.component';
import { MasterPostCardComponent } from './master-post-card.component';
import { PostEditorComponent } from './post-editor.component';
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

// Step 1 of the flow: the post library. Every post of the workspace, each managing itself (on/off, own message
// and timing, results, approval), found by search, state and collection and shown a page at a time; a bulk bar
// acts on the selected posts. A post is only later put into collections, and may sit in several.
@Component({
  selector: 'app-posts-page',
  imports: [
    CheckboxComponent,
    ConfirmModalComponent,
    EmptyStateComponent,
    FlowStepsComponent,
    InputFieldComponent,
    MasterPostCardComponent,
    ModalComponent,
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
  protected readonly store = inject(MasterPostsStore);
  protected readonly collections = inject(CollectionsStore);
  protected readonly perm = inject(PermissionsService);
  protected readonly t = inject(I18nService).t;

  protected readonly search = signal('');
  protected readonly filter = signal<PostFilter>('all');
  /** The collection the list is narrowed to ('' = every post). */
  protected readonly collectionFilter = signal('');
  protected readonly pager = new Pager(20);

  protected readonly selection = signal<ReadonlySet<string>>(new Set());
  /** The collection the bulk bar adds to or takes out of. */
  protected readonly bulkCollection = signal('');
  protected readonly bulkBusy = signal(false);

  protected readonly newOpen = signal(false);
  protected readonly deleting = signal<ApiCollectionPost | null>(null);
  protected readonly bulkDeleteOpen = signal(false);

  constructor() {
    // Counts and times move when schedules run: read both lists again when the page opens.
    void this.store.refresh();
    void this.collections.refresh();
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

  /** What a new post starts in: the collection the list is narrowed to. */
  protected readonly startIn = computed(() => {
    const c = this.collectionFilter();
    return c ? [c] : [];
  });

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
