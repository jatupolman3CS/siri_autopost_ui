import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PermissionsService } from '../../core/data/permissions.service';
import { I18nService } from '../../core/i18n/i18n.service';

// The design's lock banner: the settings below need the owner's plan to be Pro or above. Only the workspace
// owner can change the plan, so only they get the upgrade button.
@Component({
  selector: 'app-antiban-lock',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="lock">
      <i class="ph ph-lock-simple muted"></i>
      <span>{{ t().ab.locked }}</span>
      @if (perm.role() === 'owner') {
        <a class="su-btn su-btn-sm su-btn-primary" routerLink="/app/billing">{{
          t().common.upgrade
        }}</a>
      }
    </div>
  `,
  styles: `
    .lock {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 14px;
      flex-wrap: wrap;
      > .ph {
        font-size: 18px;
      }
    }
  `,
})
export class AntibanLockComponent {
  protected readonly perm = inject(PermissionsService);
  protected readonly t = inject(I18nService).t;
}
