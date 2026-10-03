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

const ENGINE = {
  antiBan: {
    min: 3,
    max: 12,
    limits: { fb: 40, x: 20, ig: 10, tt: 5, line: 3, th: 10 },
    typing: true,
    scroll: true,
    shuffle: true,
    autoPause: true,
    warmup: false,
  },
  offline: { policy: 'queue', window: '2h', line: true, email: true, push: false },
};

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
    const done = ext.toggleSimulation();
    const req = http.expectOne(`/api/workspaces/${WS}/engine/extension`);
    expect(req.request.body).toEqual({ online: false });
    req.flush({ online: false, affected: 4 });
    await settle();
    answerWorkspaceLoads(http, { simulatedOffline: true });
    await done;
    expect(ext.online()).toBe(false);
    expect(ext.simulated()).toBe(true);
    expect(ext.unpaired()).toBe(true);
  });

  it('keys "reconnect" on the simulation, not on whether a device really is online', async () => {
    // Devices are paired but none has called in: really offline, no simulation running.
    const first = ext.toggleSimulation();
    http.expectOne(`/api/workspaces/${WS}/engine/extension`).flush({ online: false, affected: 0 });
    await settle();
    for (const r of http.match(`/api/workspaces/${WS}/engine`))
      r.flush({
        ...ENGINE,
        extensionOnline: false,
        simulatedOffline: true,
        devices: 1,
        devicesOnline: 0,
      });
    answerWorkspaceLoads(http);
    await first;
    expect(ext.simulated()).toBe(true);

    // Reconnecting ends the simulation (online: true), and says the device is still offline.
    const second = ext.toggleSimulation();
    const req = http.expectOne(`/api/workspaces/${WS}/engine/extension`);
    expect(req.request.body).toEqual({ online: true });
    req.flush({ online: true, affected: 2 });
    await settle();
    for (const r of http.match(`/api/workspaces/${WS}/engine`))
      r.flush({
        ...ENGINE,
        extensionOnline: false,
        simulatedOffline: false,
        devices: 1,
        devicesOnline: 0,
      });
    answerWorkspaceLoads(http);
    await second;
    expect(ext.simulated()).toBe(false);
    expect(ext.online()).toBe(false);

    // With every device really offline and no simulation, the button starts a simulation again.
    const third = ext.toggleSimulation();
    const req3 = http.expectOne(`/api/workspaces/${WS}/engine/extension`);
    expect(req3.request.body).toEqual({ online: false });
    req3.flush({ online: false, affected: 0 });
    await settle();
    for (const r of http.match(`/api/workspaces/${WS}/engine`))
      r.flush({
        ...ENGINE,
        extensionOnline: false,
        simulatedOffline: true,
        devices: 1,
        devicesOnline: 0,
      });
    answerWorkspaceLoads(http);
    await third;
  });

  it('does not call the unpaired state before the engine has answered', async () => {
    TestBed.resetTestingModule();
    http = provideApiTesting();
    const fresh = TestBed.inject(ExtensionStore);
    expect(fresh.unpaired()).toBe(false); // nothing known yet: no "not paired" flash
  });
});
