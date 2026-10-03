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
  templateUrl: './toast-outlet.component.html',
  styleUrl: './toast-outlet.component.scss',
})
export class ToastOutletComponent {
  protected readonly notify = inject(NotificationService);
  protected readonly icons = ICONS;
}
