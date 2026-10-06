import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  TemplateRef,
  computed,
  contentChild,
  input,
  model,
  viewChildren,
} from '@angular/core';
import { PaymentMethodId } from '../../../core/payments/payment.types';
import { PaymentMethodIconComponent } from './payment-method-icon.component';

export interface PaymentMethodRow {
  id: PaymentMethodId;
  label: string;
  /** A few words under the label ("credit / debit", "scan QR"). */
  hint?: string;
  disabled?: boolean;
}

let nextId = 0;

// The ways to pay as one radio list, one row each, with its mark. The picked row opens and shows the
// <ng-template> given as content (its context's $implicit is the row id), the way Stripe's own accordion
// does. Keyboard: arrows, Home and End move the pick, like any radio group.
//
//   <app-payment-method-list [methods]="rows" [(selected)]="method">
//     <ng-template let-id> ... the form of method `id` ... </ng-template>
//   </app-payment-method-list>
@Component({
  selector: 'app-payment-method-list',
  imports: [NgTemplateOutlet, PaymentMethodIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './payment-method-list.component.html',
  styleUrl: './payment-method-list.component.scss',
})
export class PaymentMethodListComponent {
  readonly methods = input.required<readonly PaymentMethodRow[]>();
  readonly selected = model<PaymentMethodId | null>(null);
  /** Names the group for screen readers. */
  readonly label = input('');

  protected readonly panel = contentChild(TemplateRef);
  private readonly rows = viewChildren<ElementRef<HTMLButtonElement>>('row');
  protected readonly uid = `pm-${nextId++}`;

  /** Roving tabindex: only one row is a Tab stop, the picked one (else the first that can be picked). */
  protected readonly stop = computed(() => {
    const picked = this.selected();
    const list = this.methods();
    if (picked && list.some((m) => m.id === picked && !m.disabled)) return picked;
    return list.find((m) => !m.disabled)?.id ?? null;
  });

  protected pick(row: PaymentMethodRow): void {
    if (!row.disabled) this.selected.set(row.id);
  }

  protected onKey(event: KeyboardEvent, from: PaymentMethodId): void {
    const list = this.methods();
    const step =
      event.key === 'ArrowDown' || event.key === 'ArrowRight'
        ? 1
        : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
          ? -1
          : 0;
    const to =
      event.key === 'Home'
        ? this.edge(list, 1, -1)
        : event.key === 'End'
          ? this.edge(list, -1, list.length)
          : step
            ? this.next(list, from, step)
            : null;
    if (to === null) return;
    event.preventDefault();
    this.selected.set(list[to].id);
    // The roving tab stop follows the pick once the view has updated; focus the row now.
    this.rows()[to]?.nativeElement.focus();
  }

  /** The nearest row that can be picked after `from` in `dir`, wrapping around. */
  private next(
    list: readonly PaymentMethodRow[],
    from: PaymentMethodId,
    dir: 1 | -1,
  ): number | null {
    const n = list.length;
    const at = list.findIndex((m) => m.id === from);
    for (let i = 1; i < n; i++) {
      const j = (((at + dir * i) % n) + n) % n;
      if (!list[j].disabled) return j;
    }
    return null;
  }

  /** The first row that can be picked going from just past `from` in `dir`. */
  private edge(list: readonly PaymentMethodRow[], dir: 1 | -1, from: number): number | null {
    for (let j = from + dir; j >= 0 && j < list.length; j += dir) if (!list[j].disabled) return j;
    return null;
  }
}
