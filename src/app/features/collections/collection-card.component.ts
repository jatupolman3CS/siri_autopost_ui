import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CollectionsStore } from '../../core/data/collections.store';
import { SchedulesStore } from '../../core/data/schedules.store';
import { DraftStore } from '../../core/data/draft.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { ApiCollection } from '../../core/http/api.service';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { COMPOSER_PATH, composerParams } from '../composer/composer-link';
import { CollectionPostRowComponent } from './collection-post-row.component';
import { CollectionSettingsComponent } from './collection-settings.component';
import '../../core/i18n/i18n.flow';

/** Posts shown before "show more": a collection may hold thousands. */
const PAGE = 50;

// One collection: icon, name and "N posts · used by N schedules", the buttons (write a post here, schedule it,
// settings, expand), the settings panel and the posts.
@Component({
  selector: 'app-collection-card',
  imports: [CollectionPostRowComponent, CollectionSettingsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './collection-card.component.html',
  styleUrl: './collection-card.component.scss',
})
export class CollectionCardComponent {
  private readonly store = inject(CollectionsStore);
  private readonly schedules = inject(SchedulesStore);
  private readonly draft = inject(DraftStore);
  private readonly router = inject(Router);
  protected readonly perm = inject(PermissionsService);
  protected readonly t = inject(I18nService).t;

  readonly collection = input.required<ApiCollection>();

  protected readonly open = computed(() => this.store.openId() === this.collection().id);
  protected readonly cfgOpen = signal(false);
  private readonly shown = signal(PAGE);

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
  protected readonly posts = computed(() => this.collection().posts.slice(0, this.shown()));
  protected readonly more = computed(() =>
    Math.max(0, this.collection().posts.length - this.shown()),
  );
  protected readonly moreLabel = computed(() =>
    fmt(this.t().api.flow.showMorePosts, { n: this.more() }),
  );

  protected toggle(): void {
    this.store.openId.set(this.open() ? null : this.collection().id);
  }

  protected showMore(): void {
    this.shown.update((n) => n + PAGE);
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
