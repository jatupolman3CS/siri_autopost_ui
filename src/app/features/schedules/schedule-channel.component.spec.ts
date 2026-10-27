import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LinkSetsStore } from '../../core/data/link-sets.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { I18nService } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.line';
import { apiCollection, apiCollectionPost } from '../../testing/collection-fixtures';
import { provideApiTesting, settle, signIn } from '../../testing/api-testing';
import { apiChatLink, apiLineSet } from '../../testing/line.fixtures';
import { apiLinkSet, apiLink } from '../../testing/link-sets.fixtures';
import { ScheduleFormService } from './schedule-form.service';

const FB = apiLinkSet({ id: 'fb1', name: 'Groups', links: [apiLink({ id: 'a' })] });
const LINE = apiLineSet({
  id: 'ln1',
  name: 'Customers',
  links: [apiChatLink({ id: 'k1' })],
});
const COLLECTION = apiCollection({ id: 'c1', posts: [apiCollectionPost({ id: 'p1' })] });

describe('ScheduleFormService: where a schedule posts', () => {
  let http: HttpTestingController;
  let form: ScheduleFormService;
  const t = () => TestBed.inject(I18nService).t();

  beforeEach(async () => {
    http = provideApiTesting({ providers: [ScheduleFormService] });
    TestBed.inject(WorkspaceStore);
    TestBed.inject(LinkSetsStore);
    form = TestBed.inject(ScheduleFormService);
    await signIn(http, { collections: [COLLECTION], linkSets: [FB, LINE] });
    await settle();
  });

  afterEach(() => http.verify());

  it('says nothing is chosen until a link set is picked, then Facebook or LINE by the set', () => {
    expect(form.set()).toBeUndefined();
    form.pickSet('fb1');
    expect(form.channel()).toBe('fb');
    expect(form.isLine()).toBe(false);
    form.pickSet('ln1');
    expect(form.channel()).toBe('line');
    expect(form.isLine()).toBe(true);
    expect(t().api.line.schTargetLine).toContain('LINE');
  });

  it('sends the LINE options with a schedule over a LINE set, and none over a Facebook set', () => {
    form.pickCollection('c1');
    form.pickSet('ln1');
    form.lineFrom.set('10:00');
    form.lineTo.set('18:30');
    form.lineSkip.set(45);
    form.lineSplit.set(true);
    const line = form.build();
    expect(line?.lineOptions).toEqual({
      allowedFrom: '10:00',
      allowedTo: '18:30',
      skipIfActiveMinutes: 45,
      splitBubbles: true,
      imagesFirst: false,
    });

    form.pickSet('fb1');
    expect(form.build()?.lineOptions).toBeUndefined();
  });

  it('refuses hours that are not HH:mm and never asks for a bump over a LINE set', () => {
    form.pickCollection('c1');
    form.pickSet('ln1');
    form.bumpOn.set(true);
    form.lineFrom.set('9');
    expect(form.build()).toBeNull();
    expect(form.error()).toBe(t().api.line.schBadHours);
    form.lineFrom.set('09:00');
    expect(form.build()?.bumpHours).toBe(0);
  });
});
