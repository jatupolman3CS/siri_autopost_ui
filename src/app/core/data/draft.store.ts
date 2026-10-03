import { Injectable, signal } from '@angular/core';
import { dkey } from '../i18n/format';
import { CLOCK } from './clock';
import { SEED } from './seed.data';

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
  errText: string;
  errTargets: string;
  errTime: string;
}

export function blankDraft(): Draft {
  return {
    text: '',
    media: [],
    targets: { a1: true, a3: true },
    groups: SEED.groups.slice(0, 3),
    date: dkey(CLOCK.now),
    time: '14:00',
    repeat: 'none',
    useDelay: true,
    errText: '',
    errTargets: '',
    errTime: '',
  };
}

// The composer's draft lives here so the calendar ("edit") and the library ("use") can fill it.
@Injectable({ providedIn: 'root' })
export class DraftStore {
  readonly draft = signal<Draft>(blankDraft());

  patch(patch: Partial<Draft>): void {
    this.draft.update((d) => ({ ...d, ...patch }));
  }

  reset(patch: Partial<Draft> = {}): void {
    this.draft.set({ ...blankDraft(), ...patch });
  }

  appendText(text: string): void {
    this.draft.update((d) => ({ ...d, text: (d.text ? d.text + '\n' : '') + text, errText: '' }));
  }

  addMedia(id: string): void {
    this.draft.update((d) => (d.media.includes(id) ? d : { ...d, media: [...d.media, id] }));
  }
}
