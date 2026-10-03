import { Routes } from '@angular/router';
import { PostsPageComponent } from './pages/posts-page/posts-page.component';
import { PostsStore } from './state/posts.store';

export const AUTO_POST_ROUTES: Routes = [
  {
    path: '',
    providers: [PostsStore],
    children: [
      { path: '', component: PostsPageComponent, title: 'โพสต์อัตโนมัติ · SIRI.AUTOPOST' },
    ],
  },
];
