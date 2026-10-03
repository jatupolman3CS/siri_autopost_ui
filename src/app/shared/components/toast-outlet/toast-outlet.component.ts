import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NotificationService, ToastType } from '../../../core/services/notification.service';

const ICONS: Record<ToastType, [string, string]> = {
  success: ['ph-check-circle', 'var(--color-success)'],
  error: ['ph-x-circle', 'var(--color-danger)'],
  warning: ['ph-warning-circle', 'var(--color-warning)'],
  info: ['ph-info', 'var(--color-primary)'],
};

@Component({
  selector: 'app-toast-outlet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toasts">
      @for (t of notify.toasts(); track t.id) {
        <div class="su-toast" [attr.role]="t.type === 'error' ? 'alert' : 'status'">
          <i
            class="ph su-toast-icon"
            [class]="icons[t.type][0]"
            [style.color]="icons[t.type][1]"
            aria-hidden="true"
          ></i>
          <p class="su-toast-msg">{{ t.message }}</p>
          <button
            type="button"
            class="su-x"
            (click)="notify.dismiss(t.id)"
            aria-label="ปิดการแจ้งเตือนนี้"
          >
            <i class="ph ph-x" aria-hidden="true"></i>
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .toasts {
      pointer-events: none;
      position: fixed;
      top: 0;
      right: 0;
      z-index: 70;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 12px;
      padding: 24px;
      max-width: 100vw;
    }
    .su-toast {
      animation: ap-rise 0.2s ease-out;
    }
  `,
})
export class ToastOutletComponent {
  protected readonly notify = inject(NotificationService);
  protected readonly icons = ICONS;
}
