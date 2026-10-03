import { Injectable, signal } from '@angular/core';
import { PlatformKey } from './models';
import { SEED } from './seed.data';

export interface AntiBanSettings {
  min: number;
  max: number;
  limits: Record<PlatformKey, number>;
  typing: boolean;
  scroll: boolean;
  shuffle: boolean;
  autopause: boolean;
  warmup: boolean;
}

export type OfflinePolicy = 'skip' | 'queue' | 'notify';

export interface OfflineSettings {
  policy: OfflinePolicy;
  window: '30m' | '2h' | 'day';
  line: boolean;
  email: boolean;
  push: boolean;
}

export interface BillingSettings {
  cycle: 'month' | 'year';
  nFail: boolean;
  nExpire: boolean;
  nRenew: boolean;
  card: { last4: string; exp: string };
}

// Workspace settings for the posting engine and billing preferences.
@Injectable({ providedIn: 'root' })
export class SettingsStore {
  readonly ab = signal<AntiBanSettings>({
    min: 3,
    max: 12,
    limits: { ...SEED.limits },
    typing: true,
    scroll: true,
    shuffle: true,
    autopause: true,
    warmup: false,
  });
  readonly off = signal<OfflineSettings>({
    policy: 'queue',
    window: '2h',
    line: true,
    email: true,
    push: false,
  });
  readonly bill = signal<BillingSettings>({
    cycle: 'month',
    nFail: true,
    nExpire: true,
    nRenew: false,
    card: { last4: '4242', exp: '11/26' },
  });
  readonly usedToday = SEED.usedToday;

  patchAb(patch: Partial<AntiBanSettings>): void {
    this.ab.update((v) => ({ ...v, ...patch }));
  }

  patchOff(patch: Partial<OfflineSettings>): void {
    this.off.update((v) => ({ ...v, ...patch }));
  }

  patchBill(patch: Partial<BillingSettings>): void {
    this.bill.update((v) => ({ ...v, ...patch }));
  }
}
