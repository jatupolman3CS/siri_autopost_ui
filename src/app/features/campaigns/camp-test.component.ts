import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CampaignsStore } from '../../core/data/campaigns.store';
import {
  activeGroups,
  composeText,
  pick,
  postMediaIds,
  postsForGroup,
  splitPageTags,
  usablePosts,
} from '../../core/ext/lib/shared.js';
import { shortGroup } from '../../core/ext/run-view';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { CampaignActions } from './campaign-actions.service';

// "Test one group" of the selected campaign: the exact text it would post, then one real post made by
// the browser (client/dashboard.js "test").
@Component({
  selector: 'app-camp-test',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel stack">
      <h2 class="h2">{{ x().testTitle }}</h2>
      <div class="sels">
        <span class="su-select-wrap">
          <select
            class="su-select ext-in"
            [attr.aria-label]="x().testGroup"
            (change)="pickGroup($any($event.target).value)"
          >
            @for (g of groups(); track g.url) {
              <option [value]="g.url" [selected]="g.url === group()">{{ g.label }}</option>
            } @empty {
              <option value="">{{ x().noGroupsYet }}</option>
            }
          </select>
          <i class="ph ph-caret-down su-select-caret"></i>
        </span>
        <span class="su-select-wrap">
          <select
            class="su-select ext-in"
            [attr.aria-label]="x().testPost"
            (change)="pickPost($any($event.target).value)"
          >
            @for (p of postOptions(); track p.id) {
              <option [value]="p.id" [selected]="p.id === post()">{{ p.label }}</option>
            }
          </select>
          <i class="ph ph-caret-down su-select-caret"></i>
        </span>
      </div>
      @if (preview()) {
        <pre class="ext-preview">{{ preview() }}</pre>
      }
      <div class="actions">
        <button type="button" class="su-btn su-btn-sm su-btn-ghost" (click)="showPreview()">
          <i class="ph ph-eye"></i>{{ x().testPreview }}
        </button>
        <button
          type="button"
          class="su-btn su-btn-sm su-btn-primary"
          [disabled]="actions.readOnly() || actions.pending() || store.busy()"
          (click)="test()"
        >
          <i class="ph ph-paper-plane-right"></i>{{ x().testNow }}
        </button>
      </div>
    </section>
  `,
  styles: `
    .sels {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 8px;
    }
  `,
})
export class CampTestComponent {
  protected readonly store = inject(CampaignsStore);
  private readonly i18n = inject(I18nService);
  protected readonly actions = inject(CampaignActions);
  protected readonly x = computed(() => this.i18n.t().api.ext);

  private readonly chosenGroup = signal('');
  protected readonly post = signal('');
  protected readonly preview = signal('');

  protected readonly groups = computed(() =>
    activeGroups(this.store.campaign() ?? emptyCampaign).map((g) => {
      const label = g.name.trim() || shortGroup(g.url);
      return {
        url: g.url,
        label: g.text.trim() ? `${label} (${g.text.trim().slice(0, 20)})` : label,
      };
    }),
  );

  protected readonly group = computed(() => {
    const list = this.groups();
    return list.some((g) => g.url === this.chosenGroup())
      ? this.chosenGroup()
      : (list[0]?.url ?? '');
  });

  protected readonly postOptions = computed(() => {
    const c = this.store.campaign();
    if (!c) return [];
    const x = this.x();
    const url = this.group();
    const allowed = url ? postsForGroup(c, url) : usablePosts(c.posts);
    const offered = allowed.length ? allowed : usablePosts(c.posts);
    const out = [{ id: '', label: fmt(x.randomPost, { n: allowed.length }) }];
    c.posts.forEach((p, i) => {
      if (!offered.includes(p)) return;
      const head = (p.text || '').replace(/\s+/g, ' ').trim().slice(0, 30);
      const imgs = p.imageIds.length ? ` +${fmt(x.nImages, { n: p.imageIds.length })}` : '';
      out.push({ id: p.id, label: `${x.variant} ${i + 1}: ${head || x.imagesOnly}${imgs}` });
    });
    return out;
  });

  protected pickGroup(url: string): void {
    this.chosenGroup.set(url);
    this.preview.set('');
  }

  protected pickPost(id: string): void {
    this.post.set(id);
    this.preview.set('');
  }

  protected showPreview(): void {
    const c = this.store.campaign();
    if (!c) return;
    const x = this.x();
    const g = activeGroups(c).find((v) => v.url === this.group());
    const posts = g ? postsForGroup(c, g.url) : usablePosts(c.posts);
    const post =
      usablePosts(c.posts).find((p) => p.id === this.post()) ?? (posts.length ? pick(posts) : null);
    if (!post) {
      this.preview.set(g ? x.noPostForGroup : x.noContent);
      return;
    }
    const media = postMediaIds(c, post).length;
    const lead = c.leadImageIds.length;
    const files = media
      ? `\n──────────\n${fmt(lead ? x.filesWithLead : x.files, { n: media, lead, own: media - lead })}`
      : '';
    const text = composeText(post.text, g ? g.text : '', c.config.footer, c.config.footerPosition);
    const tags = splitPageTags(text, c.config.pageTags)
      .filter((p) => p.tag)
      .map((p) => p.tag!.name);
    const tagNote = tags.length
      ? `\n──────────\n${fmt(x.tagNote, { names: tags.join(', ') })}`
      : '';
    this.preview.set((text || x.noText) + tagNote + files);
  }

  protected test(): void {
    const c = this.store.campaign();
    const url = this.group();
    const x = this.x();
    if (!c || !url) return;
    if (!confirm(fmt(x.confirmTest, { url }))) return;
    void this.actions.run(
      'testPost',
      { campaignId: c.id, url, postId: this.post() || null },
      x.testStarted,
    );
  }
}

const emptyCampaign = {
  id: '',
  name: '',
  enabled: false,
  groups: [],
  posts: [],
  leadImageIds: [],
  config: {} as never,
};
