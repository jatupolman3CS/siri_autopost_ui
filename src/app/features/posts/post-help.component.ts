import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PermissionsService } from '../../core/data/permissions.service';
import { I18nService } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';

// The "?" next to the insert toolbar: what {{code}} and Spintax are in plain words, WHERE the group code comes
// from (the code column of the link set page) and that the text differs for every group, with three examples
// that can be put into the post.
@Component({
  selector: 'app-post-help',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="help">
      <div class="fw6">{{ t().api.flow.edHelpTitle }}</div>
      <section>
        <div class="fw5 small">{{ t().api.flow.edHelpCodeH }}</div>
        <p class="small">{{ t().api.flow.edHelpCodeB }}</p>
        <a class="small" routerLink="/app/targets">{{ t().api.flow.edHelpSets }}</a>
      </section>
      <section>
        <div class="fw5 small">{{ t().api.flow.edHelpSpinH }}</div>
        <p class="small">{{ t().api.flow.edHelpSpinB }}</p>
      </section>
      <div class="fw5 small">{{ t().api.flow.edHelpExamples }}</div>
      @for (e of examples(); track e.id) {
        <section class="ex" [attr.data-example]="e.id">
          <div class="fw5 small">{{ e.title }}</div>
          <pre>{{ e.text }}</pre>
          <p class="small muted">{{ e.result }}</p>
          <button
            type="button"
            class="su-btn su-btn-sm su-btn-ghost"
            [disabled]="!perm.canEdit()"
            [attr.title]="perm.editHint() || null"
            (click)="insert.emit(e.text)"
          >
            <i class="ph ph-arrow-line-down"></i>{{ t().api.flow.edHelpInsert }}
          </button>
        </section>
      }
    </div>
  `,
  styles: `
    .help {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    p {
      margin: 2px 0;
    }
    .ex {
      padding: 8px 10px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-bg);
    }
    pre {
      margin: 4px 0;
      font-family: inherit;
      font-size: 13px;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
  `,
})
export class PostHelpComponent {
  protected readonly perm = inject(PermissionsService);
  protected readonly t = inject(I18nService).t;

  /** An example is put into the post at the caret. */
  readonly insert = output<string>();

  protected readonly examples = computed(() => {
    const a = this.t().api.flow;
    return [
      { id: 'code', title: a.edEx1Title, text: a.edEx1Text, result: a.edEx1Result },
      { id: 'spin', title: a.edEx2Title, text: a.edEx2Text, result: a.edEx2Result },
      { id: 'both', title: a.edEx3Title, text: a.edEx3Text, result: a.edEx3Result },
    ];
  });
}
