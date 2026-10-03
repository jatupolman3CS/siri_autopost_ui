import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

let nextId = 0;

// Design-system checkbox with a 44px hit area: <app-checkbox label="..." [(checked)]="x" />
@Component({
  selector: 'app-checkbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './checkbox.component.html',
  styleUrl: './checkbox.component.scss',
})
export class CheckboxComponent {
  readonly label = input('');
  readonly disabled = input(false);
  readonly checked = model(false);
  protected readonly id = `su-check-${nextId++}`;
}
