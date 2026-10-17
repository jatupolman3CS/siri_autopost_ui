import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { I18nService } from '../i18n/i18n.service';
import { SeoService } from './seo.service';

describe('SeoService', () => {
  let service: SeoService;
  let titleService: Title;
  let metaService: Meta;
  let i18nService: I18nService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SeoService, Title, Meta, I18nService],
    });

    service = TestBed.inject(SeoService);
    titleService = TestBed.inject(Title);
    metaService = TestBed.inject(Meta);
    i18nService = TestBed.inject(I18nService);
  });

  it('provides default landing page titles in Thai and English', () => {
    i18nService.setLang('th');
    expect(service.getDefaultTitle('th')).toContain('AutoPost');
    expect(service.getDefaultTitle('th')).toContain('Facebook');

    i18nService.setLang('en');
    expect(service.getDefaultTitle('en')).toContain('AutoPost');
    expect(service.getDefaultTitle('en')).toContain('Facebook');
  });

  it('updates meta tags for the root landing page', () => {
    i18nService.setLang('th');
    const title = service.getDefaultTitle('th');
    service.updateMeta(title, null, '/');

    const desc = metaService.getTag('name="description"');
    expect(desc?.content).toContain('AutoPost');

    const ogUrl = metaService.getTag('property="og:url"');
    expect(ogUrl?.content).toBe('https://siriautopost.siristudiophoto.com/');
  });

  it('updates meta tags for specific routes like login and signup', () => {
    i18nService.setLang('th');
    service.updateMeta('เข้าสู่ระบบ · AutoPost', 'เข้าสู่ระบบ', '/login');

    const descLogin = metaService.getTag('name="description"');
    expect(descLogin?.content).toContain('AutoPost');

    service.updateMeta('สมัครสมาชิก · AutoPost', 'สมัครสมาชิก', '/signup');
    const descSignup = metaService.getTag('name="description"');
    expect(descSignup?.content).toContain('AutoPost');
  });
});
