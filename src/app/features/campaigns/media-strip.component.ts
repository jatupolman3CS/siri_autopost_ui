import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { CampaignsStore } from '../../core/data/campaigns.store';
import { I18nService } from '../../core/i18n/i18n.service';

// Thumbnails of stored campaign media (photos and videos) with remove and, for the lead media,
// "move earlier" buttons. Files load from the server once and show through object URLs.
@Component({
  selector: 'app-media-strip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ext-media">
      @for (m of items(); track m.id; let i = $index) {
        <div class="ext-thumb">
          @if (m.src) {
            @if (m.video) {
              <video [src]="m.src" muted preload="metadata"></video>
              <span class="vid">{{ x().video }}</span>
            } @else {
              <img [src]="m.src" alt="" loading="lazy" />
            }
          }
          @if (editable()) {
            <button
              type="button"
              class="del"
              [title]="x().removeMedia"
              (click)="removed.emit(m.id)"
            >
              ×
            </button>
            @if (movable() && i > 0) {
              <button type="button" class="left" [title]="x().moveEarlier" (click)="moved.emit(i)">
                ◀
              </button>
            }
          }
        </div>
      } @empty {
        <span class="small muted">{{ x().noMedia }}</span>
      }
    </div>
  `,
})
export class MediaStripComponent {
  private readonly store = inject(CampaignsStore);
  private readonly i18n = inject(I18nService);
  protected readonly x = computed(() => this.i18n.t().api.ext);

  readonly ids = input.required<string[]>();
  readonly movable = input(false);
  readonly editable = input(true);
  readonly removed = output<string>();
  /** Index of the item to swap with the one before it. */
  readonly moved = output<number>();

  protected readonly items = computed(() => {
    const thumbs = this.store.thumbs();
    const videos = this.store.videos();
    return this.ids().map((id) => ({ id, src: thumbs[id] ?? '', video: !!videos[id] }));
  });

  constructor() {
    effect(() => this.store.loadThumbs(this.ids()));
  }
}
