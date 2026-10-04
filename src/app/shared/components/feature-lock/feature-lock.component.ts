import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PermissionsService } from '../../../core/data/permissions.service';
import { I18nService } from '../../../core/i18n/i18n.service';

// The banner of a page whose feature the owner's plan does not include: what is locked and why, with an
// Upgrade button for the owner (the plan belongs to the owner, so nobody else can unlock it). The page
// keeps its content visible but turned off.
@Component({
  selector: 'app-feature-lock',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="panel lock" role="note">
      <i class="ph ph-lock-simple" aria-hidden="true"></i>
      <div class="grow">
        <div class="fw6">{{ heading() }}</div>
        <div class="body muted">{{ body() }}</div>
      </div>
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
      gap: 16px;
      flex-wrap: wrap;
      border-color: var(--color-primary);
      > .ph {
        font-size: 28px;
        color: var(--color-primary);
      }
    }
    .grow {
      min-width: 200px;
    }
    .body {
      font-size: 14px;
    }
  `,
})
export class FeatureLockComponent {
  readonly heading = input('');
  readonly body = input('');
  protected readonly perm = inject(PermissionsService);
  protected readonly t = inject(I18nService).t;
}
