import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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
