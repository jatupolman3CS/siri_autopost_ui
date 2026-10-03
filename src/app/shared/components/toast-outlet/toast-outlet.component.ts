import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-toast-outlet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toasts" aria-live="polite">
      @for (t of notify.toasts(); track t.id) {
        <div class="toast" [class]="t.kind" role="status">
          <span>{{ t.text }}</span>
          <button type="button" class="close" (click)="notify.dismiss(t.id)" aria-label="ปิด">
            ×
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .toasts {
      position: fixed;
      right: var(--space-md);
      bottom: var(--space-md);
      z-index: 100;
      display: grid;
      gap: var(--space-sm);
      max-width: min(420px, calc(100vw - 2 * var(--space-md)));
    }
    .toast {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      padding: var(--space-sm) var(--space-md);
      border: 1px solid var(--color-border);
      border-left: 4px solid var(--color-primary);
      border-radius: var(--radius-md);
      background: var(--color-bg);
      box-shadow: var(--shadow-lg);
    }
    .toast.success {
      border-left-color: var(--color-success);
    }
    .toast.error {
      border-left-color: var(--color-danger);
    }
    .close {
      margin-left: auto;
      border: 0;
      background: none;
      color: var(--color-text-muted);
      font-size: var(--text-lg);
      cursor: pointer;
    }
  `,
})
export class ToastOutletComponent {
  protected readonly notify = inject(NotificationService);
}
