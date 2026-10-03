import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CreatePostRequest } from '../../models/post.model';

// Dumb form: emits the request, the page decides what to do with it.
@Component({
  selector: 'app-post-form',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './post-form.component.html',
  styleUrl: './post-form.component.scss',
})
export class PostFormComponent {
  readonly saving = input(false);
  readonly serverErrors = input<Record<string, string[]>>({});
  readonly submitted = output<CreatePostRequest>();

  protected readonly form = inject(NonNullableFormBuilder).group({
    content: ['', [Validators.required, Validators.maxLength(5000)]],
    groupUrl: ['', Validators.required],
    scheduledAt: [''],
  });

  constructor() {
    // Lock the inputs while the request is in flight.
    effect(() => (this.saving() ? this.form.disable() : this.form.enable()));
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { content, groupUrl, scheduledAt } = this.form.getRawValue();
    this.submitted.emit({
      content,
      groupUrl,
      // <input type="datetime-local"> has no zone: treat it as the browser's local time.
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
    });
  }

  reset(): void {
    this.form.reset();
  }

  protected showError(field: 'content' | 'groupUrl'): boolean {
    const c = this.form.controls[field];
    return c.invalid && c.touched;
  }
}
