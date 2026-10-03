import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CampaignsStore } from '../../core/data/campaigns.store';
import { PermissionsService } from '../../core/data/permissions.service';
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
  templateUrl: './camp-global.component.html',
  styleUrl: './camp-global.component.scss',
})
export class CampGlobalComponent {
  private readonly store = inject(CampaignsStore);
  private readonly notify = inject(NotificationService);
  private readonly i18n = inject(I18nService);
  protected readonly actions = inject(CampaignActions);
  private readonly permissions = inject(PermissionsService);
  /** The API shows the Bot Token to admins only (and keeps the stored one when others save). */
  protected readonly canSeeToken = this.permissions.canAdmin;
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
