import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { PermissionsService } from '../../../core/data/permissions.service';

// A line under a page title saying why its buttons are off: the role is too low, or an admin is
// looking at the customer's app (assist mode). Shows nothing when the person may do what the page offers.
@Component({
  selector: 'app-perm-note',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (hint(); as h) {
      <p class="perm-note small muted" role="note"><i class="ph ph-lock-simple"></i>{{ h }}</p>
    }
  `,
  styles: `
    .perm-note {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 8px 0 0;
    }
  `,
})
export class PermNoteComponent {
  /** What the page needs: editor (posts, library) or admin (settings, devices, members). */
  readonly level = input<'edit' | 'admin'>('edit');
  private readonly permissions = inject(PermissionsService);
  protected readonly hint = computed(() =>
    this.level() === 'admin' ? this.permissions.adminHint() : this.permissions.editHint(),
  );
}
