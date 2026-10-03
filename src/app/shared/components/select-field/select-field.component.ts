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
  templateUrl: './select-field.component.html',
  styleUrl: './select-field.component.scss',
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
