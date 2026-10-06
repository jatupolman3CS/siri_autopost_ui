import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { ConnectExtensionPageComponent } from './connect-extension-page.component';

describe('ConnectExtensionPageComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [ConnectExtensionPageComponent],
      providers: [provideRouter([])],
    });
  });

  afterEach(() => vi.useRealTimers());

  it('says this browser does not need to be signed in to AutoPost, while it waits and when it is missing', () => {
    const fixture = TestBed.createComponent(ConnectExtensionPageComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const t = TestBed.inject(I18nService).t().api;
    const e = t.engine;
    expect(el.textContent).toContain(e.connectNoLogin);
    vi.advanceTimersByTime(4000);
    fixture.detectChanges();
    expect(el.textContent).toContain(e.connectNoLogin);
    // The way back is the copied link, from any other computer or profile.
    expect(el.textContent).toContain(t.connectHelp);
    expect(t.connectHelp).toContain('คัดลอกลิงก์เชื่อมต่อ');
    expect(e.connectNoLogin).toContain('เชื่อมต่อสำเร็จ');
  });

  it('waits for the extension, then explains that it is missing', () => {
    const fixture = TestBed.createComponent(ConnectExtensionPageComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('กำลังส่งคำขอ');
    vi.advanceTimersByTime(4000);
    fixture.detectChanges();
    expect(el.textContent).toContain('ไม่พบส่วนขยาย AutoPost');
    expect(el.querySelector('a[href="/app/team"]')).not.toBeNull();
  });
});
