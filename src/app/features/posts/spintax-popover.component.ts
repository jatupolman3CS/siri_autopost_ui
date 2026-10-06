import {
  ChangeDetectionStrategy,
  Component,
  computed,
  OnInit,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { buildSpin } from '../../core/flow';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';

/** The most options the form takes (a group of more is hard to read and rarely needed). */
export const SPIN_MAX_OPTIONS = 10;

/** A selection is offered as the first option only when it is a short single line. */
const PREFILL_MAX = 120;

// What opens under the editor's "{ } Spintax" button: a way to wrap the selected words, three ready-made sets
// (greetings, closings, calls to action) and a form that builds a custom `{a|b|c}` from the options typed.
// It only says WHAT to write at the caret (`insert`) or that the selection is to be wrapped (`wrap`); the
// editor owns the text.
@Component({
  selector: 'app-spintax-popover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sp">
      <p class="small muted none">{{ t().api.flow.edSpinIntro }}</p>
      @if (selection()) {
        <button
          type="button"
          class="su-btn su-btn-sm su-btn-primary wrap"
          data-testid="spin-wrap"
          (click)="wrap.emit()"
        >
          <i class="ph ph-selection-plus"></i>{{ wrapLabel() }}
        </button>
      }
      <div class="fw5 small">{{ t().api.flow.edSpinReady }}</div>
      <div class="sets">
        @for (s of sets(); track s.id) {
          <button type="button" class="set" [attr.data-set]="s.id" (click)="insert.emit(s.text)">
            <span class="fw5 small">{{ s.label }}</span>
            <code>{{ s.text }}</code>
          </button>
        }
      </div>
      <div class="fw5 small">{{ t().api.flow.edSpinCustom }}</div>
      <form class="custom" (submit)="$event.preventDefault(); build()">
        @for (o of options(); track $index) {
          <div class="opt">
            <input
              class="su-input"
              type="text"
              [value]="o"
              [placeholder]="t().api.flow.edOptionPh"
              [attr.aria-label]="optionLabel($index)"
              (input)="setOption($index, $any($event.target).value)"
            />
            @if (options().length > 2) {
              <button
                type="button"
                class="ibtn"
                [title]="t().api.flow.edRemoveOption"
                [attr.aria-label]="t().api.flow.edRemoveOption + ' ' + ($index + 1)"
                (click)="removeOption($index)"
              >
                <i class="ph ph-x"></i>
              </button>
            }
          </div>
        }
        <button
          type="button"
          class="su-btn su-btn-sm su-btn-ghost add"
          data-testid="spin-add"
          [disabled]="options().length >= max"
          (click)="addOption()"
        >
          <i class="ph ph-plus"></i>{{ t().api.flow.edAddOption }}
        </button>
        <p class="small muted none">{{ t().api.flow.edSpinNoBraces }}</p>
        <div class="result small">
          <span class="muted">{{ t().api.flow.edSpinResult }}</span>
          <code data-testid="spin-built">{{ built() ?? t().api.flow.edSpinNeed2 }}</code>
        </div>
        <button
          type="submit"
          class="su-btn su-btn-sm su-btn-primary"
          data-testid="spin-insert"
          [disabled]="!built()"
        >
          {{ t().api.flow.edSpinInsert }}
        </button>
      </form>
    </div>
  `,
  styles: `
    .sp {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .none {
      margin: 0;
    }
    .wrap {
      height: auto;
      min-height: 36px;
      white-space: normal;
      text-align: left;
    }
    .sets {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .set {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
      width: 100%;
      padding: 8px 10px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-bg);
      color: var(--color-text);
      font-family: inherit;
      text-align: left;
      cursor: pointer;
    }
    .set:hover {
      border-color: var(--color-primary);
    }
    code {
      font-family: inherit;
      font-size: 13px;
      overflow-wrap: anywhere;
      color: var(--color-text-muted);
    }
    .custom {
      display: flex;
      flex-direction: column;
      gap: 6px;
      align-items: flex-start;
    }
    .opt {
      display: flex;
      gap: 4px;
      align-items: center;
      width: 100%;
    }
    .opt .su-input {
      flex: 1;
      min-width: 0;
    }
    .result {
      display: flex;
      flex-direction: column;
      gap: 2px;
      width: 100%;
    }
  `,
})
export class SpintaxPopoverComponent implements OnInit {
  protected readonly t = inject(I18nService).t;
  protected readonly max = SPIN_MAX_OPTIONS;

  /** The words selected in the text when the popover opened ('' = none). */
  readonly selection = input('');
  /** A complete group to write at the caret (in place of the selection, if there is one). */
  readonly insert = output<string>();
  /** Make the selected words the first option of a group, and let the person type the others. */
  readonly wrap = output<void>();

  protected readonly options = signal<string[]>(['', '']);

  /** The three ready-made sets (their words are in the dictionary: Thai or English, like the UI). */
  protected readonly sets = computed(() => {
    const a = this.t().api.flow;
    return [
      { id: 'greet', label: a.edSetGreet, text: a.edSetGreetText },
      { id: 'close', label: a.edSetClose, text: a.edSetCloseText },
      { id: 'cta', label: a.edSetCta, text: a.edSetCtaText },
    ];
  });
  protected readonly wrapLabel = computed(() => {
    const s = this.selection().replace(/\s+/g, ' ').trim();
    return fmt(this.t().api.flow.edSpinWrap, { t: s.length > 24 ? s.slice(0, 24) + '…' : s });
  });
  /** The group the form would write, or null while it has fewer than two options. */
  protected readonly built = computed(() => buildSpin(this.options()));

  ngOnInit(): void {
    // The words that were selected become the first option: the group then replaces them.
    const s = this.selection();
    if (s && s.length <= PREFILL_MAX && !/[\r\n]/.test(s)) this.options.set([s, '']);
  }

  protected optionLabel(index: number): string {
    return fmt(this.t().api.flow.edOptionN, { n: index + 1 });
  }

  protected setOption(index: number, value: string): void {
    this.options.update((l) => l.map((o, i) => (i === index ? value : o)));
  }

  protected addOption(): void {
    this.options.update((l) => (l.length >= SPIN_MAX_OPTIONS ? l : [...l, '']));
  }

  protected removeOption(index: number): void {
    this.options.update((l) => (l.length <= 2 ? l : l.filter((_, i) => i !== index)));
  }

  protected build(): void {
    const group = this.built();
    if (group) this.insert.emit(group);
  }
}
