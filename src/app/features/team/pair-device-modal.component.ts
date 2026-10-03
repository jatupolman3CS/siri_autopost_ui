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
import { WorkspaceStore } from '../../core/data/workspace.store';
import { ApiPairingCode } from '../../core/http/api.service';
import { problemOf } from '../../core/http/problem-details';
import { hm } from '../../core/i18n/format';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { ModalComponent } from '../../shared/components/modal/modal.component';

const POLL_MS = 3000;

/**
 * The address the extension watches for (client/background.js connectRequest): it takes the code
 * from the hash and the API from this site's origin, then asks the person to allow it.
 */
export function connectUrl(origin: string, code: string, name: string, workspace: string): string {
  const p = new URLSearchParams({ 'ap-pair': '1', code, name, ws: workspace });
  return `${origin}/connect-extension#${p.toString()}`;
}

// "Add device": the web app pairs the Chrome it is open in. It creates a one-time code and opens
// /connect-extension with it in a new tab; the extension takes over that tab, asks for one "Allow"
// click and pairs. The dialog waits until the new device shows up. Nothing is typed into the extension.
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
      <label class="field">
        <span class="small muted">{{ t().api.pairName }}</span>
        <input
          class="su-input"
          maxlength="80"
          [placeholder]="t().api.pairNamePh"
          [value]="name()"
          (input)="name.set($any($event.target).value)"
        />
      </label>
      <div class="field">
        @if (code(); as c) {
          <button
            type="button"
            class="su-btn su-btn-md su-btn-primary"
            data-testid="pair-connect"
            [disabled]="expired()"
            (click)="connect(c.code)"
          >
            <i class="ph ph-plugs-connected"></i>{{ t().api.pairConnect }}
          </button>
          <div class="small" [class.muted]="!expired()" [class.err]="expired()">
            @if (expired()) {
              {{ t().api.pairExpired }}
            } @else {
              {{ t().api.pairCode }} <code data-testid="pair-code">{{ c.code }}</code> ·
              {{ expiresLabel() }}
            }
          </div>
        } @else if (error()) {
          <div class="small err">{{ error() }}</div>
        } @else {
          <div class="small muted">{{ t().api.loading }}</div>
        }
      </div>
      @if (opened() && code() && !expired()) {
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
        <button type="button" class="su-btn su-btn-sm su-btn-ghost" (click)="closed.emit()">
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
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      background: var(--color-surface-muted);
      border-radius: var(--radius-sm);
      padding: 2px 6px;
      letter-spacing: 0.08em;
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
  private readonly workspaces = inject(WorkspaceStore);
  private readonly notify = inject(NotificationService);
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;

  protected readonly code = signal<ApiPairingCode | null>(null);
  protected readonly error = signal('');
  protected readonly name = signal(defaultName());
  /** The connect tab was opened; the extension should be asking for "Allow" now. */
  protected readonly opened = signal(false);
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
    this.opened.set(false);
    try {
      this.code.set(await this.devices.createPairingCode());
    } catch (e) {
      this.error.set(problemOf(e)?.title ?? this.t().api.serverDown);
    }
  }

  /** Opens the connect address in a new tab; the extension of this Chrome picks it up. */
  protected connect(code: string): void {
    const url = connectUrl(
      location.origin,
      code,
      this.name().trim(),
      this.workspaces.current()?.name ?? '',
    );
    window.open(url, '_blank');
    this.opened.set(true);
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

/** "Chrome 3/10/2569" style default, the same shape the extension uses. */
function defaultName(): string {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const m = ua.match(/(Edg|OPR|Chrome)\/(\d+)/);
  const browser = m ? `${m[1].replace('Edg', 'Edge').replace('OPR', 'Opera')} ${m[2]}` : 'Chrome';
  return `${browser} ${new Date().toLocaleDateString('th-TH')}`;
}
