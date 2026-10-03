import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CampaignsStore } from '../../core/data/campaigns.store';
import { DEFAULT_GLOBAL, GlobalSettings, TelegramSettings } from '../../core/ext/lib/shared.js';
import { guardLine } from '../../core/ext/run-view';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { CampaignActions } from './campaign-actions.service';

type NumKey =
  'minGapMin' | 'dailyMaxPosts' | 'failStreakPause' | 'blockPauseHoursMin' | 'blockPauseHoursMax';
type TgCheck = 'onSuccess' | 'onFail' | 'screenshot' | 'roundSummary' | 'onStartStop';

interface Chat {
  id: string;
  name?: string;
  type?: string;
}

// The settings shared by every campaign (window focus, gap, anti-block) and the Telegram notices,
// with "find Chat ID" and "send a test" run on the browser (client/dashboard.js global/telegram).
@Component({
  selector: 'app-camp-global',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (g(); as g) {
      <section class="panel stack">
        <h2 class="h2">{{ x().globalTitle }}</h2>
        <label class="ext-check">
          <input
            type="checkbox"
            [checked]="g.focusWindow"
            (change)="setGlobal('focusWindow', $any($event.target).checked)"
          />
          {{ x().focusWindow }}
        </label>
        <label class="field">
          {{ x().minGapMin }}
          <input
            type="number"
            class="su-input ext-in"
            min="0"
            step="0.5"
            [value]="g.minGapMin"
            (input)="setNum('minGapMin', $any($event.target).value, 0)"
          />
        </label>
        <p class="ext-hint">{{ x().minGapHint }}</p>
        <h3 class="h3">{{ x().antiBlock }}</h3>
        <div class="ext-grid">
          @for (f of guards(); track f.key) {
            <label>
              {{ f.label }}
              <input
                type="number"
                class="su-input ext-in"
                [min]="f.min"
                step="1"
                [value]="g[f.key]"
                (input)="setNum(f.key, $any($event.target).value, f.min)"
              />
            </label>
          }
        </div>
        <p class="ext-hint">{{ x().antiBlockHint }}</p>
        <p class="small fw5 m0">{{ guard() }}</p>
      </section>

      <section class="panel stack">
        <div class="panel-head">
          <h2 class="h2">{{ x().tgTitle }}</h2>
          <label class="ext-switch">
            <input
              type="checkbox"
              [checked]="g.telegram.enabled"
              (change)="setTg('enabled', $any($event.target).checked)"
            />
            {{ x().enable }}
          </label>
        </div>
        <label class="field">
          Bot Token
          <input
            type="password"
            class="su-input ext-in"
            autocomplete="off"
            spellcheck="false"
            placeholder="123456789:AA..."
            [value]="g.telegram.botToken"
            (input)="setTg('botToken', $any($event.target).value.trim())"
          />
        </label>
        <label class="field">
          Chat ID
          <span class="chat">
            <input
              class="su-input ext-in"
              autocomplete="off"
              spellcheck="false"
              [placeholder]="x().chatIdPh"
              [value]="g.telegram.chatId"
              (input)="setTg('chatId', $any($event.target).value.trim())"
            />
            <button
              type="button"
              class="su-btn su-btn-sm su-btn-secondary"
              [disabled]="actions.pending()"
              (click)="findChat()"
            >
              {{ x().findChat }}
            </button>
          </span>
        </label>
        <div class="ext-checks">
          @for (c of tgChecks(); track c.key) {
            <label class="ext-check">
              <input
                type="checkbox"
                [checked]="g.telegram[c.key]"
                (change)="setTg(c.key, $any($event.target).checked)"
              />
              {{ c.label }}
            </label>
          }
        </div>
        @if (g.telegram.enabled && g.telegram.screenshot) {
          <div class="callout">
            <i class="ph ph-camera"></i><span>{{ x().capturePerm }}</span>
          </div>
        }
        <div>
          <button
            type="button"
            class="su-btn su-btn-sm su-btn-secondary"
            [disabled]="actions.pending()"
            (click)="test()"
          >
            <i class="ph ph-paper-plane-tilt"></i>{{ x().tgTest }}
          </button>
        </div>
        <details>
          <summary class="small muted">{{ x().tgHowTitle }}</summary>
          <ol class="ext-hint steps">
            <li>{{ x().tgHow1 }}</li>
            <li>{{ x().tgHow2 }}</li>
            <li>{{ x().tgHow3 }}</li>
          </ol>
          <p class="ext-hint">{{ x().tgHowShot }}</p>
        </details>
      </section>
    }
  `,
  styles: `
    :host {
      display: contents;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 14px;
    }
    .h3 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
    }
    .m0 {
      margin: 0;
    }
    .chat {
      display: flex;
      gap: 8px;
    }
    .steps {
      padding-left: 20px;
    }
  `,
})
export class CampGlobalComponent {
  private readonly store = inject(CampaignsStore);
  private readonly notify = inject(NotificationService);
  private readonly i18n = inject(I18nService);
  protected readonly actions = inject(CampaignActions);
  protected readonly x = computed(() => this.i18n.t().api.ext);
  protected readonly g = this.store.global;

  protected readonly guards = computed<{ key: NumKey; label: string; min: number }[]>(() => {
    const x = this.x();
    return [
      { key: 'dailyMaxPosts', label: x.dailyMaxPosts, min: 0 },
      { key: 'failStreakPause', label: x.failStreakPause, min: 0 },
      { key: 'blockPauseHoursMin', label: x.blockPauseHoursMin, min: 1 },
      { key: 'blockPauseHoursMax', label: x.blockPauseHoursMax, min: 1 },
    ];
  });

  protected readonly tgChecks = computed<{ key: TgCheck; label: string }[]>(() => {
    const x = this.x();
    return [
      { key: 'onSuccess', label: x.tgOnSuccess },
      { key: 'onFail', label: x.tgOnFail },
      { key: 'screenshot', label: x.tgScreenshot },
      { key: 'roundSummary', label: x.tgRoundSummary },
      { key: 'onStartStop', label: x.tgOnStartStop },
    ];
  });

  protected readonly guard = computed(() =>
    guardLine(this.x(), this.store.state(), this.g()?.dailyMaxPosts ?? 0),
  );

  protected setGlobal<K extends keyof GlobalSettings>(key: K, value: GlobalSettings[K]): void {
    this.store.change((s) => (s.global[key] = value));
  }

  protected setNum(key: NumKey, raw: string, min: number): void {
    const v = parseFloat(raw);
    this.setGlobal(key, Number.isFinite(v) ? Math.max(min, v) : DEFAULT_GLOBAL[key]);
  }

  protected setTg<K extends keyof TelegramSettings>(key: K, value: TelegramSettings[K]): void {
    this.store.change((s) => (s.global.telegram[key] = value));
  }

  protected test(): void {
    void this.actions.run('tgTest', {}, this.x().tgTestSent);
  }

  /** Asks the browser's bot for the chats that wrote to it and fills in the Chat ID. */
  protected async findChat(): Promise<void> {
    const x = this.x();
    const r = await this.actions.run('tgFindChats');
    if (!r?.ok) return;
    const chats = (r['chats'] as Chat[] | undefined) ?? [];
    if (!chats.length) {
      this.notify.info(x.noChats);
      return;
    }
    let chosen = chats[0];
    if (chats.length > 1) {
      const list = chats.map((c, i) => `${i + 1}. ${c.name || '-'} (${c.type}) ${c.id}`).join('\n');
      const n = parseInt(prompt(fmt(x.pickChat, { n: chats.length, list }), '1') ?? '', 10);
      if (!(n >= 1 && n <= chats.length)) return;
      chosen = chats[n - 1];
    }
    this.setTg('chatId', String(chosen.id));
    this.notify.success(fmt(x.chatSet, { name: chosen.name || '', id: chosen.id }));
  }
}
