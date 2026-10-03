import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { AdminAction, AdminStore } from '../../core/data/admin.store';
import { SessionStore } from '../../core/data/session.store';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';

export interface AdminActionRequest {
  id: string;
  action: AdminAction;
  /** Transaction to refund; defaults to the latest plan price. */
  tx?: string;
}

// Confirm dialog for suspend / ban / refund / assist / restore, with an optional internal note.
@Component({
  selector: 'app-admin-action-modal',
  imports: [ModalComponent, InputFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-action-modal.component.html',
  styleUrl: './admin-action-modal.component.scss',
})
export class AdminActionModalComponent {
  readonly request = input<AdminActionRequest | null>(null);
  readonly closed = output<void>();

  private readonly admin = inject(AdminStore);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  protected readonly t = inject(I18nService).t;
  protected readonly note = signal('');

  protected readonly title = computed(() => {
    const r = this.request();
    const c = r ? this.admin.customer(r.id) : undefined;
    return r && c ? `${this.t().adm[r.action]} · ${c.name}` : '';
  });
  protected readonly body = computed(() => {
    const r = this.request();
    if (!r) return '';
    const keys = {
      suspend: 'aSuspend',
      ban: 'aBan',
      refund: 'aRefund',
      assist: 'aAssist',
      restore: 'aRestore',
    } as const;
    return this.t().adm[keys[r.action]];
  });
  protected readonly danger = computed(() =>
    ['ban', 'suspend'].includes(this.request()?.action ?? ''),
  );

  protected async confirm(): Promise<void> {
    const r = this.request();
    const c = r ? this.admin.customer(r.id) : undefined;
    if (!r || !c) return;
    await this.admin.apply(r.id, r.action, r.tx, this.note());
    this.note.set('');
    this.closed.emit();
    if (r.action === 'assist') {
      // The customer's own dashboard, read-only, until the banner's "back to admin".
      await this.session.startAssist(r.id);
      this.notify.info(fmt(this.t().api.assistStarted, { c: c.name }));
      void this.router.navigateByUrl('/app/overview');
      return;
    }
    this.notify.success(fmt(this.t().adm.done, { c: c.name, a: this.t().adm[r.action] }));
  }
}
