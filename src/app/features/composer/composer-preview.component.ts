import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { ComposerPreviewService } from '../../core/data/composer-preview.service';
import { LibraryStore } from '../../core/data/library.store';
import { composeFull, groupSlug, seededRandom } from '../../core/flow';
import { ApiCollectionSettings } from '../../core/http/api.service';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { SelectFieldComponent } from '../../shared/components/select-field/select-field.component';

// The composer's "preview as posted": the text composed the way the engine writes it for the first usable
// link of the chosen link set (spintax resolved, the group code, the collection's footer and hashtags), a
// note saying which group it is for, and the media chips. "Reshuffle" picks other spintax words (a seeded
// random, so the preview stays still while the person types).
@Component({
  selector: 'app-composer-preview',
  imports: [SelectFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './composer-preview.component.html',
  styleUrl: './composer-preview.component.scss',
})
export class ComposerPreviewComponent {
  private readonly preview = inject(ComposerPreviewService);
  private readonly library = inject(LibraryStore);
  protected readonly t = inject(I18nService).t;

  /** The post's text as typed. */
  readonly text = input('');
  /** The library files attached to the post. */
  readonly media = input<readonly string[]>([]);
  /** The settings of the collection the post is saved to (footer, hashtags); none until one is chosen. */
  readonly settings = input<Pick<
    ApiCollectionSettings,
    'hashtags' | 'footer' | 'footerPos'
  > | null>(null);

  protected readonly seed = signal(1);
  private readonly picked = signal('');

  protected readonly setOptions = computed(() =>
    this.preview.sets().map((s) => ({ value: s.id, label: s.name })),
  );
  /** The set chosen, else the first one. */
  protected readonly setId = computed(() => {
    const sets = this.preview.sets();
    return sets.find((s) => s.id === this.picked())?.id ?? sets[0]?.id ?? '';
  });
  private readonly set = computed(() => this.preview.sets().find((s) => s.id === this.setId()));
  /** The link the example is for: the first usable one that has a code, else the first usable one. */
  private readonly link = computed(() => {
    const usable = (this.set()?.links ?? []).filter((l) => l.enabled && l.valid);
    return usable.find((l) => l.code.trim()) ?? usable[0] ?? null;
  });

  protected readonly note = computed(() => {
    const c = this.t().cmp;
    if (!this.set()) return c.previewNoSet;
    const link = this.link();
    if (!link) return this.t().ts.empty;
    const name = link.name.trim() || groupSlug(link.url);
    return fmt(c.previewFor, { g: name }) + (link.code.trim() ? '' : ' · ' + c.previewNoCode);
  });

  protected readonly composed = computed(() =>
    this.text().trim()
      ? composeFull(
          this.text(),
          this.link()?.code ?? '',
          this.settings(),
          seededRandom(this.seed()),
        )
      : '',
  );

  protected readonly chips = computed(() => {
    const files = this.library.media();
    const urls = this.library.thumbs();
    return this.media().flatMap((id) => {
      const m = files.find((f) => f.id === id);
      return m
        ? [
            {
              id,
              label: m.name,
              src: urls[id] ?? null,
              icon: m.kind === 'video' ? 'ph-video' : 'ph-image',
            },
          ]
        : [];
    });
  });

  protected pick(id: string): void {
    this.picked.set(id);
  }

  protected respin(): void {
    this.seed.update((n) => n + 1);
  }
}
