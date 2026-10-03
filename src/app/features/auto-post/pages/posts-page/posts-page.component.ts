import { ChangeDetectionStrategy, Component, OnInit, inject, viewChild } from '@angular/core';
import { SpinnerComponent } from '../../../../shared/components/spinner/spinner.component';
import { PostFormComponent } from '../../components/post-form/post-form.component';
import { PostListComponent } from '../../components/post-list/post-list.component';
import { CreatePostRequest, Post } from '../../models/post.model';
import { PostsStore } from '../../state/posts.store';

// Smart page: owns the store, passes data down to the dumb form and list.
@Component({
  selector: 'app-posts-page',
  imports: [PostFormComponent, PostListComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './posts-page.component.html',
  styleUrl: './posts-page.component.scss',
})
export class PostsPageComponent implements OnInit {
  protected readonly store = inject(PostsStore);
  private readonly form = viewChild.required(PostFormComponent);

  ngOnInit(): void {
    void this.store.load();
  }

  protected async create(req: CreatePostRequest): Promise<void> {
    if (await this.store.create(req)) this.form().reset();
  }

  protected remove(post: Post): void {
    if (confirm('ลบโพสต์นี้?')) void this.store.remove(post.id);
  }
}
