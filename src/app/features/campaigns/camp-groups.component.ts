import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { CampaignsStore } from '../../core/data/campaigns.store';
import {
  Campaign,
  CampaignGroup,
  activeGroups,
  groupDailyMax,
  groupsWithoutPosts,
  normalizeGroupUrl,
  parseGroupList,
  postsForGroup,
  usablePosts,
} from '../../core/ext/lib/shared.js';
import { shortGroup, usedToday } from '../../core/ext/run-view';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';

// Section 1 of a campaign: its groups (link, name, own text such as a purchase code, posts allowed
// per 24 hours) and the bulk paste of many groups at once (client/dashboard.js renderGroups/btnBulkAdd).
@Component({
  selector: 'app-camp-groups',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './camp-groups.component.html',
  styleUrl: './camp-groups.component.scss',
})
export class CampGroupsComponent {
  private readonly store = inject(CampaignsStore);
  private readonly notify = inject(NotificationService);
  private readonly i18n = inject(I18nService);
  protected readonly x = computed(() => this.i18n.t().api.ext);

  readonly campaign = input.required<Campaign>();
  protected readonly bulk = signal('');

  protected readonly rows = computed(() => {
    const c = this.campaign();
    this.store.campaigns(); // re-read after every edit
    const state = this.store.state();
    const seen = new Set<string>();
    return c.groups.map((g) => {
      const url = normalizeGroupUrl(g.url);
      const dup = !!url && seen.has(url);
      if (url) seen.add(url);
      const used = url ? usedToday(state, url) : 0;
      const posts = url ? postsForGroup(c, url).length : -1;
      return {
        g,
        invalid: !!g.url.trim() && !url,
        dup,
        used,
        full: g.dailyMax > 0 && used >= g.dailyMax,
        posts,
        limitTitle:
          this.x().limitTitle +
          (url
            ? '\n' +
              fmt(this.x().limitUsed, { n: used, max: g.dailyMax > 0 ? `/${g.dailyMax}` : '' })
            : ''),
      };
    });
  });

  protected readonly info = computed(() => {
    const c = this.campaign();
    this.store.campaigns();
    const x = this.x();
    const active = activeGroups(c);
    const rows = this.rows();
    const bad = rows.filter((r) => r.invalid).length;
    const dup = rows.filter((r) => r.dup).length;
    const empty = usablePosts(c.posts).length ? groupsWithoutPosts(c) : [];
    return {
      active: fmt(x.groupsActive, { n: active.length }),
      withText: fmt(x.groupsWithText, { n: active.filter((g) => g.text.trim()).length }),
      problems: [bad ? fmt(x.groupsBad, { n: bad }) : '', dup ? fmt(x.groupsDup, { n: dup }) : '']
        .filter(Boolean)
        .join(' · '),
      empty: empty.length
        ? fmt(x.groupsNoPosts, {
            n: empty.length,
            names:
              empty
                .slice(0, 5)
                .map((g) => g.name || shortGroup(g.url))
                .join(', ') + (empty.length > 5 ? ' ...' : ''),
          })
        : '',
    };
  });

  protected edit(g: CampaignGroup, patch: Partial<CampaignGroup>): void {
    this.store.change(() => Object.assign(g, patch));
  }

  protected setUrl(g: CampaignGroup, raw: string): void {
    const c = this.campaign();
    const value = raw.trim();
    // Posts limited to this row's link follow it while it is edited (client/dashboard.js).
    const home = normalizeGroupUrl(g.url);
    const now = normalizeGroupUrl(value);
    const usedElsewhere = (u: string) =>
      c.groups.some((x) => x !== g && normalizeGroupUrl(x.url) === u);
    this.store.change(() => {
      g.url = value;
      if (now && home && now !== home && !usedElsewhere(home) && !usedElsewhere(now)) {
        for (const p of c.posts) {
          if (p.groupUrls.includes(home))
            p.groupUrls = [...new Set(p.groupUrls.map((u) => (u === home ? now : u)))];
        }
      }
    });
  }

  protected setMax(g: CampaignGroup, raw: string): void {
    this.edit(g, { dailyMax: groupDailyMax(raw) });
  }

  protected remove(g: CampaignGroup): void {
    const c = this.campaign();
    this.store.change(() => c.groups.splice(c.groups.indexOf(g), 1));
  }

  protected add(): void {
    const c = this.campaign();
    this.store.change(() =>
      c.groups.push({ url: '', name: '', text: '', enabled: true, dailyMax: 0 }),
    );
  }

  /** Category headings, "url | group text", "url (note)" and "[1/วัน]" lines, as in the extension. */
  protected addBulk(): void {
    const c = this.campaign();
    const x = this.x();
    const existing = new Map(
      c.groups.map((g) => [normalizeGroupUrl(g.url), g] as const).filter(([u]) => !!u),
    );
    const { groups, invalid } = parseGroupList(this.bulk());
    let on = 0;
    let off = 0;
    let dup = 0;
    let recoded = 0;
    this.store.change(() => {
      for (const g of groups) {
        const old = existing.get(g.url);
        if (old) {
          // Already in the set: a new group text (e.g. a new code) replaces the old one.
          dup++;
          if (g.text && g.text !== old.text) {
            old.text = g.text;
            recoded++;
          }
          continue;
        }
        const row = {
          url: g.url,
          name: g.name,
          text: g.text,
          enabled: g.enabled,
          dailyMax: g.dailyMax || 0,
        };
        existing.set(g.url, row);
        c.groups.push(row);
        if (g.enabled) on++;
        else off++;
      }
    });
    this.bulk.set(invalid.join('\n'));
    const parts = [fmt(x.bulkAdded, { n: on + off })];
    if (off) parts.push(fmt(x.bulkOff, { n: off }));
    if (dup) parts.push(fmt(x.bulkDup, { n: dup }));
    if (recoded) parts.push(fmt(x.bulkRecoded, { n: recoded }));
    if (invalid.length) parts.push(fmt(x.bulkInvalid, { n: invalid.length }));
    this.notify.info(parts.join(' · '));
  }
}
