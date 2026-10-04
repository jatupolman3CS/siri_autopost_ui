import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  computed,
  ElementRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { PermissionsService } from '../../core/data/permissions.service';
import { LINK_LIMITS, LinkSetsStore } from '../../core/data/link-sets.store';
import { ApiSetLink } from '../../core/http/api.service';
import { linkLabel } from '../../core/flow/group-links';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { CheckboxComponent } from '../../shared/components/checkbox/checkbox.component';

// One link of a set (the prototype's row): switch, name, address, group code and daily cap on a grid of
// up to four columns, a remove button, then the notes under it (not a Facebook group / repeated address)
// and the health line (waiting for approval, switched off, "enable again"). Every edit goes straight to the
// store, which saves the whole row shortly after the last keystroke. The address and its notes come from
// the row (`valid`/`duplicate`: the server's answer, worked out again locally while it is being edited).
@Component({
  selector: 'app-link-row',
  imports: [CheckboxComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './link-row.component.html',
  styleUrl: './link-row.component.scss',
})
export class LinkRowComponent {
  readonly setId = input.required<string>();
  readonly link = input.required<ApiSetLink>();
  /** Put the cursor in the address field (a row that was just added). */
  readonly focus = input(false);

  private readonly store = inject(LinkSetsStore);
  private readonly notify = inject(NotificationService);
  protected readonly perm = inject(PermissionsService);
  protected readonly t = inject(I18nService).t;
  protected readonly limits = LINK_LIMITS;
  private readonly urlInput = viewChild<ElementRef<HTMLInputElement>>('urlInput');

  /** What the row is called for a screen reader: its name, else the group in its address. */
  protected readonly label = computed(() => linkLabel(this.link()));
  /** The note under the row: an address that is not a group, or one the set already has. */
  protected readonly note = computed(() => {
    const l = this.link();
    if (l.url.trim() && !l.valid) return this.t().ts.invalidUrl;
    return l.duplicate ? this.t().ts.dup : '';
  });
  protected readonly health = computed(() => {
    const l = this.link();
    if (l.health === 'ok') return null;
    const ts = this.t().ts;
    if (l.health === 'pending') return { off: false, label: ts.hPending };
    // Switched off by the engine after failures (it counts them) or by hand (it does not).
    return {
      off: true,
      label: l.failStreak > 0 ? fmt(ts.hOffReason, { n: l.failStreak }) : ts.hOff,
    };
  });

  constructor() {
    afterNextRender(() => {
      if (this.focus()) this.urlInput()?.nativeElement.focus();
    });
  }

  protected edit(field: 'name' | 'url' | 'code', event: Event): void {
    this.store.editLink(this.setId(), this.link().id, {
      [field]: (event.target as HTMLInputElement).value,
    });
  }

  /** The daily cap is a whole number from 0 (no cap) to 50; anything else is brought into range. */
  protected editMax(event: Event): void {
    const input = event.target as HTMLInputElement;
    const n = Math.max(0, Math.min(LINK_LIMITS.dailyMax, parseInt(input.value, 10) || 0));
    input.value = String(n);
    this.store.editLink(this.setId(), this.link().id, { dailyMax: n });
  }

  protected toggle(enabled: boolean): void {
    this.store.editLink(this.setId(), this.link().id, { enabled }, true);
  }

  protected async remove(): Promise<void> {
    if (await this.store.removeLink(this.setId(), this.link().id))
      this.notify.info(this.t().ts.removed);
  }

  protected async reenable(): Promise<void> {
    try {
      await this.store.reenable(this.setId(), this.link().id);
      this.notify.success(this.t().ts.reenabled);
    } catch {
      // The error interceptor has shown why; the row stays as it is.
    }
  }
}
