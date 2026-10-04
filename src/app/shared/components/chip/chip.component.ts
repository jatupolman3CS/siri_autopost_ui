import { ChangeDetectionStrategy, Component, input } from '@angular/core';

// A small rounded label (the design system's badge): keywords, scopes, "best", "switched off", chat commands.
// `tone` picks the colours, `large` is the 32 px version, `mono` writes it in a monospace face.
@Component({
  selector: 'app-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-tone]': 'tone()',
    '[class.large]': 'large()',
    '[class.mono]': 'mono()',
  },
  template: '<ng-content />',
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      height: 22px;
      padding: 0 8px;
      border-radius: var(--radius-full);
      background: var(--color-surface-muted);
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
      flex-shrink: 0;
    }
    :host([data-tone='primary']) {
      background: var(--color-primary);
      color: var(--color-primary-foreground);
    }
    :host([data-tone='accent']) {
      background: var(--color-accent);
      color: var(--color-accent-foreground);
    }
    :host(.large) {
      height: 32px;
      padding: 0 12px;
    }
    :host(.mono) {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
  `,
})
export class ChipComponent {
  readonly tone = input<'muted' | 'primary' | 'accent'>('muted');
  readonly large = input(false);
  readonly mono = input(false);
}
