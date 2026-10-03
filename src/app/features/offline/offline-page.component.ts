import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ExtensionStore } from '../../core/data/extension.store';
import { PostsStore } from '../../core/data/posts.store';
import { OfflinePolicy, OfflineSettings, SettingsStore } from '../../core/data/settings.store';
import { I18nService } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { CheckboxComponent } from '../../shared/components/checkbox/checkbox.component';
import { SelectFieldComponent } from '../../shared/components/select-field/select-field.component';

@Component({
  selector: 'app-offline-page',
  imports: [CheckboxComponent, SelectFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div class="w720">
          <h1>{{ t().off.title }}</h1>
          <p>{{ t().off.sub }}</p>
        </div>
        <button
          type="button"
          class="su-btn su-btn-sm su-btn-primary"
          [disabled]="saving()"
          (click)="save()"
        >
          {{ t().common.save }}
        </button>
      </div>

      <section class="panel policy">
        <h2 class="h2">{{ t().off.policy }}</h2>
        <div class="cards">
          @for (pc of policyCards(); track pc.id) {
            <button
              type="button"
              class="pc"
              [class.on]="pc.selected"
              [attr.aria-pressed]="pc.selected"
              (click)="settings.patchOff({ policy: pc.id })"
            >
              <div class="pc-top">
                <i class="ph" [class]="pc.icon"></i>
                <span class="radio"><span></span></span>
              </div>
              <div class="fw6">{{ pc.title }}</div>
              <div class="fs14 muted">{{ pc.body }}</div>
            </button>
          }
        </div>
      </section>

      <div class="grid-2eq">
        <section class="panel stack">
          <app-select-field
            [label]="t().off.window"
            [options]="windowOptions()"
            [value]="off().window"
            [disabled]="off().policy !== 'queue'"
            (valueChange)="settings.patchOff({ window: $any($event) })"
          />
          <div>
            <div class="fs14 fw5 mb2">{{ t().off.channels }}</div>
            <app-checkbox
              [label]="t().off.cLine"
              [checked]="off().line"
              (checkedChange)="set({ line: $event })"
            />
            <app-checkbox
              [label]="t().off.cEmail"
              [checked]="off().email"
              (checkedChange)="set({ email: $event })"
            />
            <app-checkbox
              [label]="t().off.cPush"
              [checked]="off().push"
              (checkedChange)="set({ push: $event })"
            />
          </div>
        </section>

        <section class="panel sim">
          <div>
            <h2 class="h2">{{ t().off.simTitle }}</h2>
            <p class="sub">{{ t().off.simBody }}</p>
          </div>
          <div class="ext">
            <span
              class="dot"
              [style.background]="ext.online() ? 'var(--color-success)' : 'var(--color-danger)'"
            ></span>
            <span class="grow fs14 fw5">{{
              ext.online() ? t().top.extOnline : t().top.extOffline
            }}</span>
            <button
              type="button"
              class="su-btn su-btn-sm"
              [class.su-btn-secondary]="ext.online()"
              [class.su-btn-primary]="!ext.online()"
              [disabled]="ext.busy()"
              (click)="ext.toggleOnline()"
            >
              {{ ext.online() ? t().off.simOff : t().off.simOn }}
            </button>
          </div>
          <div class="fs14 fw5">{{ t().off.waiting }} ({{ waitingRows().length }})</div>
          @for (w of waitingRows(); track w.id) {
            <div class="row tight">
              <span class="time">{{ w.time }}</span>
              <span class="pico s24"><i class="ph" [class]="w.icon"></i></span>
              <span class="grow ellipsis">{{ w.text }}</span>
              <span class="status"
                ><span class="dot" [style.background]="w.dot"></span>{{ w.statusLabel }}</span
              >
            </div>
          } @empty {
            <p class="fs14 muted flush">{{ t().off.noWaiting }}</p>
          }
        </section>
      </div>
    </div>
  `,
  styles: `
    .w720 {
      max-width: 720px;
    }
    .fs14 {
      font-size: 14px;
    }
    .mb2 {
      margin-bottom: 2px;
    }
    .flush {
      margin: 0;
    }
    .policy,
    .sim {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
    }
    .pc {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 16px;
      border-radius: var(--radius-lg);
      background: var(--color-bg);
      cursor: pointer;
      font-family: inherit;
      text-align: left;
      color: var(--color-text);
      transition: box-shadow 0.2s ease-out;
      border: 1px solid var(--color-border);
      &.on {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 1px var(--color-primary);
      }
    }
    .pc-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      > .ph {
        font-size: 24px;
        color: var(--color-primary);
      }
    }
    .radio {
      width: 20px;
      height: 20px;
      border-radius: 9999px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid var(--color-border);
      span {
        width: 10px;
        height: 10px;
        border-radius: 9999px;
      }
      .on & {
        border-color: var(--color-primary);
        span {
          background: var(--color-primary);
        }
      }
    }
    .ext {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: var(--radius-md);
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      flex-wrap: wrap;
    }
    .row.tight {
      padding: 8px 0;
    }
  `,
})
export class OfflinePageComponent {
  private readonly notify = inject(NotificationService);
  private readonly posts = inject(PostsStore);
  private readonly i18n = inject(I18nService);
  protected readonly settings = inject(SettingsStore);
  protected readonly ext = inject(ExtensionStore);
  protected readonly t = this.i18n.t;
  protected readonly off = this.settings.off;

  protected readonly policyCards = computed(() => {
    const o = this.t().off;
    const cards: [OfflinePolicy, string, string, string][] = [
      ['skip', 'ph-skip-forward', o.skip, o.skipBody],
      ['queue', 'ph-queue', o.queue, o.queueBody],
      ['notify', 'ph-bell-ringing', o.notify, o.notifyBody],
    ];
    return cards.map(([id, icon, title, body]) => ({
      id,
      icon,
      title,
      body,
      selected: this.off().policy === id,
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

  protected set(patch: Partial<OfflineSettings>): void {
    this.settings.patchOff(patch);
  }

  protected readonly saving = signal(false);

  protected async save(): Promise<void> {
    this.saving.set(true);
    try {
      await this.settings.saveOff();
      this.notify.success(this.t().off.saved);
    } finally {
      this.saving.set(false);
    }
  }
}
