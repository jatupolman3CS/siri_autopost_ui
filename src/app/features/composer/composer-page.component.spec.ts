import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DraftStore } from '../../core/data/draft.store';
import { PostsStore } from '../../core/data/posts.store';
import { ComposerPageComponent } from './composer-page.component';

describe('ComposerPageComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [ComposerPageComponent],
      providers: [provideRouter([{ path: '**', children: [] }])],
    });
  });

  function submit() {
    const fixture = TestBed.createComponent(ComposerPageComponent);
    fixture.detectChanges();
    const btn = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '.bottom .su-btn-primary',
    )!;
    btn.click();
    fixture.detectChanges();
    return fixture;
  }

  it('shows errors and queues nothing for an empty post in the past', () => {
    const draft = TestBed.inject(DraftStore);
    draft.patch({ targets: {}, date: '2020-01-01' });
    const before = TestBed.inject(PostsStore).posts().length;
    submit();
    expect(draft.draft().errText).not.toBe('');
    expect(draft.draft().errTargets).not.toBe('');
    expect(draft.draft().errTime).not.toBe('');
    expect(TestBed.inject(PostsStore).posts().length).toBe(before);
  });

  it('queues one task per selected group plus one per other account', () => {
    const draft = TestBed.inject(DraftStore);
    const tomorrow = new Date(Date.now() + 864e5);
    const date = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    draft.patch({
      text: 'โปรวันนี้',
      date,
      targets: { a1: true, a3: true },
      groups: ['A', 'B', 'C'],
    });
    const posts = TestBed.inject(PostsStore);
    const before = posts.posts().length;
    submit();
    expect(posts.posts().length).toBe(before + 4);
    expect(draft.draft().text).toBe('');
  });
});
