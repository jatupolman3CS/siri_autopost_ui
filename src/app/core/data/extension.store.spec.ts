import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  WS,
  answerWorkspaceLoads,
  provideApiTesting,
  settle,
  signIn,
} from '../../testing/api-testing';
import { ExtensionStore } from './extension.store';

describe('ExtensionStore', () => {
  let http: HttpTestingController;
  let ext: ExtensionStore;

  beforeEach(async () => {
    http = provideApiTesting();
    ext = TestBed.inject(ExtensionStore);
    await signIn(http);
  });

  afterEach(() => http.verify());

  it('simulates going offline through the API, then reloads the posts', async () => {
    expect(ext.online()).toBe(true);
    const done = ext.toggleOnline();
    const req = http.expectOne(`/api/workspaces/${WS}/engine/extension`);
    expect(req.request.body).toEqual({ online: false });
    req.flush({ online: false, affected: 4 });
    await settle();
    answerWorkspaceLoads(http);
    await done;
    expect(ext.online()).toBe(false);
  });
});
