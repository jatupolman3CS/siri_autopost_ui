import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { USER, provideApiTesting } from '../../testing/api-testing';
import { assistStorage, tokenStorage } from '../auth/token';
import { SessionStore } from './session.store';

describe('SessionStore', () => {
  let http: HttpTestingController;
  let session: SessionStore;

  beforeEach(() => {
    http = provideApiTesting();
    session = TestBed.inject(SessionStore);
  });

  afterEach(() => http.verify());

  it('keeps the token from login and sends it with later calls', async () => {
    const login = session.logIn(USER.email, 'password1');
    http.expectOne('/api/auth/login').flush({ token: 'abc', expiresAt: '2099-01-01', user: USER });
    await login;
    expect(session.isGuest()).toBe(false);
    expect(tokenStorage.get()).toBe('abc');

    void session.setPlan('agency');
    const req = http.expectOne('/api/auth/me/plan');
    expect(req.request.headers.get('Authorization')).toBe('Bearer abc');
    req.flush({ ...USER, plan: 'agency' });
  });

  it('drops a stored token the server no longer accepts', async () => {
    tokenStorage.set('stale');
    const restore = session.restore();
    http.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });
    await restore;
    expect(session.isGuest()).toBe(true);
    expect(tokenStorage.get()).toBeNull();
  });

  it('assists a customer with their token and comes back to the admin', async () => {
    const admin = { ...USER, id: 'admin-1', role: 'admin' as const };
    const login = session.logIn('admin@autopost.local', 'admin1234');
    http
      .expectOne('/api/auth/login')
      .flush({ token: 'admin-t', expiresAt: '2099-01-01', user: admin });
    await login;

    const start = session.startAssist('u-1');
    http
      .expectOne('/api/admin/customers/u-1/impersonate')
      .flush({ token: 'cust-t', expiresAt: '2099-01-01T01:00:00Z', user: USER });
    await start;
    expect(tokenStorage.get()).toBe('cust-t');
    expect(session.isAdmin()).toBe(false);
    expect(session.assist()).toMatchObject({ customerId: 'u-1', email: USER.email });
    expect(assistStorage.get()?.adminToken).toBe('admin-t');

    const end = session.endAssist();
    const me = http.expectOne('/api/auth/me');
    expect(me.request.headers.get('Authorization')).toBe('Bearer admin-t');
    me.flush(admin);
    expect(await end).toBe('u-1');
    expect(session.isAdmin()).toBe(true);
    expect(session.assist()).toBeNull();
    expect(assistStorage.get()).toBeNull();
  });

  it('falls back to the admin when a stored assist session has expired', async () => {
    // A fresh store, so it reads the stored assist session on creation.
    TestBed.resetTestingModule();
    http = provideApiTesting(); // clears localStorage
    tokenStorage.set('cust-t');
    assistStorage.set({
      adminToken: 'admin-t',
      customerId: 'u-1',
      email: 'x',
      expiresAt: '2000-01-01',
    });
    session = TestBed.inject(SessionStore);

    const restore = session.restore();
    http.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });
    await Promise.resolve();
    await Promise.resolve();
    http.expectOne('/api/auth/me').flush({ ...USER, role: 'admin' });
    await restore;
    expect(session.isAdmin()).toBe(true);
    expect(tokenStorage.get()).toBe('admin-t');
  });
});
