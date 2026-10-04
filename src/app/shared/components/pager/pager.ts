import { computed, signal, untracked } from '@angular/core';

export const PAGE_SIZES = [10, 20, 50, 100] as const;

/**
 * Client-side paging of a list that is already in memory: `slice(items)` returns the current page. The page
 * is clamped when the list shrinks, so a filter or a delete never leaves the view on an empty page.
 */
export class Pager {
  readonly size = signal<number>(20);
  private readonly requested = signal(1);
  private readonly total = signal(0);

  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / this.size())));
  readonly page = computed(() => Math.min(this.requested(), this.pageCount()));
  readonly count = this.total.asReadonly();
  /** 1-based position of the first and last row on this page (0 when empty). */
  readonly from = computed(() => (this.total() === 0 ? 0 : (this.page() - 1) * this.size() + 1));
  readonly to = computed(() => Math.min(this.total(), this.page() * this.size()));
  /** More than the smallest page size: the controls are worth showing. */
  readonly visible = computed(() => this.total() > PAGE_SIZES[0]);

  constructor(size = 20) {
    this.size.set(size);
  }

  /** Returns the current page of `items`. Call it inside a `computed`, so it follows the list and the page. */
  slice<T>(items: readonly T[]): T[] {
    // Recording the length writes a signal; untracked makes that legal inside the caller's `computed`.
    untracked(() => this.total.set(items.length));
    const start = (this.page() - 1) * this.size();
    return items.slice(start, start + this.size());
  }

  go(page: number): void {
    this.requested.set(Math.min(Math.max(1, Math.floor(page)), this.pageCount()));
  }

  setSize(size: number): void {
    this.size.set(size);
    this.requested.set(1);
  }
}
