import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { provideApiTesting, settle } from '../../testing/api-testing';
import { LandingPageComponent } from './landing-page.component';

// The landing page promises Facebook groups and pages and nothing else: the other social platforms are a later
// phase, so neither its copy nor its icons name them. Its preview runs on the design's sample posts.
describe('LandingPageComponent', () => {
  let http: HttpTestingController;

  async function open() {
    http = provideApiTesting({
      imports: [LandingPageComponent],
      providers: [provideRouter([{ path: '**', children: [] }])],
    });
    const fixture = TestBed.createComponent(LandingPageComponent);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const t = () => TestBed.inject(I18nService).t();

  afterEach(() => {
    try {
      http?.verify();
    } finally {
      http = undefined!;
      TestBed.resetTestingModule();
      localStorage.clear();
    }
  });

  it('shows the Facebook mark with a line that says groups and pages, and no other platform icon', async () => {
    const { el } = await open();
    const strip = el.querySelector<HTMLElement>('.platforms')!;
    expect(strip.querySelectorAll('.pico')).toHaveLength(1);
    expect(strip.querySelector('.pico')?.getAttribute('title')).toBe('Facebook');
    expect(strip.querySelector('.ph-facebook-logo')).not.toBeNull();
    expect(strip.textContent).toContain(t().land.platforms);
    expect(t().land.platforms).toContain('Facebook');
    expect(
      el.querySelector(
        '.ph-instagram-logo, .ph-x-logo, .ph-tiktok-logo, .ph-threads-logo, .ph-chat-circle-dots',
      ),
    ).toBeNull();
  });

  it('names no other platform and no "social accounts" in its copy, in either language', async () => {
    const { fixture, el } = await open();
    for (const lang of ['th', 'en'] as const) {
      TestBed.inject(I18nService).setLang(lang);
      fixture.detectChanges();
      expect(el.textContent, lang).not.toMatch(
        /Instagram|TikTok|Threads|LINE OA|\bX\b|โซเชียล|social (account|network)/i,
      );
    }
    TestBed.inject(I18nService).setLang('th');
  });

  it('says it posts to groups and pages, where it says where it posts', async () => {
    const { fixture, el } = await open();
    const check = (lang: 'th' | 'en', pattern: RegExp) => {
      TestBed.inject(I18nService).setLang(lang);
      fixture.detectChanges();
      expect(el.querySelector('h1')?.textContent, lang).toMatch(pattern);
      expect(el.querySelector('.platforms')?.textContent, lang).toMatch(pattern);
    };
    check('th', /กลุ่ม.*เพจ/);
    check('en', /group.*page/i);
    TestBed.inject(I18nService).setLang('th');
  });

  it('previews the queue with sample posts to Facebook groups', async () => {
    const { el } = await open();
    const rows = el.querySelectorAll('.preview .q-row');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.querySelector('.ph-facebook-logo')).not.toBeNull();
  });
});
