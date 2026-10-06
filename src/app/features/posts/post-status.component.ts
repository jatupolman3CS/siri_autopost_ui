import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MAX_VARIANTS, SpinIssue, hasCodeTag, lintSpin, spinCount } from '../../core/flow';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';

/** Digits in groups of three: 1,234,567 (the same in Thai and English, and in every browser). */
const grouped = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** How many warnings are written out; the rest are counted. */
const SHOWN = 3;

// The line under the text of a post: whether it has {{code}} (and what happens when it has not), how much
// Spintax there is ("N groups ≈ M variants"), and warnings about braces the server would not read the way the
// writer meant (unbalanced braces, `{a}` with no pipe, empty options, {{code}} inside a group). It is computed
// from the text as it is typed, so the person sees at once what a button or a keystroke did.
@Component({
  selector: 'app-post-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="status" [attr.aria-label]="t().api.flow.edStatus" data-testid="post-status">
      @if (hasCode()) {
        <span class="ok" data-testid="status-code"
          ><i class="ph ph-check-circle" aria-hidden="true"></i>{{ t().api.flow.edCodeOn }}</span
        >
      } @else {
        <span class="muted" data-testid="status-code"
          ><i class="ph ph-info" aria-hidden="true"></i>{{ t().api.flow.edCodeOff }}</span
        >
      }
      <span
        [class.ok]="stats().groups > 0"
        [class.muted]="!stats().groups"
        data-testid="status-spin"
        ><i
          class="ph"
          [class]="stats().groups ? 'ph-check-circle' : 'ph-info'"
          aria-hidden="true"
        ></i
        >{{ spinLine() }}</span
      >
    </div>
    @if (warnings().length) {
      <ul class="warns" role="status" data-testid="status-warnings">
        @for (w of warnings(); track w.kind) {
          <li>
            <i class="ph ph-warning" aria-hidden="true"></i><span>{{ w.text }}</span>
          </li>
        }
        @if (more() > 0) {
          <li class="muted">{{ moreLine() }}</li>
        }
      </ul>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .status {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 16px;
      font-size: 14px;
    }
    .status span {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .ok {
      color: var(--color-success);
    }
    .muted {
      color: var(--color-text-muted);
    }
    .warns {
      list-style: none;
      margin: 6px 0 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 14px;
      color: var(--color-warning-text, var(--color-text));
    }
    .warns li {
      display: flex;
      align-items: flex-start;
      gap: 6px;
    }
    .warns .ph-warning {
      color: var(--color-warning);
      margin-top: 2px;
    }
  `,
})
export class PostStatusComponent {
  protected readonly t = inject(I18nService).t;

  /** The post's text as typed. */
  readonly text = input('');

  protected readonly hasCode = computed(() => hasCodeTag(this.text()));
  protected readonly stats = computed(() => spinCount(this.text()));
  protected readonly spinLine = computed(() => {
    const a = this.t().api.flow;
    const s = this.stats();
    if (!s.groups) return a.edSpinOff;
    const v =
      s.variants >= MAX_VARIANTS
        ? fmt(a.edVariantsMany, { v: grouped(MAX_VARIANTS) })
        : grouped(s.variants);
    return fmt(a.edSpinOn, { g: s.groups, v });
  });

  /** One warning per kind of mistake (the first one found says where), at most a few. */
  private readonly issues = computed(() => {
    const first = new Map<SpinIssue['kind'], SpinIssue>();
    for (const i of lintSpin(this.text())) if (!first.has(i.kind)) first.set(i.kind, i);
    return [...first.values()];
  });
  protected readonly warnings = computed(() => {
    const a = this.t().api.flow;
    const message: Record<SpinIssue['kind'], string> = {
      unclosed: a.edLintUnclosed,
      unopened: a.edLintUnopened,
      noPipe: a.edLintNoPipe,
      emptyOption: a.edLintEmpty,
      codeInGroup: a.edLintCodeIn,
    };
    return this.issues()
      .slice(0, SHOWN)
      .map((i) => ({ kind: i.kind, text: fmt(message[i.kind], { t: i.text }) }));
  });
  protected readonly more = computed(() => Math.max(0, this.issues().length - SHOWN));
  protected readonly moreLine = computed(() =>
    fmt(this.t().api.flow.edLintMore, { n: this.more() }),
  );
}
