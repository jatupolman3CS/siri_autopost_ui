import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PAYMENT_METHODS, PaymentMethodId } from '../../../core/payments/payment.types';
import { PaymentMethodListComponent, PaymentMethodRow } from './payment-method-list.component';

@Component({
  imports: [PaymentMethodListComponent],
  template: `
    <app-payment-method-list [methods]="rows()" [(selected)]="picked" label="Pay with">
      <ng-template let-id
        ><p class="form">form of {{ id }}</p></ng-template
      >
    </app-payment-method-list>
  `,
})
class HostComponent {
  readonly rows = signal<PaymentMethodRow[]>(
    PAYMENT_METHODS.map((id) => ({ id, label: `label ${id}` })),
  );
  readonly picked = signal<PaymentMethodId | null>('card');
}

describe('PaymentMethodListComponent', () => {
  function open() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const rows = () => [...el.querySelectorAll<HTMLButtonElement>('button[role="radio"]')];
    return { fixture, el, host: fixture.componentInstance, rows };
  }

  it('lists the five ways to pay in order, each with its mark', () => {
    const { el, rows } = open();
    expect(rows().map((r) => r.dataset['method'])).toEqual([
      'card',
      'apple_pay',
      'google_pay',
      'link',
      'promptpay',
    ]);
    expect(el.querySelectorAll('app-payment-method-icon svg').length).toBe(5);
    expect(el.querySelector('[role="radiogroup"]')?.getAttribute('aria-label')).toBe('Pay with');
  });

  it('opens only the picked row and shows the form of that method under it', () => {
    const { fixture, el, rows } = open();
    expect(rows().map((r) => r.getAttribute('aria-checked'))).toEqual([
      'true',
      'false',
      'false',
      'false',
      'false',
    ]);
    expect(el.querySelectorAll('.form').length).toBe(1);
    expect(el.querySelector('.form')?.textContent).toBe('form of card');

    rows()[4].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.picked()).toBe('promptpay');
    expect(el.querySelectorAll('.form').length).toBe(1);
    expect(el.querySelector('.form')?.textContent).toBe('form of promptpay');
    expect(rows()[4].getAttribute('aria-checked')).toBe('true');
  });

  it('moves the pick with the arrow keys, wraps around and skips a row that is off', () => {
    const { fixture, host, rows } = open();
    host.rows.update((r) => r.map((m) => (m.id === 'apple_pay' ? { ...m, disabled: true } : m)));
    fixture.detectChanges();

    const press = (key: string) => {
      rows()
        .find((r) => r.getAttribute('aria-checked') === 'true')!
        .dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      fixture.detectChanges();
    };
    press('ArrowDown');
    expect(host.picked()).toBe('google_pay'); // apple_pay is off
    press('End');
    expect(host.picked()).toBe('promptpay');
    press('ArrowDown');
    expect(host.picked()).toBe('card'); // wraps
    press('ArrowUp');
    expect(host.picked()).toBe('promptpay');
    press('Home');
    expect(host.picked()).toBe('card');
  });

  it('does not pick a row that is off, and has one Tab stop (the picked row)', () => {
    const { fixture, host, rows } = open();
    host.rows.update((r) => r.map((m) => (m.id === 'link' ? { ...m, disabled: true } : m)));
    fixture.detectChanges();

    rows()[3].click();
    expect(host.picked()).toBe('card');
    expect(
      rows()
        .filter((r) => r.tabIndex === 0)
        .map((r) => r.dataset['method']),
    ).toEqual(['card']);

    host.picked.set(null);
    fixture.detectChanges();
    // Nothing picked: the first row is the way in.
    expect(
      rows()
        .filter((r) => r.tabIndex === 0)
        .map((r) => r.dataset['method']),
    ).toEqual(['card']);
  });
});
