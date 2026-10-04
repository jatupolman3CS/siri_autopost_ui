import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { AccountsStore } from '../../core/data/accounts.store';
import { LinkSetsStore } from '../../core/data/link-sets.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { ApiGroupLink } from '../../core/http/api.service';
import { groupSlug, normalizeGroupUrl } from '../../core/flow/group-links';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';
import { NotificationService } from '../../core/services/notification.service';
import { CheckboxComponent } from '../../shared/components/checkbox/checkbox.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import {
  SelectFieldComponent,
  SelectOption,
} from '../../shared/components/select-field/select-field.component';

// "Pick from my groups": the groups the extension of a connected Facebook account last synced (name and
// address; the API knows nothing else about them). Ticked groups are added to the set; ones it already has
// are shown but off.
@Component({
  selector: 'app-import-groups-modal',
  imports: [ModalComponent, CheckboxComponent, SelectFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './import-groups-modal.component.html',
  styleUrl: './import-groups-modal.component.scss',
})
export class ImportGroupsModalComponent {
  readonly open = input(false);
  /** The set the groups go into. */
  readonly setId = input<string | null>(null);
  readonly closed = output<void>();

  private readonly store = inject(LinkSetsStore);
  private readonly accounts = inject(AccountsStore);
  private readonly notify = inject(NotificationService);
  protected readonly perm = inject(PermissionsService);
  protected readonly t = inject(I18nService).t;

  /** The groups of the chosen account; null while they are being read. */
  protected readonly groups = signal<ApiGroupLink[] | null>(null);
  protected readonly failed = signal(false);
  protected readonly picked = signal<Record<string, boolean>>({});
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  private readonly chosen = signal('');
  private generation = 0;

  /** Only a Facebook account with a paired browser has groups the extension synced. */
  private readonly connected = computed(() =>
    this.accounts.list().filter((a) => a.platform === 'fb' && a.connected),
  );
  protected readonly accountOptions = computed<SelectOption[]>(() =>
    this.connected().map((a) => ({ value: a.id, label: a.name })),
  );
  /** The chosen account, else the one that posts the set, else the first connected one. */
  protected readonly accountId = computed(() => {
    const list = this.connected();
    const chosen = this.chosen();
    if (chosen && list.some((a) => a.id === chosen)) return chosen;
    const preferred = this.store.byId(this.setId() ?? '')?.postAsAccountId;
    return list.find((a) => a.id === preferred)?.id ?? list[0]?.id ?? '';
  });

  protected readonly rows = computed(() => {
    const set = this.store.byId(this.setId() ?? '');
    const have = new Set((set?.links ?? []).map((l) => normalizeGroupUrl(l.url)).filter(Boolean));
    const picked = this.picked();
    const inSetText = this.t().ts.inSet;
    return (this.groups() ?? []).map((g) => {
      const key = normalizeGroupUrl(g.url) || g.url;
      const inSet = have.has(key);
      return {
        key,
        url: g.url,
        name: g.name || groupSlug(g.url),
        inSet,
        checked: !inSet && !!picked[key],
        meta: inSet ? `${g.url} · ${inSetText}` : g.url,
      };
    });
  });
  protected readonly count = computed(() => this.rows().filter((r) => r.checked).length);
  protected readonly confirmLabel = computed(() =>
    fmt(this.t().ts.addSelected, { n: this.count() }),
  );

  constructor() {
    // A fresh dialog: nothing ticked, the account chosen again.
    effect(() => {
      if (this.open())
        untracked(() => {
          this.chosen.set('');
          this.picked.set({});
          this.error.set('');
        });
    });
    effect(() => {
      const id = this.accountId();
      const open = this.open();
      untracked(() => {
        if (open && id) void this.loadGroups(id);
      });
    });
  }

  protected choose(id: string): void {
    if (id) this.chosen.set(id);
  }

  protected retry(): void {
    const id = this.accountId();
    if (id) void this.loadGroups(id);
  }

  protected toggle(key: string, on: boolean): void {
    this.picked.update((p) => ({ ...p, [key]: on }));
    this.error.set('');
  }

  private async loadGroups(accountId: string): Promise<void> {
    const gen = ++this.generation;
    this.groups.set(null);
    this.failed.set(false);
    this.picked.set({});
    try {
      const list = await this.store.accountGroups(accountId);
      if (gen === this.generation) this.groups.set(list);
    } catch {
      if (gen !== this.generation) return;
      this.groups.set([]);
      this.failed.set(true);
    }
  }

  protected async confirm(): Promise<void> {
    const id = this.setId();
    const account = this.accountId();
    if (!id || !account || this.busy() || this.perm.readOnly()) return;
    const picks = this.rows().filter((r) => r.checked);
    if (!picks.length) {
      this.error.set(this.t().ts.pickOne);
      return;
    }
    this.busy.set(true);
    try {
      const set = await this.store.importGroups(
        id,
        account,
        picks.map((r) => r.url),
      );
      this.notify.success(fmt(this.t().ts.imported, { n: picks.length, s: set.name }));
      this.closed.emit();
    } catch {
      // The error interceptor has shown why; the ticks stay.
    } finally {
      this.busy.set(false);
    }
  }
}
