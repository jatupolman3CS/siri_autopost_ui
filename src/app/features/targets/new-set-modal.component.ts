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
import { AccountsStore, extensionNameOf, lineOaName } from '../../core/data/accounts.store';
import { DevicesStore } from '../../core/data/devices.store';
import { LINK_LIMITS, LinkSetsStore } from '../../core/data/link-sets.store';
import { LineOasStore } from '../../core/data/line-oas.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { LinkChannel } from '../../core/flow/line-chats';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';
import '../../core/i18n/i18n.line';
import { NotificationService } from '../../core/services/notification.service';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import {
  SelectFieldComponent,
  SelectOption,
} from '../../shared/components/select-field/select-field.component';

// "New link set": what it posts to (Facebook groups, or LINE customer chats when the plan has them and a browser is
// has an OA in the master list), a name and, for Facebook with two or more extensions connected, the extension that
// posts it, for LINE the Official Account (picked from the "LINE OA" master list; its customers become the set's chats).
// With one Facebook extension the API names it for the set. The set is created empty. A set keeps its channel for good.
@Component({
  selector: 'app-new-set-modal',
  imports: [ModalComponent, InputFieldComponent, SelectFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" [title]="t().ts.newSet" (closed)="closed.emit()">
      <div (keydown.enter)="create()">
        <div class="channel">
          <span class="su-field-label">{{ t().api.line.chatChannel }}</span>
          <div class="seg" role="radiogroup" [attr.aria-label]="t().api.line.chatChannel">
            <button
              type="button"
              role="radio"
              [class.on]="channel() === 'fb'"
              [attr.aria-checked]="channel() === 'fb'"
              (click)="setChannel('fb')"
            >
              {{ t().api.line.chatChannelFb }}
            </button>
            <button
              type="button"
              role="radio"
              [class.on]="channel() === 'line'"
              [attr.aria-checked]="channel() === 'line'"
              [disabled]="!lineAvailable()"
              [attr.title]="lineHint() || null"
              (click)="setChannel('line')"
            >
              {{ t().api.line.chatChannelLine }}
            </button>
          </div>
          @if (lineHint()) {
            <p class="su-field-help">{{ lineHint() }}</p>
          }
        </div>
        <app-input-field
          [label]="t().ts.setName"
          [placeholder]="t().ts.setNamePh"
          [(value)]="name"
          [error]="error()"
          [maxlength]="limits.setName"
        />
        @if (channel() === 'line') {
          <!-- The LINE OA is picked from the master list ("LINE OA" page): its customers are the set's chats. -->
          <app-select-field
            [label]="t().api.line.oaPickLabel"
            [options]="oaOptions()"
            [placeholder]="t().api.line.oaPickPh"
            [(value)]="postAs"
            [error]="postAsError()"
          />
        } @else if (several()) {
          <app-select-field
            [label]="t().api.flow.newSetExt"
            [options]="extensions()"
            [placeholder]="t().api.flow.postAsPick"
            [(value)]="postAs"
            [error]="postAsError()"
          />
        }
      </div>
      <div modal-footer>
        <button type="button" class="su-btn su-btn-sm su-btn-secondary" (click)="closed.emit()">
          {{ t().common.cancel }}
        </button>
        <button
          type="button"
          class="su-btn su-btn-sm su-btn-primary"
          [disabled]="busy() || perm.readOnly()"
          [attr.title]="perm.editHint() || null"
          (click)="create()"
        >
          {{ t().ts.newSet }}
        </button>
      </div>
    </app-modal>
  `,
  styles: `
    .channel {
      display: grid;
      gap: 6px;
      justify-items: start;
      margin-bottom: 12px;
      p {
        margin: 0;
      }
    }
  `,
})
export class NewSetModalComponent {
  readonly open = input(false);
  readonly closed = output<void>();

  private readonly store = inject(LinkSetsStore);
  private readonly accounts = inject(AccountsStore);
  private readonly lineOas = inject(LineOasStore);
  private readonly devices = inject(DevicesStore);
  private readonly notify = inject(NotificationService);
  protected readonly perm = inject(PermissionsService);
  protected readonly t = inject(I18nService).t;
  private readonly workspaces = inject(WorkspaceStore);
  protected readonly limits = LINK_LIMITS;
  /** What the new set posts to. */
  protected readonly channel = signal<LinkChannel>('fb');
  protected readonly name = signal('');
  protected readonly postAs = signal('');
  protected readonly error = signal('');
  protected readonly postAsError = signal('');
  protected readonly busy = signal(false);

  /** Two or more Facebook extensions: the person has to say which one posts the set. */
  protected readonly several = computed(() => this.accounts.connected().length >= 2);

  protected readonly extensions = computed<SelectOption[]>(() =>
    this.accounts
      .connected()
      .map((a) => ({ value: a.id, label: extensionNameOf(a, this.devices.list()) })),
  );

  /** The LINE Official Accounts of the master list that a browser reads: the account IS the set's poster. */
  protected readonly oaOptions = computed<SelectOption[]>(() =>
    this.lineOas.usable().map((o) => ({ value: o.id, label: lineOaName({ name: o.name }) })),
  );

  /** LINE chats need the plan and at least one LINE OA in the master list. */
  protected readonly lineAvailable = computed(
    () => !this.workspaces.lineChatLocked() && this.lineOas.usable().length > 0,
  );
  /** Why "LINE chats" cannot be chosen ('' when it can). */
  protected readonly lineHint = computed(() => {
    const line = this.t().api.line;
    if (this.workspaces.lineChatLocked())
      return fmt(line.chatChannelLineLocked, { plan: this.t().plans.pro.name });
    return this.lineOas.usable().length ? '' : line.oaPickNone;
  });

  constructor() {
    effect(() => {
      if (this.open())
        untracked(() => {
          this.name.set('');
          this.channel.set('fb');
          this.postAs.set('');
          this.error.set('');
          this.postAsError.set('');
        });
    });
  }

  protected setChannel(channel: LinkChannel): void {
    if (channel === 'line' && !this.lineAvailable()) return;
    // The extension picked for the other kind of set is not an extension for this one.
    if (channel !== this.channel()) {
      this.postAs.set('');
      this.postAsError.set('');
    }
    this.channel.set(channel);
    if (channel === 'line' && !this.postAs() && this.oaOptions().length === 1)
      this.postAs.set(this.oaOptions()[0].value);
  }

  protected async create(): Promise<void> {
    if (this.busy() || this.perm.readOnly()) return;
    const name = this.name().trim();
    if (!name) {
      this.error.set(this.t().ts.errName);
      return;
    }
    if (this.channel() === 'line' && !this.postAs()) {
      this.postAsError.set(this.t().api.line.oaPickErr);
      return;
    }
    if (this.channel() === 'fb' && this.several() && !this.postAs()) {
      this.postAsError.set(this.t().api.flow.newSetExtErr);
      return;
    }
    this.busy.set(true);
    try {
      await this.store.createSet(name, this.postAs() || null, this.channel());
      this.notify.success(fmt(this.t().ts.created, { s: name }));
      this.closed.emit();
    } catch {
      // The error interceptor has shown why (for example the 100-set limit); the name stays to be fixed.
    } finally {
      this.busy.set(false);
    }
  }
}
