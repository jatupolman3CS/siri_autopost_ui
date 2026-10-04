import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { PLATFORMS } from '../../core/data/platforms';
import { rateColor, topPosts, totalsOf } from '../../core/data/report-math';
import { ApiService, ApiSharedReport } from '../../core/http/api.service';
import { fmtDate } from '../../core/i18n/format';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.engine';
import { LangThemeSwitchComponent } from '../../layouts/lang-theme-switch.component';
import { ChipComponent } from '../../shared/components/chip/chip.component';

type State = 'loading' | 'ready' | 'missing' | 'error';

/** The most posts a client report lists (the API sends the 20 most used). */
const POSTS_SHOWN = 20;

// The public page of a shared client report (route report/:token, no sign-in, no app layout): the numbers an
// Agency workspace froze when it made the link, under the agency's brand name, ready to print or save as a PDF
// (`?print=1` opens the print dialog once the report is on screen). The `logo` switch of the report is a
// white-label switch: with it the page carries the brand name only; without it the AutoPost name and mark show in
// the header and the footer. (Nothing stores an agency logo, so the brand name is the logo.) The numbers are real
// posts of paired accounts for the last 7 or 30 days; likes and comments are not collected, so there are none.
@Component({
  selector: 'app-shared-report-page',
  imports: [LangThemeSwitchComponent, ChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shared-report-page.component.html',
  styleUrl: './shared-report-page.component.scss',
})
export class SharedReportPageComponent {
  /** The share token of the report (the last segment of /report/<token>). */
  readonly token = input<string>();
  /** `?print=1`: print as soon as the report is shown. */
  readonly print = input<string>();

  private readonly api = inject(ApiService);
  private readonly injector = inject(Injector);
  private readonly title = inject(Title);
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;

  protected readonly state = signal<State>('loading');
  protected readonly data = signal<ApiSharedReport | null>(null);
  private seq = 0;
  private printed = false;

  protected readonly view = computed(() => {
    const r = this.data();
    if (!r) return null;
    const t = this.t();
    const li = this.i18n.li();
    const groups = r.report.groups;
    const posts = topPosts(r.report.posts, POSTS_SHOWN);
    return {
      brand: r.brand,
      white: r.logo,
      workspace: fmt(t.api.engine.sharedFor, { w: r.workspaceName }),
      period: r.period === 'month' || r.report.days === 30 ? t.rep.pMonth : t.rep.pWeek,
      range: fmt(t.api.engine.sharedPeriod, {
        a: fmtDate(new Date(r.report.from), li, true),
        b: fmtDate(new Date(r.report.to), li, true),
      }),
      created: fmt(t.api.engine.sharedCreated, { d: fmtDate(new Date(r.createdAt), li, true) }),
      expires: fmt(t.api.engine.reportShareExpires, {
        d: fmtDate(new Date(r.expiresAt), li, true),
      }),
      totals: totalsOf(groups),
      groups: groups.map((g) => ({
        key: g.linkId ?? `${g.name}|${g.url ?? ''}`,
        name: g.name,
        icon: PLATFORMS[g.platform].icon,
        posted: g.posted,
        pending: g.pending,
        failed: g.failed,
        rate: g.rate,
        color: rateColor(g.rate),
      })),
      posts: posts.map((p, i) => ({ ...p, top: i === 0 && p.used > 0 })),
    };
  });

  constructor() {
    effect(() => {
      const token = this.token();
      untracked(() => void this.load(token));
    });
    // The tab (and the file name of a saved PDF) carries the brand instead of the route's "AutoPost" title, and
    // keeps it when the language changes (the title strategy writes its own text on every language switch).
    effect(() => {
      this.t();
      const v = this.view();
      if (!v) return;
      const text = `${v.brand} · ${this.t().api.reportTitle}`;
      queueMicrotask(() => this.title.setTitle(v.white ? text : `${text} · AutoPost`));
    });
    effect(() => {
      if (this.state() === 'ready' && this.print() === '1' && !this.printed) {
        this.printed = true;
        afterNextRender(() => window.print(), { injector: this.injector });
      }
    });
  }

  protected async load(token = this.token()): Promise<void> {
    const seq = ++this.seq;
    this.data.set(null);
    if (!token) {
      this.state.set('missing');
      return;
    }
    this.state.set('loading');
    try {
      const r = await this.api.sharedReport(token);
      if (seq !== this.seq) return;
      this.data.set(r);
      this.state.set('ready');
    } catch (e) {
      if (seq !== this.seq) return;
      const missing = e instanceof HttpErrorResponse && (e.status === 404 || e.status === 400);
      this.state.set(missing ? 'missing' : 'error');
    }
  }

  protected printNow(): void {
    window.print();
  }
}
