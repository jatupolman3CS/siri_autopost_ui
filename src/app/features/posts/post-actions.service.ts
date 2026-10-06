import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AccountsStore } from '../../core/data/accounts.store';
import { CollectionsStore } from '../../core/data/collections.store';
import { DraftStore } from '../../core/data/draft.store';
import { PostItem } from '../../core/data/models';
import { PermissionsService } from '../../core/data/permissions.service';
import { PostsStore } from '../../core/data/posts.store';
import { I18nService } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';
import { NotificationService } from '../../core/services/notification.service';
import { POSTS_PATH, editPostParams, newPostParams } from './posts-link';
import { canRunNow } from './post-light';

/**
 * What a person can do with ONE post wherever it is shown (the timeline, the dots of a schedule, the calendar): open
 * the library post it came from in the editor, and "post now", which also reruns a failed post at once.
 */
@Injectable({ providedIn: 'root' })
export class PostActionsService {
  private readonly router = inject(Router);
  private readonly posts = inject(PostsStore);
  private readonly accounts = inject(AccountsStore);
  private readonly collections = inject(CollectionsStore);
  private readonly draft = inject(DraftStore);
  private readonly perm = inject(PermissionsService);
  private readonly notify = inject(NotificationService);
  private readonly t = inject(I18nService).t;

  /** The posts whose "post now" is on its way to the server. */
  private readonly busy = signal<ReadonlySet<string>>(new Set());

  isBusy(id: string): boolean {
    return this.busy().has(id);
  }

  /** The library post this task was made from, when it still exists. */
  libraryPostOf(p: Pick<PostItem, 'collectionPostId'>) {
    return this.collections.postById(p.collectionPostId);
  }

  /** The browser that posts for the task's account is paired (once the accounts have arrived; before that, assumed). */
  private browserBound(p: Pick<PostItem, 'accountId'>): boolean {
    if (!this.accounts.loaded()) return true;
    return this.accounts.connected().some((a) => a.id === p.accountId);
  }

  /**
   * Why "post now" is off for this post, '' when it is on. The texts are hints for the button's title: a viewer, a post
   * that cannot be sent again, a browser that was unbound.
   */
  runBlockedReason(p: Pick<PostItem, 'status' | 'accountId'>): string {
    const f = this.t().api.flow;
    if (!this.perm.canEdit()) return this.perm.editHint();
    if (!canRunNow(p)) return f.pdCannotRun;
    if (!this.browserBound(p)) return f.pdUnbound;
    return '';
  }

  /** "Post now" / rerun. Resolves true when the server queued it (a refusal is toasted by the error interceptor). */
  async runNow(p: Pick<PostItem, 'id' | 'status' | 'accountId'>): Promise<boolean> {
    if (this.runBlockedReason(p) || this.isBusy(p.id)) return false;
    const rerun = p.status === 'failed';
    this.busy.update((s) => new Set(s).add(p.id));
    try {
      await this.posts.runNow(p.id);
    } catch {
      return false;
    } finally {
      this.busy.update((s) => {
        const next = new Set(s);
        next.delete(p.id);
        return next;
      });
    }
    const f = this.t().api.flow;
    this.notify.success(rerun ? f.rerunDone : f.runNowDone);
    return true;
  }

  /** Whether the editor can open for this task (its library post is known, or it is a queued one that can start a draft). */
  canEdit(p: Pick<PostItem, 'collectionPostId' | 'isTest' | 'status'>): boolean {
    if (!this.perm.canEdit() || p.isTest) return false;
    return !!this.libraryPostOf(p) || p.status === 'queued';
  }

  /**
   * Opens the library post a task came from in the post library's editor. A task that has none (made before
   * collections existed) starts a new post with its text and media, to be saved from there.
   */
  edit(p: Pick<PostItem, 'collectionPostId' | 'text' | 'mediaIds'>): void {
    const found = this.libraryPostOf(p);
    if (found) {
      void this.router.navigate([POSTS_PATH], { queryParams: editPostParams(found.post.id) });
      return;
    }
    this.draft.startNew();
    this.draft.patch({ text: p.text, media: p.mediaIds });
    void this.router.navigate([POSTS_PATH], { queryParams: newPostParams() });
  }
}
