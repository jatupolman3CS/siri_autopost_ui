import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  AI_DEFAULT_COUNT,
  AI_MAX_COUNT,
  AI_TONES,
  AiStore,
  AiTone,
} from '../../core/data/ai.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { INPUT_LIMITS } from '../../core/http/input-limits';
import { problemMessage } from '../../core/http/problem-details';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';
import '../../core/i18n/i18n.flow';

// The AI panel of the post editor: a friendly form (the topic, selling points added one by one with Enter, a
// tone and how many drafts) and the drafts it brings back as cards. It never saves anything and never touches
// the text itself: "Use this", "Append" and "Add as a separate post" are events for the editor, which owns the
// text and the saving. While the server has no AI key, the plan has no AI or the person cannot edit, the Write
// button is off with the reason written beside it (`AiStore.state`).
@Component({
  selector: 'app-ai-panel',
  imports: [InputFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ai-panel.component.html',
  styleUrl: './ai-panel.component.scss',
})
export class AiPanelComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly ai = inject(AiStore);
  protected readonly perm = inject(PermissionsService);
  protected readonly t = inject(I18nService).t;
  protected readonly limits = INPUT_LIMITS;
  protected readonly tones = AI_TONES;
  protected readonly counts = Array.from({ length: AI_MAX_COUNT }, (_, i) => i + 1);

  /** The draft replaces the text of the editor. */
  readonly use = output<string>();
  /** The draft is added after the text of the editor. */
  readonly append = output<string>();
  /** The draft is saved as a post of its own (the editor does it). */
  readonly separate = output<string>();
  readonly closed = output<void>();
  /** Drafts being saved as separate posts right now (the editor says which, so their buttons wait). */
  readonly saving = input<readonly string[]>([]);

  protected readonly topic = signal('');
  protected readonly points = signal<string[]>([]);
  protected readonly pointDraft = signal('');
  protected readonly tone = signal<AiTone>('friendly');
  protected readonly count = signal(AI_DEFAULT_COUNT);

  protected readonly errTopic = signal('');
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly results = signal<string[]>([]);

  protected readonly toneLabels = computed<Record<AiTone, string>>(() => ({
    friendly: this.t().ai.tFriendly,
    formal: this.t().ai.tFormal,
    sales: this.t().ai.tSales,
    short: this.t().api.flow.edAiToneShort,
  }));
  protected readonly leftLine = computed(() => {
    const n = this.ai.remaining();
    return n === null ? '' : fmt(this.t().api.flow.edAiLeft, { n });
  });
  protected readonly pointsFull = computed(() => this.points().length >= INPUT_LIMITS.aiPoints);
  protected readonly pointsHint = computed(() =>
    this.pointsFull()
      ? fmt(this.t().api.flow.edAiPointsMax, { n: INPUT_LIMITS.aiPoints })
      : this.t().ai.pointsPh,
  );
  /** How many skeleton cards to show while the AI writes. */
  protected readonly placeholders = computed(() =>
    Array.from({ length: this.count() }, (_, i) => i),
  );

  constructor() {
    // The first field is ready to type in when the panel opens.
    afterNextRender(() =>
      this.host.nativeElement.querySelector<HTMLElement>('input')?.focus({ preventScroll: true }),
    );
  }

  protected draftLabel(index: number): string {
    return fmt(this.t().api.flow.edAiDraftN, { n: index + 1 });
  }

  protected isSaving(text: string): boolean {
    return this.saving().includes(text);
  }

  /** Adds the point being typed to the list (blank and repeated ones are dropped, at most ten). */
  protected addPoint(): void {
    const p = this.pointDraft().trim().slice(0, INPUT_LIMITS.aiPointLength);
    if (!p || this.pointsFull()) return;
    if (!this.points().includes(p)) this.points.update((l) => [...l, p]);
    this.pointDraft.set('');
  }

  protected removePoint(index: number): void {
    this.points.update((l) => l.filter((_, i) => i !== index));
  }

  protected setCount(n: number): void {
    this.count.set(n);
  }

  /** Writes the drafts (or writes new ones for the same request). */
  protected async write(): Promise<void> {
    if (this.busy() || !this.ai.canWrite() || !this.perm.canEdit()) return;
    // A selling point typed but not confirmed with Enter still counts.
    this.addPoint();
    const topic = this.topic().trim();
    this.errTopic.set(topic ? '' : this.t().ai.errTopic);
    if (!topic) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const drafts = await this.ai.write({
        topic,
        points: this.points(),
        tone: this.tone(),
        count: this.count(),
      });
      this.results.set(drafts);
    } catch (e) {
      this.error.set(problemMessage(e) ?? this.t().api.flow.edAiFailed);
    } finally {
      this.busy.set(false);
    }
  }
}
