import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { CampaignsStore } from '../../core/data/campaigns.store';
import {
  Campaign,
  CampaignConfig,
  CampaignPost,
  FooterPosition,
  PostMode,
  activeGroups,
  composeText,
  newPost,
  pick,
  replaceInPosts,
  splitPageTags,
} from '../../core/ext/lib/shared.js';
import { shortGroup } from '../../core/ext/run-view';
import '../../core/i18n/i18n.ext';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { MediaStripComponent } from './media-strip.component';

// Section 2 of a campaign: how posts are picked, the lead media attached first to every post, the text
// block added to every post (and where), page tags, find & replace, and the post variants with their
// media and a random preview (client/dashboard.js "posts").
@Component({
  selector: 'app-camp-posts',
  imports: [MediaStripComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './camp-posts.component.html',
  styleUrl: './camp-posts.component.scss',
})
export class CampPostsComponent {
  private readonly store = inject(CampaignsStore);
  private readonly notify = inject(NotificationService);
  private readonly i18n = inject(I18nService);
  protected readonly x = computed(() => this.i18n.t().api.ext);

  readonly campaign = input.required<Campaign>();

  protected readonly cfg = computed(() => {
    this.store.campaigns();
    return this.campaign().config;
  });
  protected readonly posts = computed(() => {
    this.store.campaigns();
    return this.campaign().posts.map((p, i) => ({ p, n: i + 1 }));
  });
  protected readonly lead = computed(() => {
    this.store.campaigns();
    return this.campaign().leadImageIds;
  });

  /** Post id -> the preview shown under it. */
  protected readonly previews = signal<Record<string, string>>({});
  protected readonly find = signal('');
  protected readonly replace = signal('');
  protected readonly scope = signal<'current' | 'all'>('current');
  protected readonly uploading = signal(false);

  protected setCfg<K extends keyof CampaignConfig>(key: K, value: CampaignConfig[K]): void {
    const c = this.campaign();
    this.store.change(() => (c.config[key] = value));
  }

  protected setMode(v: string): void {
    this.setCfg('postMode', v as PostMode);
  }

  protected setPosition(v: string): void {
    this.setCfg('footerPosition', v as FooterPosition);
  }

  protected setText(p: CampaignPost, text: string): void {
    this.store.change(() => (p.text = text));
  }

  protected addPost(): void {
    const c = this.campaign();
    this.store.change(() => c.posts.push(newPost()));
  }

  protected removePost(p: CampaignPost, n: number): void {
    if (!confirm(fmt(this.x().confirmDeletePost, { n }))) return;
    const c = this.campaign();
    this.store.change(() => {
      c.posts.splice(c.posts.indexOf(p), 1);
      if (!c.posts.length) c.posts.push(newPost());
    });
  }

  /** A random group (preferring one with its own text) and the text it would get. */
  protected preview(p: CampaignPost): void {
    const c = this.campaign();
    const x = this.x();
    const groups = activeGroups(c);
    const withText = groups.filter((g) => g.text.trim());
    const g = withText.length ? pick(withText) : (groups[0] ?? null);
    const text = composeText(p.text, g ? g.text : '', c.config.footer, c.config.footerPosition);
    const head = g ? fmt(x.previewFor, { g: g.name || shortGroup(g.url, x.groupWord) }) : x.preview;
    this.previews.update((v) => ({
      ...v,
      [p.id]: `${head}\n──────────\n${text || x.noText}${this.tagNote(c, text)}`,
    }));
  }

  /** Pages tagged in a text ('' when none). */
  private tagNote(c: Campaign, text: string): string {
    const names = splitPageTags(text, c.config.pageTags)
      .filter((p) => p.tag)
      .map((p) => p.tag!.name);
    return names.length
      ? `\n──────────\n${fmt(this.x().tagNote, { names: names.join(', ') })}`
      : '';
  }

  protected async addPostMedia(p: CampaignPost, input: HTMLInputElement): Promise<void> {
    const ids = await this.upload(input);
    if (ids.length) this.store.change(() => (p.imageIds = [...p.imageIds, ...ids]));
  }

  protected removePostMedia(p: CampaignPost, id: string): void {
    this.store.change(() => (p.imageIds = p.imageIds.filter((x) => x !== id)));
  }

  protected async addLead(input: HTMLInputElement): Promise<void> {
    const c = this.campaign();
    const ids = await this.upload(input);
    if (ids.length) this.store.change(() => (c.leadImageIds = [...c.leadImageIds, ...ids]));
  }

  protected removeLead(id: string): void {
    const c = this.campaign();
    this.store.change(() => (c.leadImageIds = c.leadImageIds.filter((x) => x !== id)));
  }

  protected moveLead(i: number): void {
    const c = this.campaign();
    this.store.change(() => {
      const ids = [...c.leadImageIds];
      [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
      c.leadImageIds = ids;
    });
  }

  private async upload(input: HTMLInputElement): Promise<string[]> {
    const files = [...(input.files ?? [])];
    input.value = '';
    if (!files.length) return [];
    this.uploading.set(true);
    try {
      const { ids, failed } = await this.store.addMedia(files);
      if (failed.length) this.notify.error(fmt(this.x().mediaFailed, { names: failed.join(', ') }));
      return ids;
    } finally {
      this.uploading.set(false);
    }
  }

  /** Literal find & replace in post texts and the campaign text block (this campaign or all). */
  protected replaceAll(): void {
    const x = this.x();
    const find = this.find();
    const repl = this.replace();
    const s = this.store.settings();
    if (!s) return;
    if (!find) {
      this.notify.info(x.findFirst);
      return;
    }
    const ids = this.scope() === 'all' ? null : [this.campaign().id];
    const n = replaceInPosts(JSON.parse(JSON.stringify(s)), [[find, repl]], ids);
    if (!n) {
      this.notify.info(fmt(x.notFound, { s: find }));
      return;
    }
    const where = ids ? x.inThisCampaign : x.inAllCampaigns;
    if (!confirm(fmt(x.confirmReplace, { find, repl, where, n }))) return;
    this.store.change((settings) => replaceInPosts(settings, [[find, repl]], ids));
    this.notify.success(fmt(x.replaced, { n }));
  }
}
