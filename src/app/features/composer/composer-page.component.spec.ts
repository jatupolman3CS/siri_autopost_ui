import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DraftStore } from '../../core/data/draft.store';
import { dkey } from '../../core/i18n/format';
import { WS, provideApiTesting, signIn } from '../../testing/api-testing';
import { ComposerPageComponent, localIso } from './composer-page.component';

describe('ComposerPageComponent', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    http = provideApiTesting({
      imports: [ComposerPageComponent],
      providers: [provideRouter([{ path: '**', children: [] }])],
    });
    TestBed.inject(DraftStore);
    await signIn(http);
  });

  function submit() {
    const fixture = TestBed.createComponent(ComposerPageComponent);
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.bottom .su-btn-primary')!
      .click();
    fixture.detectChanges();
  }

  it('starts with the design defaults: three groups of the page, plus Instagram', () => {
    const d = TestBed.inject(DraftStore).draft();
    expect(d.targets).toEqual({ 'acc-page': true, 'acc-ig': true });
    expect(d.groups).toEqual(['G1', 'G2', 'G3']);
  });

  it('shows errors and sends nothing for an empty post in the past', () => {
    const draft = TestBed.inject(DraftStore);
    draft.patch({ targets: {}, date: '2020-01-01' });
    submit();
    expect(draft.draft().errText).not.toBe('');
    expect(draft.draft().errTargets).not.toBe('');
    expect(draft.draft().errTime).not.toBe('');
    http.expectNone(`/api/workspaces/${WS}/posts/schedule`);
  });

  it('sends the selected groups per account and skips accounts that need a new login', () => {
    const draft = TestBed.inject(DraftStore);
    const tomorrow = new Date(Date.now() + 864e5);
    draft.patch({
      text: 'โปรวันนี้',
      date: dkey(tomorrow),
      time: '14:00',
      targets: { 'acc-page': true, 'acc-ig': true, 'acc-tt': true },
      groups: ['G2', 'G4'],
    });
    submit();
    const req = http.expectOne(`/api/workspaces/${WS}/posts/schedule`);
    expect(req.request.body.content).toBe('โปรวันนี้');
    expect(req.request.body.startAt).toMatch(/T14:00:00[+-]\d{2}:\d{2}$/);
    expect(req.request.body.targets).toEqual([
      { accountId: 'acc-page', groups: ['G2', 'G4'] },
      { accountId: 'acc-ig', groups: null },
    ]);
  });

  it('writes local times with their UTC offset', () => {
    const d = new Date(2026, 9, 4, 9, 5);
    expect(localIso(d)).toMatch(/^2026-10-04T09:05:00[+-]\d{2}:\d{2}$/);
  });
});
