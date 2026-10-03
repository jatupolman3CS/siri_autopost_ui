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
  templateUrl: './media-strip.component.html',
  styleUrl: './media-strip.component.scss',
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
