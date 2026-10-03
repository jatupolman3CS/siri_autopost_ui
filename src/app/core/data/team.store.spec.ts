import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiMember } from '../http/api.service';
import { WS, provideApiTesting, settle, signIn } from '../../testing/api-testing';
import { TeamStore } from './team.store';

const OWNER: ApiMember = {
  id: null,
  userId: 'u-1',
  email: 'owner@shop.co',
  name: 'owner',
  role: 'owner',
  active: true,
  lastSeenAt: '2026-10-01T00:00:00Z',
  you: true,
};
const INVITED: ApiMember = {
  id: 'm-1',
  userId: null,
  email: 'new@shop.co',
  name: '',
  role: 'editor',
  active: false,
  lastSeenAt: null,
  you: false,
};

describe('TeamStore', () => {
  let http: HttpTestingController;
  let team: TeamStore;

  beforeEach(async () => {
    http = provideApiTesting();
    team = TestBed.inject(TeamStore);
    await signIn(http);
    http.expectOne(`/api/workspaces/${WS}/members`).flush([OWNER]);
    await settle();
  });

  afterEach(() => http.verify());

  it('loads the members of the current workspace and the caller role', () => {
    expect(team.members()).toEqual([OWNER]);
    expect(team.role()).toBe('owner');
    expect(team.canManage()).toBe(true);
  });

  it('invites, then reloads the members and the workspace counts', async () => {
    const done = team.invite('new@shop.co', 'editor');
    const req = http.expectOne(`/api/workspaces/${WS}/members`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'new@shop.co', role: 'editor' });
    req.flush(INVITED);
    await settle();
    http
      .expectOne((r) => r.method === 'GET' && r.url === `/api/workspaces/${WS}/members`)
      .flush([OWNER, INVITED]);
    http
      .expectOne('/api/workspaces')
      .flush([{ id: WS, name: 'Shop', posts7: 0, members: 2, role: 'owner' }]);
    await done;
    expect(team.members().length).toBe(2);
  });

  it('passes the server refusal to the caller', async () => {
    const done = team.invite('new@shop.co', 'editor');
    http
      .expectOne(`/api/workspaces/${WS}/members`)
      .flush({ title: 'ทีมเต็มแล้ว' }, { status: 422, statusText: 'Unprocessable' });
    await expect(done).rejects.toBeTruthy();
  });

  it('changes a role', async () => {
    const done = team.changeRole('m-1', 'viewer');
    const req = http.expectOne(`/api/workspaces/${WS}/members/m-1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ role: 'viewer' });
    req.flush(null);
    await settle();
    http.expectOne(`/api/workspaces/${WS}/members`).flush([OWNER, { ...INVITED, role: 'viewer' }]);
    await done;
    expect(team.members()[1].role).toBe('viewer');
  });
});
