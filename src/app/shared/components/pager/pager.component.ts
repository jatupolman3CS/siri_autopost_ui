import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService, fmt } from '../../../core/i18n/i18n.service';
import { PAGE_SIZES, Pager } from './pager';

// Page controls for a list: "21–40 of 130", previous / next and a page size choice.
@Component({
  selector: 'app-pager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pager.component.html',
  styleUrl: './pager.component.scss',
})
export class PagerComponent {
  private readonly i18n = inject(I18nService);
  protected readonly t = computed(() => this.i18n.t().common);
  protected readonly sizes = PAGE_SIZES;

  readonly pager = input.required<Pager>();

  protected readonly range = computed(() => {
    const p = this.pager();
    return fmt(this.t().pgRange, { a: p.from(), b: p.to(), n: p.count() });
  });
  protected readonly pageOf = computed(() => {
    const p = this.pager();
    return fmt(this.t().pgPage, { p: p.page(), n: p.pageCount() });
  });

  protected onSize(el: HTMLSelectElement): void {
    this.pager().setSize(Number(el.value));
  }
}
