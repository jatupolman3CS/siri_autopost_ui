import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ExtensionStore } from '../../core/data/extension.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { PostsStore } from '../../core/data/posts.store';
import { OfflinePolicy, OfflineSettings, SettingsStore } from '../../core/data/settings.store';
import { I18nService } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { CheckboxComponent } from '../../shared/components/checkbox/checkbox.component';
import { PermNoteComponent } from '../../shared/components/perm-note/perm-note.component';
import { SelectFieldComponent } from '../../shared/components/select-field/select-field.component';
import { Pager } from '../../shared/components/pager/pager';
import { PagerComponent } from '../../shared/components/pager/pager.component';

@Component({
  selector: 'app-offline-page',
  imports: [PagerComponent, CheckboxComponent, PermNoteComponent, SelectFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './offline-page.component.html',
  styleUrl: './offline-page.component.scss',
})
export class OfflinePageComponent {
  private readonly notify = inject(NotificationService);
  private readonly posts = inject(PostsStore);
  private readonly i18n = inject(I18nService);
  protected readonly settings = inject(SettingsStore);
  protected readonly ext = inject(ExtensionStore);
  protected readonly perm = inject(PermissionsService);
  protected readonly t = this.i18n.t;
  protected readonly off = this.settings.off;
  /** Admins change the policy, once it has loaded. */
  protected readonly editable = computed(() => this.perm.canAdmin() && this.settings.loaded());

  protected readonly policyCards = computed(() => {
    const o = this.t().off;
    const cards: [OfflinePolicy, string, string, string][] = [
      ['skip', 'ph-skip-forward', o.skip, o.skipBody],
      ['queue', 'ph-queue', o.queue, o.queueBody],
      ['notify', 'ph-bell-ringing', o.notify, o.notifyBody],
    ];
    // "Notify me" sends nothing yet (the API treats it like "Queue"): shown, not selectable.
    return cards.map(([id, icon, title, body]) => ({
      id,
      icon,
      title,
      body,
      selected: this.off().policy === id,
      supported: id !== 'notify',
    }));
  });

  protected readonly windowOptions = computed(() => {
    const o = this.t().off;
    return [
      { value: '30m', label: o.w30 },
      { value: '2h', label: o.w2h },
      { value: 'day', label: o.wDay },
    ];
  });

  protected readonly waitingRows = computed(() => {
    const t = this.t();
    return this.posts.waiting().map((p) => this.posts.row(p, t));
  });

  protected readonly waitPager = new Pager(20);
  protected readonly waitPage = computed(() => this.waitPager.slice(this.waitingRows()));

  protected set(patch: Partial<OfflineSettings>): void {
    this.settings.patchOff(patch);
  }

  protected readonly saving = signal(false);

  protected async save(): Promise<void> {
    if (!this.editable()) return;
    this.saving.set(true);
    try {
      await this.settings.saveOff();
      this.notify.success(this.t().off.saved);
    } finally {
      this.saving.set(false);
    }
  }
}
