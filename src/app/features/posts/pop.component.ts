import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  model,
} from '@angular/core';

// A small popover that hangs under its trigger button: `<app-pop #p><button pop-trigger (click)="p.toggle()">
// …</button> @if (p.open()) { …content… }</app-pop>`. The content is only created while it is open (so its
// own state starts fresh every time), the popover closes on Escape, on a click outside it and when asked
// (`close()`), and on a phone it becomes a sheet at the bottom of the screen.
@Component({
  selector: 'app-pop',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'outside($event)',
    '(keydown.escape)': 'escape($event)',
  },
  template: `
    <ng-content select="[pop-trigger]" />
    @if (open()) {
      <div class="pop" role="dialog" [attr.aria-label]="label() || null" [class.right]="right()">
        <ng-content />
      </div>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: inline-flex;
    }
    .pop {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      z-index: 30;
      width: max-content;
      min-width: 260px;
      max-width: min(420px, calc(100vw - 32px));
      max-height: min(70vh, 520px);
      overflow: auto;
      padding: 12px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      box-shadow: var(--shadow-md);
    }
    .pop.right {
      left: auto;
      right: 0;
    }
    @media (max-width: 639px) {
      .pop,
      .pop.right {
        position: fixed;
        top: auto;
        bottom: 8px;
        left: 8px;
        right: 8px;
        width: auto;
        max-width: none;
        max-height: 75vh;
      }
    }
  `,
})
export class PopComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Whether the popover is showing (two-way: the owner may close it after an action). */
  readonly open = model(false);
  /** The accessible name of the popover. */
  readonly label = input('');
  /** Hang from the right edge of the trigger (for a trigger at the right end of a row). */
  readonly right = input(false);

  toggle(): void {
    this.open.update((o) => !o);
  }

  close(): void {
    this.open.set(false);
  }

  protected outside(e: Event): void {
    // composedPath, not contains(): a click on a button the handler removes must still count as inside.
    if (this.open() && !e.composedPath().includes(this.host.nativeElement)) this.close();
  }

  protected escape(e: Event): void {
    if (!this.open()) return;
    e.stopPropagation();
    this.close();
    // Back to the trigger, so a keyboard user is not left in the page.
    this.host.nativeElement.querySelector<HTMLElement>('[pop-trigger]')?.focus();
  }
}
