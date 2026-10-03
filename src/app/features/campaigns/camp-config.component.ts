import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CampaignsStore } from '../../core/data/campaigns.store';
import {
  Campaign,
  CampaignConfig,
  DEFAULT_CONFIG,
  TypingSpeed,
} from '../../core/ext/lib/shared.js';
import '../../core/i18n/i18n.ext';
import { I18nService } from '../../core/i18n/i18n.service';

type NumKey = {
  [K in keyof CampaignConfig]: CampaignConfig[K] extends number ? K : never;
}[keyof CampaignConfig];
type BoolKey = {
  [K in keyof CampaignConfig]: CampaignConfig[K] extends boolean ? K : never;
}[keyof CampaignConfig];

interface NumField {
  key: NumKey;
  label: string;
  min: number;
  max?: number;
  step: number;
}

// Sections 3 and 4 of a campaign: delays, rounds and working hours, then the human-like randomness
// (the extension's data-cfg fields).
@Component({
  selector: 'app-camp-config',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './camp-config.component.html',
  styleUrl: './camp-config.component.scss',
})
export class CampConfigComponent {
  private readonly store = inject(CampaignsStore);
  private readonly i18n = inject(I18nService);
  protected readonly x = computed(() => this.i18n.t().api.ext);

  readonly campaign = input.required<Campaign>();

  protected readonly cfg = computed(() => {
    this.store.campaigns();
    return this.campaign().config;
  });

  protected readonly timing = computed<NumField[]>(() => {
    const x = this.x();
    return [
      { key: 'groupDelayMin', label: x.groupDelayMin, min: 0.5, step: 0.5 },
      { key: 'groupDelayMax', label: x.groupDelayMax, min: 0.5, step: 0.5 },
      { key: 'roundIntervalHours', label: x.roundIntervalHours, min: 0.1, step: 0.5 },
      { key: 'roundJitterMin', label: x.roundJitterMin, min: 0, step: 1 },
      { key: 'maxRounds', label: x.maxRounds, min: 0, step: 1 },
      { key: 'groupCooldownHours', label: x.groupCooldownHours, min: 0, step: 1 },
    ];
  });

  protected readonly checks = computed<{ key: BoolKey; label: string }[]>(() => {
    const x = this.x();
    return [
      { key: 'shuffleGroups', label: x.shuffleGroups },
      { key: 'browseBeforePost', label: x.browseBeforePost },
      { key: 'typos', label: x.typos },
      { key: 'shuffleImages', label: x.shuffleImages },
    ];
  });

  protected readonly rotation = computed<NumField[]>(() => {
    const x = this.x();
    return [
      { key: 'recentAvoid', label: x.recentAvoid, min: 0, step: 1 },
      { key: 'leadChancePct', label: x.leadChancePct, min: 0, max: 100, step: 5 },
    ];
  });

  protected readonly behaviour = computed<NumField[]>(() => {
    const x = this.x();
    return [
      { key: 'maxTypeChars', label: x.maxTypeChars, min: 0, step: 50 },
      { key: 'skipChancePct', label: x.skipChancePct, min: 0, max: 90, step: 1 },
      { key: 'longBreakEvery', label: x.longBreakEvery, min: 0, step: 1 },
      { key: 'longBreakMin', label: x.longBreakMin, min: 1, step: 1 },
      { key: 'longBreakMax', label: x.longBreakMax, min: 1, step: 1 },
    ];
  });

  protected readonly speeds = computed(() => {
    const x = this.x();
    return [
      { v: 'slow', label: x.speedSlow },
      { v: 'normal', label: x.speedNormal },
      { v: 'fast', label: x.speedFast },
    ];
  });

  protected set<K extends keyof CampaignConfig>(key: K, value: CampaignConfig[K]): void {
    const c = this.campaign();
    this.store.change(() => (c.config[key] = value));
  }

  protected setBool(key: BoolKey, on: boolean): void {
    this.set(key, on);
  }

  protected setSpeed(v: string): void {
    this.set('typingSpeed', v as TypingSpeed);
  }

  /** Like the extension: a number below the field's minimum becomes the minimum; not a number keeps the default. */
  protected setNum(f: NumField, raw: string): void {
    const v = parseFloat(raw);
    this.set(f.key, Number.isFinite(v) ? Math.max(f.min, v) : DEFAULT_CONFIG[f.key]);
  }
}
