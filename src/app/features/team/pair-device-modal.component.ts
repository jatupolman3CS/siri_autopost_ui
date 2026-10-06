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
import '../../core/i18n/i18n.engine';
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

// "Add device": the web app creates a one-time code and a connect address, /connect-extension#ap-pair=1&code=...
// The extension that opens that address takes the tab over, asks for one "Allow" click and pairs. "Connect this
// Chrome" opens it in a new tab here; "Copy connect link" gives the same address for another computer or Chrome
// profile, which need not be signed in to the web app at all (or may be signed in as someone else): the extension
// only says "connected successfully" there. The dialog waits until the new device shows up, wherever it paired
// from, and says the name it really got: names are unique in a workspace, so a taken one becomes "name (2)".
// Nothing is typed into the extension.
@Component({
  selector: 'app-pair-device-modal',
  imports: [ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pair-device-modal.component.html',
  styleUrl: './pair-device-modal.component.scss',
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
  /** The connect tab was opened (or the link copied); the extension should be asking for "Allow" now. */
  protected readonly opened = signal(false);
  /** The link was copied just now (the button says so for a moment). */
  protected readonly copied = signal(false);
  /** The browser would not let the page copy: the link shows in a box to copy by hand. */
  protected readonly copyFailed = signal(false);
  /** The name asked for when the connect address was opened or copied (what the new device is compared with). */
  private requested = '';
  /** The name this browser would get if it paired now: the typed one, or "name (2)" when another extension has it. */
  protected readonly finalName = computed(() => this.devices.freeName(this.name()));
  protected readonly nameTaken = computed(
    () => this.name().trim() !== '' && this.finalName() !== this.name().trim(),
  );
  protected readonly nameTakenNote = computed(() =>
    fmt(this.t().api.engine.pairNameTaken, { d: this.finalName() }),
  );
  /** The address the extension watches for, with the current code and name. */
  protected readonly link = computed(() => {
    const c = this.code();
    return c
      ? connectUrl(
          location.origin,
          c.code,
          this.name().trim(),
          this.workspaces.current()?.name ?? '',
        )
      : '';
  });
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
    this.requested = this.name().trim();
    this.opened.set(true);
  }

  /** Copies the connect address for another computer or Chrome profile (it needs no sign-in to the web app). */
  protected async copyLink(): Promise<void> {
    const url = this.link();
    if (!url) return;
    this.requested = this.name().trim();
    this.opened.set(true);
    try {
      await navigator.clipboard.writeText(url);
      this.copyFailed.set(false);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      // No clipboard (an insecure page, or the browser refused): the link shows in a box to copy by hand.
      this.copyFailed.set(true);
    }
  }

  private async start(): Promise<void> {
    this.known = new Set(this.devices.list().map((d) => d.id));
    this.requested = '';
    this.copied.set(false);
    this.copyFailed.set(false);
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
    await this.devices.refresh();
    const fresh = this.devices.list().find((d) => !this.known.has(d.id));
    if (!fresh) return;
    this.stop();
    // The server keeps names unique: say the one the extension really got when it is not the one asked for.
    const asked = this.requested || this.name().trim();
    this.notify.success(
      asked && asked !== fresh.name
        ? fmt(this.t().api.engine.pairedRenamed, { d: fresh.name, w: asked })
        : fmt(this.t().api.paired, { d: fresh.name }),
    );
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
