import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CollectionsStore } from '../../core/data/collections.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { ApiCollection, ApiCollectionSettings } from '../../core/http/api.service';
import { INPUT_LIMITS } from '../../core/http/input-limits';
import { I18nService } from '../../core/i18n/i18n.service';
import { CheckboxComponent } from '../../shared/components/checkbox/checkbox.component';
import { SelectFieldComponent } from '../../shared/components/select-field/select-field.component';
import '../../core/i18n/i18n.flow';

// The composing settings of one collection: hashtags and footer (applied when a post is composed), the
// approval rule (an admin's switch, the other controls are an editor's), and four settings the system stores but nothing applies yet (page tags, image shuffle,
// watermark and its position), each marked as such. Edits go to CollectionsStore, which saves them 800 ms
// after the last change; the controls are off for anyone who may not edit.
@Component({
  selector: 'app-collection-settings',
  imports: [CheckboxComponent, SelectFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './collection-settings.component.html',
  styleUrl: './collection-settings.component.scss',
})
export class CollectionSettingsComponent {
  private readonly store = inject(CollectionsStore);
  protected readonly perm = inject(PermissionsService);
  protected readonly t = inject(I18nService).t;
  protected readonly limits = INPUT_LIMITS;

  readonly collection = input.required<ApiCollection>();
  protected readonly s = computed(() => this.collection().settings);

  protected readonly footerPosOptions = computed(() => [
    { value: 'end', label: this.t().col.posEnd },
    { value: 'top', label: this.t().col.posTop },
  ]);
  protected readonly wmPosOptions = computed(() => {
    const c = this.t().col;
    return [
      { value: 'br', label: c.wmBR },
      { value: 'bl', label: c.wmBL },
      { value: 'tr', label: c.wmTR },
      { value: 'c', label: c.wmC },
    ];
  });

  protected set(patch: Partial<ApiCollectionSettings>): void {
    if (!this.perm.canEdit()) return;
    // The approval rule is the admin's: the API answers 403 to an editor who changes it.
    if (patch.requireApproval !== undefined && !this.perm.canAdmin()) return;
    this.store.updateSettings(this.collection().id, patch);
  }

  protected setFooterPos(value: string): void {
    this.set({ footerPos: value as ApiCollectionSettings['footerPos'] });
  }

  protected setWatermarkPos(value: string): void {
    this.set({ watermarkPos: value as ApiCollectionSettings['watermarkPos'] });
  }
}
