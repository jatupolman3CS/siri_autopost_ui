import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { WS, provideApiTesting, settle, signIn } from '../../testing/api-testing';
import { FakeDeviceEvents } from '../../testing/fake-events';
import { apiLineOa } from '../../testing/line.fixtures';
import { DeviceEventsService } from './device-events.service';
import { LineOasStore } from './line-oas.store';

const OAS = `/api/workspaces/${WS}/line/oas`;

describe('LineOasStore', () => {
  let http: HttpTestingController;
  let store: LineOasStore;

  beforeEach(() => {
    http = provideApiTesting({
      providers: [{ provide: DeviceEventsService, useClass: FakeDeviceEvents }],
    });
    store = TestBed.inject(LineOasStore);
  });

  afterEach(() => http.verify());

  it('holds the OAs of the workspace and offers the ones a browser reads', async () => {
    const one = apiLineOa({ id: 'one', name: 'LINE · Flowers' });
    const orphan = apiLineOa({ id: 'two', deviceId: null, deviceName: null });
    await signIn(http, { lineOas: [one, orphan] });
    await settle();
    expect(store.loaded()).toBe(true);
    expect(store.list().map((o) => o.id)).toEqual(['one', 'two']);
    expect(store.usable().map((o) => o.id)).toEqual(['one']);
  });

  it('"use this OA" asks the API to switch the browser and says whether it was taken', async () => {
    await signIn(http, { lineOas: [apiLineOa({ id: 'one', active: false })] });
    await settle();
    const done = store.use('one');
    const req = http.expectOne(`${OAS}/one/use`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
    expect(await done).toBe(true);

    const refused = store.use('one');
    http.expectOne(`${OAS}/one/use`).flush({ title: 'x' }, { status: 422, statusText: 'x' });
    expect(await refused).toBe(false);
  });

  it('"force sync" sends the read command for that OA', async () => {
    await signIn(http, { lineOas: [apiLineOa({ id: 'one' })] });
    await settle();
    const done = store.sync('one');
    const req = http.expectOne(`${OAS}/one/sync`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
    expect(await done).toBe(true);
  });

  it('adds an OA by its address and takes it out again', async () => {
    await signIn(http, { lineOas: [] });
    await settle();
    const added = store.add('https://chat.line.biz/Unew12345/chat', null);
    const post = http.expectOne(OAS);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toMatchObject({ url: 'https://chat.line.biz/Unew12345/chat' });
    post.flush(apiLineOa({ id: 'new' }));
    expect((await added).id).toBe('new');
    expect(store.list().map((o) => o.id)).toEqual(['new']);

    const removed = store.remove('new');
    http.expectOne(`${OAS}/new`).flush(null);
    await removed;
    expect(store.list()).toEqual([]);
  });
});
