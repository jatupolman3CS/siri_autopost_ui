import { TestBed } from '@angular/core/testing';
import { Router, RouterStateSnapshot, provideRouter } from '@angular/router';
import { HttpTestingController } from '@angular/common/http/testing';
import { USER, provideApiTesting } from '../../testing/api-testing';
import { SessionStore } from '../data/session.store';
import { safeReturnUrl, signedInGuard } from './guards';

describe('signedInGuard', () => {
  let http: HttpTestingController;
  const state = (url: string) => ({ url }) as RouterStateSnapshot;
  const run = (url: string) =>
    TestBed.runInInjectionContext(() => signedInGuard({} as never, state(url)));

  beforeEach(() => {
    http = provideApiTesting({ providers: [provideRouter([])] });
  });

  it('sends a guest to the login page, remembering where they were going', () => {
    const result = run('/app/billing?checkout=success&session_id=cs_1');
    const tree = TestBed.inject(Router).serializeUrl(result as never);
    expect(tree).toBe('/login?returnUrl=%2Fapp%2Fbilling%3Fcheckout%3Dsuccess%26session_id%3Dcs_1');
  });

  it('lets a signed-in user through', async () => {
    const login = TestBed.inject(SessionStore).logIn(USER.email, 'password1');
    http.expectOne('/api/auth/login').flush({ token: 't', expiresAt: '2099-01-01', user: USER });
    await login;
    expect(run('/app/overview')).toBe(true);
  });
});

describe('safeReturnUrl', () => {
  it('keeps addresses inside the app', () => {
    expect(safeReturnUrl('/app/calendar?day=2026-10-03')).toBe('/app/calendar?day=2026-10-03');
    expect(safeReturnUrl('/app')).toBe('/app');
  });

  it('never sends a person to another site or an outside page', () => {
    for (const bad of [
      'https://evil.example/app',
      '//evil.example',
      '/login',
      '/application',
      '',
      null,
      undefined,
    ])
      expect(safeReturnUrl(bad)).toBeNull();
  });
});
