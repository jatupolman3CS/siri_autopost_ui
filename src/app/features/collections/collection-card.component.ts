import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CollectionsStore } from '../../core/data/collections.store';
import { SchedulesStore } from '../../core/data/schedules.store';
import { DraftStore } from '../../core/data/draft.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { ApiCollection } from '../../core/http/api.service';
import { INPUT_LIMITS } from '../../core/http/input-limits';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { CheckboxComponent } from '../../shared/components/checkbox/checkbox.component';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal/confirm-modal.component';
import { PagerComponent } from '../../shared/components/pager/pager.component';
import { RenameModalComponent } from '../../shared/components/rename-modal/rename-modal.component';
import { Pager } from '../../shared/components/pager/pager';
import { COMPOSER_PATH, composerParams } from '../composer/composer-link';
import { CollectionPostRowComponent } from './collection-post-row.component';
import { CollectionSettingsComponent } from './collection-settings.component';
import '../../core/i18n/i18n.flow';

// One collection: icon, name and "N posts · used by N schedules", the buttons (write a post here, schedule it,
// settings, expand), the settings panel and the posts.
@Component({
  selector: 'app-collection-card',
  imports: [
    CollectionPostRowComponent,
    CollectionSettingsComponent,
    PagerComponent,
    CheckboxComponent,
    ConfirmModalComponent,
    RenameModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './collection-card.component.html',
  styleUrl: './collection-card.component.scss',
})
export class CollectionCardComponent {
  private readonly store = inject(CollectionsStore);
  private readonly schedules = inject(SchedulesStore);
  private readonly draft = inject(DraftStore);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  protected readonly perm = inject(PermissionsService);
  protected readonly t = inject(I18nService).t;

  readonly collection = input.required<ApiCollection>();

  protected readonly open = computed(() => this.store.openId() === this.collection().id);
  protected readonly cfgOpen = signal(false);
  protected readonly nameLimit = INPUT_LIMITS.collectionName;
  protected readonly renameOpen = signal(false);
  protected readonly deleteOpen = signal(false);
  protected readonly deleteBody = computed(() =>
    fmt(this.t().api.colDeleteBody, { name: this.collection().name }),
  );
  /** A collection may hold thousands of posts: they are shown a page at a time. */
  protected readonly pager = new Pager(50);

  protected readonly meta = computed(() => {
    const t = this.t();
    const c = this.collection();
    const names = this.schedules.loaded() ? this.schedules.namesUsingCollection(c.id) : [];
    const used = !c.scheduleCount
      ? t.col.notUsed
      : names.length
        ? fmt(t.col.usedIn, { s: names.join(', ') })
        : fmt(t.api.flow.usedInN, { n: c.scheduleCount });
    return fmt(t.col.postsN, { n: c.posts.length }) + ' · ' + used;
  });
  protected readonly posts = computed(() => this.pager.slice(this.collection().posts));

  /** Saves the new name (the store applies it at once and saves it a moment later); a refusal puts the old name back. */
  protected readonly saveName = async (name: string): Promise<void> => {
    this.store.rename(this.collection().id, name);
    await this.store.flush();
    if (this.collection().name !== name) throw new Error('rename refused');
    this.notify.success(this.t().api.itemRenamed);
  };

  /** Switches the collection on or off; the schedules that use it change with it, so they are read again. */
  protected async setActive(on: boolean): Promise<void> {
    if (!this.perm.canEdit()) return;
    try {
      await this.store.setActive(this.collection().id, on);
      this.notify.success(on ? this.t().api.itemSwitchedOn : this.t().api.itemSwitchedOff);
    } catch {
      // The interceptor tells the user.
    }
    void this.schedules.refresh();
  }

  protected readonly remove = async (): Promise<void> => {
    await this.store.remove(this.collection().id);
    this.notify.success(this.t().api.itemDeleted);
  };

  protected toggle(): void {
    this.store.openId.set(this.open() ? null : this.collection().id);
  }

  protected add(): void {
    this.draft.startNew(this.collection().id);
    void this.router.navigate([COMPOSER_PATH], { queryParams: composerParams(this.draft.draft()) });
  }

  protected schedule(): void {
    void this.router.navigate(['/app/schedules'], {
      queryParams: { collection: this.collection().id },
    });
  }
}
