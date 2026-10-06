import { TestBed } from '@angular/core/testing';
import { PlanKey } from '../../../core/data/models';
import { DESIGN_PLANS, tierViews } from '../../../core/data/plans';
import { I18nService } from '../../../core/i18n/i18n.service';
import { PlanCard, PlanCardsComponent } from './plan-cards.component';

describe('PlanCardsComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [PlanCardsComponent] });
    TestBed.inject(I18nService).setLang('en');
  });
  afterEach(() => localStorage.clear());

  function render(over: (card: PlanCard) => Partial<PlanCard> = () => ({})) {
    const t = TestBed.inject(I18nService).t();
    const cards: PlanCard[] = tierViews(DESIGN_PLANS, 'month', t).map((v) => ({
      ...v,
      highlighted: v.k === 'pro',
      variant: v.k === 'pro' ? 'primary' : 'secondary',
      cta: 'Choose',
      ...over({ ...v } as PlanCard),
    }));
    const fixture = TestBed.createComponent(PlanCardsComponent);
    fixture.componentRef.setInput('cards', cards);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }
  const card = (el: HTMLElement, k: PlanKey) =>
    el.querySelector<HTMLElement>(`[data-plan="${k}"]`)!;
  const limits = (c: HTMLElement) =>
    [...c.querySelectorAll('.limits li')].map((li) => [
      li.querySelector('.lbl')!.textContent!.trim(),
      li.querySelector('.val')!.textContent!.trim(),
    ]);

  it('shows a card per plan with the name, the price and who it is good for', () => {
    const { el } = render();
    expect(el.querySelectorAll('.tier')).toHaveLength(4);
    expect(card(el, 'agency').querySelector('.name')!.textContent).toContain('Premium');
    expect(card(el, 'agency').textContent).not.toContain('Agency');
    expect(card(el, 'basic').textContent).toContain('Good for: a small shop');
    expect(card(el, 'pro').classList).toContain('hl');
  });

  it('lists the seven numbers as labelled lines', () => {
    const { el } = render();
    expect(limits(card(el, 'basic'))).toEqual([
      ['Facebook groups and pages', '50'],
      ['Image library', '200'],
      ['Post library', '200'],
      ['Posts per day (24 h)', '50'],
      ['Extensions (browsers)', '1'],
      ['Team seats', '1'],
      ['Facebook accounts', '2'],
    ]);
    // The top plan writes its null numbers as unlimited.
    expect(limits(card(el, 'agency'))[0]).toEqual(['Facebook groups and pages', 'Unlimited']);
    expect(limits(card(el, 'agency'))[5]).toEqual(['Team seats', '10']);
  });

  it('shows a check for the functions a plan has and a muted dash for the others, with words for a reader', () => {
    const { el } = render();
    const row = (k: PlanKey, label: string) =>
      [...card(el, k).querySelectorAll<HTMLElement>('.feats li')].find((li) =>
        li.textContent!.includes(label),
      )!;

    const aiOnPro = row('pro', 'AI post drafts');
    expect(aiOnPro.querySelector('i')!.classList).toContain('ph-check');
    expect(aiOnPro.classList).not.toContain('off');
    expect(aiOnPro.querySelector('.sr-only')!.textContent).toBe('Included');

    const aiOnBasic = row('basic', 'AI post drafts');
    expect(aiOnBasic.querySelector('i')!.classList).toContain('ph-minus');
    expect(aiOnBasic.classList).toContain('off');
    expect(aiOnBasic.querySelector('.sr-only')!.textContent).toBe('Not included');

    // Bumping and client reports are Premium only.
    expect(row('pro', 'Auto bump').classList).toContain('off');
    expect(row('agency', 'Auto bump').classList).not.toContain('off');
    expect(row('agency', 'Client reports').classList).not.toContain('off');
    expect(card(el, 'free').querySelectorAll('.feats li:not(.off)')).toHaveLength(0);
    expect(card(el, 'agency').querySelectorAll('.feats li.off')).toHaveLength(0);
  });

  it('hides the icons from a screen reader and labels both lists with the plan', () => {
    const { el } = render();
    const c = card(el, 'pro');
    expect(
      [...c.querySelectorAll('.feats i')].every((i) => i.getAttribute('aria-hidden') === 'true'),
    ).toBe(true);
    expect(c.querySelector('.limits')!.getAttribute('aria-label')).toBe('Limits: Pro');
    expect(c.querySelector('.feats')!.getAttribute('aria-label')).toBe('Functions: Pro');
  });

  it('says the chosen plan key, and disables the button of the current plan', () => {
    const chosen: PlanKey[] = [];
    const { fixture, el } = render((c) => ({ disabled: c.k === 'basic' }));
    fixture.componentInstance.choose.subscribe((k) => chosen.push(k));
    const buttons = [...el.querySelectorAll<HTMLButtonElement>('.tier button')];
    expect(buttons.map((b) => b.disabled)).toEqual([false, true, false, false]);
    buttons[3].click();
    expect(chosen).toEqual(['agency']);
  });
});
