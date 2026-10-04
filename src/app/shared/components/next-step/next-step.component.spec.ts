import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../../core/i18n/i18n.service';
import { UiPrefsService } from '../../../core/services/ui-prefs.service';
import { NextStepComponent } from './next-step.component';

describe('NextStepComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [NextStepComponent] });
  });
  afterEach(() => localStorage.clear());

  function render() {
    const fixture = TestBed.createComponent(NextStepComponent);
    fixture.componentRef.setInput('label', 'Paste the groups');
    const go = vi.fn();
    fixture.componentInstance.go.subscribe(go);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement, go };
  }

  it('shows "Next step", the label and a button that emits go (simple mode)', () => {
    const { el, go } = render();
    expect(el.textContent).toContain(TestBed.inject(I18nService).t().flow.next);
    expect(el.querySelector('.fw6')?.textContent).toBe('Paste the groups');
    const button = el.querySelector('button')!;
    expect(button.textContent).toContain('Paste the groups');
    button.click();
    expect(go).toHaveBeenCalledTimes(1);
  });

  it('is hidden when simple mode is off, and comes back when it is on again', () => {
    const { fixture, el } = render();
    TestBed.inject(UiPrefsService).set(false);
    fixture.detectChanges();
    expect(el.querySelector('.next')).toBeNull();
    TestBed.inject(UiPrefsService).set(true);
    fixture.detectChanges();
    expect(el.querySelector('.next')).not.toBeNull();
  });
});
