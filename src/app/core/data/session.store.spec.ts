import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { USER, provideApiTesting } from '../../testing/api-testing';
import { tokenStorage } from '../auth/token';
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
});
