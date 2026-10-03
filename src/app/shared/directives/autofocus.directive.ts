import { Directive, ElementRef, afterNextRender, inject } from '@angular/core';

// <input appAutofocus>: focuses the element once it is rendered.
@Directive({ selector: '[appAutofocus]' })
export class AutofocusDirective {
  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef);
    afterNextRender(() => el.nativeElement.focus());
  }
}
