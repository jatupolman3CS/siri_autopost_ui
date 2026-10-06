import { Directive, ElementRef, OnInit, inject, output } from '@angular/core';

/**
 * Marks the box a Stripe element is mounted in and says when the box exists, so the element is mounted as
 * soon as its row has opened. The checkout destroys the element itself whenever the row closes (Stripe
 * elements cannot be mounted twice, and a leftover one would hold its iframe).
 */
@Directive({ selector: '[appPaymentHost]' })
export class PaymentHostDirective implements OnInit {
  readonly hostReady = output<HTMLElement>();
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  ngOnInit(): void {
    this.hostReady.emit(this.el.nativeElement);
  }
}
