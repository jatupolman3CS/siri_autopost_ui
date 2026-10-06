import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PaymentMethodId } from '../../../core/payments/payment.types';

// The mark of one way to pay, drawn inline so nothing is fetched. They are stylised stand-ins that follow
// each brand's colours; Stripe draws the official buttons (Apple Pay, Google Pay, Link) when they are used.
@Component({
  selector: 'app-payment-method-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': '"pmi pmi-" + method()', 'aria-hidden': 'true' },
  template: `
    @switch (method()) {
      @case ('card') {
        <svg
          viewBox="0 0 32 32"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <rect x="3" y="7" width="26" height="18" rx="3" />
          <path d="M3 13h26M8 20h6" stroke-linecap="round" />
        </svg>
      }
      @case ('apple_pay') {
        <svg viewBox="0 0 44 18" width="40" height="16" fill="currentColor">
          <path
            transform="translate(1 -1.5) scale(.75)"
            d="M12.15 6.9c-.95 0-2.42-1.08-3.96-1.04-2.04.03-3.91 1.18-4.96 3.01-2.12 3.68-.55 9.1 1.52 12.09 1.01 1.45 2.21 3.09 3.79 3.04 1.52-.07 2.09-.99 3.94-.99 1.83 0 2.35.99 3.96.95 1.64-.03 2.68-1.48 3.68-2.95 1.16-1.69 1.64-3.33 1.66-3.42-.04-.01-3.18-1.22-3.22-4.86-.03-3.04 2.48-4.49 2.6-4.56-1.43-2.09-3.62-2.32-4.39-2.38-2-.16-3.68 1.09-4.61 1.09zM15.53 3.83c.84-1.01 1.4-2.43 1.25-3.83-1.21.05-2.66.8-3.53 1.82-.78.9-1.45 2.34-1.27 3.71 1.34.1 2.72-.69 3.56-1.7z"
          />
          <text x="15" y="14" font-size="12" font-weight="600" font-family="system-ui, sans-serif">
            Pay
          </text>
        </svg>
      }
      @case ('google_pay') {
        <svg
          viewBox="0 0 44 18"
          width="40"
          height="16"
          font-family="system-ui, sans-serif"
          font-weight="600"
        >
          <text x="0" y="14" font-size="14" fill="#4285f4">G</text>
          <text x="13" y="14" font-size="12" fill="currentColor">Pay</text>
        </svg>
      }
      @case ('link') {
        <svg
          viewBox="0 0 32 32"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          stroke-width="4"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M11 6l11 10-11 10" />
        </svg>
      }
      @case ('promptpay') {
        <svg
          viewBox="0 0 44 26"
          width="36"
          height="22"
          fill="currentColor"
          font-family="system-ui, sans-serif"
          font-weight="700"
        >
          <text x="22" y="11" font-size="10.5" text-anchor="middle">Prompt</text>
          <text x="22" y="23" font-size="12.5" text-anchor="middle">Pay</text>
        </svg>
      }
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: none;
      width: 52px;
      height: 36px;
      border-radius: var(--radius-md);
      border: 1px solid var(--color-border);
      background: var(--color-bg);
      color: var(--color-text);
    }
    :host(.pmi-card) {
      background: var(--color-surface-muted);
    }
    :host(.pmi-apple_pay) {
      background: #000;
      color: #fff;
      border-color: #000;
    }
    :host(.pmi-link) {
      background: #00d66f;
      border-color: #00d66f;
      color: #011e0f;
    }
    :host(.pmi-promptpay) {
      background: #113566;
      border-color: #113566;
      color: #fff;
    }
  `,
})
export class PaymentMethodIconComponent {
  readonly method = input.required<PaymentMethodId>();
}
