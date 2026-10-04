import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CollectionsStore } from '../../core/data/collections.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { AI_TONES, AiTone, generatePosts, parsePoints } from '../../core/flow';
import { INPUT_LIMITS } from '../../core/http/input-limits';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { SelectFieldComponent } from '../../shared/components/select-field/select-field.component';

/** The numbers of posts the dialog offers (the API takes up to 20 in one batch). */
const COUNTS = ['1', '3', '5', '10', '20'];

// The "post drafts" dialog (the design called it "write with AI", but there is no language model): a topic,
// optional selling points, a tone and a number of posts become drafts from text templates (core/flow/ai-writer)
// that are added to a collection in one batch.
@Component({
  selector: 'app-ai-writer-modal',
  imports: [InputFieldComponent, ModalComponent, SelectFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" [title]="t().ai.title" (closed)="closed.emit()">
      <form class="form" id="ai-writer-form" (submit)="$event.preventDefault(); generate()">
        <app-input-field
          [label]="t().ai.topic"
          [placeholder]="t().ai.topicPh"
          [(value)]="topic"
          [error]="errTopic()"
          [maxlength]="limits.aiTopic"
        />
        <app-input-field
          [label]="t().ai.points"
          [placeholder]="t().ai.pointsPh"
          [(value)]="points"
          [maxlength]="limits.aiPoints"
        />
        <div class="trio">
          <app-select-field [label]="t().ai.tone" [options]="toneOptions()" [(value)]="tone" />
          <app-select-field [label]="t().ai.count" [options]="countOptions" [(value)]="count" />
          <app-select-field
            [label]="t().ai.into"
            [placeholder]="t().cmp.colPh"
            [options]="collectionOptions()"
            [(value)]="collectionId"
            [error]="errCol()"
          />
        </div>
        <p class="small muted note">{{ t().ai.note }}</p>
      </form>
      <div modal-footer>
        <button type="button" class="su-btn su-btn-sm su-btn-secondary" (click)="closed.emit()">
          {{ t().common.cancel }}
        </button>
        <button
          type="submit"
          form="ai-writer-form"
          class="su-btn su-btn-sm su-btn-primary"
          [disabled]="busy() || !perm.canEdit()"
          [attr.title]="perm.editHint() || null"
        >
          {{ t().ai.generate }}
        </button>
      </div>
    </app-modal>
  `,
  styles: `
    .form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .trio {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
    }
    .note {
      margin: 0;
    }
  `,
})
export class AiWriterModalComponent {
  private readonly store = inject(CollectionsStore);
  private readonly notify = inject(NotificationService);
  protected readonly perm = inject(PermissionsService);
  protected readonly t = inject(I18nService).t;
  protected readonly limits = INPUT_LIMITS;
  protected readonly countOptions = COUNTS.map((v) => ({ value: v, label: v }));

  readonly open = input(false);
  /** The collection chosen when the dialog opens (the draft's, else the last one saved to, else the first). */
  readonly defaultCollectionId = input('');
  /** The posts are saved: the collection they went to and how many. */
  readonly generated = output<{ collectionId: string; count: number }>();
  readonly closed = output<void>();

  protected readonly topic = signal('');
  protected readonly points = signal('');
  protected readonly tone = signal<string>('friendly');
  protected readonly count = signal('3');
  protected readonly collectionId = signal('');
  protected readonly errTopic = signal('');
  protected readonly errCol = signal('');
  protected readonly busy = signal(false);

  protected readonly toneOptions = computed(() => {
    const a = this.t().ai;
    const label: Record<AiTone, string> = {
      friendly: a.tFriendly,
      sales: a.tSales,
      formal: a.tFormal,
    };
    return AI_TONES.map((value) => ({ value, label: label[value] }));
  });
  protected readonly collectionOptions = computed(() =>
    this.store.collections().map((c) => ({ value: c.id, label: c.name })),
  );

  constructor() {
    // A fresh form every time the dialog opens.
    effect(() => {
      if (!this.open()) return;
      const first = this.store.collections()[0]?.id ?? '';
      const wanted = this.defaultCollectionId() || this.store.lastId() || first;
      this.topic.set('');
      this.points.set('');
      this.tone.set('friendly');
      this.count.set('3');
      this.collectionId.set(this.store.byId(wanted) ? wanted : first);
      this.errTopic.set('');
      this.errCol.set('');
    });
  }

  protected async generate(): Promise<void> {
    if (this.busy() || !this.perm.canEdit()) return;
    const t = this.t();
    const topic = this.topic().trim();
    const collection = this.store.byId(this.collectionId());
    this.errTopic.set(topic ? '' : t.ai.errTopic);
    this.errCol.set(collection ? '' : t.cmp.errCol);
    if (!topic || !collection) return;
    const texts = generatePosts({
      topic,
      points: parsePoints(this.points()),
      tone: this.tone() as AiTone,
      count: Number(this.count()),
    });
    this.busy.set(true);
    try {
      const made = await this.store.addPosts(
        collection.id,
        texts.map((text) => ({ text })),
      );
      this.notify.success(fmt(t.ai.generated, { n: made.length, c: collection.name }));
      this.generated.emit({ collectionId: collection.id, count: made.length });
      this.closed.emit();
    } catch {
      // The API's reason was toasted by the error interceptor; nothing was added.
    } finally {
      this.busy.set(false);
    }
  }
}
