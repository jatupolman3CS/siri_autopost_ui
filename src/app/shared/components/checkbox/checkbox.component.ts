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
  /** The name a screen reader reads when there is no visible label (a switch inside a table row). */
  readonly ariaLabel = input<string | null>(null);
  readonly disabled = input(false);
  readonly checked = model(false);
  protected readonly id = `su-check-${nextId++}`;
}
