import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CollectionsStore } from '../../core/data/collections.store';
import { MasterPostsStore } from '../../core/data/master-posts.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { ApiCollection } from '../../core/http/api.service';
import { problemMessage } from '../../core/http/problem-details';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { CheckboxComponent } from '../../shared/components/checkbox/checkbox.component';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import '../../core/i18n/i18n.flow';

/** Rows shown at once: the library may hold thousands of posts, so the list is narrowed by searching. */
const SHOWN = 50;

// "Add from the library": the posts of the post library that are not in the collection yet, found by text and
// ticked, put into the collection in one request. They stay in their other collections too. The page shows
// this component only while it is open, so the library is read only when somebody asks for it.
@Component({
  selector: 'app-add-from-library-modal',
  imports: [CheckboxComponent, InputFieldComponent, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="true" [title]="t().api.flow.colAddFromLibTitle" (closed)="closed.emit()">
      <p class="small muted hint">{{ t().api.flow.colAddFromLibHint }}</p>
      @if (!library.loaded()) {
        <p class="muted">—</p>
      } @else {
        <app-input-field
          [label]="t().api.flow.plSearch"
          [placeholder]="t().api.flow.plSearchPh"
          [(value)]="search"
        />
        <div class="list">
          @for (p of shown(); track p.id) {
            <div class="item">
              <app-checkbox
                [ariaLabel]="p.text"
                [checked]="picked().has(p.id)"
                (checkedChange)="toggle(p.id, $event)"
              />
              <span class="text">{{ p.text }}</span>
              @if (!p.active) {
                <span class="small muted">{{ t().api.flow.colPostOff }}</span>
              }
            </div>
          } @empty {
            <p class="small muted">{{ t().api.flow.colAddFromLibEmpty }}</p>
          }
        </div>
        @if (more() > 0) {
          <p class="small muted">{{ moreLine() }}</p>
        }
      }
      @if (error()) {
        <p class="su-field-err" role="alert">{{ error() }}</p>
      }
      <div modal-footer>
        <button type="button" class="su-btn su-btn-sm su-btn-secondary" (click)="closed.emit()">
          {{ t().common.cancel }}
        </button>
        <button
          type="button"
          class="su-btn su-btn-sm su-btn-primary"
          [disabled]="busy() || !picked().size || !perm.canEdit()"
          [attr.title]="perm.editHint() || null"
          (click)="add()"
        >
          {{ addLabel() }}
        </button>
      </div>
    </app-modal>
  `,
  styles: `
    .hint {
      margin: 0 0 12px;
    }
    .list {
      display: flex;
      flex-direction: column;
      max-height: 320px;
      overflow-y: auto;
      margin-top: 12px;
    }
    .item {
      display: flex;
      align-items: center;
      gap: 8px;
      border-top: 1px solid var(--color-border);
    }
    .text {
      flex: 1;
      min-width: 0;
      font-size: 14px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
})
export class AddFromLibraryModalComponent {
  protected readonly library = inject(MasterPostsStore);
  private readonly collections = inject(CollectionsStore);
  private readonly notify = inject(NotificationService);
  protected readonly perm = inject(PermissionsService);
  protected readonly t = inject(I18nService).t;

  readonly collection = input.required<ApiCollection>();
  readonly closed = output<void>();

  protected readonly search = signal('');
  protected readonly picked = signal<ReadonlySet<string>>(new Set());
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  /** Library posts the collection does not hold yet that match the search. */
  private readonly candidates = computed(() => {
    const held = new Set(this.collection().posts.map((p) => p.id));
    const q = this.search().trim().toLowerCase();
    return this.library
      .posts()
      .filter((p) => !held.has(p.id) && !p.collectionIds.includes(this.collection().id))
      .filter((p) => !q || p.text.toLowerCase().includes(q));
  });
  protected readonly shown = computed(() => this.candidates().slice(0, SHOWN));
  protected readonly more = computed(() => Math.max(0, this.candidates().length - SHOWN));
  protected readonly moreLine = computed(() => fmt(this.t().api.flow.colPostsShown, { n: SHOWN }));
  protected readonly addLabel = computed(() =>
    fmt(this.t().api.flow.colAddFromLibGo, { n: this.picked().size }),
  );

  protected toggle(id: string, on: boolean): void {
    this.picked.update((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  protected async add(): Promise<void> {
    if (this.busy() || !this.picked().size || !this.perm.canEdit()) return;
    const ids = [...this.picked()];
    this.busy.set(true);
    this.error.set('');
    try {
      await this.collections.addExistingPosts(this.collection().id, ids);
      this.notify.success(fmt(this.t().api.flow.colAddedN, { n: ids.length }));
      this.closed.emit();
    } catch (e) {
      this.error.set(problemMessage(e) ?? this.t().api.itemActionFailed);
    } finally {
      this.busy.set(false);
    }
  }
}
