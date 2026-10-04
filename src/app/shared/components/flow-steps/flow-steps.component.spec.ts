import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { I18nService } from '../../../core/i18n/i18n.service';
import { FlowStepsComponent } from './flow-steps.component';

describe('FlowStepsComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [FlowStepsComponent],
      providers: [provideRouter([])],
    });
  });
  afterEach(() => localStorage.clear());

  function render(current: 1 | 2 | 3) {
    const fixture = TestBed.createComponent(FlowStepsComponent);
    fixture.componentRef.setInput('current', current);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, steps: [...el.querySelectorAll<HTMLAnchorElement>('a.step')] };
  }

  it('links the three steps to collections, link sets and schedules', () => {
    const { steps } = render(1);
    expect(steps.map((a) => a.getAttribute('href'))).toEqual([
      '/app/collections',
      '/app/targets',
      '/app/schedules',
    ]);
    expect(steps.map((a) => a.querySelector('.num')?.textContent?.trim())).toEqual(['1', '2', '3']);
  });

  it('writes each step from the dictionary, in the current language', () => {
    const t = TestBed.inject(I18nService).t();
    const { steps } = render(1);
    expect(steps[0].querySelector('.title')?.textContent).toBe(t.flow.s1);
    expect(steps[1].querySelector('.body')?.textContent).toBe(t.flow.s2b);
    expect(steps[2].querySelector('.title')?.textContent).toBe(t.flow.s3);
    TestBed.inject(I18nService).setLang('en');
    TestBed.tick();
    const fixture = TestBed.createComponent(FlowStepsComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.title').textContent).toBe(
      'Write posts into a collection',
    );
  });

  it('marks only the current step', () => {
    for (const current of [1, 2, 3] as const) {
      const { steps } = render(current);
      const on = steps.filter((a) => a.classList.contains('on'));
      expect(on).toHaveLength(1);
      expect(steps.indexOf(on[0])).toBe(current - 1);
      expect(on[0].getAttribute('aria-current')).toBe('step');
      expect(steps.filter((a) => a.hasAttribute('aria-current'))).toHaveLength(1);
    }
  });
});
