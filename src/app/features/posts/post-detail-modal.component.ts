import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { AccountsStore, extensionNameOf } from '../../core/data/accounts.store';
import { CollectionsStore } from '../../core/data/collections.store';
import { DevicesStore } from '../../core/data/devices.store';
import { LinkSetsStore } from '../../core/data/link-sets.store';
import { PostsStore } from '../../core/data/posts.store';
import { SchedulesStore } from '../../core/data/schedules.store';
import { fmtDate, hm } from '../../core/i18n/format';
import { I18nService } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { LIGHT_COLOR, isOverdue, lightOf } from './post-light';
import { PostActionsService } from './post-actions.service';

/**
 * The window of ONE post (opened from the timeline's dots and from the dots of a schedule): what it is, where and
 * when it goes, why it failed, and the three things a person does with it: edit the library post it came from, post
 * it now (the queue-jumping "post now"), or rerun it when it failed. It reads the post by id from `PostsStore`, so
 * it follows the post while it changes (queued, posting, posted) and closes itself when the post is gone.
 */
@Component({
  selector: 'app-post-detail-modal',
  imports: [ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './post-detail-modal.component.html',
  styleUrl: './post-detail-modal.component.scss',
})
export class PostDetailModalComponent {
  /** The post to show; null keeps the window closed. */
  readonly postId = input<string | null>(null);
  readonly closed = output<void>();

  private readonly i18n = inject(I18nService);
  private readonly posts = inject(PostsStore);
  private readonly schedules = inject(SchedulesStore);
  private readonly collections = inject(CollectionsStore);
  private readonly linkSets = inject(LinkSetsStore);
  private readonly accounts = inject(AccountsStore);
  private readonly devices = inject(DevicesStore);
  protected readonly actions = inject(PostActionsService);
  protected readonly t = this.i18n.t;

  protected readonly item = computed(() => {
    const id = this.postId();
    return id ? (this.posts.items().find((p) => p.id === id) ?? null) : null;
  });

  protected readonly view = computed(() => {
    const p = this.item();
    if (!p) return null;
    const t = this.t();
    const li = this.i18n.li();
    const schedule = this.schedules.byId(p.scheduleId);
    const collection = this.collections.byId(schedule?.collectionId);
    const set = schedule ? this.linkSets.byId(schedule.linkSetId) : undefined;
    const account = this.accounts.byId(p.accountId);
    const reason = p.code ? t.reasons[p.code] : null;
    const text =
      p.text.trim() || (this.collections.postById(p.collectionPostId)?.post.text ?? '').trim();
    const blocked = this.actions.runBlockedReason(p);
    return {
      light: lightOf(p),
      color: LIGHT_COLOR[lightOf(p)],
      status: t.status[p.status],
      when: `${fmtDate(p.dt, li, true)} ${hm(p.dt)}`,
      published: p.publishedAt ? `${fmtDate(p.publishedAt, li, true)} ${hm(p.publishedAt)}` : '',
      schedule: schedule?.name ?? '',
      pair: schedule ? `${collection?.name ?? '—'} → ${set?.name ?? '—'}` : '',
      extension: account ? extensionNameOf(account, this.devices.list()) : '',
      text,
      media: p.mediaIds.length,
      reasonTitle: reason?.title ?? '',
      // What the extension or the server reported says more than the generic reason.
      reasonDetail: p.detail ?? '',
      code: p.groupCode ?? '',
      rushed: p.rushed ?? false,
      overdue: isOverdue(p, this.posts.now()),
      failed: p.status === 'failed',
      runLabel: p.status === 'failed' ? t.api.flow.pdRerun : t.api.flow.pdRunNow,
      blocked,
      canEdit: this.actions.canEdit(p),
      editHint: this.actions.libraryPostOf(p) || p.status === 'queued' ? '' : t.api.flow.pdNoEdit,
    };
  });

  protected readonly busy = computed(() => {
    const p = this.item();
    return !!p && this.actions.isBusy(p.id);
  });

  protected async run(): Promise<void> {
    const p = this.item();
    if (!p) return;
    if (await this.actions.runNow(p)) this.closed.emit();
  }

  protected edit(): void {
    const p = this.item();
    if (!p) return;
    this.actions.edit(p);
    this.closed.emit();
  }
}
