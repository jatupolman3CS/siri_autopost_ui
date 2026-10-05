import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CollectionsStore } from '../../core/data/collections.store';
import { DevicesStore } from '../../core/data/devices.store';
import { ExtensionStore } from '../../core/data/extension.store';
import { LinkSetsStore } from '../../core/data/link-sets.store';
import { SchedulesStore } from '../../core/data/schedules.store';
import { SettingsStore } from '../../core/data/settings.store';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { COMPOSER_PATH } from '../composer/composer-link';

type HubStep = 'links' | 'posts' | 'schedule';

// The "three steps" card at the top of the overview: link the groups, write the posts, set the schedule. Each
// step shows whether it is done and what there is so far; the first step that is not done gets the primary
// button, and when all three are done the last one keeps it (the schedules are where the work goes on). The
// line above the steps says whether the extension is ready, with a button to pair a computer when there is none.
@Component({
  selector: 'app-overview-hub',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './overview-hub.component.html',
  styleUrl: './overview-hub.component.scss',
})
export class OverviewHubComponent {
  private readonly router = inject(Router);
  private readonly linkSets = inject(LinkSetsStore);
  private readonly collections = inject(CollectionsStore);
  private readonly schedules = inject(SchedulesStore);
  private readonly devices = inject(DevicesStore);
  private readonly settings = inject(SettingsStore);
  private readonly extension = inject(ExtensionStore);
  protected readonly t = inject(I18nService).t;

  /** The three lists have arrived: until then no step is called done and the figures read "—". */
  private readonly ready = computed(
    () => this.linkSets.loaded() && this.collections.loaded() && this.schedules.loaded(),
  );

  protected readonly steps = computed(() => {
    const ov = this.t().ov;
    const ready = this.ready();
    // A post may sit in several collections: it counts once.
    const posts = new Set(this.collections.collections().flatMap((c) => c.posts.map((p) => p.id)))
      .size;
    const defs: { id: HubStep; done: boolean; title: string; detail: string; action: string }[] = [
      {
        id: 'links',
        done: this.linkSets.linkCount() > 0,
        title: ov.s1,
        detail: fmt(ov.s1d, { n: this.linkSets.linkCount(), m: this.linkSets.setCount() }),
        action: ov.s1a,
      },
      {
        id: 'posts',
        done: posts > 0,
        title: ov.s2,
        detail: fmt(ov.s2d, { n: posts, m: this.collections.collections().length }),
        action: ov.s2a,
      },
      {
        id: 'schedule',
        done: this.schedules.activeCount() > 0,
        title: ov.s3,
        detail: fmt(ov.s3d, {
          n: this.schedules.activeCount(),
          k: this.schedules.todayCount(),
        }),
        action: ov.s3a,
      },
    ];
    const firstTodo = defs.findIndex((d) => !d.done);
    return defs.map((d, i) => ({
      ...d,
      n: i + 1,
      done: ready && d.done,
      detail: ready ? d.detail : '—',
      primary: ready && (i === firstTodo || (firstTodo < 0 && i === 2)),
    }));
  });

  /** Whether the extension is ready; null while the computers or the engine are still being read. */
  protected readonly extStatus = computed(() => {
    if (!this.devices.loaded()) return null;
    const list = this.devices.list();
    if (!list.length) {
      return { text: this.t().ov.extNone, dot: 'var(--color-text-muted)', needPair: true };
    }
    if (!this.settings.loaded()) return null;
    const dev = list.find((d) => d.online) ?? list[0];
    return this.extension.online()
      ? {
          text: fmt(this.t().ov.extOk, { d: dev.name }),
          dot: 'var(--color-success)',
          needPair: false,
        }
      : { text: this.t().ov.extNo, dot: 'var(--color-danger)', needPair: false };
  });

  protected go(id: HubStep): void {
    if (id === 'links') void this.router.navigateByUrl('/app/targets');
    else if (id === 'posts') {
      // The composer starts a post in the collection that was last used (or is open), if there is one.
      const collection = this.collections.lastId() ?? this.collections.openId();
      void this.router.navigate([COMPOSER_PATH], {
        queryParams: collection && this.collections.byId(collection) ? { collection } : {},
      });
    } else void this.router.navigate(['/app/schedules'], { queryParams: { new: 1 } });
  }
}
