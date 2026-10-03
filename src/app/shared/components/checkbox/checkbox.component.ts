import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

let nextId = 0;

// Design-system checkbox with a 44px hit area: <app-checkbox label="..." [(checked)]="x" />
@Component({
  selector: 'app-checkbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="su-check" [class.su-check-on]="checked()" [class.su-check-dis]="disabled()">
      <span class="su-check-hit">
        <input
          type="checkbox"
          class="su-check-input"
          [id]="id"
          [checked]="checked()"
          [disabled]="disabled()"
          (change)="checked.set($any($event.target).checked)"
        />
        <span class="su-check-box" aria-hidden="true"></span>
        <i class="ph-bold ph-check su-check-glyph" aria-hidden="true"></i>
        <span class="su-check-focus" aria-hidden="true"></span>
      </span>
      <label class="su-check-label" [attr.for]="id">{{ label() }}</label>
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
  `,
})
export class CheckboxComponent {
  readonly label = input('');
  readonly disabled = input(false);
  readonly checked = model(false);
  protected readonly id = `su-check-${nextId++}`;
}
