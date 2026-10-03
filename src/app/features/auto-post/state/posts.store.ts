import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { problemOf } from '../../../core/http/problem-details';
import { NotificationService } from '../../../core/services/notification.service';
import { CreatePostRequest, Post, PostStatus } from '../models/post.model';
import { PostsApiService } from '../services/posts-api.service';

export type FieldErrors = Record<string, string[]>;

// Signal-based state for the auto-post feature. Provided by auto-post.routes.ts, so it lives
// as long as the user stays inside the feature.
@Injectable()
export class PostsStore {
  private readonly api = inject(PostsApiService);
  private readonly notify = inject(NotificationService);

  private readonly _posts = signal<Post[]>([]);
  private readonly _loading = signal(false);
  private readonly _saving = signal(false);
  private readonly _fieldErrors = signal<FieldErrors>({});

  readonly posts = this._posts.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly fieldErrors = this._fieldErrors.asReadonly();
  readonly countByStatus = computed(() => {
    const counts: Record<PostStatus, number> = { Draft: 0, Scheduled: 0, Published: 0, Failed: 0 };
    for (const p of this._posts()) counts[p.status]++;
    return counts;
  });

  async load(): Promise<void> {
    this._loading.set(true);
    try {
      this._posts.set(await firstValueFrom(this.api.list()));
    } catch {
      // errorInterceptor already told the user.
    } finally {
      this._loading.set(false);
    }
  }

  // Resolves true when saved; on 400 the field errors are exposed through fieldErrors().
  async create(req: CreatePostRequest): Promise<boolean> {
    this._saving.set(true);
    this._fieldErrors.set({});
    try {
      const post = await firstValueFrom(this.api.create(req));
      this._posts.update((list) => [post, ...list]);
      this.notify.success('บันทึกโพสต์แล้ว');
      return true;
    } catch (err) {
      this._fieldErrors.set(problemOf(err)?.errors ?? {});
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await firstValueFrom(this.api.remove(id));
      this._posts.update((list) => list.filter((p) => p.id !== id));
      this.notify.success('ลบโพสต์แล้ว');
    } catch {
      // errorInterceptor already told the user.
    }
  }
}
