import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ThaiDatePipe } from '../../../../shared/pipes/thai-date.pipe';
import { POST_STATUS_LABEL, Post } from '../../models/post.model';

@Component({
  selector: 'app-post-list',
  imports: [ThaiDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './post-list.component.html',
  styleUrl: './post-list.component.scss',
})
export class PostListComponent {
  readonly posts = input.required<Post[]>();
  readonly deleted = output<Post>();

  protected readonly statusLabel = POST_STATUS_LABEL;
}
