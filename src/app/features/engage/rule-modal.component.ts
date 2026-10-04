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
import { AUTO_REPLY_LIMITS, AutoReplyStore, SCOPE_ALL } from '../../core/data/auto-reply.store';
import { I18nService } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.engine';
import { NotificationService } from '../../core/services/notification.service';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { SelectFieldComponent } from '../../shared/components/select-field/select-field.component';

// "New reply rule": keywords, what to reply to the comment, what to send to the chat, and which collection it
// applies to. A rule needs keywords and at least one of the two messages (the design's rule). The list is saved
// as a whole by the store; a refused save keeps the dialog open (the error interceptor has said why).
@Component({
  selector: 'app-rule-modal',
  imports: [ModalComponent, InputFieldComponent, SelectFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" [title]="t().ar.ruleTitle" (closed)="closed.emit()">
      <form class="form" (submit)="$event.preventDefault(); create()">
        <app-input-field
          [label]="t().ar.keywords"
          [placeholder]="t().ar.keywordsPh"
          [(value)]="keywords"
          [error]="error()"
          [maxlength]="limits.keywords"
        />
        <app-input-field
          [label]="t().ar.reply"
          [placeholder]="t().ar.replyPh"
          [(value)]="reply"
          [maxlength]="limits.reply"
        />
        <app-input-field
          [label]="t().ar.inbox"
          [placeholder]="t().ar.inboxPh"
          [(value)]="inbox"
          [maxlength]="limits.inbox"
        />
        <app-select-field [label]="t().ar.scope" [options]="scopes()" [(value)]="scope" />
        <button type="submit" hidden></button>
      </form>
      <div modal-footer>
        <button type="button" class="su-btn su-btn-sm su-btn-secondary" (click)="closed.emit()">
          {{ t().common.cancel }}
        </button>
        <button
          type="button"
          class="su-btn su-btn-sm su-btn-primary"
          [disabled]="busy()"
          (click)="create()"
        >
          {{ t().common.save }}
        </button>
      </div>
    </app-modal>
  `,
  styles: `
    .form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
  `,
})
export class RuleModalComponent {
  readonly open = input(false);
  readonly closed = output<void>();

  private readonly store = inject(AutoReplyStore);
  private readonly notify = inject(NotificationService);
  protected readonly t = inject(I18nService).t;
  protected readonly limits = AUTO_REPLY_LIMITS;

  protected readonly keywords = signal('');
  protected readonly reply = signal('');
  protected readonly inbox = signal('');
  protected readonly scope = signal(SCOPE_ALL);
  protected readonly error = signal('');
  protected readonly busy = signal(false);

  protected readonly scopes = computed(() => [
    { value: SCOPE_ALL, label: this.t().ar.scopeAll },
    ...this.store.collections().map((c) => ({ value: c.id, label: c.name })),
  ]);

  constructor() {
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        this.keywords.set('');
        this.reply.set('');
        this.inbox.set('');
        this.scope.set(SCOPE_ALL);
        this.error.set('');
        // A collection made since the page opened is offered too.
        void this.store.loadCollections();
      });
    });
  }

  protected async create(): Promise<void> {
    if (this.busy()) return;
    if (!this.keywords().trim() || !(this.reply().trim() || this.inbox().trim())) {
      this.error.set(this.t().ar.errRule);
      return;
    }
    this.busy.set(true);
    try {
      const ok = await this.store.addRule({
        keywords: this.keywords(),
        reply: this.reply(),
        inbox: this.inbox(),
        scope: this.scope(),
      });
      if (ok) {
        this.notify.success(this.t().ar.saved);
        this.closed.emit();
      }
    } finally {
      this.busy.set(false);
    }
  }
}
