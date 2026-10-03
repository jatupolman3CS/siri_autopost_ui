import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

export interface SelectOption {
  value: string;
  label: string;
}

let nextId = 0;

// Design-system select. With a placeholder, an empty value shows it as a disabled first option.
@Component({
  selector: 'app-select-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="su-field-label" [attr.for]="id">{{ label() }}</label>
    <div class="su-select-wrap">
      <select
        class="su-select"
        [class.su-input-error]="!!error()"
        [id]="id"
        [disabled]="disabled()"
        (change)="onChange($any($event.target))"
      >
        @if (placeholder()) {
          <option value="" disabled [selected]="!value()">{{ placeholder() }}</option>
        }
        @for (o of options(); track o.value) {
          <option [value]="o.value" [selected]="o.value === value()">{{ o.label }}</option>
        }
      </select>
      <i class="ph ph-caret-down su-select-caret" aria-hidden="true"></i>
    </div>
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
export class SelectFieldComponent {
  readonly label = input('');
  readonly options = input<SelectOption[]>([]);
  readonly placeholder = input('');
  readonly error = input('');
  readonly disabled = input(false);
  /** Action menus (e.g. "insert snippet"): go back to the placeholder after each pick. */
  readonly resetAfterChange = input(false);
  readonly value = model('');
  protected readonly id = `su-select-${nextId++}`;

  protected onChange(el: HTMLSelectElement): void {
    this.value.set(el.value);
    if (this.resetAfterChange()) {
      el.value = '';
      this.value.set('');
    }
  }
}
