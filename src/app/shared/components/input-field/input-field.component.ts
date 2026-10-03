import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

let nextId = 0;

// Design-system text input with label and error: <app-input-field label="..." [(value)]="x" />
@Component({
  selector: 'app-input-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (label()) {
      <label class="su-field-label" [attr.for]="id">{{ label() }}</label>
    }
    <input
      class="su-input"
      [class.su-input-error]="!!error()"
      [id]="id"
      [type]="type()"
      [placeholder]="placeholder()"
      [disabled]="disabled()"
      [value]="value()"
      [attr.autocomplete]="autocomplete()"
      [attr.aria-invalid]="error() ? true : null"
      [attr.aria-label]="label() ? null : placeholder()"
      (input)="value.set($any($event.target).value)"
    />
    @if (error()) {
      <p class="su-field-err" role="alert">{{ error() }}</p>
    }
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class InputFieldComponent {
  readonly label = input('');
  readonly type = input('text');
  readonly placeholder = input('');
  readonly error = input('');
  readonly disabled = input(false);
  readonly autocomplete = input<string | null>(null);
  readonly value = model('');
  protected readonly id = `su-input-${nextId++}`;
}
