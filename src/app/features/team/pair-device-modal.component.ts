import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { DevicesStore } from '../../core/data/devices.store';
import { ApiPairingCode } from '../../core/http/api.service';
import { problemOf } from '../../core/http/problem-details';
import { hm } from '../../core/i18n/format';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { ModalComponent } from '../../shared/components/modal/modal.component';

const POLL_MS = 3000;

// "Add device": shows a pairing code for the extension and waits until a new device shows up.
@Component({
  selector: 'app-pair-device-modal',
  imports: [ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" [title]="t().api.pairTitle" (closed)="closed.emit()">
      <ol class="steps fs14">
        <li>{{ t().api.pairStep1 }}</li>
        <li>{{ t().api.pairStep2 }}</li>
        <li>{{ t().api.pairStep3 }}</li>
      </ol>
      <div class="field">
        <div class="small muted">{{ t().api.pairUrl }}</div>
        <div class="value">
          <code class="url">{{ apiUrl }}</code>
          <button type="button" class="su-btn su-btn-sm su-btn-ghost" (click)="copy(apiUrl)">
            <i class="ph ph-copy"></i>{{ t().api.copy }}
          </button>
        </div>
      </div>
      <div class="field">
        <div class="small muted">{{ t().api.pairCode }}</div>
        @if (code(); as c) {
          <div class="value">
            <code class="code" data-testid="pair-code">{{ c.code }}</code>
            <button type="button" class="su-btn su-btn-sm su-btn-ghost" (click)="copy(c.code)">
              <i class="ph ph-copy"></i>{{ t().api.copy }}
            </button>
          </div>
          <div class="small" [class.muted]="!expired()" [class.err]="expired()">
            {{ expired() ? t().api.pairExpired : expiresLabel() }}
          </div>
        } @else if (error()) {
          <div class="small err">{{ error() }}</div>
        } @else {
          <div class="small muted">{{ t().api.loading }}</div>
        }
      </div>
      @if (code() && !expired()) {
        <div class="wait small muted">
          <i class="ph ph-circle-notch spin"></i>{{ t().api.pairWaiting }}
        </div>
      }
      <div modal-footer>
        @if (expired()) {
          <button type="button" class="su-btn su-btn-sm su-btn-secondary" (click)="newCode()">
            {{ t().api.pairNew }}
          </button>
        }
        <button type="button" class="su-btn su-btn-sm su-btn-primary" (click)="closed.emit()">
          {{ t().api.done }}
        </button>
      </div>
    </app-modal>
  `,
  styles: `
    .fs14 {
      font-size: 14px;
    }
    .steps {
      margin: 0 0 16px;
      padding-left: 20px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 14px;
    }
    .value {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      background: var(--color-surface-muted);
      border-radius: var(--radius-sm);
      padding: 6px 10px;
    }
    .url {
      font-size: 14px;
      word-break: break-all;
    }
    .code {
      font-size: 28px;
      font-weight: 700;
      letter-spacing: 0.12em;
    }
    .err {
      color: var(--color-danger);
    }
    .wait {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .spin {
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
})
export class PairDeviceModalComponent {
  readonly open = input(false);
  readonly closed = output<void>();
  /** Emits the name of the device that just paired. */
  readonly paired = output<string>();

  private readonly devices = inject(DevicesStore);
  private readonly notify = inject(NotificationService);
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;

  /** The extension calls the API at the web app's own origin (/api is served from there). */
  protected readonly apiUrl = typeof location === 'undefined' ? '' : location.origin;
  protected readonly code = signal<ApiPairingCode | null>(null);
  protected readonly error = signal('');
  private readonly now = signal(Date.now());
  protected readonly expired = computed(() => {
    const c = this.code();
    return !!c && new Date(c.expiresAt).getTime() <= this.now();
  });
  protected readonly expiresLabel = computed(() => {
    const c = this.code();
    return c ? fmt(this.t().api.pairExpires, { t: hm(new Date(c.expiresAt)) }) : '';
  });

  private known = new Set<string>();
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    effect(() => {
      if (this.open()) untracked(() => void this.start());
      else untracked(() => this.stop());
    });
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  protected async newCode(): Promise<void> {
    this.code.set(null);
    this.error.set('');
    try {
      this.code.set(await this.devices.createPairingCode());
    } catch (e) {
      this.error.set(problemOf(e)?.title ?? this.t().api.serverDown);
    }
  }

  protected copy(text: string): void {
    void navigator.clipboard?.writeText(text).then(() => this.notify.info(this.t().api.copied));
  }

  private async start(): Promise<void> {
    this.known = new Set(this.devices.list().map((d) => d.id));
    this.stop();
    this.timer = setInterval(() => void this.poll(), POLL_MS);
    await this.newCode();
  }

  private stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  private async poll(): Promise<void> {
    this.now.set(Date.now());
    if (!this.code() || this.expired()) return;
    await this.devices.load().catch(() => undefined);
    const fresh = this.devices.list().find((d) => !this.known.has(d.id));
    if (!fresh) return;
    this.stop();
    this.notify.success(fmt(this.t().api.paired, { d: fresh.name }));
    this.paired.emit(fresh.name);
    this.closed.emit();
  }
}
