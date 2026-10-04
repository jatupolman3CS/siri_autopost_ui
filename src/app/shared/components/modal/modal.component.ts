import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  Injector,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  untracked,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { I18nService } from '../../../core/i18n/i18n.service';

let nextId = 0;

/** The modals that are open, oldest first: only the last one answers Esc and Tab (a dialog on a dialog). */
const openModals: ModalComponent[] = [];

/** What Tab can land on. Hidden and disabled controls are left out below, a layout is not needed for that. */
const FOCUSABLE =
  'a[href], button, input, select, textarea, summary, [tabindex], [contenteditable=""], [contenteditable="true"]';

function focusablesIn(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => {
    if (el.getAttribute('tabindex') === '-1') return false;
    if ((el as HTMLButtonElement).disabled) return false;
    if (el instanceof HTMLInputElement && el.type === 'hidden') return false;
    return !el.hidden && !el.closest('[hidden]');
  });
}

// Design-system modal. Body content is projected; put the buttons in <div modal-footer>.
//
// It is a proper dialog: `role="dialog"` + `aria-modal`, named by its title (`aria-labelledby`), focus moves
// into it when it opens (the first control of the body, else its close button), Tab and Shift+Tab stay inside,
// Esc closes it, and focus goes back to what had it before when it closes. With `closable` off the person
// has to use the dialog's own buttons: no close button, no Esc, no click on the backdrop.
@Component({
  selector: 'app-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.scss',
})
export class ModalComponent {
  readonly open = input(false);
  readonly title = input('');
  /** Esc, the close button and a click on the backdrop emit `closed`. */
  readonly closable = input(true);
  readonly closed = output<void>();
  protected readonly t = inject(I18nService).t;
  protected readonly titleId = `su-modal-title-${nextId++}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly doc = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private active = false;
  private previous: HTMLElement | null = null;

  constructor() {
    effect(() => {
      const open = this.open();
      untracked(() => (open ? this.activate() : this.deactivate()));
    });
    inject(DestroyRef).onDestroy(() => this.deactivate());
  }

  @HostListener('document:keydown', ['$event'])
  protected onKeydown(e: KeyboardEvent): void {
    if (!this.active || openModals[openModals.length - 1] !== this) return;
    if (e.key === 'Escape') {
      if (this.closable() && !e.defaultPrevented) this.closed.emit();
    } else if (e.key === 'Tab') {
      this.trapTab(e);
    }
  }

  protected onOverlay(e: MouseEvent): void {
    if (this.closable() && e.target === e.currentTarget) this.closed.emit();
  }

  private panel(): HTMLElement | null {
    return this.host.nativeElement.querySelector<HTMLElement>('.su-modal-panel');
  }

  private activate(): void {
    if (this.active) return;
    this.active = true;
    const current = this.doc.activeElement;
    this.previous = current instanceof HTMLElement && current !== this.doc.body ? current : null;
    openModals.push(this);
    // The dialog is drawn after this effect: move the focus once it exists.
    afterNextRender(() => this.focusFirst(), { injector: this.injector });
  }

  private deactivate(): void {
    if (!this.active) return;
    this.active = false;
    const at = openModals.indexOf(this);
    if (at >= 0) openModals.splice(at, 1);
    const back = this.previous;
    this.previous = null;
    // Give the focus back only when it is still in the dialog (or nowhere): someone who moved on to another
    // control, or a page that took focus itself, keeps it.
    const now = this.doc.activeElement;
    const lost = !now || now === this.doc.body || this.host.nativeElement.contains(now);
    if (back && lost && back.isConnected) back.focus();
  }

  private focusFirst(): void {
    const panel = this.panel();
    if (!this.active || !panel) return;
    const now = this.doc.activeElement;
    // A field that took focus by itself (an autofocus) stays where it is.
    if (now && now !== panel && panel.contains(now)) return;
    const items = focusablesIn(panel);
    const target = items.find((el) => !el.classList.contains('su-x')) ?? items[0] ?? panel;
    target.focus();
  }

  private trapTab(e: KeyboardEvent): void {
    const panel = this.panel();
    if (!panel) return;
    const items = focusablesIn(panel);
    if (!items.length) {
      e.preventDefault();
      panel.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const now = this.doc.activeElement;
    const inside = !!now && panel.contains(now);
    if (e.shiftKey) {
      if (!inside || now === first || now === panel) {
        e.preventDefault();
        last.focus();
      }
    } else if (!inside || now === last) {
      e.preventDefault();
      first.focus();
    }
  }
}
