import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { LineChatList } from '../../core/data/line-chats.store';
import { DeviceEventsService } from '../../core/data/device-events.service';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.line';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';
import { PagerComponent } from '../../shared/components/pager/pager.component';
import {
  SelectFieldComponent,
  SelectOption,
} from '../../shared/components/select-field/select-field.component';
import { LineChatRowComponent } from '../line/line-chat-row.component';

// The customers of ONE LINE Official Account, as its browser read them (name, labels, last chat, a "do not send" switch)
// with the chat link of each opened from the row. It brings its own `LineChatList`, fixed to the account, so every OA
// card of the master page has a list of its own and never shows another OA's customers.
@Component({
  selector: 'app-line-oa-customers',
  imports: [InputFieldComponent, LineChatRowComponent, PagerComponent, SelectFieldComponent],
  providers: [LineChatList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="find">
      <app-input-field
        [label]="t().api.line.chatSearch"
        [placeholder]="t().api.line.chatSearchPh"
        [value]="list.q()"
        (valueChange)="list.setSearch($event)"
        (keydown.enter)="list.applySearch()"
      />
      <app-select-field
        [label]="t().api.line.chatDnsFilter"
        [options]="dnsOptions()"
        [value]="dnsValue()"
        (valueChange)="setDns($event)"
      />
    </div>
    <p class="small muted" role="status">{{ shown() }}</p>
    <div class="rows" [attr.aria-label]="t().api.line.oaCustomers">
      @for (c of list.chats(); track c.id) {
        <app-line-chat-row [chat]="c" />
      } @empty {
        @if (list.loaded()) {
          <p class="nomatch">
            {{ list.filtered() ? t().api.line.chatNoMatch : t().api.line.oaNoCustomers }}
          </p>
        }
      }
    </div>
    <app-pager [pager]="list.pager" />
  `,
  styles: `
    :host {
      display: block;
    }
    .find {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
      gap: 12px;
    }
    .rows {
      padding-top: 4px;
    }
    .nomatch {
      margin: 12px 0;
      text-align: center;
      color: var(--color-text-muted);
    }
    .muted {
      color: var(--color-text-muted);
    }
  `,
})
export class LineOaCustomersComponent {
  /** The OA's account id. */
  readonly accountId = input.required<string>();

  protected readonly list = inject(LineChatList);
  protected readonly t = inject(I18nService).t;

  protected readonly dnsOptions = computed<SelectOption[]>(() => [
    { value: '', label: this.t().api.line.chatDnsAll },
    { value: 'true', label: this.t().api.line.chatDnsOnly },
    { value: 'false', label: this.t().api.line.chatDnsExcept },
  ]);
  protected readonly dnsValue = computed(() => {
    const v = this.list.doNotSend();
    return v === null ? '' : String(v);
  });
  protected readonly shown = computed(() =>
    fmt(this.t().api.line.chatShown, { n: this.list.total() }),
  );

  constructor() {
    // Nothing is asked until the account is set: the list would otherwise read every OA's customers first.
    this.list.enabled.set(false);
    effect(() => {
      const id = this.accountId();
      untracked(() => {
        this.list.setAccount(id);
        this.list.enabled.set(true);
      });
    });
    const events = inject(DeviceEventsService);
    const stop = events.subscribe((e) => {
      if (e.type === 'device.line_chats') void this.list.refresh();
    });
    const stopResume = events.onResume(() => void this.list.refresh());
    inject(DestroyRef).onDestroy(() => {
      stop();
      stopResume();
    });
  }

  protected setDns(value: string): void {
    this.list.setDoNotSendFilter(value === '' ? null : value === 'true');
  }
}
