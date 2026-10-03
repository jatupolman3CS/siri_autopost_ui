import { Injectable, inject, signal } from '@angular/core';
import {
  COMMAND_LIFETIME_MIN,
  COMMAND_WAIT_MIN,
  CampaignsStore,
  CommandResult,
} from '../../core/data/campaigns.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';

// The buttons of the extension's settings page, run on the device through the campaigns store, with the
// messages the extension shows. Provided by the campaigns page so its parts share one "waiting" state.
@Injectable()
export class CampaignActions {
  private readonly store = inject(CampaignsStore);
  private readonly notify = inject(NotificationService);
  private readonly i18n = inject(I18nService);
  private readonly permissions = inject(PermissionsService);

  /** A command is on its way to the device. */
  readonly pending = signal(false);
  /** Viewers (and an admin in assist mode) read only; editors and up change the campaigns and press the buttons. */
  readonly readOnly = this.permissions.readOnly;

  /**
   * Sends a command and toasts the outcome: okText on success, the device's own error otherwise.
   * Returns the device's answer (null while another command is waiting).
   */
  async run(cmd: string, args: object = {}, okText?: string): Promise<CommandResult | null> {
    if (this.pending()) return null;
    const x = this.i18n.t().api.ext;
    this.pending.set(true);
    this.notify.info(fmt(x.cmdSent, { n: COMMAND_WAIT_MIN }));
    try {
      const r = await this.store.command(cmd, args);
      if (r.ok) {
        if (okText) this.notify.success(okText);
      } else {
        this.notify.error(this.errorText(r));
      }
      return r;
    } catch {
      this.notify.error(x.cmdFailed);
      return { ok: false, error: 'failed' };
    } finally {
      this.pending.set(false);
    }
  }

  errorText(r: CommandResult): string {
    const x = this.i18n.t().api.ext;
    if (r.error === 'expired') return x.cmdExpired;
    if (r.error === 'timeout') return fmt(x.cmdTimeout, { m: COMMAND_LIFETIME_MIN });
    if (r.error === 'no-device') return x.noDeviceTitle;
    return r.error || x.cmdFailed;
  }
}
