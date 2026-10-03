import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

let nextId = 0;

// Design-system text input with label and error: <app-input-field label="..." [(value)]="x" />
@Component({
  selector: 'app-input-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './input-field.component.html',
  styleUrl: './input-field.component.scss',
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
