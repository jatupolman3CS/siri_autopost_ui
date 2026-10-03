import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { dkey } from '../i18n/format';
import { AccountsStore } from './accounts.store';
import { SocialAccount } from './models';

export interface Draft {
  text: string;
  media: string[];
  /** accountId -> selected */
  targets: Record<string, boolean>;
  /** Facebook groups picked for accounts that post to groups. */
  groups: string[];
  date: string;
  time: string;
  repeat: 'none' | 'daily' | 'weekdays' | 'weekly';
  useDelay: boolean;
  /** True until the user picks targets: the defaults follow the workspace's accounts. */
  autoTargets: boolean;
  /** A queued post being edited: it is deleted once the new version is scheduled. */
  replaces: string | null;
  errText: string;
  errTargets: string;
  errTime: string;
}

/** 14:00 today as in the design; once that has passed, the full hour after next. */
function defaultSlot(now = new Date()): { date: string; time: string } {
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14);
  if (at <= now) at.setTime(new Date(now).setMinutes(0, 0, 0) + 2 * 3600_000);
  return { date: dkey(at), time: `${String(at.getHours()).padStart(2, '0')}:00` };
}

export function blankDraft(): Draft {
  return {
    text: '',
    media: [],
    targets: {},
    groups: [],
    ...defaultSlot(),
    repeat: 'none',
    useDelay: true,
    autoTargets: true,
    replaces: null,
    errText: '',
    errTargets: '',
    errTime: '',
  };
}

/**
 * A connected (paired) group account with three of its groups; without one, the design's
 * default: the first group-posting sample account with three groups, plus Instagram.
 */
export function defaultTargets(list: SocialAccount[]): Pick<Draft, 'targets' | 'groups'> {
  const usable = list.filter((a) => a.health !== 'relogin');
  const connected = usable.find((a) => a.connected && a.groups.length);
  const page = connected ?? usable.find((a) => a.groups.length);
  const ig = connected ? undefined : usable.find((a) => a.platform === 'ig');
  const targets: Record<string, boolean> = {};
  if (page) targets[page.id] = true;
  if (ig) targets[ig.id] = true;
  return { targets, groups: page ? page.groups.slice(0, 3) : [] };
}

// The composer's draft lives here so the calendar ("edit") and the library ("use") can fill it.
@Injectable({ providedIn: 'root' })
export class DraftStore {
  private readonly accounts = inject(AccountsStore);
  readonly draft = signal<Draft>(blankDraft());

  constructor() {
    // Keep the targets valid for the current workspace's accounts.
    effect(() => {
      const list = this.accounts.list();
      untracked(() =>
        this.draft.update((d) => {
          if (d.autoTargets) return { ...d, ...defaultTargets(list) };
          const ids = new Set(list.map((a) => a.id));
          const groups = new Set(list.flatMap((a) => a.groups));
          return {
            ...d,
            targets: Object.fromEntries(Object.entries(d.targets).filter(([id]) => ids.has(id))),
            groups: d.groups.filter((g) => groups.has(g)),
          };
        }),
      );
    });
  }

  patch(patch: Partial<Draft>): void {
    this.draft.update((d) => ({ ...d, ...patch }));
  }

  reset(patch: Partial<Draft> = {}): void {
    const base = { ...blankDraft(), ...defaultTargets(this.accounts.list()) };
    this.draft.set({ ...base, ...patch });
  }

  appendText(text: string): void {
    this.draft.update((d) => ({ ...d, text: (d.text ? d.text + '\n' : '') + text, errText: '' }));
  }

  addMedia(id: string): void {
    this.draft.update((d) => (d.media.includes(id) ? d : { ...d, media: [...d.media, id] }));
  }
}
