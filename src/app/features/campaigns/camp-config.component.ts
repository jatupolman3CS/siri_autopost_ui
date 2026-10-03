import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CampaignsStore } from '../../core/data/campaigns.store';
import {
  Campaign,
  CampaignConfig,
  DEFAULT_CONFIG,
  TypingSpeed,
} from '../../core/ext/lib/shared.js';
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
  template: `
    <section class="panel stack ext-num">
      <h2 class="h2"><span class="n">3</span>{{ x().timingTitle }}</h2>
      <div class="ext-grid">
        @for (f of timing(); track f.key) {
          <label>
            {{ f.label }}
            <input
              type="number"
              class="su-input ext-in"
              [min]="f.min"
              [attr.max]="f.max ?? null"
              [step]="f.step"
              [value]="cfg()[f.key]"
              (input)="setNum(f, $any($event.target).value)"
            />
          </label>
        }
      </div>
      <p class="ext-hint">{{ x().cooldownHint }}</p>
      <p class="ext-hint">{{ x().timingHint }}</p>
      <div class="hours">
        <label class="ext-check">
          <input
            type="checkbox"
            [checked]="cfg().activeHoursEnabled"
            (change)="setBool('activeHoursEnabled', $any($event.target).checked)"
          />
          {{ x().activeHours }}
        </label>
        <input
          type="time"
          class="su-input ext-in time"
          [attr.aria-label]="x().activeStart"
          [value]="cfg().activeStart"
          (input)="set('activeStart', $any($event.target).value)"
        />
        {{ x().to }}
        <input
          type="time"
          class="su-input ext-in time"
          [attr.aria-label]="x().activeEnd"
          [value]="cfg().activeEnd"
          (input)="set('activeEnd', $any($event.target).value)"
        />
      </div>
    </section>

    <section class="panel stack ext-num">
      <h2 class="h2"><span class="n">4</span>{{ x().humanTitle }}</h2>
      <div class="ext-checks">
        @for (b of checks(); track b.key) {
          <label class="ext-check">
            <input
              type="checkbox"
              [checked]="cfg()[b.key]"
              (change)="setBool(b.key, $any($event.target).checked)"
            />
            {{ b.label }}
          </label>
        }
      </div>
      <div class="ext-grid">
        @for (f of rotation(); track f.key) {
          <label>
            {{ f.label }}
            <input
              type="number"
              class="su-input ext-in"
              [min]="f.min"
              [attr.max]="f.max ?? null"
              [step]="f.step"
              [value]="cfg()[f.key]"
              (input)="setNum(f, $any($event.target).value)"
            />
          </label>
        }
      </div>
      <p class="ext-hint">{{ x().rotationHint }}</p>
      <div class="ext-grid">
        <label>
          {{ x().typingSpeed }}
          <span class="su-select-wrap">
            <select class="su-select ext-in" (change)="setSpeed($any($event.target).value)">
              @for (s of speeds(); track s.v) {
                <option [value]="s.v" [selected]="cfg().typingSpeed === s.v">{{ s.label }}</option>
              }
            </select>
            <i class="ph ph-caret-down su-select-caret"></i>
          </span>
        </label>
        @for (f of behaviour(); track f.key) {
          <label>
            {{ f.label }}
            <input
              type="number"
              class="su-input ext-in"
              [min]="f.min"
              [attr.max]="f.max ?? null"
              [step]="f.step"
              [value]="cfg()[f.key]"
              (input)="setNum(f, $any($event.target).value)"
            />
          </label>
        }
      </div>
    </section>
  `,
  styles: `
    :host {
      display: contents;
    }
    .hours {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      font-size: 14px;
    }
    .time {
      width: 120px;
    }
  `,
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
